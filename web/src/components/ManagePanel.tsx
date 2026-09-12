'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Portfolio, Project } from '@/lib/types';
import {
  createProjectInFolder, createTaskInFolder, deleteProjectFromFolder,
  loadFolderHandleFromStorage, updateProjectInFolder, writeStages,
} from '@/lib/fileSystem';

interface ManagePanelProps {
  portfolio: Portfolio;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

const fieldStyle: React.CSSProperties = {
  width: '100%', background: 'var(--bg)', border: '1px solid var(--border2)',
  color: 'var(--text)', borderRadius: 3, padding: '7px 8px', fontSize: 12,
  fontFamily: 'inherit', outline: 'none',
};
const buttonStyle: React.CSSProperties = {
  background: 'transparent', border: '1px solid var(--border)', borderRadius: 3,
  color: 'var(--text2)', padding: '5px 9px', fontSize: 10, cursor: 'pointer',
  fontFamily: 'IBM Plex Mono, monospace',
};

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 5 }}>{children}</div>;
}

export function ManagePanel({ portfolio, onClose, onRefresh }: ManagePanelProps) {
  const [tab, setTab] = useState<'projects' | 'stages' | 'task'>('projects');
  const [stages, setStages] = useState<string[]>(portfolio.stages || ['Discovery', 'Build', 'Growth']);
  const [selectedSlug, setSelectedSlug] = useState(portfolio.projects[0]?.slug || '');
  const selected = useMemo(() => portfolio.projects.find(p => p.slug === selectedSlug), [portfolio.projects, selectedSlug]);
  const [projectDraft, setProjectDraft] = useState<Partial<Project>>({});
  const [newProject, setNewProject] = useState({ name: '', type: 'project' as 'project' | 'learning', sector: '', oneLiner: '', logo: '' });
  const [newTask, setNewTask] = useState({ projectSlug: portfolio.projects[0]?.slug || '', title: '', purpose: '', stage: stages[0] || 'Discovery' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (!selected) return;
    setProjectDraft({ ...selected });
  }, [selected?.id]);

  async function run(action: () => Promise<void>, success: string) {
    setBusy(true); setMessage('');
    try { await action(); await onRefresh(); setMessage(success); }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong'); }
    finally { setBusy(false); }
  }

  async function saveStages() {
    const cleaned = stages.map(s => s.trim()).filter((s, i, all) => s && all.findIndex(x => x.toLowerCase() === s.toLowerCase()) === i);
    if (!cleaned.length) { setMessage('Keep at least one stage.'); return; }
    const root = await loadFolderHandleFromStorage();
    if (!root) { setMessage('Folder is not connected.'); return; }
    await run(async () => { await writeStages(root as any, cleaned); setStages(cleaned); }, 'Stages saved.');
  }

  async function moveProject(index: number, delta: number) {
    const next = [...portfolio.projects];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    await run(async () => {
      for (let i = 0; i < next.length; i++) await updateProjectInFolder({ ...next[i], order: i });
    }, 'Project order saved.');
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.62)', display: 'flex', justifyContent: 'flex-end' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside style={{ width: 420, maxWidth: '92vw', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <strong style={{ fontSize: 13 }}>Manage portfolio</strong>
          <button onClick={onClose} aria-label="Close" style={{ ...buttonStyle, marginLeft: 'auto', width: 28, padding: 4 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 5, padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
          {(['projects', 'stages', 'task'] as const).map(value => (
            <button key={value} onClick={() => setTab(value)} style={{ ...buttonStyle, color: tab === value ? 'var(--accent)' : 'var(--text2)', borderColor: tab === value ? 'var(--accent)' : 'var(--border)' }}>
              {value === 'task' ? 'New task' : value[0].toUpperCase() + value.slice(1)}
            </button>
          ))}
        </div>
        <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          {tab === 'projects' && (
            <>
              <Label>Order and select</Label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 18 }}>
                {portfolio.projects.map((project, index) => (
                  <div key={project.id} style={{ display: 'flex', gap: 5 }}>
                    <button onClick={() => setSelectedSlug(project.slug)} style={{ ...buttonStyle, flex: 1, textAlign: 'left', color: selectedSlug === project.slug ? 'var(--accent)' : 'var(--text2)' }}>
                      {project.type === 'learning' ? 'Learning · ' : ''}{project.title || project.slug}
                    </button>
                    <button onClick={() => moveProject(index, -1)} disabled={busy || index === 0} style={buttonStyle}>↑</button>
                    <button onClick={() => moveProject(index, 1)} disabled={busy || index === portfolio.projects.length - 1} style={buttonStyle}>↓</button>
                  </div>
                ))}
              </div>
              {selected && (
                <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div><Label>Name</Label><input style={fieldStyle} value={projectDraft.title || ''} onChange={e => setProjectDraft(d => ({ ...d, title: e.target.value, name: e.target.value }))} /></div>
                  <div><Label>Type</Label><select style={fieldStyle} value={projectDraft.type || 'project'} onChange={e => setProjectDraft(d => ({ ...d, type: e.target.value as Project['type'] }))}><option value="project">Project</option><option value="learning">Learning</option></select></div>
                  <div><Label>Sector</Label><input style={fieldStyle} value={projectDraft.sector || ''} onChange={e => setProjectDraft(d => ({ ...d, sector: e.target.value }))} /></div>
                  <div><Label>One-line story</Label><textarea style={fieldStyle} rows={2} value={projectDraft.oneLiner || ''} onChange={e => setProjectDraft(d => ({ ...d, oneLiner: e.target.value }))} /></div>
                  <div><Label>Logo URL</Label><input style={fieldStyle} value={projectDraft.logo || ''} onChange={e => setProjectDraft(d => ({ ...d, logo: e.target.value }))} /></div>
                  <div style={{ display: 'flex', gap: 7 }}>
                    <button disabled={busy} onClick={() => run(() => updateProjectInFolder({ ...selected, ...projectDraft } as Project), 'Project saved.')} style={{ ...buttonStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }}>Save project</button>
                    <button disabled={busy} onClick={() => {
                      if (!window.confirm(`Delete “${selected.title}” and every Task inside it? This cannot be undone.`)) return;
                      run(() => deleteProjectFromFolder(selected.slug), 'Project deleted.');
                    }} style={{ ...buttonStyle, color: 'var(--danger)' }}>Delete project</button>
                  </div>
                </div>
              )}
              <div style={{ borderTop: '1px solid var(--border)', marginTop: 20, paddingTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
                <Label>Create project or learning</Label>
                <input style={fieldStyle} placeholder="Name" value={newProject.name} onChange={e => setNewProject(v => ({ ...v, name: e.target.value }))} />
                <select style={fieldStyle} value={newProject.type} onChange={e => setNewProject(v => ({ ...v, type: e.target.value as 'project' | 'learning' }))}><option value="project">Project</option><option value="learning">Learning</option></select>
                <input style={fieldStyle} placeholder="Sector (optional)" value={newProject.sector} onChange={e => setNewProject(v => ({ ...v, sector: e.target.value }))} />
                <input style={fieldStyle} placeholder="One-line story (optional)" value={newProject.oneLiner} onChange={e => setNewProject(v => ({ ...v, oneLiner: e.target.value }))} />
                <button disabled={busy || !newProject.name.trim()} onClick={() => run(async () => { await createProjectInFolder(newProject); setNewProject({ name: '', type: 'project', sector: '', oneLiner: '', logo: '' }); }, 'Created.')} style={{ ...buttonStyle, color: 'var(--accent)' }}>Create</button>
              </div>
            </>
          )}
          {tab === 'stages' && (
            <>
              <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.55, margin: '0 0 14px' }}>Stages group Tasks. Rename, reorder, add, or remove them to match how you work.</p>
              {stages.map((stage, index) => (
                <div key={`${index}-${stage}`} style={{ display: 'flex', gap: 5, marginBottom: 6 }}>
                  <input style={{ ...fieldStyle, flex: 1 }} value={stage} onChange={e => setStages(v => v.map((s, i) => i === index ? e.target.value : s))} />
                  <button style={buttonStyle} onClick={() => setStages(v => { const n = [...v]; if (index > 0) [n[index - 1], n[index]] = [n[index], n[index - 1]]; return n; })}>↑</button>
                  <button style={buttonStyle} onClick={() => setStages(v => { const n = [...v]; if (index < n.length - 1) [n[index + 1], n[index]] = [n[index], n[index + 1]]; return n; })}>↓</button>
                  <button style={{ ...buttonStyle, color: 'var(--danger)' }} onClick={() => setStages(v => v.filter((_, i) => i !== index))}>×</button>
                </div>
              ))}
              <div style={{ display: 'flex', gap: 7, marginTop: 10 }}><button style={buttonStyle} onClick={() => setStages(v => [...v, 'New stage'])}>Add stage</button><button style={{ ...buttonStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }} disabled={busy} onClick={saveStages}>Save stages</button></div>
            </>
          )}
          {tab === 'task' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.55, margin: 0 }}>Create the shell now, then edit its full story and chips from the Task panel.</p>
              <div><Label>Project</Label><select style={fieldStyle} value={newTask.projectSlug} onChange={e => setNewTask(v => ({ ...v, projectSlug: e.target.value }))}>{portfolio.projects.map(p => <option key={p.id} value={p.slug}>{p.title}</option>)}</select></div>
              <div><Label>Stage</Label><select style={fieldStyle} value={newTask.stage} onChange={e => setNewTask(v => ({ ...v, stage: e.target.value }))}>{stages.map(s => <option key={s} value={s}>{s}</option>)}</select></div>
              <div><Label>Purpose</Label><input style={fieldStyle} value={newTask.purpose} onChange={e => setNewTask(v => ({ ...v, purpose: e.target.value }))} /></div>
              <div><Label>Task title</Label><input style={fieldStyle} value={newTask.title} onChange={e => setNewTask(v => ({ ...v, title: e.target.value }))} /></div>
              <button disabled={busy || !newTask.projectSlug || !newTask.title.trim() || !newTask.purpose.trim()} style={{ ...buttonStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }} onClick={() => {
                const project = portfolio.projects.find(p => p.slug === newTask.projectSlug);
                if (!project) return;
                run(async () => { await createTaskInFolder({ project, purposeName: newTask.purpose, stage: newTask.stage, title: newTask.title }); setNewTask(v => ({ ...v, title: '', purpose: '' })); }, 'Task created.');
              }}>Create task</button>
            </div>
          )}
          {message && <div className="mono" style={{ marginTop: 14, fontSize: 10, color: message.endsWith('.') ? 'var(--accent)' : 'var(--danger)' }}>{message}</div>}
        </div>
      </aside>
    </div>
  );
}
