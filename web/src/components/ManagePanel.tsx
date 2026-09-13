'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Portfolio, Project, Record, DEFAULT_STAGES, resolveRecordStage } from '@/lib/types';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import {
  createProjectInFolder, createTaskInFolder, deleteProjectFromFolder,
  deleteRecordFromFile, saveRecordToFile, updateProjectInFolder, updateProjectStagesInFolder,
} from '@/lib/fileSystem';

/** Each panel is opened for exactly one job, so it never shows portfolio-wide controls. */
export type ManageMode =
  | { kind: 'create-project' }
  | { kind: 'edit-project'; projectSlug: string }
  | { kind: 'stages'; projectSlug: string }
  | { kind: 'new-task'; projectSlug: string; stage?: string };

interface ManagePanelProps {
  portfolio: Portfolio;
  mode: ManageMode;
  onClose: () => void;
  onRefresh: () => Promise<void>;
  onCreated?: () => void;
}

/** Local row identity, so a rename is distinguishable from a remove + add. */
interface StageRow {
  id: string;
  name: string;
}

let stageRowSeq = 0;
const nextRowId = () => `row-${++stageRowSeq}`;
const same = (a: string, b: string) => (a || '').trim().toLowerCase() === (b || '').trim().toLowerCase();

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

function ProjectFacts({ project }: { project: Project }) {
  const tasks = project.goals.reduce((sum, goal) => sum + goal.records.length, 0);
  return (
    <div className="mono" style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '9px 11px', border: '1px solid var(--border)', borderRadius: 4, background: 'var(--bg)', fontSize: 10, color: 'var(--text3)' }}>
      <span style={{ color: 'var(--text2)' }}>{project.type === 'learning' ? 'Learning' : 'Project'}</span>
      <span>{project.goals.length} purpose{project.goals.length === 1 ? '' : 's'}</span>
      <span>{tasks} task{tasks === 1 ? '' : 's'}</span>
    </div>
  );
}

