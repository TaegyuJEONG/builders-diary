'use client';

import {
  Portfolio, Project, Goal, Record, NarrativeSection, ImportRun,
  DEFAULT_STAGES, EntryType, normalizeStage,
} from './types';

// Legacy v2 category → v4 stage. Used only when a record has no explicit
// `section` of its own.
const LEGACY_CATEGORY_TO_SECTION: { [k: string]: string } = {
  Planning: 'Discovery',
  Research: 'Discovery',
  Design: 'Build',
  Engineering: 'Build',
  Growth: 'Growth',
};

interface FileSystemDirectoryHandle {
  name: string;
  kind: 'directory';
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  entries(): AsyncIterable<[string, FileSystemHandle]>;
  keys(): AsyncIterable<string>;
  values(): AsyncIterable<FileSystemHandle>;
  [Symbol.asyncIterator](): AsyncIterator<[string, FileSystemHandle]>;
}

interface FileSystemFileHandle {
  name: string;
  kind: 'file';
  getFile(): Promise<File>;
}

type FileSystemHandle = FileSystemDirectoryHandle | FileSystemFileHandle;

export async function selectFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    if (!('showDirectoryPicker' in window)) {
      throw new Error('File System Access API is not supported in this browser');
    }
    const handle = await (window as any).showDirectoryPicker({
      // Open the picker inside Documents — where the npx installer creates
      // builders-diary — so the user just clicks the folder and hits Select.
      id: 'builders-diary-root',
      startIn: 'documents',
    });
    return handle;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      return null;
    }
    throw error;
  }
}

export async function saveFolderHandleToStorage(handle: FileSystemDirectoryHandle): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const idb = indexedDB.open('BuildersDiary', 1);
      idb.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('folderHandles')) {
          db.createObjectStore('folderHandles');
        }
      };
      idb.onsuccess = (e: any) => {
        const db = e.target.result;
        try {
          const transaction = db.transaction('folderHandles', 'readwrite');
          const request = transaction.objectStore('folderHandles').put(handle, 'root');
          request.onsuccess = () => {
            db.close();
            resolve();
          };
          request.onerror = () => {
            db.close();
            reject(request.error);
          };
        } catch (error) {
          db.close();
          reject(error);
        }
      };
      idb.onerror = () => reject(idb.error);
    } catch (error) {
      console.error('Failed to save folder handle:', error);
      reject(error);
    }
  });
}

export async function loadFolderHandleFromStorage(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve) => {
    try {
      const idb = indexedDB.open('BuildersDiary', 1);
      idb.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('folderHandles')) {
          db.createObjectStore('folderHandles');
        }
      };
      idb.onsuccess = (e: any) => {
        const db = e.target.result;
        try {
          const transaction = db.transaction('folderHandles', 'readonly');
          const request = transaction.objectStore('folderHandles').get('root');
          request.onsuccess = () => {
            db.close();
            resolve(request.result || null);
          };
          request.onerror = () => {
            db.close();
            resolve(null);
          };
        } catch (error) {
          db.close();
          resolve(null);
        }
      };
      idb.onerror = () => resolve(null);
    } catch (error) {
      console.error('Failed to load folder handle:', error);
      resolve(null);
    }
  });
}

/**
 * Read the install marker the npx installer drops into the data folder.
 * Returns the parsed marker, or null if this folder wasn't set up by the installer.
 */
export async function readInstallMarker(
  handle: FileSystemDirectoryHandle
): Promise<{ version?: string; tools?: string[] } | null> {
  try {
    const fh = await handle.getFileHandle('.builders-diary.json');
    const file = await fh.getFile();
    return JSON.parse(await file.text());
  } catch {
    return null;
  }
}

export async function verifyFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const permission = await (handle as any).queryPermission?.({ mode: 'read' });
    if (permission === 'granted') {
      return true;
    }
    if (permission === 'prompt') {
      const result = await (handle as any).requestPermission?.({ mode: 'read' });
      return result === 'granted';
    }
    return false;
  } catch (error) {
    console.error('Permission verification failed:', error);
    return false;
  }
}

