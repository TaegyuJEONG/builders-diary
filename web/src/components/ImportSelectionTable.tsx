'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ImportProposalProject, ImportSourcePreview, loadFolderHandleFromStorage,
  readProjectProposal, writeProjectSelections,
} from '@/lib/fileSystem';

interface ImportSelectionTableProps {
  onSaved?: () => void;
  refreshKey?: number;
}

interface Draft {
  project: ImportProposalProject;
  checked: boolean;
  name: string;
  parentId: string | null;
}

const GRID = '24px 24px minmax(150px,1fr) minmax(130px,.9fr) minmax(130px,.9fr) minmax(200px,1.4fr)';
const inputStyle: React.CSSProperties = { width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)', color: 'var(--text)', borderRadius: 3, padding: '6px 8px', fontSize: 12, fontFamily: 'inherit' };

function headCell(label: string) {
  return <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em' }}>{label}</div>;
}

function SourceList({ sources, kind, onOpen }: { sources: ImportSourcePreview[]; kind: 'Chat' | 'Claude Code'; onOpen: (kind: string, sources: ImportSourcePreview[]) => void }) {
  if (!sources.length) return <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>—</span>;
  const label = kind === 'Chat' ? `${sources.length} chat${sources.length === 1 ? '' : 's'}` : `${sources.length} session${sources.length === 1 ? '' : 's'}`;
  return <button onClick={() => onOpen(kind, sources)} className="mono" style={{ padding: 0, border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer', fontSize: 10.5, textAlign: 'left' }}>{label}</button>;
}

/**
 * User-facing selection of agent-classified projects only. Raw discovery belongs to
 * the agent, never this table: scratch workspaces and empty Chat shells cannot appear
 * unless the agent deliberately proposes them as a project.
 */
export function ImportSelectionTable({ onSaved, refreshKey = 0 }: ImportSelectionTableProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [dragId, setDragId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ kind: string; sources: ImportSourcePreview[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) { if (!cancelled) setLoaded(true); return; }
      const data = await readProjectProposal(handle);
      if (cancelled) return;
      if (!data) { setLoaded(true); return; }
      setRunId(data.runId);
      setDrafts(previous => {
        const prior = new Map(previous.map(row => [row.project.id, row]));
        const next = data.projects.map(project => {
          const saved = prior.get(project.id);
          return saved ? { ...saved, project } : { project, checked: true, name: project.name, parentId: null };
        });
        return next;
      });
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const topLevel = useMemo(() => drafts.filter(row => row.parentId === null), [drafts]);
  const childrenOf = (id: string) => drafts.filter(row => row.parentId === id);
  const selected = topLevel.filter(row => row.checked);

  function update(id: string, patch: Partial<Draft>) {
    setDrafts(rows => rows.map(row => row.project.id === id ? { ...row, ...patch } : row));
  }

  function move(draggedId: string, destinationId: string, merge: boolean) {
    if (draggedId === destinationId) return;
    setDrafts(rows => {
      const dragged = rows.find(row => row.project.id === draggedId);
      if (!dragged) return rows;
      if (merge) return rows.map(row => row.project.id === draggedId ? { ...row, parentId: destinationId } : row);
      const reordered = rows.filter(row => row.project.id !== draggedId);
      const at = reordered.findIndex(row => row.project.id === destinationId);
      reordered.splice(at < 0 ? reordered.length : at, 0, { ...dragged, parentId: null });
      return reordered;
    });
  }

  async function save() {
    if (!runId) return;
    setSaving(true); setMessage('');
    try {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) throw new Error('Folder is not connected');
      const projects = topLevel.map((row, order) => ({
        proposal_id: row.project.id,
        name: row.name,
        action: row.checked ? 'confirm' : 'drop',
        order,
        merged_from: childrenOf(row.project.id).map(child => child.project.id),
      }));
      await writeProjectSelections(handle, runId, { run_id: runId, order: topLevel.map(row => row.project.id), projects });
      setMessage('Saved. Claude Code will create these projects.');
      onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally { setSaving(false); }
  }

  if (!loaded) return null;
  if (!runId || drafts.length === 0) return <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>Waiting for Claude Code to propose projects. Raw discovery stays private until it is classified.</p>;

  return <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div style={{ overflowX: 'auto' }}><div style={{ minWidth: 780, display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '0 6px 2px' }}><div />{headCell('#')}{headCell('Project')}{headCell('Chat')}{headCell('Claude Code')}{headCell('Summary')}</div>
      {topLevel.map((row, index) => {
        const children = childrenOf(row.project.id);
        return <React.Fragment key={row.project.id}>
          <div draggable onDragStart={() => setDragId(row.project.id)} onDragEnd={() => setDragId(null)} onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragId) move(dragId, row.project.id, event.altKey); }} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'start', padding: '8px 6px', borderRadius: 5, background: row.checked ? 'var(--surface)' : 'var(--bg)', border: '1px solid var(--border)', opacity: dragId === row.project.id ? .55 : 1, cursor: 'grab' }}>
            <div className="mono" style={{ color: 'var(--text3)', fontSize: 10, paddingTop: 7 }}>{index + 1}</div>
            <input type="checkbox" checked={row.checked} onChange={() => update(row.project.id, { checked: !row.checked })} aria-label={`Import ${row.name}`} style={{ marginTop: 7 }} />
            <div><input value={row.name} onChange={event => update(row.project.id, { name: event.target.value })} aria-label="Project name" style={inputStyle} />{children.length > 0 && <div className="mono" style={{ color: 'var(--accent)', fontSize: 9.5, marginTop: 4 }}>+ {children.length} merged project{children.length === 1 ? '' : 's'}</div>}</div>
            <div style={{ paddingTop: 6 }}><SourceList kind="Chat" sources={row.project.chat} onOpen={(kind, sources) => setDetail({ kind, sources })} /></div>
            <div style={{ paddingTop: 6 }}><SourceList kind="Claude Code" sources={row.project.claude_code} onOpen={(kind, sources) => setDetail({ kind, sources })} /></div>
            <div style={{ paddingTop: 4, color: 'var(--text2)', fontSize: 11.5, lineHeight: 1.5 }}>{row.project.summary || <span style={{ color: 'var(--text3)' }}>No summary yet</span>}</div>
          </div>
          {children.map(child => <div key={child.project.id} style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, padding: '7px 6px 7px 26px', border: '1px dashed var(--border)', background: 'var(--bg)' }}>
            <div className="mono" style={{ color: 'var(--text3)', fontSize: 11 }}>↳</div><div /><div style={{ color: 'var(--text2)', fontSize: 12 }}>{child.name}<button onClick={() => update(child.project.id, { parentId: null })} className="mono" style={{ marginLeft: 8, border: 0, background: 'transparent', color: 'var(--accent)', cursor: 'pointer' }}>unmerge</button></div><div /><div /><div style={{ color: 'var(--text3)', fontSize: 11 }}>{child.project.summary}</div>
          </div>)}
          {dragId && dragId !== row.project.id && <div onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); if (dragId) move(dragId, row.project.id, true); }} className="mono" style={{ padding: '5px 8px', border: '1px dashed var(--border)', color: 'var(--text3)', textAlign: 'center', fontSize: 9.5 }}>Drop here to merge into “{row.name}”</div>}
        </React.Fragment>;
      })}
    </div></div>
    <div className="mono" style={{ color: 'var(--text3)', fontSize: 10, lineHeight: 1.7 }}>Drag a project to reorder. Drop it in the merge zone under another project to combine their sources.</div>
    {message && <div className="mono" style={{ color: message.startsWith('Saved') ? 'var(--accent)' : 'var(--danger)', fontSize: 10.5 }}>{message}</div>}
    <button onClick={save} disabled={saving || !selected.length} className="mono" style={{ padding: 11, background: 'var(--accent)', color: 'var(--bg)', border: 0, borderRadius: 4, cursor: saving || !selected.length ? 'not-allowed' : 'pointer', opacity: selected.length ? 1 : .5 }}>{saving ? 'Saving…' : `Save ${selected.length} project${selected.length === 1 ? '' : 's'}`}</button>
    {detail && <div role="dialog" aria-label={`${detail.kind} details`} style={{ border: '1px solid var(--border2)', background: 'var(--surface)', borderRadius: 5, padding: 12 }}><div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><strong style={{ fontSize: 12 }}>{detail.kind} details</strong><button onClick={() => setDetail(null)} className="mono" style={{ marginLeft: 'auto', border: 0, background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}>×</button></div>{detail.sources.map((source, i) => <div key={`${source.title}-${i}`} style={{ borderTop: i ? '1px solid var(--border)' : 0, marginTop: i ? 9 : 6, paddingTop: i ? 9 : 0 }}><div style={{ color: 'var(--text)', fontSize: 12 }}>{source.title}</div><div style={{ color: 'var(--text2)', fontSize: 11.5, lineHeight: 1.55, marginTop: 3 }}>{source.summary || source.first_prompt || 'No metadata summary available.'}</div></div>)}</div>}
  </div>;
}
