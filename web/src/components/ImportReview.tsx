'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  loadFolderHandleFromStorage, readProjectCandidates, writeProjectSelections,
  ImportCandidate,
} from '@/lib/fileSystem';

interface ImportReviewProps {
  onClose: () => void;
  onSaved: () => void;
}

interface CandidateDraft extends ImportCandidate {
  checked: boolean;
  name: string;
  sector: string;
  oneLiner: string;
}

const fieldStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
  color: 'var(--text)', borderRadius: 3, padding: '7px 8px', fontSize: 12,
  fontFamily: 'inherit', outline: 'none',
};

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{children}</div>;
}

export function ImportReview({ onClose, onSaved }: ImportReviewProps) {
  const [drafts, setDrafts] = useState<CandidateDraft[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) { setLoaded(true); return; }
      const data = await readProjectCandidates(handle);
      if (!data) { setLoaded(true); return; }
      setRunId(data.runId);
      setDrafts(data.candidates.map(c => ({
        ...c, checked: true, name: c.name, sector: '', oneLiner: '',
      })));
      setLoaded(true);
    })();
  }, []);

  const confirmedCount = useMemo(() => drafts.filter(d => d.checked).length, [drafts]);

  function toggle(id: string) {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, checked: !d.checked } : d));
  }
  function setField(id: string, key: 'name' | 'sector' | 'oneLiner', value: string) {
    setDrafts(prev => prev.map(d => d.id === id ? { ...d, [key]: value } : d));
  }

  async function save() {
    if (!runId) return;
    setSaving(true); setMessage('');
    try {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) throw new Error('Folder is not connected');
      await writeProjectSelections(handle, runId, {
        run_id: runId,
        projects: drafts.map(d => d.checked
          ? { candidate_id: d.id, name: d.name, sector: d.sector, one_liner: d.oneLiner }
          : { candidate_id: d.id, action: 'drop' }),
      });
      setMessage('Saved. Run apply-selections in Claude Code to write these projects.');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  if (drafts.length === 0) {
    return (
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.62)', display: 'flex', justifyContent: 'flex-end' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <aside style={{ width: 460, maxWidth: '92vw', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border2)', padding: 20 }}>
          <h3 style={{ fontSize: 13, margin: '0 0 10px' }}>Review import</h3>
          <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.6 }}>No import proposal yet. Start <code className="mono">/builders-diary-import</code> in Claude Code first — its project proposal will appear here.</p>
          <button onClick={onClose} className="mono" style={{ marginTop: 14, padding: '8px 14px', background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 4, cursor: 'pointer' }}>Close</button>
        </aside>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.62)', display: 'flex', justifyContent: 'flex-end' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside style={{ width: 480, maxWidth: '94vw', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <strong style={{ fontSize: 13 }}>Review import · {confirmedCount} selected</strong>
          <button onClick={onClose} aria-label="Close" className="mono" style={{ marginLeft: 'auto', width: 28, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text2)', cursor: 'pointer' }}>×</button>
        </div>
        <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.6, margin: 0 }}>
            Tick the projects to import, rename any of them, then save. Claude Code picks up your choices and writes the projects.
          </p>
          {drafts.map(d => (
            <div key={d.id} style={{ border: `1px solid ${d.checked ? 'var(--accent-dim)' : 'var(--border)'}`, borderRadius: 5, padding: '10px 12px', background: d.checked ? 'var(--tag-active-bg)' : 'var(--bg)', opacity: d.checked ? 1 : 0.6 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, cursor: 'pointer' }}>
                <input type="checkbox" checked={d.checked} onChange={() => toggle(d.id)} />
                <span className="mono" style={{ fontSize: 9, color: 'var(--text3)' }}>{d.source.replace(/^claude_/, '').replace(/_/g, ' ')}{d.session_count ? ` · ${d.session_count}` : ''}</span>
              </label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div><Label>Name</Label><input style={fieldStyle} value={d.name} onChange={e => setField(d.id, 'name', e.target.value)} /></div>
                <div><Label>Sector</Label><input style={fieldStyle} value={d.sector} onChange={e => setField(d.id, 'sector', e.target.value)} /></div>
                <div><Label>One-line story</Label><input style={fieldStyle} value={d.oneLiner} onChange={e => setField(d.id, 'oneLiner', e.target.value)} /></div>
              </div>
            </div>
          ))}
          {message && <div className="mono" style={{ fontSize: 10.5, color: message.startsWith('Saved') ? 'var(--accent)' : 'var(--danger)' }}>{message}</div>}
        </div>
        <div style={{ padding: 14, borderTop: '1px solid var(--border)' }}>
          <button onClick={save} disabled={saving || confirmedCount === 0} className="mono" style={{ width: '100%', padding: 11, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: saving || confirmedCount === 0 ? 'not-allowed' : 'pointer', opacity: confirmedCount === 0 ? 0.5 : 1 }}>
            {saving ? 'Saving…' : `Save ${confirmedCount} project${confirmedCount === 1 ? '' : 's'}`}
          </button>
        </div>
      </aside>
    </div>
  );
}