/**
 * Read-only permission check for polling contexts (no user gesture available).
 * Never calls requestPermission — that would silently fail outside a click handler
 * and break background detection. Returns true only if permission is already granted.
 */
export async function hasFolderPermission(handle: FileSystemDirectoryHandle): Promise<boolean> {
  try {
    const permission = await (handle as any).queryPermission?.({ mode: 'read' });
    return permission === 'granted';
  } catch {
    return false;
  }
}

export async function saveRecordToFile(
  record: {
    file_path: string; title: string; summary?: string; content?: string; result?: string;
    status?: string; updated_at?: string; tags?: string[]; section?: string;
    purpose?: string | null; tools?: string[]; mindset?: string[];
  },
): Promise<void> {
  return new Promise((resolve, reject) => {
    const idb = indexedDB.open('BuildersDiary', 1);
    idb.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('folderHandles')) {
        db.createObjectStore('folderHandles');
      }
    };
    idb.onsuccess = async (e: any) => {
      const db = e.target.result;
      try {
        const tx = db.transaction('folderHandles', 'readonly');
        const req = tx.objectStore('folderHandles').get('root');
        req.onsuccess = async () => {
          db.close();
          const rootHandle: FileSystemDirectoryHandle | null = req.result || null;
          if (!rootHandle) {
            // demo mode — no real file to write; resolve silently
            resolve();
            return;
          }
          try {
            const segments = record.file_path.split('/').filter(Boolean);
            let dir: FileSystemDirectoryHandle = rootHandle;
            for (const seg of segments.slice(0, -1)) {
              dir = await dir.getDirectoryHandle(seg, { create: true });
            }
            const fileName = segments[segments.length - 1];
            const fileHandle = await dir.getFileHandle(fileName, { create: true });
            const writable = await (fileHandle as any).createWritable();

            // record.json is the source of truth. Preserve v3 fields and merge
            // only the editable values; never overwrite JSON with legacy markdown.
            let existing: { [key: string]: any } = {};
            try {
              const current = await fileHandle.getFile();
              const text = await current.text();
              const parsed = JSON.parse(text);
              if (parsed && typeof parsed === 'object') existing = parsed;
            } catch {
              // A missing/legacy file is still writable from the supplied record.
            }
            const updated = {
              ...existing,
              title: record.title,
              body_md: record.content ?? existing.body_md ?? existing.body ?? '',
              body: record.content ?? existing.body ?? '',
              ...(record.summary ? { summary: record.summary } : {}),
              ...(record.result ? { result: record.result } : {}),
              ...(record.status ? { status: record.status } : {}),
              ...(record.updated_at ? { updated_at: record.updated_at } : {}),
              ...(record.tags !== undefined ? { tags: record.tags } : {}),
              ...(record.section !== undefined ? { section: record.section } : {}),
              ...(record.purpose !== undefined ? { purpose: record.purpose } : {}),
              ...(record.tools !== undefined ? { tools: record.tools } : {}),
              ...(record.mindset !== undefined ? { mindset: record.mindset } : {}),
            };
            await writable.write(JSON.stringify(updated, null, 2));
            await writable.close();
            resolve();
          } catch (err) {
            reject(err);
          }
        };
        req.onerror = () => { db.close(); reject(req.error); };
      } catch (err) {
        db.close();
        reject(err);
      }
    };
    idb.onerror = () => reject(idb.error);
  });
}

/** Delete one Task directory. The user-facing caller must confirm first. */
export async function deleteRecordFromFile(filePath: string): Promise<void> {
  const root = await loadFolderHandleFromStorage();
  if (!root) throw new Error('Builder’s Diary folder is not connected');
  const segments = filePath.split('/').filter(Boolean);
  if (segments.length < 4 || segments[segments.length - 1] !== 'record.json') {
    throw new Error('Invalid Builder’s Diary record path');
  }
  let parent = root;
  for (const segment of segments.slice(0, -2)) {
    parent = await parent.getDirectoryHandle(segment);
  }
  await parent.removeEntry(segments[segments.length - 2], { recursive: true });
}

