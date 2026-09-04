'use client';

import React from 'react';
import { SearchableSelect, SelectOption } from './SearchableSelect';

interface HeaderProps {
  projectName?: string;
  mindsetOptions: SelectOption[];
  toolOptions: SelectOption[];
  selectedMindset: string[];
  selectedTools: string[];
  onMindsetChange: (v: string[]) => void;
  onToolChange: (v: string[]) => void;
  onRefresh: () => void;
  onReconnect: () => void;
  isLoading?: boolean;
}

export function Header({
  projectName,
  mindsetOptions,
  toolOptions,
  selectedMindset,
  selectedTools,
  onMindsetChange,
  onToolChange,
  onRefresh,
  onReconnect,
  isLoading = false,
}: HeaderProps) {
  const activeTagCount = selectedMindset.length + selectedTools.length;

  return (
    <header style={{
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      padding: '0 24px',
      height: 56,
      display: 'flex',
      alignItems: 'center',
      gap: 20,
      flexShrink: 0,
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexShrink: 0 }}>
        <span className="serif" style={{ fontSize: 20, color: 'var(--text)', whiteSpace: 'nowrap' }}>
          Builder&apos;s Diary
        </span>
        {projectName && (
          <span className="mono" style={{
            fontSize: 11, color: 'var(--accent)',
            border: '1px solid var(--accent-dim)', background: 'var(--tag-active-bg)',
            borderRadius: 3, padding: '2px 8px', whiteSpace: 'nowrap',
          }}>
            {projectName}
          </span>
        )}
      </div>

      <div style={{ width: 1, height: 22, background: 'var(--border)', flexShrink: 0 }} />

      {/* Tag filters — searchable */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
        <span className="mono" style={{
          fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
        }}>
          마인드셋
        </span>
        <SearchableSelect
          options={mindsetOptions}
          value={selectedMindset}
          onChange={onMindsetChange}
          multiple
          placeholder="전체"
          searchPlaceholder="마인드셋 검색…"
          minWidth={150}
        />

        <span className="mono" style={{
          fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', flexShrink: 0,
        }}>
          도구
        </span>
        <SearchableSelect
          options={toolOptions}
          value={selectedTools}
          onChange={onToolChange}
          multiple
          placeholder="전체"
          searchPlaceholder="도구 검색…"
          minWidth={150}
        />

        {activeTagCount > 0 && (
          <button
            onClick={() => { onMindsetChange([]); onToolChange([]); }}
            className="mono"
            style={{
              fontSize: 11, color: 'var(--text2)', background: 'none',
              border: '1px solid var(--border)', borderRadius: 3, padding: '4px 10px',
            }}
          >
            태그 초기화 ({activeTagCount})
          </button>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="mono"
          style={{
            fontSize: 11, letterSpacing: '0.06em',
            padding: '7px 14px',
            background: 'transparent',
            color: 'var(--text2)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            opacity: isLoading ? 0.6 : 1,
          }}
          onMouseEnter={e => { if (!isLoading) e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          {isLoading ? 'LOADING…' : 'REFRESH'}
        </button>
        <button
          onClick={onReconnect}
          className="mono"
          style={{
            fontSize: 11, letterSpacing: '0.06em',
            padding: '7px 14px',
            background: 'transparent',
            color: 'var(--text2)',
            border: '1px solid var(--border)',
            borderRadius: 3,
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
        >
          폴더 변경
        </button>
      </div>
    </header>
  );
}
