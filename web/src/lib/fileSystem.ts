'use client';

import {
  Portfolio, Project, Goal, Record, NarrativeSection, ImportRun,
  DEFAULT_STAGES, EntryType, normalizeStage, TOOL_CATEGORIES, ToolCategory, ToolCategories,
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

export type ImportClientRoot = { client_id: string; adapter_id: string; path: string };
export type ImportConfig = {
  schema_version?: number;
  enabled_clients?: string[];
  clients?: { [clientId: string]: { enabled?: boolean; adapter_ids?: string[]; roots?: ImportClientRoot[] } };
  source_roots?: ImportClientRoot[];
};

export async function readImportConfig(handle: FileSystemDirectoryHandle): Promise<ImportConfig> {
  try {
    const imports = await handle.getDirectoryHandle('imports');
    const fh = await imports.getFileHandle('config.json');
    return JSON.parse(await (await fh.getFile()).text()) as ImportConfig;
  } catch {
    return { schema_version: 1, enabled_clients: ['claude'], source_roots: [] };
  }
}

export async function writeImportConfig(handle: FileSystemDirectoryHandle, config: ImportConfig): Promise<void> {
  const imports = await handle.getDirectoryHandle('imports', { create: true });
  const fh = await imports.getFileHandle('config.json', { create: true });
  const writable = await (fh as any).createWritable();
  await writable.write(JSON.stringify(config, null, 2) + '\n');
  await writable.close();
}

/**
 * Read the install marker the npx installer drops into the data folder.
 * Returns the parsed marker, or null if this folder wasn't set up by the installer.
 */
export async function readInstallMarker(
  handle: FileSystemDirectoryHandle
): Promise<{ version?: string; tools?: string[]; import_sources?: string[]; source_roots?: ImportClientRoot[]; enabled_clients?: string[]; clients?: { [clientId: string]: { enabled?: boolean; adapter_ids?: string[]; roots?: ImportClientRoot[] } } } | null> {
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
    purpose?: string | null; tools?: string[]; toolCategories?: Partial<ToolCategories>; mindset?: string[]; activities?: string[]; order?: number;
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
              ...(record.toolCategories !== undefined ? { tool_categories: record.toolCategories } : {}),
              ...(record.mindset !== undefined ? { mindset: record.mindset } : {}),
              ...(record.activities !== undefined ? { activities: record.activities } : {}),
              ...(record.order !== undefined ? { order: record.order } : {}),
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

  // User-defined order wins. Legacy projects without an order are appended
  // chronologically after the explicitly ordered projects.
  const maxExplicitOrder = projects.reduce((max, project) => (
    typeof project.order === 'number' ? Math.max(max, project.order) : max
  ), -1);
  const unrankedOrder = new Map(
    projects
      .filter(project => typeof project.order !== 'number')
      .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
      .map((project, index) => [project.id, maxExplicitOrder + 1 + index])
  );
  projects.sort((a, b) => {
    const aOrder = typeof a.order === 'number' ? a.order : unrankedOrder.get(a.id) ?? 999999;
    const bOrder = typeof b.order === 'number' ? b.order : unrankedOrder.get(b.id) ?? 999999;
    return aOrder - bOrder;
  });

  return { path: handle.name, projects, stages };
}

/** Read and clean an ordered stage list from project metadata or a fallback. */
export function readProjectStages(raw: unknown, fallback: string[] = [...DEFAULT_STAGES]): string[] {
  const value = raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as { stages?: unknown }).stages
    : raw;
  const names: string[] = [];
  for (const item of Array.isArray(value) ? value : []) {
    const name = String(typeof item === 'string' ? item : (item as { name?: unknown })?.name ?? '').trim();
    if (name && !names.some(existing => existing.toLowerCase() === name.toLowerCase())) names.push(name);
  }
  return names.length ? names : [...fallback];
}

/** Read the builder's default stage template (stages.json), else the defaults. */
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
  name: string; type?: EntryType; sector?: string; oneLiner?: string; logo?: string; order?: number; stages?: string[];
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
  const stages = readProjectStages(input.stages, await readStages(root));
  await writeJsonFile(folder, 'project.json', {
    id: `p-${crypto.randomUUID().replace(/-/g, '').slice(0, 8)}`,
    slug, title: name, name, type: input.type || 'project',
    stages,
    sector: input.sector || undefined,
    one_liner: input.oneLiner || undefined,
    logo: input.logo || undefined,
    created_at: now, updated_at: now, share_id: null,
    ...(typeof input.order === 'number' ? { order: input.order } : {}),
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
    ...(Array.isArray(project.stages) ? { stages: project.stages } : {}),
    updated_at: new Date().toISOString(),
  });
}