// ── Actual folder structure ──────────────────────────────────────────────────
// ~/builders-diary/
//   {project-slug}/
//     project.json   → { id, slug, title, created_at, ... }
//     {goal-slug}/
//       goal.json    → { id, slug, title, project_slug, ... }
//       {YYYYMMDD}-{seq}-{title-slug}/
//         record.json → { id, folder, title, body, tags, ... }

export async function scanFolderStructure(handle: FileSystemDirectoryHandle): Promise<Portfolio> {
  const projects: Project[] = [];
  const stages = await readStages(handle);

  try {
    for await (const [name, entry] of handle.entries()) {
      // Skip hidden files/folders
      if (name.startsWith('.')) continue;
      if (entry.kind !== 'directory') continue;

      const projectFolder = entry as FileSystemDirectoryHandle;
      const project = await scanProjectFolder(projectFolder, name, stages);
      if (project) projects.push(project);
    }
  } catch (error) {
    console.error('Error scanning folder:', error);
  }

  // User-defined order wins; unranked projects fall back to recency.
  projects.sort((a, b) =>
    (a.order ?? 999) - (b.order ?? 999)
    || (b.created_at || '').localeCompare(a.created_at || '')
  );

  return { path: handle.name, projects, stages };
}

/** Read the builder's editable stage list (stages.json), else the defaults. */
export async function readStages(handle: FileSystemDirectoryHandle): Promise<string[]> {
  try {
    const fh = await handle.getFileHandle('stages.json');
    const parsed = JSON.parse(await (await fh.getFile()).text());
    const raw = Array.isArray(parsed) ? parsed : parsed?.stages;
    const names: string[] = [];
    for (const item of Array.isArray(raw) ? raw : []) {
      const name = String(typeof item === 'string' ? item : item?.name ?? '').trim();
      if (name && !names.some(n => n.toLowerCase() === name.toLowerCase())) names.push(name);
    }
    return names.length ? names : [...DEFAULT_STAGES];
  } catch {
    return [...DEFAULT_STAGES];
  }
}

/** Persist an edited stage list back to the connected folder. */
export async function writeStages(handle: FileSystemDirectoryHandle, stages: string[]): Promise<void> {
  const fh = await handle.getFileHandle('stages.json', { create: true });
  const writable = await (fh as any).createWritable();
  await writable.write(JSON.stringify({ stages: stages.map(name => ({ name })) }, null, 2) + '\n');
  await writable.close();
}

function slugifyForPath(value: string): string {
  return (value || '').trim().toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]/gu, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'untitled';
}

async function writeJsonFile(folder: FileSystemDirectoryHandle, name: string, value: unknown): Promise<void> {
  const fh = await folder.getFileHandle(name, { create: true });
  const writable = await (fh as any).createWritable();
  await writable.write(JSON.stringify(value, null, 2) + '\n');
  await writable.close();
}

