'use client';

import React from 'react';
import { Project, Goal, Record, SECTION_META, PROGRESS_META, Progress } from '@/lib/types';
import { FilterState, recordPasses } from '@/lib/portfolio';

// ────────────────────────────────────────────────────────────────────────────
// 3-level view: Project cards (row) → Section boards → Task cards.
// The project row is the recruiter's first impression (sector / role / one-liner);
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

// ── Project card (row 1) ──
function ProjectCard({
  project, selected, onSelect,
}: {
  project: Project; selected: boolean; onSelect: () => void;
}) {
  const taskCount = project.goals.reduce((s, g) => s + g.records.length, 0);
  return (
    <div
      onClick={onSelect}
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
      }}
      onMouseEnter={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)'; }}
      onMouseLeave={e => { if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)'; }}
    >
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
        {project.role && (
          <span className="mono" style={{
            fontSize: 9, padding: '2px 7px', borderRadius: 3,
            background: 'var(--tag-active-bg)', color: 'var(--accent)',
            border: '1px solid var(--accent-dim)', whiteSpace: 'nowrap',
          }}>
            {project.role}
          </span>
        )}
        <span className="mono" style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>
          {taskCount} task{taskCount === 1 ? '' : 's'}
        </span>
      </div>
    </div>
  );
}

// ── progress rollup chip for a section box ──
function ProgressRollup({ records }: { records: Record[] }) {
  const counts: { [k in Progress]?: number } = {};
  for (const r of records) {
    const p = (r.progress || undefined) as Progress | undefined;
    if (p) counts[p] = (counts[p] || 0) + 1;
  }
  const order: Progress[] = ['done', 'ongoing', 'undecided', 'dropped'];
  const parts = order.filter(k => counts[k]);
  if (parts.length === 0) return null;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
      {parts.map(k => (
        <span key={k} className="mono" style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9, color: 'var(--text3)' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROGRESS_META[k].color, display: 'inline-block' }} />
          {counts[k]} {PROGRESS_META[k].label.toLowerCase()}
        </span>
      ))}
    </span>
  );
}

// ── Task card (inside a section box) ──
function TaskCard({
  record, selected, onSelect,
}: {
  record: Record; selected: boolean; onSelect: () => void;
}) {
  const ev = record.evidence || [];
  const hasHighlight = !!record.highlight || !!record.judgment || ev.some(e => e.type === 'judgment');
  const tools = record.tools || [];

  return (
    <div
      data-rid={record.id}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(); }}
      style={{
        width: 236, minWidth: 236, flexShrink: 0, alignSelf: 'flex-start',
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
      {/* date + progress dot */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span className="mono" style={{ fontSize: 9, color: 'var(--text3)' }}>
          {record.date || record.created_at?.slice(0, 10)}
        </span>
        {record.progress && (
          <span className="mono" title={PROGRESS_META[record.progress as Progress]?.label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 9,
            color: PROGRESS_META[record.progress as Progress]?.color || 'var(--text3)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: PROGRESS_META[record.progress as Progress]?.color, display: 'inline-block' }} />
            {PROGRESS_META[record.progress as Progress]?.label}
          </span>
        )}
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

      {/* sub-purpose */}
      {record.subPurpose && (
        <div style={{ fontSize: 10.5, color: 'var(--text2)', lineHeight: 1.5, marginTop: 5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any, overflow: 'hidden' }}>
          {record.subPurpose}
        </div>
      )}

      {/* tools */}
      {tools.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 8 }}>
          {tools.slice(0, 3).map(t => (
            <span key={t} className="mono" style={{
              fontSize: 8.5, padding: '1px 5px', borderRadius: 3,
              background: 'var(--tag-bg)', color: 'var(--text2)', border: '1px solid var(--border)', whiteSpace: 'nowrap',
            }}>
              {t}
            </span>
          ))}
          {tools.length > 3 && (
            <span className="mono" style={{ fontSize: 8.5, color: 'var(--text3)' }}>+{tools.length - 3}</span>
          )}
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

// ── Section board (row 2): one box per lifecycle stage present in the project ──
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
  const hasLifecycleGoals = crossToolGoals || goals.some(g => !!SECTION_META[g.stage || '']) || allRecordsHaveSections;
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
      order: SECTION_META[stage]?.order ?? 999,
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
        const color = SECTION_META[stage as string]?.color || 'var(--text3)';
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
              <span style={{ marginLeft: 'auto' }}>
                <ProgressRollup records={g.records} />
              </span>
            </div>
            {/* task cards — horizontal scroll within the box */}
            <div className="thin-scroll" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 13px', overflowX: 'auto' }}>
              {g.records.map(r => (
                <TaskCard
                  key={r.id}
                  record={r}
                  selected={r.id === selectedRecordId}
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

function resolveLifecycleStage(record: Record, goalStage?: string): string {
  if (record.section && SECTION_META[record.section]) return record.section;
  if (goalStage && SECTION_META[goalStage]) return goalStage;
  return 'Build';
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
      order: SECTION_META[key]?.order ?? 999,
      records,
    }));
}

function ExploreToggle({ mode, onChange }: { mode: ExploreMode; onChange: (mode: ExploreMode) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '9px 20px 0', flexShrink: 0 }}>
      <span className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginRight: 4 }}>Explore by</span>
      {([['project', 'Project'], ['section', 'Section'], ['tool', 'Tool']] as const).map(([value, label]) => (
        <button
          key={value}
          onClick={() => onChange(value)}
          className="mono"
          style={{
            border: `1px solid ${mode === value ? 'var(--accent-dim)' : 'var(--border)'}`,
            background: mode === value ? 'var(--tag-active-bg)' : 'transparent',
            color: mode === value ? 'var(--accent)' : 'var(--text3)',
            borderRadius: 3, padding: '3px 8px', fontSize: 9, cursor: 'pointer',
          }}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── Top-level 3-level view ──
export function ProjectSectionView({
  projects, selectedProjectId, selectedGoalId, filterState, mode, onModeChange, onSelectProject,
  selectedRecordId, onSelectRecord,
}: {
  projects: Project[];
  selectedProjectId: string | null;
  selectedGoalId: string | null;
  filterState: FilterState;
  mode: ExploreMode;
  onModeChange: (mode: ExploreMode) => void;
  onSelectProject: (id: string) => void;
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
}) {
  const active = projects.find(p => p.id === selectedProjectId) || null;
  const crossGoals = mode === 'project' ? [] : crossProjectGoals(projects, mode);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <ExploreToggle mode={mode} onChange={onModeChange} />
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
              />
            ))}
          </div>

          {/* Row 2: sections of the selected project */}
          <div style={{ flex: 1, minHeight: 0 }}>
            {active ? (
              <SectionBoard
                goals={active.goals}
                selectedGoalId={selectedGoalId}
                filterState={filterState}
                selectedRecordId={selectedRecordId}
                onSelectRecord={onSelectRecord}
              />
            ) : (
              <div className="mono" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text3)', fontSize: 12 }}>
                Select a project to see its Think → Ship → Reflect sections
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