/** Persist only the selected project's stage list. */
export async function updateProjectStagesInFolder(projectSlug: string, stages: string[]): Promise<void> {
  if (!projectSlug || projectSlug.startsWith('.') || projectSlug.includes('/')) {
    throw new Error('Invalid project slug');
  }
  const root = await loadFolderHandleFromStorage();
  if (!root) throw new Error('Builder’s Diary folder is not connected');
  const folder = await root.getDirectoryHandle(projectSlug);
  const existing = await readJson(folder, 'project.json') || {};
  const cleaned = readProjectStages(stages, []);
  if (!cleaned.length) throw new Error('Keep at least one stage.');
  await writeJsonFile(folder, 'project.json', {
    ...existing,
    stages: cleaned,
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
  project: Project; purposeName: string; stage: string; title: string; activities?: string[];
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
    purpose: purposeName, activities: input.activities || [], tags: [], tools: [], mindset: [],
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
        phase: manifest.phase,
        project_progress: Array.isArray(manifest.project_progress) ? manifest.project_progress : [],
        pause_supported: manifest.pause_supported === true,
      });
    }
    return runs.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  } catch {
    return [];
  }
}

/** The proposal the import skill writes for a run: candidates the user can pick. */
export interface ImportCandidate {
  id: string;
  name: string;
  source: string;
  source_refs: string[];
  description?: string;
  /** Evidence line written by the agent when it attaches sources (assign-sources). */
  summary?: string;
  /** The user's own project intent text from Claude's export. */
  prompt_template?: string;
  /** Claude's built-in example project — never the user's own work. */
  is_starter_project?: boolean;
  doc_count?: number;
  session_count?: number | null;
}