/** Create a Project or Learning entry directly from the web UI. */
export async function createProjectInFolder(input: {
  name: string; type?: EntryType; sector?: string; oneLiner?: string; logo?: string;
}): Promise<void> {
  const root = await loadFolderHandleFromStorage();
  if (!root) throw new Error('Builder’s Diary folder is not connected');
  const name = input.name.trim();
  if (!name) throw new Error('Project name is required');
  const slug = slugifyForPath(name);
  const folder = await root.getDirectoryHandle(slug, { create: true });
  const existing = await readJson(folder, 'project.json');
  if (existing?.id) throw new Error('A project with this name already exists');
  const now = new Date().toISOString();
  await writeJsonFile(folder, 'project.json', {
    id: `p-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    slug, title: name, name, type: input.type || 'project',
    sector: input.sector || undefined,
    one_liner: input.oneLiner || undefined,
    logo: input.logo || undefined,
    created_at: now, updated_at: now, share_id: null,
  });
}

/** Update metadata/order for an existing Project without touching its Tasks. */
export async function updateProjectInFolder(project: Project): Promise<void> {
  const root = await loadFolderHandleFromStorage();
  if (!root) throw new Error('Builder’s Diary folder is not connected');
  const folder = await root.getDirectoryHandle(project.slug);
  const existing = await readJson(folder, 'project.json') || {};
  await writeJsonFile(folder, 'project.json', {
    ...existing,
    title: project.title || project.name || project.slug,
    name: project.name || project.title || project.slug,
    type: project.type || 'project',
    sector: project.sector || '',
    one_liner: project.oneLiner || '',
    logo: project.logo || null,
    order: project.order,
    updated_at: new Date().toISOString(),
  });
}

export async function deleteProjectFromFolder(slug: string): Promise<void> {
  const root = await loadFolderHandleFromStorage();
  if (!root) throw new Error('Builder’s Diary folder is not connected');
  if (!slug || slug.startsWith('.') || slug.includes('/')) throw new Error('Invalid project slug');
  await root.removeEntry(slug, { recursive: true });
}

/** Create a minimal Task. The user can enrich every field in the detail editor. */
export async function createTaskInFolder(input: {
  project: Project; purposeName: string; stage: string; title: string;
}): Promise<void> {
  const root = await loadFolderHandleFromStorage();
  if (!root) throw new Error('Builder’s Diary folder is not connected');
  const title = input.title.trim();
  const purposeName = input.purposeName.trim();
  if (!title || !purposeName || !input.stage) throw new Error('Title, Purpose, and Stage are required');
  const projectFolder = await root.getDirectoryHandle(input.project.slug);
  const purposeSlug = slugifyForPath(purposeName);
  const purposeFolder = await projectFolder.getDirectoryHandle(purposeSlug, { create: true });
  let goal = await readJson(purposeFolder, 'goal.json');
  const now = new Date().toISOString();
  if (!goal?.id) {
    goal = {
      id: `g-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
      slug: purposeSlug, title: purposeName, project_slug: input.project.slug,
      created_at: now, updated_at: now, share_id: null,
    };
    await writeJsonFile(purposeFolder, 'goal.json', goal);
  }
  const date = now.slice(0, 10);
  const stamp = date.replace(/-/g, '');
  let seq = 0;
  for await (const [name, entry] of purposeFolder.entries()) {
    if (entry.kind === 'directory' && /^\d{8}-\d{3}-/.test(name)) seq += 1;
  }
  const recordFolderName = `${stamp}-${String(seq).padStart(3, '0')}-${slugifyForPath(title)}`;
  const recordFolder = await purposeFolder.getDirectoryHandle(recordFolderName, { create: true });
  await writeJsonFile(recordFolder, 'record.json', {
    id: `r-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    folder: recordFolderName, title, date, section: input.stage,
    purpose: purposeName, tags: [], tools: [], mindset: [], progress: null,
    body_md: '', body: '', highlight: null, judgment: null, evidence: [],
    project_id: input.project.id, project_slug: input.project.slug,
    project_title: input.project.title, goal_id: goal?.id || undefined,
    goal_slug: purposeSlug, goal_title: purposeName,
    entry_type: input.project.type || 'project',
    created_at: now, updated_at: now, share_id: null,
  });
}

async function readJson(folder: FileSystemDirectoryHandle, fileName: string): Promise<any | null> {
  try {
    const fileHandle = await folder.getFileHandle(fileName);
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** Read private importer run metadata. Raw chats and source indexes are never loaded by the web UI. */
export async function scanImportRuns(handle: FileSystemDirectoryHandle): Promise<ImportRun[]> {
  try {
    const imports = await handle.getDirectoryHandle('imports');
    const runs: ImportRun[] = [];
    for await (const [name, entry] of imports.entries()) {
      if (entry.kind !== 'directory' || name.startsWith('.')) continue;
      const manifest = await readJson(entry as FileSystemDirectoryHandle, 'manifest.json');
      if (!manifest || typeof manifest !== 'object' || !manifest.id) continue;
      runs.push({
        id: String(manifest.id),
        source: String(manifest.source || 'claude'),
        status: String(manifest.status || 'unknown'),
        created_at: String(manifest.created_at || ''),
        counts: manifest.counts || undefined,
        warnings: Array.isArray(manifest.warnings) ? manifest.warnings : [],
      });
    }
    return runs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch {
    return [];
  }
}

async function scanProjectFolder(
  projectFolder: FileSystemDirectoryHandle,
  slug: string,
  stages: string[] = [...DEFAULT_STAGES]
): Promise<Project | null> {
  // Must have project.json to be considered a valid project
  const meta = await readJson(projectFolder, 'project.json');
  if (!meta) return null;

  const goals: Goal[] = [];

  for await (const [name, entry] of projectFolder.entries()) {
    if (name.startsWith('.') || name === 'project.json') continue;
    if (entry.kind !== 'directory') continue;

    const goalFolder = entry as FileSystemDirectoryHandle;
    const goal = await scanGoalFolder(goalFolder, name, stages);
    if (goal) goals.push(goal);
  }

  // Add project/section breadcrumbs to every task so cross-project views remain navigable.
  const enrichedGoals = goals.map(g => ({
    ...g,
    records: g.records.map(r => ({
      ...r,
      projectId: meta.id || `proj-${slug}`,
      projectTitle: meta.title || meta.name || slug,
      goalId: g.id,
      goalTitle: g.title,
    })),
  }));

  // Purposes are workstreams, so they sort by when they started — not by a
  // lifecycle stage, which now lives on each Task.
  enrichedGoals.sort((a, b) =>
    (a.created_at || '').localeCompare(b.created_at || '') || a.title.localeCompare(b.title)
  );

  return {
    id: meta.id || `proj-${slug}`,
    slug: meta.slug || slug,
    title: meta.title || meta.name || slug,
    name: meta.name || meta.title || slug,
    type: (meta.type === 'learning' ? 'learning' : 'project') as EntryType,
    order: typeof meta.order === 'number' ? meta.order : undefined,
    sector: meta.sector || undefined,
    oneLiner: meta.one_liner || undefined,
    role: meta.role || undefined,
    logo: meta.logo || null,
    tags: Array.isArray(meta.tags) ? meta.tags : undefined,
    created_at: meta.created_at,
    goals: enrichedGoals,
  };
}

async function scanGoalFolder(
  goalFolder: FileSystemDirectoryHandle,
  slug: string,
  stages: string[] = [...DEFAULT_STAGES]
): Promise<Goal | null> {
  // Must have goal.json to be considered a valid section
  const meta = await readJson(goalFolder, 'goal.json');
  if (!meta) return null;

  // Pre-v4 goal.json may still carry a `stage`; it is only a fallback for
  // records that have no section of their own. A Purpose has no stage now.
  const legacyGoalStage = meta.stage || '';

  const records: Record[] = [];

  for await (const [name, entry] of goalFolder.entries()) {
    if (name.startsWith('.') || name === 'goal.json') continue;
    if (entry.kind !== 'directory') continue;

    const recordFolder = entry as FileSystemDirectoryHandle;
    const record = await scanRecordFolder(recordFolder, name);
    if (record) {
      // The Task's own stage always wins; legacy records fall back to their old
      // category, then to the pre-v4 goal stage. Everything is normalized into
      // the builder's configured vocabulary.
      const raw = record.section
        || LEGACY_CATEGORY_TO_SECTION[record.category || '']
        || legacyGoalStage
        || 'Build';
      record.section = normalizeStage(raw, stages);
      records.push(record);
    }
  }

  // Sort by folder name (YYYYMMDD-seq-...) ascending
  records.sort((a, b) => (a.folder || '').localeCompare(b.folder || ''));

  return {
    id: meta.id || `goal-${slug}`,
    slug: meta.slug || slug,
    title: meta.title || slug,
    created_at: meta.created_at,
    records,
  };
}

/** Parse markdown into named H2 sections. "## Heading\n body..." → [{heading, body}].
 *  Text before the first H2 becomes an untitled leading block. This is what fixes
 *  the legacy PURPOSE=WORK duplication + raw "##" leakage on old records. */
function parseNarrative(md: string): NarrativeSection[] {
  const text = (md || '').trim();
  if (!text) return [];
  const lines = text.split('\n');
  const out: NarrativeSection[] = [];
  let heading = '';
  let buf: string[] = [];
  const flush = () => {
    const body = buf.join('\n').trim();
    if (heading || body) out.push({ heading, body });
    buf = [];
  };
  for (const line of lines) {
    const m = line.match(/^\s*##\s+(.*)$/);
    if (m) { flush(); heading = m[1].trim(); }
    else buf.push(line);
  }
  flush();
  return out;
}

/** First narrative block's body → a short card summary (no raw "##"). */
function summaryFromNarrative(narrative: NarrativeSection[], fallback: string): string {
  const first = narrative.find(n => n.body) || narrative[0];
  const src = (first?.body || fallback || '').replace(/^#+\s.*$/gm, '').trim();
  return src.slice(0, 200);
}

/** Pull a "Result" narrative block's body, if present, for a one-liner. */
function resultFromNarrative(narrative: NarrativeSection[]): string | undefined {
  const r = narrative.find(n => /result|outcome|결과/i.test(n.heading));
  return r?.body?.trim() || undefined;
}

async function scanRecordFolder(
  recordFolder: FileSystemDirectoryHandle,
  folderName: string
): Promise<Record | null> {
  const meta = await readJson(recordFolder, 'record.json');
  if (!meta) return null;

  // v3 prefers body_md; legacy records only have `body`.
  const body: string = meta.body_md || meta.body || '';
  const narrative = parseNarrative(body);

  // Section is explicit only in v3 records. Legacy category is mapped after
  // the goal is scanned, so old records can be split into lifecycle sections.
  const section = meta.section || undefined;

  // Highlight: v3 `highlight` → legacy `judgment` (string or {ai,builder,why}).
  const highlight = meta.highlight ?? meta.judgment ?? null;

  // Tools / mindset: v3 explicit fields, else empty.
  const tools: string[] = Array.isArray(meta.tools) ? meta.tools : [];
  const mindset: string[] = Array.isArray(meta.mindset) ? meta.mindset : [];

  return {
    id: meta.id || folderName,
    folder: meta.folder || folderName,
    title: meta.title || folderName,
    body,
    narrative,
    // summary/content for UI — summary is now clean (no raw "##" / no dup)
    summary: summaryFromNarrative(narrative, body),
    content: body,
    result: resultFromNarrative(narrative),
    category: meta.category || null,
    // v3 fields
    date: meta.date || (meta.created_at ? meta.created_at.slice(0, 10) : ''),
    section,
    entryType: meta.entry_type === 'learning' ? 'learning' : 'project',
    purpose: meta.purpose || meta.sub_purpose || null,
    subPurpose: meta.purpose || meta.sub_purpose || null,
    tools,
    toolTags: tools,
    mindset,
    mindsetTags: mindset,
    progress: meta.progress || null,
    highlight,
    judgment: highlight,  // keep old field populated for any component still reading it
    evidence: Array.isArray(meta.evidence) ? meta.evidence : [],
    tags: meta.tags || [],
    created_at: meta.created_at || '',
    updated_at: meta.updated_at || meta.created_at || '',
    status: meta.share_id ? 'shared' : 'draft',
    share_id: meta.share_id || null,
    project_slug: meta.project_slug || '',
    goal_slug: meta.goal_slug || '',
    file_path: `${meta.project_slug}/${meta.goal_slug}/${folderName}/record.json`,
  };
}
