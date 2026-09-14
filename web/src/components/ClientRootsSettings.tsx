'use client';

import { useEffect, useState } from 'react';
import { ImportConfig, readImportConfig, writeImportConfig, selectFolder, loadFolderHandleFromStorage } from '@/lib/fileSystem';

const CLIENTS = [
  { id: 'claude', label: 'Claude', adapters: [{ id: 'claude_code', label: 'Claude Code' }, { id: 'claude_chat_export', label: 'Claude Chat export' }] },
  { id: 'cursor', label: 'Cursor', adapters: [] },
  { id: 'codex', label: 'Codex', adapters: [] },
  { id: 'antigravity', label: 'Antigravity', adapters: [] },
  { id: 'hermes', label: 'Hermes', adapters: [] },
];

/** Settings surface: detection is a static allowlist; filesystem access starts only on a click. */
export function ClientRootsSettings() {
  const [config, setConfig] = useState<ImportConfig>({ schema_version: 1, enabled_clients: ['claude'], source_roots: [] });
  const [selected, setSelected] = useState<string>('claude');
  const [adapter, setAdapter] = useState('claude_code');
  const [pathValue, setPathValue] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    loadFolderHandleFromStorage().then(handle => handle && readImportConfig(handle).then(setConfig));
  }, []);

  async function optIn() {
    if (!pathValue.startsWith('/') || pathValue.includes('\0')) {
      setStatus('Choose an absolute existing folder path.');
      return;
    }
    const handle = await selectFolder();
    if (!handle) return;
    const nextRoots = [...(config.source_roots || []).filter(root => root.path !== pathValue), { client_id: selected, adapter_id: adapter, path: pathValue }];
    const next: ImportConfig = {
      ...config,
      enabled_clients: Array.from(new Set([...(config.enabled_clients || []), selected])),
      source_roots: nextRoots,
      clients: { ...(config.clients || {}), [selected]: { enabled: true, adapter_ids: CLIENTS.find(client => client.id === selected)?.adapters.map(item => item.id) || [], roots: nextRoots.filter(root => root.client_id === selected) } },
    };
    const root = await loadFolderHandleFromStorage();
    if (!root) { setStatus('Connect a Builder’s Diary folder first.'); return; }
    await writeImportConfig(root, next);
    setConfig(next);
    setStatus(`Connected ${handle.name}.`);
  }

  return (
    <section aria-label="Client history connections" style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 18, background: 'var(--surface)' }}>
      <h2 style={{ fontSize: 16, margin: '0 0 6px' }}>Client history connections</h2>
      <p className="mono" style={{ color: 'var(--text3)', fontSize: 11, lineHeight: 1.6, margin: '0 0 16px' }}>
        Detected clients are listed here without scanning your home directory. Opt in and choose each source folder explicitly. Choose a source folder only when you are ready.
      </p>
      <div style={{ display: 'grid', gap: 8 }}>
        {CLIENTS.map(client => {
          const enabled = (config.enabled_clients || []).includes(client.id);
          return <button key={client.id} type="button" onClick={() => client.adapters.length && setSelected(client.id)} disabled={!client.adapters.length} style={{ textAlign: 'left', padding: 10, border: `1px solid ${selected === client.id ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 4, background: enabled ? 'var(--tag-active-bg)' : 'transparent', color: client.adapters.length ? 'var(--text)' : 'var(--text3)' }}>
            <strong>{client.label}</strong><span className="mono" style={{ marginLeft: 8, fontSize: 10 }}>{enabled ? 'enabled' : client.adapters.length ? 'not connected' : 'adapter coming soon'}</span>
          </button>;
        })}
      </div>
      {CLIENTS.find(client => client.id === selected)?.adapters.length ? <div style={{ marginTop: 16, display: 'grid', gap: 8 }}>
        <label className="mono" style={{ fontSize: 11 }}>Adapter <select value={adapter} onChange={event => setAdapter(event.target.value)}>{CLIENTS.find(client => client.id === selected)?.adapters.map(item => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
        <label className="mono" style={{ fontSize: 11 }}>Absolute source root <input aria-label="Absolute source root" value={pathValue} onChange={event => setPathValue(event.target.value)} placeholder="/Users/you/.claude/projects" style={{ display: 'block', width: '100%', marginTop: 4 }} /></label>
        <button type="button" onClick={optIn} style={{ padding: '9px 12px', background: 'var(--accent)', color: 'var(--bg)', border: 0, borderRadius: 4 }}>Opt in and choose a source folder</button>
      </div> : null}
      {status && <p className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>{status}</p>}
    </section>
  );
}