/** Read the latest run's project candidates (metadata only — never raw chats). */
export async function readProjectCandidates(handle: FileSystemDirectoryHandle): Promise<{ runId: string; candidates: ImportCandidate[] } | null> {
  try {
    const imports = await handle.getDirectoryHandle('imports');
    const runs: string[] = [];
    for await (const [name, entry] of imports.entries()) {
      if (entry.kind === 'directory' && !name.startsWith('.')) runs.push(name);
    }
    runs.sort().reverse();
    for (const runId of runs) {
      const runDir = await imports.getDirectoryHandle(runId);
      const manifest = await readJson(runDir, 'manifest.json');
      if (!manifest || manifest.status === 'source_task_curation') continue;
      const candidates = await readJson(runDir, 'project-candidates.json');
      if (!candidates) continue;
      return {
        runId,
        candidates: (Array.isArray(candidates.candidates) ? candidates.candidates : []).map((c: any) => ({
          id: String(c.id),
          name: String(c.name || ''),
          source: String(c.source || ''),
          source_refs: Array.isArray(c.source_refs) ? c.source_refs : [],
          description: c.description || undefined,
          summary: c.summary || undefined,
          prompt_template: c.prompt_template || undefined,
          is_starter_project: c.is_starter_project === true,
          doc_count: typeof c.doc_count === 'number' ? c.doc_count : 0,
          session_count: typeof c.session_count === 'number' ? c.session_count : null,
        })),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export interface ImportSourcePreview {
  title: string;
  summary?: string;
  first_prompt?: string;
  created_at?: string | null;
  message_count?: number;
}

export interface ImportProposalProject {
  id: string;
  classification: 'project';
  name: string;
  summary: string;
  source_refs: string[];
  candidate_ids: string[];
  chat: ImportSourcePreview[];
  claude_code: ImportSourcePreview[];
}

export interface ImportDedupReport {
  exact_duplicates: { canonical_source_ref: string; duplicate_source_refs: string[] }[];
  merge_candidates: { source_refs: string[]; score: number; status: 'candidate' }[];
}

export interface EvidenceCandidate {
  id: string;
  kind: string;
  label: string;
  url?: string;
  meta?: string;
  detail?: string;
  quote?: string;
  verified: boolean;
  visibility?: 'private' | 'public' | 'approved' | 'unverified';
  visibility_options?: string[];
}

export interface TaskProposal {
  id: string;
  source_ref: string;
  project: string;
  purpose: string;
  stage: string;
  title: string;
  date: string;
  activities: string[];
  task_aim: string;
  tools: string[];
  tool_categories: Partial<ToolCategories>;
  mindset: string[];
  body: string;
  highlight: TaskApproval['highlight'];
  evidence_candidates: EvidenceCandidate[];
  status: 'pending' | 'approved' | 'dropped';
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(item => typeof item === 'string').map(String) : [];
}

function normalizeTaskProposal(raw: any, fallbackId: string): TaskProposal | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = String(raw.id || raw.proposal_id || fallbackId).trim();
  const title = String(raw.title || '').trim();
  if (!id || !title) return null;
  return {
    id,
    source_ref: String(raw.source_ref || raw.source || '').trim(),
    project: String(raw.project || raw.project_name || '').trim(),
    purpose: String(raw.purpose || raw.goal || '').trim(),
    stage: String(raw.stage || '').trim(),
    title,
    date: String(raw.date || raw.source_date || '').trim(),
    activities: strings(raw.activities || raw.activity),
    task_aim: String(raw.task_aim || raw.aim || raw.purpose_text || '').trim(),
    tools: strings(raw.tools),
    tool_categories: normalizeToolCategories(raw.tool_categories || raw.toolCategories),
    mindset: strings(raw.mindset),
    body: String(raw.body || raw.summary || '').trim(),
    highlight: raw.highlight && (typeof raw.highlight === 'string' || typeof raw.highlight === 'object') ? raw.highlight : null,
    evidence_candidates: Array.isArray(raw.evidence_candidates)
      ? raw.evidence_candidates.filter((item: any) => item && typeof item === 'object' && typeof item.label === 'string' && Object.entries(item).every(([key, value]) => ['id', 'kind', 'label', 'url', 'meta', 'detail', 'quote', 'visibility', 'visibility_options', 'verified'].includes(key) && (typeof value === 'string' || typeof value === 'boolean' || Array.isArray(value))))
          .map((item: any, index: number) => ({ id: String(item.id || `evidence-${index + 1}`), kind: String(item.kind || item.type || 'file'), label: String(item.label), ...(typeof item.url === 'string' ? { url: item.url } : {}), ...(typeof item.meta === 'string' ? { meta: item.meta } : {}), ...(typeof item.detail === 'string' ? { detail: item.detail } : {}), ...(typeof item.quote === 'string' ? { quote: item.quote } : {}), verified: item.verified === true, visibility: ['private', 'public', 'approved', 'unverified'].includes(item.visibility) ? item.visibility : 'private', visibility_options: Array.isArray(item.visibility_options) ? item.visibility_options.filter((value: any) => typeof value === 'string') : ['private', 'public'] }))
      : [],
    status: raw.status === 'approved' || raw.status === 'dropped' ? raw.status : 'pending',
  };
}

function normalizeToolCategories(raw: any): Partial<ToolCategories> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const result: Partial<ToolCategories> = {};
  for (const category of TOOL_CATEGORIES) {
    if (Array.isArray(raw[category])) result[category] = raw[category].filter((item: any) => typeof item === 'string').map((item: string) => item.trim()).filter(Boolean);
  }
  return result;
}

/** Read only normalized, agent-written Task proposal files from the latest import run. */
export async function readTaskProposals(handle: FileSystemDirectoryHandle): Promise<{ runId: string; proposals: TaskProposal[] } | null> {
  try {
    const imports = await handle.getDirectoryHandle('imports');
    const runs: string[] = [];
    for await (const [name, entry] of imports.entries()) {
      if (entry.kind === 'directory' && !name.startsWith('.')) runs.push(name);
    }
    runs.sort().reverse();
    for (const runId of runs) {
      const runDir = await imports.getDirectoryHandle(runId);
      const proposalsDir = await runDir.getDirectoryHandle('task-proposals');
      const proposals: TaskProposal[] = [];
      for await (const [name, entry] of proposalsDir.entries()) {
        if (entry.kind !== 'file' || !name.endsWith('.json') || name.startsWith('.')) continue;
        const proposal = normalizeTaskProposal(await readJson(proposalsDir, name), name.slice(0, -5));
        if (proposal) proposals.push(proposal);
      }
      return { runId, proposals: proposals.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title)) };
    }
    return null;
  } catch {
    return null;
  }
}

