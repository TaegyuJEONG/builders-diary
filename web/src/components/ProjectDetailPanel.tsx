'use client';

import React, { useEffect, useState } from 'react';
import { Project } from '@/lib/types';

interface ProjectDetailPanelProps {
  project: Project;
  onClose: () => void;
  onSave: (project: Project) => Promise<void>;
  onDelete: (project: Project) => Promise<void>;
}

const field: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
  borderRadius: 3, color: 'var(--text)', padding: '8px 9px', fontSize: 12,
  fontFamily: 'inherit', outline: 'none',
};

export function ProjectDetailPanel({ project, onClose, onSave, onDelete }: ProjectDetailPanelProps) {
  const [draft, setDraft] = useState({
    title: project.title || project.name || '',
    type: (project.type || 'project') as 'project' | 'learning',
    sector: project.sector || '',
    oneLiner: project.oneLiner || '',
    logo: project.logo || '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft({
      title: project.title || project.name || '',
      type: (project.type || 'project') as 'project' | 'learning',
      sector: project.sector || '',
      oneLiner: project.oneLiner || '',
      logo: project.logo || '',
    });
  }, [project.id]);

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
          <div><label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>One-line story</label><textarea style={field} rows={4} value={draft.oneLiner} onChange={e => setDraft(d => ({ ...d, oneLiner: e.target.value }))} /></div>
          <div><label className="mono" style={{ display: 'block', fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 5 }}>Logo URL</label><input style={field} value={draft.logo} onChange={e => setDraft(d => ({ ...d, logo: e.target.value }))} /></div>
        </div>
      </div>
      <div style={{ padding: 14, borderTop: '1px solid var(--border)', display: 'flex', gap: 8 }}>
        <button disabled={saving || !draft.title.trim()} onClick={save} className="mono" style={{ flex: 1, padding: 10, background: 'var(--accent)', color: 'var(--bg)', border: 'none', borderRadius: 4, cursor: 'pointer', fontSize: 11, fontWeight: 600 }}>{saving ? 'Saving…' : 'Save'}</button>
        <button disabled={saving} onClick={() => { if (window.confirm(`Delete “${project.title}” and every Task inside it? This cannot be undone.`)) onDelete(project); }} className="mono" style={{ padding: '10px 12px', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 4, cursor: 'pointer', fontSize: 11 }}>Delete</button>
      </div>
    </aside>
  );
}
