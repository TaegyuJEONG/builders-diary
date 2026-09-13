'use client';

import React, { useState } from 'react';
import { Project, Goal, Record, DEFAULT_STAGES, normalizeStage, stageMeta, resolveRecordStage } from '@/lib/types';
import { FilterState, recordPasses, buildProjectToolbox } from '@/lib/portfolio';

// ────────────────────────────────────────────────────────────────────────────
// 3-level view: Project cards (row) → Section boards → Task cards.
// The project row is the recruiter's first impression (sector / one-liner);
// selecting a project reveals its lifecycle sections, each holding its task cards
// with a progress rollup. Task click opens the right detail panel (handled by parent).
// ────────────────────────────────────────────────────────────────────────────

function initials(name: string): string {
  return (name || '?')
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w[0]?.toUpperCase() || '')
    .join('');
}

function Toolbox({ project }: { project: Project }) {
  const [open, setOpen] = useState(false);
  const groups = buildProjectToolbox(project);
  const count = groups.reduce((sum, group) => sum + group.tools.length, 0);
  if (count === 0) return null;

  return (
    <div style={{ marginTop: 2 }} onClick={e => e.stopPropagation()}>
      <button
        className="mono"
        onClick={() => setOpen(v => !v)}
        style={{
          border: '1px solid var(--border)', background: 'transparent', color: 'var(--text3)',
          borderRadius: 3, padding: '3px 7px', fontSize: 9, cursor: 'pointer',
        }}
      >
        Toolbox · {count} {open ? '⌃' : '⌄'}
      </button>
      {open && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 7 }}>
          {groups.map(group => (
            <div key={group.category}>
              <div className="mono" style={{ fontSize: 8.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 4 }}>
                {group.category}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {group.tools.map(tool => (
                  <span key={tool} className="mono" style={{ fontSize: 9, color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 3, padding: '2px 5px' }}>
                    {tool}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Project card (row 1) ──
function ProjectCard({
  project, selected, onSelect, onEdit, onDropProject,
}: {
  project: Project; selected: boolean; onSelect: () => void; onEdit?: () => void; onDropProject?: (sourceId: string, targetId: string) => void;
}) {
  const taskCount = project.goals.reduce((s, g) => s + g.records.length, 0);
  return (
    <div
      onClick={onSelect}
      draggable
      onDragStart={e => { e.dataTransfer.setData('application/x-bd-project', project.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); const source = e.dataTransfer.getData('application/x-bd-project'); if (source && source !== project.id) onDropProject?.(source, project.id); }}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(); }}
      style={{
        width: 260, minWidth: 260, flexShrink: 0,
        background: 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 7, padding: '14px 15px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 9,
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? '0 0 0 1px var(--accent), 0 4px 16px rgba(74,222,128,0.07)' : 'none',
        position: 'relative',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
    >
      <button onClick={e => { e.stopPropagation(); onEdit?.(); }} title={`Edit ${project.title || project.slug}`} aria-label={`Edit ${project.title || project.slug}`} style={{ position: 'absolute', top: 8, right: 8, width: 24, height: 24, border: '1px solid var(--border)', borderRadius: 4, background: 'var(--surface)', color: 'var(--text2)', cursor: 'pointer', fontSize: 12 }}>✎</button>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        {/* Logo or initial badge */}
        {project.logo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={project.logo} alt="" style={{ width: 38, height: 38, borderRadius: 7, objectFit: 'cover', flexShrink: 0 }} />
        ) : (
          <div style={{
            width: 38, height: 38, borderRadius: 7, flexShrink: 0,
            background: 'var(--tag-active-bg)', color: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 700, letterSpacing: '0.02em',
          }}>
            {initials(project.name || project.title)}
          </div>
        )}
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 14, fontWeight: 650, color: 'var(--text)', lineHeight: 1.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {project.name || project.title}
          </div>
          {project.sector && (
            <div className="mono" style={{ fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 3 }}>
              {project.sector}
            </div>
          )}
        </div>
      </div>

      {project.oneLiner && (
        <div style={{ fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
          {project.oneLiner}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
        <Toolbox project={project} />
        <span className="mono" style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>
          {taskCount} task{taskCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

// ── Task card (inside a section box) ──
function TaskCard({
  record, selected, filterState, stacked = false, draggable: isDraggable = true, onSelect, onDropTask,
}: {
  record: Record; selected: boolean; filterState: FilterState; stacked?: boolean; draggable?: boolean; onSelect: () => void; onDropTask?: (sourceId: string, beforeId?: string) => void;
}) {
  const ev = record.evidence || [];
  const hasHighlight = !!record.highlight || !!record.judgment || ev.some(e => e.type === 'judgment');
  const tools = record.tools || [];

  return (
    <div
      data-rid={record.id}
      onClick={onSelect}
      draggable={isDraggable}
      onDragStart={e => { e.stopPropagation(); e.dataTransfer.setData('application/x-bd-task', record.id); e.dataTransfer.effectAllowed = 'move'; }}
      onDragOver={e => e.preventDefault()}
      onDrop={e => { e.preventDefault(); e.stopPropagation(); const source = e.dataTransfer.getData('application/x-bd-task'); if (source && source !== record.id) onDropTask?.(source, record.id); }}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(); }}
      style={{
        width: stacked ? '100%' : 236, minWidth: stacked ? 0 : 236, flexShrink: 0, alignSelf: 'flex-start',
        background: 'var(--bg)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 5, padding: '10px 11px', cursor: 'pointer',
        display: 'flex', flexDirection: 'column',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected ? '0 0 0 1px var(--accent)' : 'none',
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
    >
      {/* Date only. Progress is deliberately absent: this is a record, not PM software. */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--text3)' }}>
          {record.date || record.created_at?.slice(0, 10)}
        </span>
      </div>

      {/* source project — especially useful in Section/Tool cross-project views */}
      {record.projectTitle && (
        <div className="mono" style={{ fontSize: 8.5, color: 'var(--text3)', marginBottom: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {record.projectTitle}
        </div>
      )}

      {/* title */}
      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
        {record.title}
      </div>

      {/* purpose */}
      {(record.purpose || record.subPurpose) && (
        <div style={{ fontSize: 10.5, color: 'var(--text2)', lineHeight: 1.5, marginTop: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
          {record.purpose || record.subPurpose}
        </div>
      )}

      {(record.activities || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {(record.activities || []).map(activity => {
            const active = filterState.activity === activity;
            return (
              <span key={activity} className="mono" style={{
                fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
                background: active ? 'var(--tag-active-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text3)',
                border: `1px solid ${active ? 'var(--accent-dim)' : 'var(--border)'}`,
                whiteSpace: 'nowrap',
              }}>
                {activity}
              </span>
            );
          })}
        </div>
      )}

      {/* tools */}
      {tools.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {tools.slice(0, 3).map(t => {
            const active = filterState.tools.includes(t);
            return (
              <span key={t} className="mono" style={{
                fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
                background: active ? 'var(--tag-active-bg)' : 'var(--tag-bg)',
                color: active ? 'var(--accent)' : 'var(--text2)',
                border: `1px solid ${active ? 'var(--accent-dim)' : 'var(--border)'}`,
                whiteSpace: 'nowrap',
              }}>
                {t}
              </span>
            );
          })}
          {tools.length > 3 && (
            <span className="mono" style={{ fontSize: 8.5, color: 'var(--text3)' }}>+{tools.length - 3}</span>
          )}
        </div>
      )}

      {(record.mindset || []).length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 5 }}>
          {(record.mindset || []).slice(0, 3).map(t => {
            const active = filterState.mindset.includes(t);
            return (
              <span key={t} className="mono" style={{
                fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
                background: active ? 'var(--tag-active-bg)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text3)',
                border: `1px solid ${active ? 'var(--accent-dim)' : 'var(--border)'}`,
                whiteSpace: 'nowrap',
              }}>
                {t}
              </span>
            );
          })}
        </div>
      )}

      {/* signal row */}
      {(hasHighlight || ev.length > 0) && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 8, paddingTop: 7, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
          {hasHighlight && (
            <span className="mono" title="AI-vs-builder judgment" style={{
              fontSize: 8.5, padding: '2px 6px', borderRadius: 3,
              background: 'var(--tag-active-bg)', color: 'var(--accent)', border: '1px solid var(--accent-dim)', whiteSpace: 'nowrap',
            }}>
              ◆ judgment
            </span>
          )}
          {ev.length > 0 && (
            <span className="mono" title={`${ev.length} evidence`} style={{
              fontSize: 8.5, padding: '2px 6px', borderRadius: 3,
              background: 'var(--tag-bg)', color: 'var(--text2)', border: '1px solid var(--border)', whiteSpace: 'nowrap',
            }}>
              ✓ {ev.length} evidence
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Stage board: lifecycle stage → Task cards. Purpose belongs inside each Task. ──
function PurposeStageBoard({
  goals, stages, selectedGoalId, filterState, selectedRecordId, onSelectRecord,
  onDropTaskToStage, onCreateTask, onDeleteStage,
  onDropStage, onCreateStage, editable = false,
}: {
  goals: Goal[];
  stages: string[];
  selectedGoalId: string | null;
  filterState: FilterState;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
  onDropTaskToStage?: (sourceId: string, targetStage: string, beforeId?: string) => void;
  onCreateTask?: (stage: string) => void;
  onDeleteStage?: (stage: string) => void;
  onDropStage?: (sourceStage: string, targetStage: string) => void;
  onCreateStage?: () => void;
  /** Stages belong to one project, so editing is offered only in a single-project view. */
  editable?: boolean;
}) {
  const stageGroups = new Map<string, Record[]>();
  for (const goal of goals) {
    if (selectedGoalId && goal.id !== selectedGoalId) continue;
    for (const record of goal.records) {
      if (!recordPasses(record, filterState)) continue;
      const stage = resolveLifecycleStage(record, goal.stage, stages);
      if (!stageGroups.has(stage)) stageGroups.set(stage, []);
      stageGroups.get(stage)!.push(record);
    }
  }

  const stageNames = [...new Set([...stages, ...stageGroups.keys()])];
  const orderedStages = stageNames
    .map(stage => [stage, stageGroups.get(stage) || []] as [string, Record[]])
    .sort(([a], [b]) => stageMeta(a, stages).order - stageMeta(b, stages).order || a.localeCompare(b));
  if (orderedStages.length === 0) {
    return (
      <div className="mono" style={{ padding: '30px 24px', color: 'var(--text3)', fontSize: 12 }}>
        No tasks match these filters.
      </div>
    );
  }

  return (
    <div className="thin-scroll" style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 14, padding: '16px 20px 24px', overflowX: 'auto', overflowY: 'hidden', height: '100%' }}>
      {orderedStages.map(([stage, records]) => {
        const color = stageMeta(stage, stages).color;
        return (
          <div key={stage} draggable={editable} onDragStart={e => { e.dataTransfer.setData('application/x-bd-stage', stage); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!editable) return; const task = e.dataTransfer.getData('application/x-bd-task'); const sourceStage = e.dataTransfer.getData('application/x-bd-stage'); if (task) onDropTaskToStage?.(task, stage); else if (sourceStage && sourceStage !== stage) onDropStage?.(sourceStage, stage); }} style={{ width: 280, minWidth: 280, height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', border: `1px solid ${records.length ? 'var(--border)' : 'rgba(255,255,255,.06)'}`, borderRadius: 7, background: records.length ? 'var(--surface)' : 'rgba(0,0,0,.22)', overflow: 'hidden', flexShrink: 0, opacity: records.length ? 1 : .78 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '9px 13px', borderBottom: '1px solid var(--border)' }} onDragOver={e => e.preventDefault()}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, opacity: records.length ? 1 : .35, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 650, color: records.length ? 'var(--text)' : 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{stage}</span>
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--text3)' }}>{records.length} task{records.length === 1 ? '' : 's'}</span>
              {editable && <button onClick={() => onCreateTask?.(stage)} title={`Add task to ${stage}`} className="mono" style={{ marginLeft: 'auto', width: 22, height: 22, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', borderRadius: 3, cursor: 'pointer' }}>+</button>}
              {editable && <button onClick={() => onDeleteStage?.(stage)} title={`Delete ${stage}`} className="mono" style={{ width: 22, height: 22, border: '1px solid var(--border)', background: 'transparent', color: 'var(--danger)', borderRadius: 3, cursor: 'pointer' }}>×</button>}
            </div>
            <div className="thin-scroll" style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 10, padding: '12px 13px', overflowY: 'auto', overflowX: 'hidden' }}>
              {records.length === 0 && <div className="mono" style={{ flex: 1, minHeight: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', opacity: .65, fontSize: 11 }}>No tasks yet</div>}
              {records.map(record => (
                <TaskCard
                  key={record.id}
                  record={record}
                  selected={record.id === selectedRecordId}
                  filterState={filterState}
                  stacked
                  draggable={editable}
                  onDropTask={(sourceId, beforeId) => onDropTaskToStage?.(sourceId, stage, beforeId)}
                  onSelect={() => onSelectRecord(record.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
      {editable && <button onClick={onCreateStage} title="Create stage" className="mono" style={{ width: 280, minWidth: 280, height: 58, alignSelf: 'flex-start', border: '1px dashed var(--border2)', borderRadius: 7, background: 'transparent', color: 'var(--text2)', fontSize: 12, cursor: 'pointer' }}>+ Stage</button>}
    </div>
  );
}

// ── Section board (cross-project Section / Tool exploration) ──
function SectionBoard({
  goals, selectedGoalId, filterState, selectedRecordId, onSelectRecord,
}: {
  goals: Goal[];
  selectedGoalId: string | null;
  filterState: FilterState;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
}) {
  // Older stores used human goal names instead of lifecycle stages. Merge those
  // records into lifecycle boxes in memory; no on-disk migration is needed.
  const allRecordsHaveSections = goals.length > 0 && goals.every(g => g.records.every(r => !!r.section));
  const crossToolGoals = goals.some(g => (g.stage || '').startsWith('Tool ·'));
  const hasLifecycleGoals = crossToolGoals || goals.some(g => !!g.stage) || allRecordsHaveSections;
  const sourceGoals = hasLifecycleGoals ? goals : (() => {
    const grouped = new Map<string, { source: Goal; records: Record[] }>();
    for (const goal of goals) {
      for (const record of goal.records) {
        const stage = resolveLifecycleStage(record, goal.stage);
        if (!grouped.has(stage)) grouped.set(stage, { source: goal, records: [] });
        grouped.get(stage)!.records.push(record);
      }
    }
    return [...grouped.entries()].map(([stage, group]) => ({
      ...group.source,
      id: `legacy-section-${stage.toLowerCase()}`,
      slug: stage.toLowerCase(),
      title: stage,
      stage,
      order: stageMeta(stage).order,
      records: group.records,
    }));
  })();

  // Apply the existing Header filters to the cards inside each section.
  const visibleGoals = sourceGoals.map(g => ({
    ...g,
    records: g.records.filter(r => recordPasses(r, filterState)),
  }));
  const nonEmpty = visibleGoals
    .filter(g => !selectedGoalId || g.id === selectedGoalId)
    .filter(g => g.records.length > 0);
  if (nonEmpty.length === 0) {
    return (
      <div className="mono" style={{ padding: '30px 24px', color: 'var(--text3)', fontSize: 12 }}>
        No tasks in this project yet.
      </div>
    );
  }
  return (
    <div className="thin-scroll" style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '16px 20px 24px', overflowY: 'auto', height: '100%' }}>
      {nonEmpty.map(g => {
        const stage = g.stage || g.title;
        const color = stageMeta(stage as string).color;
        return (
          <div key={g.id} style={{
            border: '1px solid var(--border)', borderRadius: 7,
            background: 'var(--surface)', overflow: 'hidden', flexShrink: 0,
          }}>
            {/* section header */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              padding: '9px 13px', borderBottom: '1px solid var(--border)',
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ fontSize: 12.5, fontWeight: 650, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                {stage}
              </span>
              <span className="mono" style={{ fontSize: 9.5, color: 'var(--text3)' }}>
                {g.records.length}
              </span>

            </div>
            {/* task cards — horizontal scroll within the box */}
            <div className="thin-scroll" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 13px', overflowX: 'auto' }}>
              {g.records.map(r => (
                <TaskCard
                  key={r.id}
                  record={r}
                  selected={r.id === selectedRecordId}
                  filterState={filterState}
                  onSelect={() => onSelectRecord(r.id)}
                />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export type ExploreMode = 'project' | 'section' | 'tool';

function resolveLifecycleStage(
  record: Record,
  goalStage?: string,
  stages: string[] = [...DEFAULT_STAGES],
): string {
  return resolveRecordStage(record, goalStage, stages);
}

function crossProjectGoals(projects: Project[], mode: ExploreMode): Goal[] {
  const groups = new Map<string, Record[]>();
  for (const project of projects) {
    for (const goal of project.goals) {
      for (const record of goal.records) {
        const keys = mode === 'section'
          ? [resolveLifecycleStage(record, goal.stage)]
          : ((record.tools && record.tools.length > 0) ? record.tools : ['Unspecified']);
        for (const key of keys) {
          if (!groups.has(key)) groups.set(key, []);
          groups.get(key)!.push(record);
        }
      }
    }
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, records]) => ({
      id: `cross-${mode}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      slug: key.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: key,
      stage: mode === 'section' ? key : `Tool · ${key}`,
      order: stageMeta(key).order,
      records,
    }));
}

// ── Top-level 3-level view ──
export function ProjectSectionView({
  projects, stages = [...DEFAULT_STAGES], selectedProjectId, selectedGoalId, filterState, mode, onModeChange, onSelectProject,
  selectedRecordId, onSelectRecord, onDropProject, onEditProject, onCreateProject, onDropTaskToStage, onCreateTask, onDeleteStage, onDropStage, onCreateStage,
}: {
  projects: Project[];
  stages?: string[];
  selectedProjectId: string | null;
  selectedGoalId: string | null;
  filterState: FilterState;
  mode: ExploreMode;
  onModeChange: (mode: ExploreMode) => void;
  onSelectProject: (id: string) => void;
  onDropProject?: (sourceId: string, targetId: string) => void;
  onEditProject?: (id: string) => void;
  onCreateProject?: () => void;
  onDropTaskToStage?: (sourceId: string, targetStage: string, beforeId?: string) => void;
  onCreateTask?: (stage: string) => void;
  onDeleteStage?: (stage: string) => void;
  onDropStage?: (sourceStage: string, targetStage: string) => void;
  onCreateStage?: () => void;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
}) {
  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const active = projects.find(p => p.id === selectedProjectId) || null;
  const activeStages = active?.stages?.length ? active.stages : stages;
  const visibleGoals = active ? active.goals : projects.flatMap(p => p.goals);
  const crossGoals = mode === 'project' ? [] : crossProjectGoals(projects, mode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {mode === 'project' ? (
        <>
          {/* Row 1: project cards */}
          <div className="thin-scroll" style={{
            display: 'flex', gap: 12, padding: '9px 20px 14px',
            overflowX: 'auto', flexShrink: 0,
            borderBottom: '1px solid var(--border)',
          }}>
            {projects.map(p => (
              <ProjectCard
                key={p.id}
                project={p}
                selected={p.id === selectedProjectId}
                onSelect={() => onSelectProject(p.id)}
                onEdit={() => onEditProject?.(p.id)}
                onDropProject={onDropProject}
              />
            ))}
            <button onClick={onCreateProject} className="mono" title="Create project or learning" style={{ width: 38, minWidth: 38, height: 38, alignSelf: 'center', border: '1px dashed var(--border2)', background: 'transparent', color: 'var(--text2)', borderRadius: 5, fontSize: 18, cursor: 'pointer' }}>+</button>
          </div>

          {/* Row 2: sections of the selected project */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {active || visibleGoals.length > 0 ? (
              <PurposeStageBoard
                goals={visibleGoals}
                stages={activeStages}
                selectedGoalId={selectedGoalId}
                filterState={filterState}
                selectedRecordId={selectedRecordId}
                onSelectRecord={onSelectRecord}
                onDropTaskToStage={onDropTaskToStage}
                onCreateTask={onCreateTask}
                onDeleteStage={onDeleteStage}
                onDropStage={onDropStage}
                onCreateStage={onCreateStage}
                editable={!!active}
              />
            ) : (
              <div className="mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 12 }}>
                No tasks yet.
              </div>
            )}
          </div>
        </>
      ) : (
        <div style={{ flex: 1, minHeight: 0 }}>
          <SectionBoard
            goals={crossGoals}
            selectedGoalId={null}
            filterState={filterState}
            selectedRecordId={selectedRecordId}
            onSelectRecord={onSelectRecord}
          />
        </div>
      )}
    </div>
  );
}