/** Read only the agent-classified project proposal. Raw discovery is deliberately not UI input. */
export async function readProjectProposal(handle: FileSystemDirectoryHandle): Promise<{ runId: string; status: 'draft' | 'finalized'; projects: ImportProposalProject[]; dedupReport: ImportDedupReport } | null> {
  try {
    const imports = await handle.getDirectoryHandle('imports');
    const runs: string[] = [];
    for await (const [name, entry] of imports.entries()) {
      if (entry.kind === 'directory' && !name.startsWith('.')) runs.push(name);
    }
    runs.sort().reverse();
    for (const runId of runs) {
      const runDir = await imports.getDirectoryHandle(runId);
      const manifest = await readJson(runDir, 'manifest.json');
      if (!manifest || manifest.status === 'source_task_curation') continue;
      const proposal = await readJson(runDir, 'project-proposal.json');
      const rawDedup = await readJson(runDir, 'dedup-report.json');
      const dedupReport: ImportDedupReport = {
        exact_duplicates: Array.isArray(rawDedup?.exact_duplicates) ? rawDedup.exact_duplicates : [],
        merge_candidates: Array.isArray(rawDedup?.merge_candidates) ? rawDedup.merge_candidates : [],
      };
      if (!proposal) return { runId, status: 'draft', projects: [], dedupReport };
      const status = proposal.status === 'finalized' ? 'finalized' : 'draft';
      const projects = Array.isArray(proposal.projects) ? proposal.projects : [];
      return {
        runId,
        status,
        dedupReport,
        projects: projects
          .filter((project: any) => project && project.classification === 'project')
          .map((project: any) => ({
            id: String(project.id),
            classification: 'project' as const,
            name: String(project.name || ''),
            summary: String(project.summary || ''),
            source_refs: Array.isArray(project.source_refs) ? project.source_refs.map(String) : [],
            candidate_ids: Array.isArray(project.candidate_ids) ? project.candidate_ids.map(String) : [],
            chat: Array.isArray(project.chat) ? project.chat.map((source: any) => ({
              title: String(source.title || 'Untitled Chat'), summary: source.summary || undefined,
              created_at: source.created_at || undefined, message_count: typeof source.message_count === 'number' ? source.message_count : undefined,
            })) : [],
            claude_code: Array.isArray(project.claude_code) ? project.claude_code.map((source: any) => ({
              title: String(source.title || 'Untitled Claude Code session'), first_prompt: source.first_prompt || undefined,
              created_at: source.created_at || undefined,
            })) : [],
          })),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export interface ProjectEnrichmentProposal {
  project_id: string;
  project_slug: string;
  name: string;
  sector: string;
  one_liner: string;
  status: 'pending' | 'approved';
}

export async function readProjectEnrichmentProposals(handle: FileSystemDirectoryHandle): Promise<{ runId: string; proposals: ProjectEnrichmentProposal[] } | null> {
  try {
    const imports = await handle.getDirectoryHandle('imports');
    const runs: string[] = [];
    for await (const [name, entry] of imports.entries()) if (entry.kind === 'directory' && !name.startsWith('.')) runs.push(name);
    runs.sort().reverse();
    for (const runId of runs) {
      const runDir = await imports.getDirectoryHandle(runId);
      const data = await readJson(runDir, 'project-enrichment-proposals.json');
      if (!data) continue;
      return { runId, proposals: Array.isArray(data.proposals) ? data.proposals.filter((item: any) => item?.project_id && item.status !== 'approved').map((item: any) => ({
        project_id: String(item.project_id), project_slug: String(item.project_slug || ''), name: String(item.name || ''), sector: String(item.sector || ''), one_liner: String(item.one_liner || ''), status: 'pending' as const,
      })) : [] };
    }
    return null;
  } catch { return null; }
}

export async function writeProjectLogoAction(handle: FileSystemDirectoryHandle, projectId: string, file: File): Promise<void> {
  const allowed = new Set(['image/png', 'image/jpeg', 'image/webp']);
  if (!allowed.has(file.type)) throw new Error('Choose a PNG, JPEG, or WebP image.');
  if (file.size > 5 * 1024 * 1024) throw new Error('Logo must be 5 MB or smaller.');
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  const dataBase64 = btoa(binary);
  const actions = await handle.getDirectoryHandle('actions', { create: true });
  const actionFile = await actions.getFileHandle('project-logo.json', { create: true });
  const writable = await (actionFile as any).createWritable();
  await writable.write(JSON.stringify({ schema_version: 1, action_id: crypto.randomUUID(), action: 'project.logo', run_id: 'logo', created_at: new Date().toISOString(), payload: { project_id: projectId.trim(), mime: file.type, filename: file.name.split(/[\\\\/]/).pop() || 'logo', data_base64: dataBase64 } }, null, 2) + '\\n');
  await writable.close();
}

export async function waitForProjectLogoResult(handle: FileSystemDirectoryHandle, timeoutMs = 900000): Promise<{ status: string; project_id?: string; logo?: string; error?: string } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const result = await readJson(await handle.getDirectoryHandle('results'), 'project-logo.json');
      if (result) return result.result && typeof result.result === 'object' ? { ...result, ...result.result } : result;
    } catch { /* helper may not have written it yet */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { status: 'timeout', error: 'The local logo was not applied in time.' };
}


export async function writeProjectEnrichAction(handle: FileSystemDirectoryHandle, runId: string, projectId: string, sector: string, oneLiner: string): Promise<void> {
  if (!projectId.trim() || !sector.trim() || !oneLiner.trim()) throw new Error('Project identifier, sector, and one-line story are required.');
  const runDir = await (await handle.getDirectoryHandle('imports')).getDirectoryHandle(runId);
  const file = await (await runDir.getDirectoryHandle('actions', { create: true })).getFileHandle('project-enrich.json', { create: true });
  const writable = await (file as any).createWritable();
  await writable.write(JSON.stringify({ schema_version: 1, action_id: crypto.randomUUID(), action: 'project.enrich', run_id: runId, created_at: new Date().toISOString(), payload: { project_id: projectId.trim(), sector: sector.trim(), one_liner: oneLiner.trim() } }, null, 2) + '\n');
  await writable.close();
}

export async function waitForProjectEnrichResult(handle: FileSystemDirectoryHandle, runId: string, timeoutMs = 900000): Promise<{ status: string; project_id?: string; error?: string } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const runDir = await (await handle.getDirectoryHandle('imports')).getDirectoryHandle(runId);
      const result = await readJson(await runDir.getDirectoryHandle('results'), 'project-enrich.json');
      if (result) return result;
    } catch { /* helper may not have written it */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { status: 'timeout', error: 'Project enrichment was not applied in time.' };
}

export interface ChatViewEntry {
  title: string;
  summary: string;
  created_at?: string | null;
  message_count: number;
  pages: string[];
}

export async function readChatView(handle: FileSystemDirectoryHandle, runId: string, projectId: string): Promise<{ chats: ChatViewEntry[]; errors: Array<{ title: string; message: string }> } | null> {
  try {
    const imports = await handle.getDirectoryHandle('imports');
    const runDir = await imports.getDirectoryHandle(runId);
    const view = await readJson(runDir, 'chat-view.json');
    if (!view) return null;
    const chats = view.projects?.[projectId];
    return {
      chats: Array.isArray(chats) ? chats : [],
      errors: Array.isArray(view.errors) ? view.errors.filter((error: any) => error.project_id === projectId) : [],
    };
  } catch (error) {
    return { chats: [], errors: [{ title: 'Chat viewer', message: error instanceof Error ? error.message : 'Unable to read Chat viewer files.' }] };
  }
}

export async function readChatPage(handle: FileSystemDirectoryHandle, runId: string, pagePath: string): Promise<{ messages: Array<{ sender: string; text: string; created_at?: string | null }> } | null> {
  try {
    const imports = await handle.getDirectoryHandle('imports');
    const runDir = await imports.getDirectoryHandle(runId);
    const segments = pagePath.split('/').filter(Boolean);
    let directory = runDir;
    for (const segment of segments.slice(0, -1)) directory = await directory.getDirectoryHandle(segment);
    return await readJson(directory, segments[segments.length - 1]);
  } catch {
    return null;
  }
}

export async function writeProjectConfirmAction(handle: FileSystemDirectoryHandle, runId: string, projects: unknown[]): Promise<void> {
  const imports = await handle.getDirectoryHandle('imports');
  const runDir = await imports.getDirectoryHandle(runId);
  const actions = await runDir.getDirectoryHandle('actions', { create: true });
  const file = await actions.getFileHandle('project-confirm.json', { create: true });
  const writable = await (file as any).createWritable();
  await writable.write(JSON.stringify({ action: 'project.confirm', run_id: runId, projects }, null, 2) + '\n');
  await writable.close();
}

/** Declarative Task fields the web may send to the active import helper.
 * The helper validates this again; the browser never chooses a command or path. */
export interface TaskApproval {
  proposal_id?: string;
  project: string;
  goal: string;
  stage: string;
  title: string;
  date: string;
  activity: string[];
  purpose: string;
  tools: string[];
  tool_categories?: Partial<ToolCategories>;
  mindset: string[];
  body: string;
  evidence: Array<{ candidate_id?: string; type?: string; kind?: string; label?: string; url?: string; meta?: string; detail?: string; quote?: string; visibility?: string; verified?: boolean }>;
  highlight: string | { ai?: string; builder?: string; why?: string } | null;
}

/** Write a run-scoped approval request. The Python helper is the sole portfolio writer. */
export async function writeTaskApproveAction(handle: FileSystemDirectoryHandle, runId: string, task: TaskApproval): Promise<void> {
  const imports = await handle.getDirectoryHandle('imports');
  const runDir = await imports.getDirectoryHandle(runId);
  const actions = await runDir.getDirectoryHandle('actions', { create: true });
  const file = await actions.getFileHandle('task-approve.json', { create: true });
  const writable = await (file as any).createWritable();
  const allowedTask = {
    ...(task.proposal_id ? { proposal_id: task.proposal_id } : {}),
    project: task.project, goal: task.goal, stage: task.stage, title: task.title, date: task.date,
    activity: task.activity, purpose: task.purpose, tools: task.tools, tool_categories: task.tool_categories || {}, mindset: task.mindset,
    body: task.body, evidence: task.evidence, highlight: task.highlight,
  };
  await writable.write(JSON.stringify({ schema_version: 1, action_id: crypto.randomUUID(), action: 'task.approve', run_id: runId, created_at: new Date().toISOString(), payload: { task: allowedTask } }, null, 2) + '\n');
  await writable.close();
}

export async function writeTaskDropAction(handle: FileSystemDirectoryHandle, runId: string, proposalId: string): Promise<void> {
  if (!proposalId.trim() || proposalId.includes('/') || proposalId.includes('\\')) throw new Error('Invalid task proposal id');
  const imports = await handle.getDirectoryHandle('imports');
  const runDir = await imports.getDirectoryHandle(runId);
  const actions = await runDir.getDirectoryHandle('actions', { create: true });
  const file = await actions.getFileHandle('task-drop.json', { create: true });
  const writable = await (file as any).createWritable();
  await writable.write(JSON.stringify({ schema_version: 1, action_id: crypto.randomUUID(), action: 'task.drop', run_id: runId, created_at: new Date().toISOString(), payload: { proposal_id: proposalId } }, null, 2) + '\n');
  await writable.close();
}

export async function waitForTaskActionResult(handle: FileSystemDirectoryHandle, runId: string, action: 'approve' | 'drop', timeoutMs = 900000): Promise<{ status: string; result?: { [key: string]: unknown }; error?: string } | null> {
  const started = Date.now();
  const resultName = action === 'approve' ? 'task-approve.json' : 'task-drop.json';
  while (Date.now() - started < timeoutMs) {
    try {
      const imports = await handle.getDirectoryHandle('imports');
      const runDir = await imports.getDirectoryHandle(runId);
      const result = await readJson(await runDir.getDirectoryHandle('results'), resultName);
      if (result) return result;
    } catch { /* helper may not have created the result directory yet */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { status: 'timeout', error: 'The applying session is not connected. In the Claude Code import chat, type: save done' };
}

export async function waitForProjectConfirmResult(handle: FileSystemDirectoryHandle, runId: string, timeoutMs = 900000): Promise<{ status: string; confirmed?: string[]; error?: string } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const imports = await handle.getDirectoryHandle('imports');
      const runDir = await imports.getDirectoryHandle(runId);
      const result = await readJson(runDir, 'results/project-confirm.json');
      if (result) return result;
    } catch { /* helper may not have created the result directory yet */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { status: 'timeout', error: 'The applying session is not connected. In the Claude Code import chat, type: save done' };
}

export async function writeProjectMergeAction(handle: FileSystemDirectoryHandle, runId: string, targetSlug: string, sourceSlug: string): Promise<void> {
  if (!targetSlug.trim() || !sourceSlug.trim() || targetSlug === sourceSlug || /[./\\\\]/.test(targetSlug) || /[./\\\\]/.test(sourceSlug)) {
    throw new Error('Choose two different existing projects.');
  }
  const imports = await handle.getDirectoryHandle('imports');
  const runDir = await imports.getDirectoryHandle(runId);
  const actions = await runDir.getDirectoryHandle('actions', { create: true });
  const file = await actions.getFileHandle('project-merge.json', { create: true });
  const writable = await (file as any).createWritable();
  await writable.write(JSON.stringify({ schema_version: 1, action_id: crypto.randomUUID(), action: 'project.merge', run_id: runId, created_at: new Date().toISOString(), payload: { target_slug: targetSlug, source_slug: sourceSlug } }, null, 2) + '\n');
  await writable.close();
}

export async function waitForProjectMergeResult(handle: FileSystemDirectoryHandle, runId: string, timeoutMs = 900000): Promise<{ status: string; target_slug?: string; source_slug?: string; error?: string } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const imports = await handle.getDirectoryHandle('imports');
      const runDir = await imports.getDirectoryHandle(runId);
      const result = await readJson(await runDir.getDirectoryHandle('results'), 'project-merge.json');
      if (result) return result;
    } catch { /* helper may not have created the result directory yet */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { status: 'timeout', error: 'The project merge was not applied in time.' };
}

export async function writeProjectSplitAction(handle: FileSystemDirectoryHandle, runId: string, sourceSlug: string, newSlug: string, newTitle: string, taskIds: string[], sourceRefs: string[] = []): Promise<void> {
  if (!sourceSlug.trim() || !newSlug.trim() || !newTitle.trim() || sourceSlug === newSlug || /[./\\\\]/.test(sourceSlug) || /[./\\\\]/.test(newSlug)) throw new Error('Choose a new project name and at least one selected Task.');
  if (!taskIds.length && !sourceRefs.length) throw new Error('Select at least one Task or source.');
  const imports = await handle.getDirectoryHandle('imports');
  const runDir = await imports.getDirectoryHandle(runId);
  const actions = await runDir.getDirectoryHandle('actions', { create: true });
  const file = await actions.getFileHandle('project-split.json', { create: true });
  const writable = await (file as any).createWritable();
  await writable.write(JSON.stringify({ schema_version: 1, action_id: crypto.randomUUID(), action: 'project.split', run_id: runId, created_at: new Date().toISOString(), payload: { source_slug: sourceSlug, new_slug: newSlug, new_title: newTitle.trim(), task_ids: taskIds, source_refs: sourceRefs } }, null, 2) + '\\n');
  await writable.close();
}

export async function waitForProjectSplitResult(handle: FileSystemDirectoryHandle, runId: string, timeoutMs = 900000): Promise<{ status: string; new_slug?: string; moved_task_ids?: string[]; error?: string } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const imports = await handle.getDirectoryHandle('imports');
      const runDir = await imports.getDirectoryHandle(runId);
      const result = await readJson(await runDir.getDirectoryHandle('results'), 'project-split.json');
      if (result) return result;
    } catch { /* helper may not have created the result directory yet */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { status: 'timeout', error: 'The project split was not applied in time.' };
}

export async function writeTaskMergeAction(handle: FileSystemDirectoryHandle, runId: string, targetId: string, sourceId: string): Promise<void> {
  if (!targetId.trim() || !sourceId.trim() || targetId === sourceId) throw new Error('Choose two different Tasks.');
  const runDir = await (await handle.getDirectoryHandle('imports')).getDirectoryHandle(runId);
  const file = await (await runDir.getDirectoryHandle('actions', { create: true })).getFileHandle('task-merge.json', { create: true });
  const writable = await (file as any).createWritable();
  await writable.write(JSON.stringify({ schema_version: 1, action_id: crypto.randomUUID(), action: 'task.merge', run_id: runId, created_at: new Date().toISOString(), payload: { target_id: targetId, source_id: sourceId } }, null, 2) + '\n');
  await writable.close();
}

export async function waitForTaskMergeResult(handle: FileSystemDirectoryHandle, runId: string, timeoutMs = 900000): Promise<{ status: string; error?: string } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const runDir = await (await handle.getDirectoryHandle('imports')).getDirectoryHandle(runId); const result = await readJson(await runDir.getDirectoryHandle('results'), 'task-merge.json'); if (result) return result; } catch { /* helper may not have written it */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { status: 'timeout', error: 'The Task merge was not applied in time.' };
}

