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
      const transaction = db.transaction('folderHandles', 'readwrite');
      transaction.objectStore('folderHandles').put(handle, 'root');
    };
  } catch (error) {
    console.error('Failed to save folder handle:', error);
  }
}

export async function loadFolderHandleFromStorage(): Promise<FileSystemDirectoryHandle | null> {
  return new Promise((resolve) => {
    try {
      const idb = indexedDB.open('BuildersDiary', 1);
      idb.onsuccess = (e: any) => {
        const db = e.target.result;
        const transaction = db.transaction('folderHandles', 'readonly');
        const request = transaction.objectStore('folderHandles').get('root');
        request.onsuccess = () => {
          resolve(request.result || null);
        };
      };
      idb.onerror = () => resolve(null);
    } catch (error) {
      resolve(null);
    }
  });
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

export async function scanFolderStructure(handle: FileSystemDirectoryHandle): Promise<Portfolio> {
  const projects: Project[] = [];

  try {
    for await (const [name, entry] of handle.entries()) {
      if (entry.kind === 'directory' && name.startsWith('content')) {
        const contentFolder = entry as FileSystemDirectoryHandle;
        const projectsInContent = await scanProjectsFolder(contentFolder);
        projects.push(...projectsInContent);
      }
    }
  } catch (error) {
    console.error('Error scanning folder:', error);
  }

  return {
    path: handle.name,
    projects,
  };
}

async function scanProjectsFolder(contentFolder: FileSystemDirectoryHandle): Promise<Project[]> {
  const projects: Project[] = [];

  try {
    for await (const [name, entry] of contentFolder.entries()) {
      if (entry.kind === 'directory' && name.startsWith('projects-')) {
        const projectFolder = entry as FileSystemDirectoryHandle;
        const projectSlug = name.replace('projects-', '');
        const project = await scanProjectFolder(projectFolder, projectSlug);
        if (project) {
          projects.push(project);
        }
      }
    }
  } catch (error) {
    console.error('Error scanning projects:', error);
  }

  return projects;
}

async function scanProjectFolder(
  projectFolder: FileSystemDirectoryHandle,
  slug: string
): Promise<Project | null> {
  const goals: Goal[] = [];
  let projectTitle = slug;

  try {
    for await (const [name, entry] of projectFolder.entries()) {
      if (name === 'project.yaml' && entry.kind === 'file') {
        const file = await (entry as FileSystemFileHandle).getFile();
        const content = await file.text();
        const title = content.match(/title:\s*(.+)/)?.[1];
        if (title) projectTitle = title;
      } else if (name === 'goals' && entry.kind === 'directory') {
        const goalsFolder = entry as FileSystemDirectoryHandle;
        const goalsInFolder = await scanGoalsFolder(goalsFolder);
        goals.push(...goalsInFolder);
      }
    }
  } catch (error) {
    console.error(`Error scanning project ${slug}:`, error);
  }

  return {
    id: `proj-${slug}`,
    slug,
    title: projectTitle,
    goals,
  };
}

async function scanGoalsFolder(goalsFolder: FileSystemDirectoryHandle): Promise<Goal[]> {
  const goals: Goal[] = [];

  try {
    for await (const [name, entry] of goalsFolder.entries()) {
      if (entry.kind === 'directory') {
        const goalFolder = entry as FileSystemDirectoryHandle;
        const goal = await scanGoalFolder(goalFolder, name);
        if (goal) {
          goals.push(goal);
        }
      }
    }
  } catch (error) {
    console.error('Error scanning goals:', error);
  }

  return goals;
}

async function scanGoalFolder(
  goalFolder: FileSystemDirectoryHandle,
  slug: string
): Promise<Goal | null> {
  const records: Record[] = [];
  let goalTitle = slug;

  try {
    for await (const [name, entry] of goalFolder.entries()) {
      if (name === 'goal.yaml' && entry.kind === 'file') {
        const file = await (entry as FileSystemFileHandle).getFile();
        const content = await file.text();
        const title = content.match(/title:\s*(.+)/)?.[1];
        if (title) goalTitle = title;
      } else if (name === 'records' && entry.kind === 'directory') {
        const recordsFolder = entry as FileSystemDirectoryHandle;
        const recordsInFolder = await scanRecordsFolder(recordsFolder);
        records.push(...recordsInFolder);
      }
    }
  } catch (error) {
    console.error(`Error scanning goal ${slug}:`, error);
  }

  return {
    id: `goal-${slug}`,
    slug,
    title: goalTitle,
    records,
  };
}

async function scanRecordsFolder(recordsFolder: FileSystemDirectoryHandle): Promise<Record[]> {
  const records: Record[] = [];

  try {
    for await (const [name, entry] of recordsFolder.entries()) {
      if (entry.kind === 'file' && name.endsWith('.md')) {
        const file = await (entry as FileSystemFileHandle).getFile();
        const content = await file.text();
        const record = await parseMarkdownFile(content, name);
        if (record) {
          records.push(record);
        }
      }
    }
  } catch (error) {
    console.error('Error scanning records:', error);
  }

  return records;
}

async function parseMarkdownFile(content: string, filePath: string): Promise<Record | null> {
  try {
    const { parseFrontMatter } = await import('./parser');
    const parsed = parseFrontMatter(content);
    if (!parsed) return null;

    return {
      id: parsed.id,
      title: parsed.title,
      summary: parsed.summary || '',
      tags: parsed.tags || [],
      created_at: parsed.created_at,
      updated_at: parsed.updated_at,
      status: parsed.status,
      content: parsed.content,
      file_path: filePath,
    };
  } catch (error) {
    console.error(`Error parsing ${filePath}:`, error);
    return null;
  }
}
