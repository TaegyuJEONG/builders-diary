'use client';

import React, { useMemo } from 'react';
import { Project } from '@/lib/types';
import { SearchableSelect, SelectOption } from './SearchableSelect';

interface FilterBarProps {
  projects: Project[];
  selectedProjectId: string | null;
  selectedGoalId: string | null;
  searchKeyword: string;
  resultCount: number;
  onProjectChange: (projectId: string | null) => void;
  onGoalChange: (goalId: string | null) => void;
  onSearchChange: (keyword: string) => void;
}

export function FilterBar({
  projects,
  selectedProjectId,
  selectedGoalId,
  searchKeyword,
  resultCount,
  onProjectChange,
  onGoalChange,
  onSearchChange,
}: FilterBarProps) {
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const goals = selectedProject?.goals || [];

  const projectOptions: SelectOption[] = useMemo(
    () => projects.map(p => ({
      value: p.id,
      label: p.title,
      count: p.goals.reduce((a, g) => a + g.records.length, 0),
    })),
    [projects]
  );

  const goalOptions: SelectOption[] = useMemo(
    () => goals.map(g => ({ value: g.id, label: g.title, count: g.records.length })),
    [goals]
  );

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 14,
      padding: '12px 24px',
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      flexShrink: 0,
    }}>
      {/* Project */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          프로젝트
        </span>
        <SearchableSelect
          options={projectOptions}
          value={selectedProjectId}
          onChange={(v) => { onProjectChange(v); onGoalChange(null); }}
          placeholder="프로젝트 선택"
          searchPlaceholder="프로젝트 검색…"
          allOptionLabel="전체 프로젝트"
          minWidth={200}
        />
      </div>

      {/* Goal */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          목표
        </span>
        <SearchableSelect
          options={goalOptions}
          value={selectedGoalId}
          onChange={onGoalChange}
          placeholder={selectedProject ? '목표 선택' : '프로젝트 먼저'}
          searchPlaceholder="목표 검색…"
          allOptionLabel="전체 목표"
          minWidth={200}
          emptyText={selectedProject ? '목표 없음' : '프로젝트를 먼저 선택'}
        />
      </div>

      {/* Keyword search */}
      <div style={{ position: 'relative', flex: 1, maxWidth: 320 }}>
        <input
          type="text"
          value={searchKeyword}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="작업 카드 검색…"
          className="mono"
          style={{
            width: '100%',
            padding: '7px 28px 7px 10px',
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--text)',
            fontSize: 12,
            outline: 'none',
          }}
          onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onBlur={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        />
        {searchKeyword && (
          <button
            onClick={() => onSearchChange('')}
            style={{
              position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', color: 'var(--text3)', fontSize: 14, cursor: 'pointer',
              lineHeight: 1, padding: 2,
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* Count */}
      <span className="mono" style={{ fontSize: 11, color: 'var(--text3)', marginLeft: 'auto', flexShrink: 0 }}>
        작업 {resultCount}개
      </span>
    </div>
  );
}
