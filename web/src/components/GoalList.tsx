'use client';

import React from 'react';
import { Project } from '@/lib/types';

interface GoalListProps {
  project: Project | undefined;
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string | null) => void;
  // count of currently-visible cards per goal (after tag/keyword filters)
  visibleCountByGoal: { [goalId: string]: number };
}

export function GoalList({
  project,
  selectedGoalId,
  onSelectGoal,
  visibleCountByGoal,
}: GoalListProps) {
  if (!project) {
    return (
      <div style={{ padding: 16, color: 'var(--text3)', fontSize: 12 }} className="mono">
        프로젝트를 선택하세요
      </div>
    );
  }

  const totalVisible = Object.values(visibleCountByGoal).reduce((a, b) => a + b, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div className="mono" style={{
          fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6,
        }}>
          목표
        </div>
        <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>
          {project.title}
        </div>
        {project.description && (
          <div style={{ fontSize: 11, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>
            {project.description}
          </div>
        )}
      </div>

      {/* List */}
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: 8 }}>
        {/* All goals */}
        <button
          onClick={() => onSelectGoal(null)}
          style={goalRowStyle(selectedGoalId === null)}
        >
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            전체 목표
          </span>
          <span className="mono" style={countStyle(selectedGoalId === null)}>{totalVisible}</span>
        </button>

        {project.goals.map(goal => {
          const active = selectedGoalId === goal.id;
          const count = visibleCountByGoal[goal.id] ?? 0;
          return (
            <button
              key={goal.id}
              onClick={() => onSelectGoal(goal.id)}
              style={goalRowStyle(active)}
              title={goal.description}
            >
              <span style={{
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                paddingLeft: 8,
              }}>
                {goal.title}
              </span>
              <span className="mono" style={countStyle(active)}>{count}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function goalRowStyle(active: boolean): React.CSSProperties {
  return {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '9px 8px',
    marginBottom: 2,
    background: active ? 'var(--surface2)' : 'transparent',
    border: 'none',
    borderRadius: 4,
    color: active ? 'var(--text)' : 'var(--text2)',
    fontSize: 12.5,
    textAlign: 'left',
    cursor: 'pointer',
    transition: 'background 0.12s, color 0.12s',
  };
}

function countStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 11,
    color: active ? 'var(--accent)' : 'var(--text3)',
    background: active ? 'var(--tag-active-bg)' : 'var(--surface)',
    borderRadius: 3,
    padding: '1px 7px',
    flexShrink: 0,
    minWidth: 22,
    textAlign: 'center',
  };
}
