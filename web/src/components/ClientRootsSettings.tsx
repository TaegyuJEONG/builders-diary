'use client';

import { useEffect, useState } from 'react';
import { ImportConfig, loadFolderHandleFromStorage, readImportConfig, selectFolder, writeImportConfig } from '@/lib/fileSystem';

const HISTORY_SOURCES = {
  cursor: { label: 'Cursor', adapterId: 'cursor' },
  codex: { label: 'Codex CLI', adapterId: 'codex' },
  hermes: { label: 'Hermes', adapterId: 'hermes' },
} as const;

type HistoryClient = keyof typeof HISTORY_SOURCES;

interface Props {
  clientId: HistoryClient;
}

/** Explicit folder connection only: no background discovery or filesystem scanning. */
export function ClientRootsSettings({ clientId }: Props) {
  const client = HISTORY_SOURCES[clientId];
  const [config, setConfig] = useState<ImportConfig>({ schema_version: 1, enabled_clients: ['claude'], source_roots: [] });
  const [folderPath, setFolderPath] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadFolderHandleFromStorage().then(handle => handle && readImportConfig(handle).then(setConfig));
  }, []);

  async function connectFolder() {
    if (!folderPath.startsWith('/') || folderPath.includes('\0')) {
      setStatus('Paste the full path to an existing folder first.');
      return;
    }

    // The picker is deliberately user-initiated. It never scans or accesses a history folder by itself.
    const chosenFolder = await selectFolder();
    if (!chosenFolder) return;
    const root = await loadFolderHandleFromStorage();
    if (!root) {
      setStatus('Connect your Builder’s Diary folder first.');
      return;
    }

    const nextRoots = [
      ...(config.source_roots || []).filter(rootEntry => rootEntry.path !== folderPath),
      { client_id: clientId, adapter_id: client.adapterId, path: folderPath },
    ];
    const next: ImportConfig = {
      ...config,
      enabled_clients: Array.from(new Set([...(config.enabled_clients || []), clientId])),
      source_roots: nextRoots,
      clients: {
        ...(config.clients || {}),
        [clientId]: {
          enabled: true,
          adapter_ids: [client.adapterId],
          roots: nextRoots.filter(rootEntry => rootEntry.client_id === clientId),
        },
      },
    };

    await writeImportConfig(root, next);
    setConfig(next);
    setStatus(`${client.label} folder connected. The import helper will validate it before reading anything.`);
  }

  return (
    <section aria-label={`${client.label} local history folder`} style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 14, background: 'var(--surface)' }}>
      <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, margin: '0 0 12px' }}>
        Choose the folder containing its local history. Builder&apos;s Diary never searches your computer for it.
      </p>
      <label className="mono" style={{ fontSize: 11, color: 'var(--text2)', display: 'block', marginBottom: 10 }}>
        Local history folder
        <input
          aria-label={`${client.label} local history folder path`}
          value={folderPath}
          onChange={event => setFolderPath(event.target.value)}
          placeholder="Paste the folder path you want to import"
          style={{ display: 'block', width: '100%', marginTop: 5, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '8px 9px', color: 'var(--text)' }}
        />
      </label>
      <button type="button" onClick={connectFolder} style={{ padding: '9px 12px', background: 'var(--accent)', color: 'var(--bg)', border: 0, borderRadius: 4, cursor: 'pointer' }}>
        Choose this folder
      </button>
      {status && <p className="mono" style={{ color: 'var(--accent)', fontSize: 11, lineHeight: 1.6, margin: '10px 0 0' }}>{status}</p>}
    </section>
  );
}