export function ManagePanel({ portfolio, mode, onClose, onRefresh, onCreated }: ManagePanelProps) {
  const projectSlug = 'projectSlug' in mode ? mode.projectSlug : undefined;
  const project = useMemo(
    () => (projectSlug ? portfolio.projects.find(p => p.slug === projectSlug) : undefined),
    [portfolio.projects, projectSlug],
  );
  // Portfolio defaults are only the template new projects copy at creation time.
  const defaultStages = useMemo(() => portfolio.stages?.length ? portfolio.stages : [...DEFAULT_STAGES], [portfolio.stages]);
  const projectStages = project?.stages?.length ? project.stages : defaultStages;
  const projectTasks = useMemo<Record[]>(
    () => (project ? project.goals.flatMap(goal => goal.records) : []),
    [project],
  );

  const [newProject, setNewProject] = useState({ name: '', type: 'project' as 'project' | 'learning', sector: '', oneLiner: '' });
  const [projectDraft, setProjectDraft] = useState<Partial<Project>>({});
  const [stageRows, setStageRows] = useState<StageRow[]>([]);
  const [savedRows, setSavedRows] = useState<StageRow[]>([]);
  const [newTask, setNewTask] = useState({ title: '', purpose: '', activity: '', stage: '' });
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [stageRemoval, setStageRemoval] = useState<{ rows: StageRow[]; removed: string[]; tasks: Record[] } | null>(null);
  const [projectDeletion, setProjectDeletion] = useState(false);

  const initialTaskStage = mode.kind === 'new-task' ? mode.stage : undefined;
  // Keyed on the on-disk stage list signature, not array identity: the page polls
  // the folder every 2.5s and must not discard unsaved edits.
  const stageSignature = (project?.stages || []).join('\u0000');

  useEffect(() => {
    if (!project) {
      setStageRows([]);
      setSavedRows([]);
      return;
    }
    const rows = projectStages.map(name => ({ id: nextRowId(), name }));
    setProjectDraft({ ...project });
    setStageRows(rows);
    setSavedRows(rows);
    setNewTask({
      title: '',
      purpose: '',
      activity: '',
      stage: initialTaskStage && projectStages.some(s => same(s, initialTaskStage)) ? initialTaskStage : (projectStages[0] || ''),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [project?.id, stageSignature, initialTaskStage]);

  async function run(action: () => Promise<void>, success: string): Promise<boolean> {
    setBusy(true); setMessage('');
    try { await action(); await onRefresh(); setMessage(success); return true; }
    catch (error) { setMessage(error instanceof Error ? error.message : 'Something went wrong'); return false; }
    finally { setBusy(false); }
  }

  const createdStageRow = () => { const row = { id: nextRowId(), name: '' }; setStageRows(rows => [...rows, row]); };

  function moveStageRow(index: number, delta: number) {
    setStageRows(rows => {
      const target = index + delta;
      if (target < 0 || target >= rows.length) return rows;
      const next = [...rows];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function persistStages(rows: StageRow[], removedTasks: Record[]) {
    if (!project) return;
    await run(async () => {
      // A row that kept its identity but changed its name is a rename, so its Tasks follow it.
      const renames = savedRows
        .map(saved => ({ saved, current: rows.find(row => row.id === saved.id) }))
        .filter(entry => entry.current && !same(entry.saved.name, entry.current.name))
        .map(entry => ({ from: entry.saved.name, to: entry.current!.name.trim() }));
      for (const task of removedTasks) await deleteRecordFromFile(task.file_path);
      for (const rename of renames) {
        for (const task of projectTasks) {
          if (same(task.section || '', rename.from)) {
            await saveRecordToFile({ file_path: task.file_path, title: task.title, section: rename.to });
          }
        }
      }
      await updateProjectStagesInFolder(project.slug, rows.map(row => row.name.trim()));
      setSavedRows(rows);
    }, 'Project stages saved.');
  }

  function requestSaveStages() {
    if (!project) { setMessage('Select a project first.'); return; }
    const rows = stageRows.map(row => ({ ...row, name: row.name.trim() }));
    if (!rows.length) { setMessage('Keep at least one stage.'); return; }
    if (rows.some(row => !row.name)) { setMessage('Every stage needs a name.'); return; }
    if (new Set(rows.map(row => row.name.toLowerCase())).size !== rows.length) {
      setMessage('Stage names must be unique.');
      return;
    }

    const removed = savedRows.filter(saved => !rows.some(row => row.id === saved.id)).map(saved => saved.name);
    // Resolve the same way the board does, so the dialog lists exactly the Tasks
    // that disappear from that stage column.
    const removedTasks = project
      ? project.goals.flatMap(goal => goal.records.filter(record => (
        removed.some(name => same(name, resolveRecordStage(record, goal.stage, projectStages)))
      )))
      : [];
    if (removedTasks.length) {
      setStageRemoval({ rows, removed, tasks: removedTasks });
      return;
    }
    void persistStages(rows, []);
  }

  const headerTitle = mode.kind === 'create-project'
    ? 'New project or learning'
    : mode.kind === 'edit-project' ? `Edit · ${project?.title || projectSlug || ''}`
      : mode.kind === 'stages' ? `Stages · ${project?.title || projectSlug || ''}`
        : `New task · ${project?.title || projectSlug || ''}`;

  const missingProject = mode.kind !== 'create-project' && !project;
  const removalToken = !project ? '' : stageRemoval && stageRemoval.removed.length === 1
    ? `${project.title} / ${stageRemoval.removed[0]}`
    : project.title;

  return (
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.62)', display: 'flex', justifyContent: 'flex-end' }} onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <aside style={{ width: 420, maxWidth: '92vw', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border2)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
            <strong style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{headerTitle}</strong>
            <button onClick={onClose} aria-label="Close" style={{ ...buttonStyle, marginLeft: 'auto', width: 28, padding: 4 }}>×</button>
          </div>
          <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
            {missingProject && (
              <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.55, margin: 0 }}>This project is no longer in the portfolio.</p>
            )}

            {mode.kind === 'create-project' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.55, margin: 0 }}>
                  New projects start with the standard {defaultStages.length}-stage structure ({defaultStages.join(' · ')}) and can be adjusted afterwards.
                </p>
                <div><Label>Name</Label><input style={fieldStyle} placeholder="Name" value={newProject.name} onChange={e => setNewProject(v => ({ ...v, name: e.target.value }))} /></div>
                <div><Label>Type</Label><select style={fieldStyle} value={newProject.type} onChange={e => setNewProject(v => ({ ...v, type: e.target.value as 'project' | 'learning' }))}><option value="project">Project</option><option value="learning">Learning</option></select></div>
                <div><Label>Sector · optional</Label><input style={fieldStyle} placeholder="e.g. Marketplace SaaS" value={newProject.sector} onChange={e => setNewProject(v => ({ ...v, sector: e.target.value }))} /></div>
                <div><Label>One-line story · optional</Label><input style={fieldStyle} placeholder="What this work is" value={newProject.oneLiner} onChange={e => setNewProject(v => ({ ...v, oneLiner: e.target.value }))} /></div>
                <button
                  disabled={busy || !newProject.name.trim()}
                  onClick={async () => {
                    const created = await run(async () => {
                      await createProjectInFolder({ ...newProject });
                      setNewProject({ name: '', type: 'project', sector: '', oneLiner: '' });
                    }, 'Project created.');
                    if (created) onCreated?.();
                  }}
                  style={{ ...buttonStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }}
                >Create project</button>
              </div>
            )}

            {mode.kind === 'edit-project' && project && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ProjectFacts project={project} />
                <div><Label>Name</Label><input style={fieldStyle} value={projectDraft.title || ''} onChange={e => setProjectDraft(d => ({ ...d, title: e.target.value, name: e.target.value }))} /></div>
                <div><Label>Type</Label><select style={fieldStyle} value={projectDraft.type || 'project'} onChange={e => setProjectDraft(d => ({ ...d, type: e.target.value as Project['type'] }))}><option value="project">Project</option><option value="learning">Learning</option></select></div>
                <div><Label>Sector</Label><input style={fieldStyle} value={projectDraft.sector || ''} onChange={e => setProjectDraft(d => ({ ...d, sector: e.target.value }))} /></div>
                <div><Label>One-line story</Label><textarea style={fieldStyle} rows={2} value={projectDraft.oneLiner || ''} onChange={e => setProjectDraft(d => ({ ...d, oneLiner: e.target.value }))} /></div>
                <div><Label>Logo URL</Label><input style={fieldStyle} value={projectDraft.logo || ''} onChange={e => setProjectDraft(d => ({ ...d, logo: e.target.value }))} /></div>
                <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
                  <button disabled={busy} onClick={() => run(() => updateProjectInFolder({ ...project, ...projectDraft } as Project), 'Project saved.')} style={{ ...buttonStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }}>Save project</button>
                  <button disabled={busy} onClick={() => setProjectDeletion(true)} style={{ ...buttonStyle, color: 'var(--danger)' }}>Delete project</button>
                </div>
              </div>
            )}

            {mode.kind === 'stages' && project && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ProjectFacts project={project} />
                <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.55, margin: 0 }}>
                  These stages apply to {project.title} only. Rename, reorder, add, or remove them to match this work.
                </p>
                {stageRows.map((row, index) => (
                  <div key={row.id} style={{ display: 'flex', gap: 5 }}>
                    <input
                      style={{ ...fieldStyle, flex: 1 }}
                      value={row.name}
                      placeholder="Stage name"
                      onChange={e => setStageRows(rows => rows.map(item => item.id === row.id ? { ...item, name: e.target.value } : item))}
                    />
                    <button style={buttonStyle} disabled={index === 0} onClick={() => moveStageRow(index, -1)}>↑</button>
                    <button style={buttonStyle} disabled={index === stageRows.length - 1} onClick={() => moveStageRow(index, 1)}>↓</button>
                    <button
                      style={{ ...buttonStyle, color: 'var(--danger)' }}
                      title={`Remove ${row.name || 'stage'}`}
                      onClick={() => setStageRows(rows => rows.filter(item => item.id !== row.id))}
                    >×</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 7, marginTop: 4 }}>
                  <button style={buttonStyle} onClick={createdStageRow}>Add stage</button>
                  <button style={{ ...buttonStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }} disabled={busy} onClick={requestSaveStages}>Save stages</button>
                </div>
              </div>
            )}

            {mode.kind === 'new-task' && project && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <ProjectFacts project={project} />
                <div><Label>Stage</Label><select style={fieldStyle} value={newTask.stage} onChange={e => setNewTask(v => ({ ...v, stage: e.target.value }))}>{projectStages.map(stage => <option key={stage} value={stage}>{stage}</option>)}</select></div>
                <div><Label>Purpose</Label><input style={fieldStyle} placeholder="What this workstream is for" value={newTask.purpose} onChange={e => setNewTask(v => ({ ...v, purpose: e.target.value }))} /></div>
                <div><Label>Task title</Label><input style={fieldStyle} placeholder="What you did" value={newTask.title} onChange={e => setNewTask(v => ({ ...v, title: e.target.value }))} /></div>
                <div><Label>Activities · comma separated</Label><input style={fieldStyle} value={newTask.activity} onChange={e => setNewTask(v => ({ ...v, activity: e.target.value }))} /></div>
                <button
                  disabled={busy || !newTask.title.trim() || !newTask.purpose.trim() || !newTask.stage}
                  style={{ ...buttonStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }}
                  onClick={() => run(async () => {
                    await createTaskInFolder({
                      project, purposeName: newTask.purpose, stage: newTask.stage, title: newTask.title,
                      activities: newTask.activity.split(',').map(value => value.trim()).filter(Boolean),
                    });
                    setNewTask(v => ({ ...v, title: '', purpose: '', activity: '' }));
                  }, 'Task created.')}
                >Create task</button>
              </div>
            )}

            {message && <div className="mono" style={{ marginTop: 14, fontSize: 10, color: message.endsWith('.') ? 'var(--accent)' : 'var(--danger)' }}>{message}</div>}
          </div>
        </aside>
      </div>

      {stageRemoval && project && (
        <ConfirmDialog
          open
          danger
          title={`Remove ${stageRemoval.removed.join(', ')} from ${project.title}?`}
          message={<>
            <p style={{ margin: 0 }}>This Stage and its {stageRemoval.tasks.length} Task{stageRemoval.tasks.length === 1 ? '' : 's'} in {project.title} will be deleted. This cannot be undone.</p>
            <ul style={{ margin: '10px 0 0', paddingLeft: 18 }}>
              {stageRemoval.tasks.slice(0, 8).map(task => <li key={task.id} style={{ marginBottom: 3 }}>{task.title}</li>)}
            </ul>
            {stageRemoval.tasks.length > 8 && <p style={{ margin: '8px 0 0' }}>+{stageRemoval.tasks.length - 8} more</p>}
          </>}
          confirmLabel="Delete stage"
          requireText={removalToken}
          onCancel={() => setStageRemoval(null)}
          onConfirm={() => {
            const request = stageRemoval;
            setStageRemoval(null);
            void persistStages(request.rows, request.tasks);
          }}
        />
      )}

      {projectDeletion && project && (
        <ConfirmDialog
          open
          danger
          title={`Delete ${project.title}?`}
          message={<p style={{ margin: 0 }}>This deletes the project and its {projectTasks.length} Task{projectTasks.length === 1 ? '' : 's'}. This cannot be undone.</p>}
          confirmLabel="Delete project"
          requireText={project.title}
          onCancel={() => setProjectDeletion(false)}
          onConfirm={() => {
            const slug = project.slug;
            setProjectDeletion(false);
            void run(async () => { await deleteProjectFromFolder(slug); }, 'Project deleted.').then(deleted => { if (deleted) onClose(); });
          }}
        />
      )}
    </>
  );
}