export async function writeTaskSplitAction(handle: FileSystemDirectoryHandle, runId: string, sourceId: string, children: Array<{ [key: string]: unknown }>): Promise<void> {
  if (!sourceId.trim() || children.length < 2 || children.some(child => typeof child.title !== 'string' || typeof child.body !== 'string')) throw new Error('Provide a source Task and at least two child drafts.');
  const runDir = await (await handle.getDirectoryHandle('imports')).getDirectoryHandle(runId);
  const file = await (await runDir.getDirectoryHandle('actions', { create: true })).getFileHandle('task-split.json', { create: true });
  const writable = await (file as any).createWritable();
  await writable.write(JSON.stringify({ schema_version: 1, action_id: crypto.randomUUID(), action: 'task.split', run_id: runId, created_at: new Date().toISOString(), payload: { source_id: sourceId, children } }, null, 2) + '\n');
  await writable.close();
}

export async function waitForTaskSplitResult(handle: FileSystemDirectoryHandle, runId: string, timeoutMs = 900000): Promise<{ status: string; child_ids?: string[]; error?: string } | null> {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try { const runDir = await (await handle.getDirectoryHandle('imports')).getDirectoryHandle(runId); const result = await readJson(await runDir.getDirectoryHandle('results'), 'task-split.json'); if (result) return result; } catch { /* helper may not have written it */ }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  return { status: 'timeout', error: 'The Task split was not applied in time.' };
}

