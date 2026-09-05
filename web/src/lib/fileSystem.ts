'use client';

import { Portfolio, Project, Goal, Record } from './types';

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
    const handle = await (window as any).showDirectoryPicker();
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

            // Build markdown with front matter
            const fm = [
              '---',
              `title: ${record.title}`,
              record.summary  ? `summary: ${record.summary}`           : '',
              record.status   ? `status: ${record.status}`             : '',
              record.updated_at ? `updated_at: ${record.updated_at}`   : '',
              record.tags?.length ? `tags: [${record.tags.join(', ')}]` : '',
              '---',
            ].filter(l => l !== '').join('\n');

            const body = record.content || '';
            const full = record.result
              ? `${fm}\n\n${body}\n\n## Result\n\n${record.result}`
              : `${fm}\n\n${body}`;

            await writable.write(full);
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
    if (goal) goals.push(goal);
  }

  goals.sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));

  return {
    id: meta.id || `proj-${slug}`,
    slug: meta.slug || slug,
    title: meta.title || slug,
    created_at: meta.created_at,
    goals,
  };
}

async function scanGoalFolder(
  goalFolder: FileSystemDirectoryHandle,
  slug: string
): Promise<Goal | null> {
  // Must have goal.json to be considered a valid goal
  const meta = await readJson(goalFolder, 'goal.json');
  if (!meta) return null;

  const records: Record[] = [];

  for await (const [name, entry] of goalFolder.entries()) {
    if (name.startsWith('.') || name === 'goal.json') continue;
    if (entry.kind !== 'directory') continue;

    const recordFolder = entry as FileSystemDirectoryHandle;
    const record = await scanRecordFolder(recordFolder, name);
    if (record) records.push(record);
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

async function scanRecordFolder(
  recordFolder: FileSystemDirectoryHandle,
  folderName: string
): Promise<Record | null> {
  const meta = await readJson(recordFolder, 'record.json');
  if (!meta) return null;

  // Split body into content + the judgment section (## The judgment call), if present.
  const body: string = meta.body || '';

  return {
    id: meta.id || folderName,
    folder: meta.folder || folderName,
    title: meta.title || folderName,
    body,
    // Map body → summary/content for UI compatibility
    summary: body ? body.slice(0, 200) : '',
    content: body,
    category: meta.category || null,
    judgment: meta.judgment || null,
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
