'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  loadFolderHandleFromStorage, readProjectCandidates, writeProjectSelections,
  ImportCandidate,
} from '@/lib/fileSystem';

/**
 * The import project-selection table.
 *
 * Columns are the same judgement the chat skill shows — order, name, sources, evidence —
 * because a candidate is only importable when its sources are attached. It is rendered
 * both inside the onboarding step 3 card and in the header's Review-import drawer, so the
 * web route and the chat route stay equivalent.
 *
 * Merging is expressed as a parent row with children nested under it: the children
 * contribute their sources and evidence to the parent's title. Only the parent is written
 * as a project; children are absorbed (`merged_from`), which is what makes a merge keep
 * every source.
 */

interface ImportSelectionTableProps {
  /** Called after selections.json is written. */
  onSaved?: () => void;
  /** Bump to re-read candidates (the parent polls while the skill writes). */
  refreshKey?: number;
}

interface Draft {
  candidate: ImportCandidate;
  checked: boolean;
  name: string;
  sector: string;
  oneLiner: string;
  parentId: string | null;
}

const GRID = '26px 26px minmax(150px, 1fr) 150px minmax(170px, 1.25fr) 26px';

const fieldStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
  color: 'var(--text)', borderRadius: 3, padding: '6px 8px', fontSize: 12,
  fontFamily: 'inherit', outline: 'none',
};

function headCell(text: string): React.ReactNode {
  return (
    <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {text}
    </div>
  );
}

function sourceInfo(candidate: ImportCandidate) {
  if (candidate.source === 'claude_chat_project') {
    const count = candidate.source_refs.length;
    return {
      label: 'Chat project',
      detail: count ? `${count} conversation${count === 1 ? '' : 's'}` : 'no conversations linked',
      warn: count === 0,
    };
  }
  const count = candidate.session_count ?? candidate.source_refs.length;
  return {
    label: 'Claude Code workspace',
    detail: count ? `${count} session${count === 1 ? '' : 's'}` : 'no sessions',
    warn: count === 0,
  };
}

function evidenceInfo(candidate: ImportCandidate) {
  if (candidate.is_starter_project) {
    return { text: 'Claude’s built-in example project — not your work.', warn: true, origin: '' };
  }
  const text = (candidate.summary || candidate.description || candidate.prompt_template || '').trim();
  const origin = candidate.summary ? 'agent'
    : candidate.prompt_template ? 'your project prompt'
    : candidate.description ? 'project description'
    : '';
  return { text, warn: false, origin };
}

