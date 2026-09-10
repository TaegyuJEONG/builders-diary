'use client';

import { Portfolio, Project, Goal, Record, NarrativeSection, SECTION_META } from './types';

// Legacy v2 category → v3 lifecycle section. Used only when a record has no
// explicit v3 `section` and its goal.json has no v3 `stage`.
const LEGACY_CATEGORY_TO_SECTION: { [k: string]: string } = {
  Planning: 'Plan',
  Design: 'Build',
  Engineering: 'Build',
  Research: 'Think',
  Growth: 'Ship',
};

interface FileSystemDirectoryHandle {
  name: string;
  kind: 'directory';
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
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
  record: { file_path: string; title: string; summary?: string; content?: string; result?: string; status?: string; updated_at?: string; tags?: string[] },
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
              ...(record.tags ? { tags: record.tags } : {}),
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

  try {
    for await (const [name, entry] of handle.entries()) {
      // Skip hidden files/folders
      if (name.startsWith('.')) continue;
      if (entry.kind !== 'directory') continue;

      const projectFolder = entry as FileSystemDirectoryHandle;
      const project = await scanProjectFolder(projectFolder, name);
      if (project) projects.push(project);
    }
  } catch (error) {
    console.error('Error scanning folder:', error);
  }

  // Sort projects by created_at descending
  projects.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));

  return { path: handle.name, projects };
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

async function scanProjectFolder(
  projectFolder: FileSystemDirectoryHandle,
  slug: string
): Promise<Project | null> {
  // Must have project.json to be considered a valid project
  const meta = await readJson(projectFolder, 'project.json');
  if (!meta) return null;

  const goals: Goal[] = [];

  for await (const [name, entry] of projectFolder.entries()) {
    if (name.startsWith('.') || name === 'project.json') continue;
    if (entry.kind !== 'directory') continue;

    const goalFolder = entry as FileSystemDirectoryHandle;
    const goal = await scanGoalFolder(goalFolder, name);
    if (goal) goals.push(...expandGoalSections(goal));
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

  enrichedGoals.sort((a, b) => {
    const ao = a.order ?? 999, bo = b.order ?? 999;
    if (ao !== bo) return ao - bo;
    return (a.created_at || '').localeCompare(b.created_at || '');
  });

  return {
    id: meta.id || `proj-${slug}`,
    slug: meta.slug || slug,
    title: meta.title || meta.name || slug,
    name: meta.name || meta.title || slug,
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
  slug: string
): Promise<Goal | null> {
  // Must have goal.json to be considered a valid section
  const meta = await readJson(goalFolder, 'goal.json');
  if (!meta) return null;

  // A v3 goal.json has `stage`. Legacy goal.json stores a human goal title,
  // so leave stage empty and derive each record's lifecycle section from its
  // legacy category below.
  const explicitStage = meta.stage || '';

  const records: Record[] = [];

  for await (const [name, entry] of goalFolder.entries()) {
    if (name.startsWith('.') || name === 'goal.json') continue;
    if (entry.kind !== 'directory') continue;

    const recordFolder = entry as FileSystemDirectoryHandle;
    const record = await scanRecordFolder(recordFolder, name);
    if (record) {
      // v3 record.section wins. Legacy records derive their lifecycle stage
      // from the old category (Research→Think, Planning→Plan, etc.).
      if (!record.section) {
        record.section = explicitStage || LEGACY_CATEGORY_TO_SECTION[record.category || ''] || 'Build';
      }
      records.push(record);
    }
  }

  // Sort by folder name (YYYYMMDD-seq-...) ascending
  records.sort((a, b) => (a.folder || '').localeCompare(b.folder || ''));

  const stage = explicitStage || (records.length === 1 ? records[0].section : undefined);
  const order = typeof meta.order === 'number'
    ? meta.order
    : (SECTION_META[stage as string]?.order ?? 999);

  return {
    id: meta.id || `goal-${slug}`,
    slug: meta.slug || slug,
    title: meta.title || slug,
    stage,
    order,
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

function expandGoalSections(goal: Goal): Goal[] {
  const groups = new Map<string, Record[]>();
  for (const record of goal.records) {
    const stage = record.section || goal.stage || 'Build';
    if (!groups.has(stage)) groups.set(stage, []);
    groups.get(stage)!.push(record);
  }
  if (groups.size <= 1) {
    const stage = goal.stage || [...groups.keys()][0] || 'Build';
    return [{
      ...goal,
      stage,
      title: goal.stage ? goal.title : stage,
      order: goal.order ?? SECTION_META[stage]?.order ?? 999,
    }];
  }

  // Legacy goal folders can contain records from multiple old categories.
  // Present them as virtual lifecycle sections without moving files on disk.
  return [...groups.entries()].map(([stage, records]) => ({
    ...goal,
    id: `${goal.id}-${stage.toLowerCase()}`,
    slug: `${goal.slug}-${stage.toLowerCase()}`,
    title: stage,
    stage,
    order: SECTION_META[stage]?.order ?? 999,
    records,
  }));
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
