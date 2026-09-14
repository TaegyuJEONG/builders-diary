'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  loadFolderHandleFromStorage, readProjectEnrichmentProposals,
  writeProjectEnrichAction, waitForProjectEnrichResult,
} from '@/lib/fileSystem';

export function ProjectEnrichmentQueue({ refreshKey = 0, onSaved }: { refreshKey?: number; onSaved?: () => void }) {
  const [runId, setRunId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<any[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const load = useCallback(async () => {
    const handle = await loadFolderHandleFromStorage();
    if (!handle) return;
    const data = await readProjectEnrichmentProposals(handle);
    if (data) { setRunId(data.runId); setProposals(data.proposals); }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { const timer = window.setInterval(() => void load(), 2500); return () => window.clearInterval(timer); }, [load]);

  async function approve(proposal: any) {
    if (!runId) return;
    setBusyId(proposal.project_id); setMessage('Waiting for the helper to save this project story…');
    try {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) throw new Error('Folder is not connected');
      await writeProjectEnrichAction(handle, runId, proposal.project_id, proposal.sector, proposal.one_liner);
      const result = await waitForProjectEnrichResult(handle, runId);
      if (!result || result.status !== 'applied') throw new Error(result?.error || 'Project enrichment was not applied.');
      setProposals(items => items.filter(item => item.project_id !== proposal.project_id));
      setMessage('Project story saved.');
      onSaved?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Project enrichment failed.'); }
    finally { setBusyId(null); }
  }

  if (!proposals.length) return message ? <div className="mono" style={{ color: 'var(--text2)', fontSize: 11 }}>{message}</div> : null;
  return <section style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '10px 20px' }}>
    <div><strong style={{ fontSize: 13 }}>Project enrichment</strong><div className="mono" style={{ color: 'var(--text2)', fontSize: 10 }}>Confirmed projects need a short sector and one-line story before they are complete.</div></div>
    {message && <div className="mono" style={{ color: 'var(--text2)', fontSize: 11 }}>{message}</div>}
    {proposals.map(proposal => <article key={proposal.project_id} style={{ border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', padding: 12 }}>
      <strong>{proposal.name}</strong><div className="mono" style={{ color: 'var(--accent)', fontSize: 10, marginTop: 4 }}>Pending enrichment</div>
      <label style={{ display: 'block', marginTop: 8, fontSize: 11 }}>Sector<input aria-label={`Sector for ${proposal.name}`} value={proposal.sector} onChange={event => setProposals(items => items.map(item => item.project_id === proposal.project_id ? { ...item, sector: event.target.value } : item))} /></label>
      <label style={{ display: 'block', marginTop: 8, fontSize: 11 }}>One-line story<textarea aria-label={`One-line story for ${proposal.name}`} rows={2} value={proposal.one_liner} onChange={event => setProposals(items => items.map(item => item.project_id === proposal.project_id ? { ...item, one_liner: event.target.value } : item))} /></label>
      <button disabled={busyId === proposal.project_id || !proposal.sector.trim() || !proposal.one_liner.trim()} onClick={() => void approve(proposal)} className="mono" style={{ marginTop: 9, padding: '7px 10px', background: 'var(--accent)', color: 'var(--bg)', border: 0, borderRadius: 4 }}>Approve enrichment</button>
    </article>)}
  </section>;
}