export function ImportSelectionTable({ onSaved, refreshKey = 0 }: ImportSelectionTableProps) {
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropHint, setDropHint] = useState<{ id: string; pos: 'before' | 'after' | 'into' } | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) { if (!cancelled) setLoaded(true); return; }
      const data = await readProjectCandidates(handle);
      if (cancelled) return;
      if (!data) { setLoaded(true); return; }
      setRunId(data.runId);
      // Re-read on every poll so newly assigned sources and evidence show up, but keep
      // the user's own work: rows stay in the order they dragged them into, merges stay
      // merged, and typed names survive. Only genuinely new candidates are appended.
      setDrafts(prev => {
        const incoming = new Map(data.candidates.map(c => [c.id, c]));
        const kept = prev
          .filter(d => incoming.has(d.candidate.id))
          .map(d => ({ ...d, candidate: incoming.get(d.candidate.id)! }));
        const keptIds = new Set(kept.map(d => d.candidate.id));
        const added = data.candidates
          .filter(c => !keptIds.has(c.id))
          .map(c => ({ candidate: c, checked: !c.is_starter_project, name: c.name, sector: '', oneLiner: '', parentId: null }));
        return [...kept, ...added];
      });
      setLoaded(true);
    })();
    return () => { cancelled = true; };
  }, [refreshKey]);

  const topLevel = useMemo(() => drafts.filter(d => d.parentId === null), [drafts]);
  const childrenOf = (id: string) => drafts.filter(d => d.parentId === id);
  const selectedCount = useMemo(() => topLevel.filter(d => d.checked).length, [topLevel]);
  const unsourced = useMemo(
    () => topLevel.filter(d => d.checked && d.candidate.source_refs.length === 0).length,
    [topLevel],
  );

  function patch(id: string, changes: Partial<Draft>) {
    setDrafts(prev => prev.map(d => (d.candidate.id === id ? { ...d, ...changes } : d)));
  }

  /** Rebuild the flat list so every child follows its parent. */
  function reflow(tops: Draft[], all: Draft[]): Draft[] {
    return tops.flatMap(top => [top, ...all.filter(d => d.parentId === top.candidate.id)]);
  }

  function applyDrop() {
    const hint = dropHint;
    const moving = dragId;
    setDragId(null);
    setDropHint(null);
    if (!hint || !moving || hint.id === moving) return;

    const dragged = drafts.find(d => d.candidate.id === moving);
    if (!dragged) return;

    if (hint.pos === 'into') {
      if (moving === hint.id) return;
      const target = drafts.find(d => d.candidate.id === hint.id);
      if (!target) return;
      // A parent cannot become a child of its own child.
      if (drafts.some(d => d.candidate.id === hint.id && d.parentId === moving)) return;
      const children = drafts.filter(d => d.parentId === moving).map(d => ({ ...d, parentId: hint.id }));
      const tops = topLevel.map(d =>
        d.candidate.id === moving ? { ...d, parentId: hint.id } : d,
      );
      const targetIndex = tops.findIndex(d => d.candidate.id === hint.id);
      const [moved] = tops.splice(tops.findIndex(d => d.candidate.id === moving), 1);
      tops.splice(targetIndex + 1, 0, moved);
      setDrafts(reflow(tops, [...drafts.filter(d => d.candidate.id !== moving && !children.some(c => c.candidate.id === d.candidate.id)), ...children]));
      return;
    }

    const target = drafts.find(d => d.candidate.id === hint.id);
    if (!target) return;
    // Dropping next to a child positions the row next to its parent.
    const anchorId = target.parentId ?? target.candidate.id;
    const tops = topLevel.filter(d => d.candidate.id !== moving);
    const anchorIndex = tops.findIndex(d => d.candidate.id === anchorId);
    if (anchorIndex === -1) return;
    const insertAt = hint.pos === 'before' ? anchorIndex : anchorIndex + 1;
    const moved = { ...dragged, parentId: null };
    const children = drafts.filter(d => d.parentId === moving).map(d => ({ ...d, parentId: null }));
    const without = drafts.filter(d => d.candidate.id !== moving && !children.some(c => c.candidate.id === d.candidate.id));
    const nextTops = [...tops];
    nextTops.splice(insertAt, 0, moved);
    setDrafts(reflow(nextTops, [...without, ...children]));
  }

  async function save() {
    if (!runId) return;
    setSaving(true);
    setMessage('');
    try {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) throw new Error('Folder is not connected');
      const projects: Record<string, unknown>[] = [];
      topLevel.forEach((top, index) => {
        const childIds = childrenOf(top.candidate.id).map(d => d.candidate.id);
        if (!top.checked) {
          // A dropped parent takes its merged children with it.
          projects.push({ candidate_id: top.candidate.id, action: 'drop' });
          childIds.forEach(id => projects.push({ candidate_id: id, action: 'drop' }));
          return;
        }
        projects.push({
          candidate_id: top.candidate.id,
          name: top.name,
          sector: top.sector,
          one_liner: top.oneLiner,
          action: 'confirm',
          order: index,
          merged_from: childIds,
        });
      });
      await writeProjectSelections(handle, runId, {
        run_id: runId,
        order: topLevel.map(d => d.candidate.id),
        projects,
      });
      setMessage('Saved. Claude Code picks this up and writes the projects.');
      onSaved?.();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  if (drafts.length === 0) {
    return (
      <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.7, margin: 0 }}>
        No import proposal yet. Start <code className="mono">/builders-diary-import</code> in Claude Code
        first — its project proposal appears here.
      </p>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ minWidth: 720, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'center', padding: '0 6px 2px' }}>
            <div />{headCell('#')}{headCell('Name')}{headCell('Sources')}{headCell('Evidence')}<div />
          </div>

          {topLevel.map((draft, index) => {
            const children = childrenOf(draft.candidate.id);
            const source = sourceInfo(draft.candidate);
            const evidence = evidenceInfo(draft.candidate);
            const isDragging = dragId === draft.candidate.id;
            const hint = dropHint?.id === draft.candidate.id ? dropHint.pos : null;
            const childSources = children.reduce((sum, child) => sum + child.candidate.source_refs.length, 0);

            return (
              <React.Fragment key={draft.candidate.id}>
                <div
                  draggable
                  onDragStart={() => setDragId(draft.candidate.id)}
                  onDragEnd={() => { setDragId(null); setDropHint(null); }}
                  onDragOver={event => {
                    if (!dragId || dragId === draft.candidate.id) return;
                    event.preventDefault();
                    const box = event.currentTarget.getBoundingClientRect();
                    const pos = (event.clientY - box.top) / box.height < 0.5 ? 'before' : 'after';
                    setDropHint({ id: draft.candidate.id, pos });
                  }}
                  onDrop={event => { event.preventDefault(); applyDrop(); }}
                  style={{
                    display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'start',
                    padding: '8px 6px', borderRadius: 5, cursor: 'grab',
                    borderTop: hint === 'before' ? '2px solid var(--accent)' : '1px solid transparent',
                    borderBottom: hint === 'after' ? '2px solid var(--accent)' : '1px solid transparent',
                    background: isDragging ? 'var(--tag-active-bg)' : draft.checked ? 'var(--surface)' : 'var(--bg)',
                    opacity: isDragging ? 0.5 : 1,
                  }}
                >
                  <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', paddingTop: 8 }}>{index + 1}</div>
                  <input
                    type="checkbox"
                    checked={draft.checked}
                    onChange={() => patch(draft.candidate.id, { checked: !draft.checked })}
                    style={{ marginTop: 8 }}
                    aria-label={`Import ${draft.name}`}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <input
                      style={fieldStyle}
                      value={draft.name}
                      onChange={event => patch(draft.candidate.id, { name: event.target.value })}
                      aria-label="Project name"
                    />
                    {children.length > 0 && (
                      <div className="mono" style={{ fontSize: 9.5, color: 'var(--accent)' }}>
                        + {children.length} merged · {childSources} source{childSources === 1 ? '' : 's'} absorbed
                      </div>
                    )}
                  </div>
                  <div className="mono" style={{ fontSize: 9.5, lineHeight: 1.6, paddingTop: 7 }}>
                    <div style={{ color: 'var(--text2)' }}>{source.label}</div>
                    <div style={{ color: source.warn ? 'var(--danger)' : 'var(--text3)' }}>{source.detail}</div>
                  </div>
                  <div style={{ fontSize: 11.5, lineHeight: 1.55, paddingTop: 6, color: evidence.warn ? 'var(--danger)' : 'var(--text2)' }}>
                    {evidence.text || <span style={{ color: 'var(--text3)' }}>No evidence recorded</span>}
                    {(evidence.origin || (draft.candidate.doc_count ?? 0) > 0) && (
                      <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', marginTop: 3 }}>
                        {[evidence.origin, draft.candidate.doc_count ? `${draft.candidate.doc_count} project docs` : ''].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setExpanded(expanded === draft.candidate.id ? null : draft.candidate.id)}
                    aria-label="More fields"
                    className="mono"
                    style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, paddingTop: 7 }}
                  >
                    {expanded === draft.candidate.id ? '⌃' : '⌄'}
                  </button>
                </div>

                {expanded === draft.candidate.id && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, padding: '2px 6px 8px 60px' }}>
                    <div>
                      <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Sector</div>
                      <input style={fieldStyle} value={draft.sector} onChange={event => patch(draft.candidate.id, { sector: event.target.value })} />
                    </div>
                    <div>
                      <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>One-line story</div>
                      <input style={fieldStyle} value={draft.oneLiner} onChange={event => patch(draft.candidate.id, { oneLiner: event.target.value })} />
                    </div>
                  </div>
                )}

                {children.map(child => {
                  const childSource = sourceInfo(child.candidate);
                  const childEvidence = evidenceInfo(child.candidate);
                  return (
                    <div
                      key={child.candidate.id}
                      style={{
                        display: 'grid', gridTemplateColumns: GRID, gap: 8, alignItems: 'start',
                        padding: '7px 6px 7px 26px', borderRadius: 5,
                        background: 'var(--bg)', border: '1px dashed var(--border)',
                        opacity: draft.checked ? 1 : 0.55,
                      }}
                    >
                      <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', paddingTop: 7 }}>↳</div>
                      <div />
                      <div style={{ paddingTop: 6 }}>
                        <div style={{ fontSize: 12, color: 'var(--text2)' }}>{child.name}</div>
                        <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>
                          merges into “{draft.name}”
                        </div>
                      </div>
                      <div className="mono" style={{ fontSize: 9.5, lineHeight: 1.6, paddingTop: 7 }}>
                        <div style={{ color: 'var(--text2)' }}>{childSource.label}</div>
                        <div style={{ color: childSource.warn ? 'var(--danger)' : 'var(--text3)' }}>{childSource.detail}</div>
                      </div>
                      <div style={{ fontSize: 11.5, lineHeight: 1.55, paddingTop: 6, color: 'var(--text2)' }}>
                        {childEvidence.text || <span style={{ color: 'var(--text3)' }}>No evidence recorded</span>}
                      </div>
                      <button
                        onClick={() => patch(child.candidate.id, { parentId: null })}
                        aria-label={`Un-merge ${child.name}`}
                        className="mono"
                        style={{ background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11, paddingTop: 7 }}
                      >
                        ×
                      </button>
                    </div>
                  );
                })}

                {dragId && dragId !== draft.candidate.id && (
                  <div
                    onDragOver={event => { event.preventDefault(); event.stopPropagation(); setDropHint({ id: draft.candidate.id, pos: 'into' }); }}
                    onDrop={event => { event.preventDefault(); event.stopPropagation(); applyDrop(); }}
                    className="mono"
                    style={{
                      margin: '0 6px', padding: '5px 8px', borderRadius: 4,
                      border: `1px dashed ${dropHint?.id === draft.candidate.id && dropHint.pos === 'into' ? 'var(--accent)' : 'var(--border)'}`,
                      background: dropHint?.id === draft.candidate.id && dropHint.pos === 'into' ? 'var(--tag-active-bg)' : 'transparent',
                      color: dropHint?.id === draft.candidate.id && dropHint.pos === 'into' ? 'var(--accent)' : 'var(--text3)',
                      fontSize: 9.5, textAlign: 'center',
                    }}
                  >
                    ⇣ drop here to merge into “{draft.name}”
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.7 }}>
        Drag a row by its number to reorder, or drop it under another row to merge — a merged row
        contributes its sources and evidence to the row above it.
      </div>

      {unsourced > 0 && (
        <div className="mono" style={{ fontSize: 10, color: 'var(--danger)', lineHeight: 1.7 }}>
          {unsourced} selected project{unsourced === 1 ? ' has' : 's have'} no linked sources — importing
          {unsourced === 1 ? ' it' : ' them'} would create empty projects. Let the skill attach their sources first.
        </div>
      )}

      {message && (
        <div className="mono" style={{ fontSize: 10.5, color: message.startsWith('Saved') ? 'var(--accent)' : 'var(--danger)' }}>{message}</div>
      )}

      <button
        onClick={save}
        disabled={saving || selectedCount === 0}
        className="mono"
        style={{
          width: '100%', padding: 11, background: 'var(--accent)', color: 'var(--bg)', border: 'none',
          borderRadius: 4, fontSize: 12, fontWeight: 600,
          cursor: saving || selectedCount === 0 ? 'not-allowed' : 'pointer',
          opacity: selectedCount === 0 ? 0.5 : 1,
        }}
      >
        {saving ? 'Saving…' : `Save ${selectedCount} project${selectedCount === 1 ? '' : 's'}`}
      </button>
    </div>
  );
}