/** Write the user's project choices so the import skill can apply them. */
export async function writeProjectSelections(handle: FileSystemDirectoryHandle, runId: string, selections: unknown): Promise<void> {
  const imports = await handle.getDirectoryHandle('imports');
  const runDir = await imports.getDirectoryHandle(runId);
  const fh = await runDir.getFileHandle('selections.json', { create: true });
  const writable = await (fh as any).createWritable();
  await writable.write(JSON.stringify(selections, null, 2) + '\n');
  await writable.close();
}

async function scanProjectFolder(
  projectFolder: FileSystemDirectoryHandle,
  slug: string,
  stages: string[] = [...DEFAULT_STAGES]
): Promise<Project | null> {
  // Must have project.json to be considered a valid project
  const meta = await readJson(projectFolder, 'project.json');
  if (!meta) return null;
  if (meta.merged_into) return null;
  const projectStages = readProjectStages(meta.stages, stages);

  const goals: Goal[] = [];

  for await (const [name, entry] of projectFolder.entries()) {
    if (name.startsWith('.') || name === 'project.json') continue;
    if (entry.kind !== 'directory') continue;

    const goalFolder = entry as FileSystemDirectoryHandle;
    const goal = await scanGoalFolder(goalFolder, name, projectStages);
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
    stages: projectStages,
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
  records.sort((a, b) =>
    (a.order ?? 999999) - (b.order ?? 999999)
    || (a.folder || '').localeCompare(b.folder || '')
  );

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
    activities: Array.isArray(meta.activities) ? meta.activities : [],
    order: typeof meta.order === 'number' ? meta.order : undefined,
    entryType: meta.entry_type === 'learning' ? 'learning' : 'project',
    purpose: meta.purpose || meta.sub_purpose || null,
    subPurpose: meta.purpose || meta.sub_purpose || null,
    tools,
    toolCategories: normalizeToolCategories(meta.tool_categories || meta.toolCategories),
    toolTags: tools,
    mindset,
    mindsetTags: mindset,
    // Legacy progress is intentionally retained for compatibility readers only.
    // No writer or user-facing component should copy, edit, filter, or display it.
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
