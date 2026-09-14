'use client';

import React, { useEffect, useState } from 'react';
import { Project } from '@/lib/types';

interface ProjectDetailPanelProps {
  project: Project;
  onClose: () => void;
  onSave: (project: Project) => Promise<void>;
  onDelete: (project: Project) => Promise<void>;
  projects?: Project[];
  onMerge?: (targetSlug: string, sourceSlug: string) => Promise<void>;
  onSplit?: (sourceSlug: string, newSlug: string, newTitle: string, taskIds: string[], sourceRefs: string[]) => Promise<void>;
}

const field: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
  borderRadius: 3, color: 'var(--text)', padding: '8px 9px', fontSize: 12,
  fontFamily: 'inherit', outline: 'none',
};

export function ProjectDetailPanel({ project, onClose, onSave, onDelete, projects = [], onMerge, onSplit }: ProjectDetailPanelProps) {
  const [draft, setDraft] = useState({
    title: project.title || project.name || '',
    type: (project.type || 'project') as 'project' | 'learning',
    sector: project.sector || '',
    oneLiner: project.oneLiner || '',
    logo: project.logo || '',
  });
  const [saving, setSaving] = useState(false);
  const [targetSlug, setTargetSlug] = useState(project.slug);
  const [sourceSlug, setSourceSlug] = useState('');
  const [mergeState, setMergeState] = useState('');
  const [newSlug, setNewSlug] = useState(`${project.slug}-split`);
  const [newTitle, setNewTitle] = useState(`${project.title || project.slug} split`);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [selectedSourceRefs, setSelectedSourceRefs] = useState<string[]>([]);
  const [splitState, setSplitState] = useState('');

  useEffect(() => {
    setDraft({
      title: project.title || project.name || '',
      type: (project.type || 'project') as 'project' | 'learning',
      sector: project.sector || '',
      oneLiner: project.oneLiner || '',
      logo: project.logo || '',
    });
    setNewSlug(`${project.slug}-split`);
    setNewTitle(`${project.title || project.slug} split`);
    setSelectedTaskIds([]);
    setSelectedSourceRefs([]);
    setSplitState('');
  }, [project.id]);

  async function confirmMerge() {
    if (!onMerge || !sourceSlug || targetSlug === sourceSlug) return;
    if (!window.confirm(`Merge ${sourceSlug} into ${targetSlug}? The source will be retained as a redirect.`)) return;
    setMergeState('Waiting for helper result…');
    try { await onMerge(targetSlug, sourceSlug); setMergeState('Projects merged.'); }
    catch (error) { setMergeState(error instanceof Error ? error.message : 'Project merge failed.'); }
  }

  async function confirmSplit() {
    if (!onSplit || (!selectedTaskIds.length && !selectedSourceRefs.length) || !newSlug.trim() || !newTitle.trim()) return;
    if (!window.confirm(`Split selected work into ${newTitle.trim()}?`)) return;
    setSplitState('Waiting for helper result…');
    try { await onSplit(project.slug, newSlug.trim(), newTitle.trim(), selectedTaskIds, selectedSourceRefs); setSplitState('Project split.'); }
    catch (error) { setSplitState(error instanceof Error ? error.message : 'Project split failed.'); }
  }

  async function save() {
    setSaving(true);
    try {
      await onSave({ ...project, title: draft.title, name: draft.title, type: draft.type as Project['type'], sector: draft.sector, oneLiner: draft.oneLiner, logo: draft.logo || null });
      onClose();
    } finally { setSaving(false); }
  }

  return (
    <aside className="detail-col" style={{ width: 400, height: '100%', flexShrink: 0, overflow: 'hidden', background: 'var(--surface)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
        <strong style={{ fontSize: 13 }}>Project</strong>
        <button onClick={onClose} aria-label="Close" className="mono" style={{ marginLeft: 'auto', width: 28, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text2)', cursor: 'pointer' }}>×</button>
      </div>
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div><label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>Name</label><input style={field} value={draft.title} onChange={e => setDraft(d => ({ ...d, title: e.target.value }))} /></div>
          <div><label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>Type</label><select style={field} value={draft.type} onChange={e => setDraft(d => ({ ...d, type: e.target.value as 'project' | 'learning' }))}><option value="project">Project</option><option value="learning">Learning</option></select></div>
          <div><label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>Sector</label><input style={field} value={draft.sector} onChange={e => setDraft(d => ({ ...d, sector: e.target.value }))} /></div>
          {(!project.sector || !project.oneLiner) && <div className="mono" style={{ color: 'var(--accent)', fontSize: 10 }}>Pending enrichment — add a sector and one-line story.</div>}
          <div><label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>One-line story</label><textarea style={field} rows={4} value={draft.oneLiner} onChange={e => setDraft(d => ({ ...d, oneLiner: e.target.value }))} /></div>
          <div><label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>Logo URL</label><input style={field} value={draft.logo} onChange={e => setDraft(d => ({ ...d, logo: e.target.value }))} /></div>
          {onMerge && projects.length > 1 && <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Merge projects</div>
            <label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', marginBottom: 4 }}>Target</label>
            <select aria-label="Merge target" style={field} value={targetSlug} onChange={e => setTargetSlug(e.target.value)}>{projects.map(item => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select>
            <label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', margin: '8px 0 4px' }}>Source</label>
            <select aria-label="Merge source" style={field} value={sourceSlug} onChange={e => setSourceSlug(e.target.value)}><option value="">Choose a project</option>{projects.filter(item => item.slug !== targetSlug).map(item => <option key={item.slug} value={item.slug}>{item.title}</option>)}</select>
            <button disabled={saving || !sourceSlug || targetSlug === sourceSlug} onClick={confirmMerge} className="mono" style={{ marginTop: 9, width: '100%', padding: 9, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Confirm merge</button>
            {mergeState && <div className="mono" style={{ marginTop: 7, fontSize: 10, color: mergeState.endsWith('.') && !mergeState.includes('failed') ? 'var(--accent)' : 'var(--text2)' }}>{mergeState}</div>}
          </div>}
          {onSplit && <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12 }}>
            <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Split project</div>
            <input aria-label="New project title" style={field} value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="New project title" />
            <input aria-label="New project slug" style={{ ...field, marginTop: 7 }} value={newSlug} onChange={e => setNewSlug(e.target.value)} placeholder="new-project-slug" />
            <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', margin: '9px 0 5px' }}>Select Tasks to move</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, maxHeight: 160, overflowY: 'auto' }}>
              {project.goals.flatMap(goal => goal.records.map(record => ({ record, goal }))).map(({ record, goal }) => <label key={record.id} className="mono" style={{ fontSize: 10, color: 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={selectedTaskIds.includes(record.id)} onChange={e => setSelectedTaskIds(ids => e.target.checked ? [...ids, record.id] : ids.filter(id => id !== record.id))} />{record.title} <span style={{ color: 'var(--text3)' }}>· {goal.title}</span></label>)}
            </div>
            <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', margin: '9px 0 5px' }}>Select source refs (optional)</div>
            {[...new Set(project.goals.flatMap(goal => goal.records.flatMap(record => (record as { source_refs?: string[] }).source_refs || [])))].map(ref => <label key={ref} className="mono" style={{ fontSize: 10, color: 'var(--text2)', display: 'flex', gap: 6, alignItems: 'center' }}><input type="checkbox" checked={selectedSourceRefs.includes(ref)} onChange={e => setSelectedSourceRefs(refs => e.target.checked ? [...refs, ref] : refs.filter(item => item !== ref))} />{ref}</label>)}
            <button disabled={(!selectedTaskIds.length && !selectedSourceRefs.length) || !newSlug.trim() || !newTitle.trim()} onClick={confirmSplit} className="mono" style={{ marginTop: 9, width: '100%', padding: 9, background: 'transparent', color: 'var(--accent)', border: '1px solid var(--accent)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Confirm split</button>
            {splitState && <div className="mono" style={{ marginTop: 7, fontSize: 10, color: splitState === 'Project split.' ? 'var(--accent)' : 'var(--text2)' }}>{splitState}</div>}
          </div>}
        </div>
      </div>
      <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button disabled={saving || !draft.title.trim()} onClick={save} className="mono" style={{ flex: 1, padding: 10, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{saving ? 'Saving…' : 'Save'}</button>
        <button disabled={saving} onClick={() => { if (window.confirm(`Delete “${project.title}” and every Task inside it? This cannot be undone.`)) onDelete(project); }} className="mono" style={{ padding: '10px 12px', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Delete</button>
      </div>
    </aside>
  );
}
