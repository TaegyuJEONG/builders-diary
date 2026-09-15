'use client';

import React, { useMemo, useState } from 'react';

type DownloadItem = { category: string; filename?: string; export_url?: string };

export function ClaudeExportDownload() {
  const [items, setItems] = useState<DownloadItem[]>([]);
  const [error, setError] = useState('');
  const [opened, setOpened] = useState<string[]>([]);
  const requiredReady = useMemo(() => items.some(i => i.category === 'conversations' && i.export_url) && items.some(i => i.category === 'projects' && i.export_url), [items]);

  async function loadManifest(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(''); setItems([]); setOpened([]);
    if (file.size > 2 * 1024 * 1024) { setError('The export manifest is too large. Choose the JSON manifest from Claude.'); return; }
    try {
      const parsed = JSON.parse(await file.text());
      const data = Array.isArray(parsed?.data_files) ? parsed.data_files : [];
      const safe = data.filter((item: any) => ['conversations', 'projects', 'memories'].includes(item?.category) && typeof item?.export_url === 'string' && /^https:\/\//i.test(item.export_url)).map((item: any) => ({ category: item.category, filename: typeof item.filename === 'string' ? item.filename : undefined, export_url: item.export_url }));
      if (!safe.length) throw new Error('No supported export downloads found in this manifest.');
      setItems(safe);
    } catch (e) { setError(e instanceof Error ? e.message : 'The export manifest could not be read.'); }
  }

  return <div style={{ border: '1px solid var(--border)', borderRadius: 6, padding: 14, background: 'var(--surface)' }}>
    <div style={{ fontSize: 13, fontWeight: 600 }}>Download your Claude export</div>
    <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.6, margin: '5px 0 10px' }}>Choose the manifest JSON from Claude. Open all three links in this page; then reply “Done” in the same Claude Code chat so the import scan can continue.</div>
    <input type="file" accept="application/json,.json" onChange={loadManifest} aria-label="Choose Claude export manifest" />
    {error && <div role="alert" className="mono" style={{ color: 'var(--danger)', fontSize: 10.5, marginTop: 8 }}>{error}</div>}
    {items.length > 0 && <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>{items.map(item => <a key={item.category} href={item.export_url} target="_self" rel="noreferrer" onClick={() => setOpened(prev => [...new Set([...prev, item.category])])} className="mono" style={{ color: 'var(--accent)', fontSize: 11 }}>{opened.includes(item.category) ? '✓ ' : ''}{item.category[0].toUpperCase() + item.category.slice(1)}{item.filename ? ` · ${item.filename}` : ''}</a>)}</div>}
    {items.length > 0 && !requiredReady && <div className="mono" style={{ color: 'var(--danger)', fontSize: 10, marginTop: 9 }}>Conversations and Projects are required before continuing.</div>}
    {requiredReady && <div className="mono" style={{ color: 'var(--accent)', fontSize: 10, marginTop: 9 }}>Required downloads ready. Reply “Done” in your Claude Code chat; the import will continue there by re-running the local scan.</div>}
  </div>;
}
