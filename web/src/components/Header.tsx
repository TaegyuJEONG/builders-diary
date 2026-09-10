'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SelectOption, SearchableSelect } from './SearchableSelect';
import { Project } from '@/lib/types';

interface HeaderProps {
  projects: Project[];
  selectedProjectId: string | null;
  selectedGoalId: string | null;
  resultCount: number;
  mindsetOptions: SelectOption[];
  toolOptions: SelectOption[];
  selectedMindset: string[];
  selectedTools: string[];
  onProjectChange: (id: string | null) => void;
  onGoalChange: (id: string | null) => void;
  onMindsetChange: (v: string[]) => void;
  onToolChange: (v: string[]) => void;
  onReconnect: () => void;
  onSelectRecord: (id: string) => void;
  isLoading?: boolean;
  /** AI tools the user has installed the skill for (from onboarding). */
  selectedClients?: string[];
}

/** Small pill badge showing a count. */
function CountBadge({ n }: { n: number }) {
  return (
    <span style={{
      background: 'var(--surface2)',
      color: 'var(--text3)',
      borderRadius: 10,
      fontSize: 10,
      padding: '1px 6px',
      marginLeft: 4,
      fontFamily: 'IBM Plex Mono, monospace',
    }}>{n}</span>
  );
}

/** Filter popover — appears when the ⊞ icon is clicked. */
function FilterPopover({
  mindsetOptions,
  toolOptions,
  selectedMindset,
  selectedTools,
  onMindsetChange,
  onToolChange,
  onClose,
}: {
  mindsetOptions: SelectOption[];
  toolOptions: SelectOption[];
  selectedMindset: string[];
  selectedTools: string[];
  onMindsetChange: (v: string[]) => void;
  onToolChange: (v: string[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const toggle = (arr: string[], val: string, set: (v: string[]) => void) => {
    const s = new Set(arr);
    s.has(val) ? s.delete(val) : s.add(val);
    set(Array.from(s));
  };

  const activeCount = selectedMindset.length + selectedTools.length;

  return (
    <div ref={ref} style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      width: 320,
      background: 'var(--surface)',
      border: '1px solid var(--border2)',
      borderRadius: 6,
      boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
      zIndex: 200,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Filters {activeCount > 0 && <CountBadge n={activeCount} />}
        </span>
        {activeCount > 0 && (
          <button onClick={() => { onMindsetChange([]); onToolChange([]); }} style={{ background: 'none', border: 'none', color: 'var(--text3)', fontSize: 11, cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace' }}>
            Clear all
          </button>
        )}
      </div>

      {/* Mindset */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace' }}>
          Mindset
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {mindsetOptions.map(o => {
            const active = selectedMindset.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => toggle(selectedMindset, o.value, onMindsetChange)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 3,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--tag-active-bg)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace',
                  transition: 'all 0.15s',
                }}
              >
                {o.label}
                {typeof o.count === 'number' && <span style={{ marginLeft: 4, opacity: 0.5 }}>{o.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tools */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace' }}>
          Tools
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {toolOptions.map(o => {
            const active = selectedTools.includes(o.value);
            return (
              <button
                key={o.value}
                onClick={() => toggle(selectedTools, o.value, onToolChange)}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  borderRadius: 3,
                  border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                  background: active ? 'var(--tag-active-bg)' : 'transparent',
                  color: active ? 'var(--accent)' : 'var(--text2)',
                  cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace',
                  transition: 'all 0.15s',
                }}
              >
                {o.label}
                {typeof o.count === 'number' && <span style={{ marginLeft: 4, opacity: 0.5 }}>{o.count}</span>}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Known AI tools for the manager popover (mirror of onboarding list).
const TOOL_LABELS: { [id: string]: string } = {
  claude: 'Claude Code',
  cursor: 'Cursor',
  windsurf: 'Windsurf',
  cline: 'Cline',
  codex: 'Codex CLI',
  antigravity: 'Antigravity',
  chatgpt: 'ChatGPT',
};
const ADDABLE_TOOLS = ['claude', 'cursor', 'windsurf', 'antigravity', 'cline'];

/** Tools manager popover — shows connected tools + a command to add another. */
function ToolsPopover({
  selectedClients,
  onClose,
}: {
  selectedClients: string[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [addTool, setAddTool] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [onClose]);

  const snippet = `npx builders-diary@latest install --tools ${addTool ?? 'claude'}`;
  const copy = () => {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const notYetAdded = ADDABLE_TOOLS.filter(t => !selectedClients.includes(t));

  return (
    <div ref={ref} style={{
      position: 'absolute',
      top: 'calc(100% + 8px)',
      right: 0,
      width: 320,
      background: 'var(--surface)',
      border: '1px solid var(--border2)',
      borderRadius: 6,
      boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
      zIndex: 200,
      overflow: 'hidden',
    }}>
      <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}>
        <span style={{ fontSize: 11, color: 'var(--text2)', fontFamily: 'IBM Plex Mono, monospace', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          Your tools
        </span>
      </div>

      {/* Connected tools */}
      <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--border)' }}>
        {selectedClients.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'IBM Plex Mono, monospace' }}>No tools yet.</div>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {selectedClients.map(t => (
              <span key={t} className="mono" style={{
                fontSize: 11, padding: '3px 9px', borderRadius: 3,
                background: 'var(--tag-active-bg)', color: 'var(--accent)',
                border: '1px solid var(--accent-dim)',
              }}>
                ✓ {TOOL_LABELS[t] ?? t}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Add another */}
      <div style={{ padding: '10px 14px' }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, fontFamily: 'IBM Plex Mono, monospace' }}>
          Add another
        </div>
        {notYetAdded.length === 0 ? (
          <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'IBM Plex Mono, monospace' }}>All set — every tool added.</div>
        ) : (
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
              {notYetAdded.map(t => (
                <button
                  key={t}
                  onClick={() => setAddTool(t)}
                  className="mono"
                  style={{
                    fontSize: 11, padding: '4px 10px', borderRadius: 3,
                    border: `1px solid ${addTool === t ? 'var(--accent)' : 'var(--border)'}`,
                    background: addTool === t ? 'var(--tag-active-bg)' : 'transparent',
                    color: addTool === t ? 'var(--accent)' : 'var(--text2)',
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >
                  {TOOL_LABELS[t] ?? t}
                </button>
              ))}
            </div>
            {addTool && (
              <div style={{
                background: 'var(--bg)', border: '1px solid var(--border)',
                borderRadius: 4, padding: '8px 10px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <code className="mono" style={{ fontSize: 10.5, color: 'var(--text2)', flex: 1, wordBreak: 'break-all', lineHeight: 1.6 }}>
                  <span style={{ color: 'var(--text3)' }}>$ </span>{snippet}
                </code>
                <button
                  onClick={copy}
                  className="mono"
                  style={{
                    flexShrink: 0, padding: '4px 10px', fontSize: 10.5,
                    background: copied ? 'var(--tag-active-bg)' : 'transparent',
                    border: '1px solid var(--border)', borderRadius: 3,
                    color: copied ? 'var(--accent)' : 'var(--text3)',
                    cursor: 'pointer', whiteSpace: 'nowrap',
                  }}
                >
                  {copied ? '✓' : 'Copy'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export function Header({
  projects,
  selectedProjectId,
  selectedGoalId,
  resultCount,
  mindsetOptions,
  toolOptions,
  selectedMindset,
  selectedTools,
  onProjectChange,
  onGoalChange,
  onMindsetChange,
  onToolChange,
  onReconnect,
  onSelectRecord,
  isLoading = false,
  selectedClients = [],
}: HeaderProps) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const filterBtnRef = useRef<HTMLDivElement>(null);

  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const goals = selectedProject?.goals || [];

  const projectOptions: SelectOption[] = projects.map(p => ({
    value: p.id,
    label: p.title,
    count: p.goals.reduce((a, g) => a + g.records.length, 0),
  }));

  // Goals: scoped to the selected project, or ALL goals across projects
  // when no project is picked (e.g. "Venture design" across everything).
  const goalScope = selectedProject ? goals : projects.flatMap(p => p.goals);
  const goalOptions: SelectOption[] = goalScope.map(g => ({
    value: g.id,
    label: g.title,
    count: g.records.length,
  }));

  // Card search: only cards in the current project+goal scope
  const scopedRecords = selectedProject
    ? (selectedGoalId
      ? selectedProject.goals.find(g => g.id === selectedGoalId)?.records || []
      : selectedProject.goals.flatMap(g => g.records))
    : projects.flatMap(p => p.goals.flatMap(g => g.records));

  const searchOptions: SelectOption[] = scopedRecords.map(r => ({
    value: r.id,
    label: r.title,
  }));

  const activeFilterCount = selectedMindset.length + selectedTools.length;

  return (
    <header style={{
      background: 'var(--bg)',
      borderBottom: '1px solid var(--border)',
      padding: '0 20px',
      height: 52,
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      flexShrink: 0,
      position: 'relative',
    }}>
      {/* Brand */}
      <span className="serif" style={{ fontSize: 26, color: 'var(--text)', whiteSpace: 'nowrap', flexShrink: 0 }}>
        Builder&apos;s Diary
      </span>

      <span style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Project dropdown */}
      <SearchableSelect
        options={projectOptions}
        value={selectedProjectId}
        onChange={(v) => { onProjectChange(v); onGoalChange(null); }}
        placeholder="Select project"
        searchPlaceholder="Search projects…"
        allOptionLabel="All Projects"
        minWidth={180}
      />

      {/* Goal dropdown */}
      <SearchableSelect
        options={goalOptions}
        value={selectedGoalId}
        onChange={onGoalChange}
        placeholder="All Goals"
        searchPlaceholder="Search goals…"
        allOptionLabel="All Goals"
        minWidth={160}
      />

      <span style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Card search — jump to a specific card */}
      <div style={{ flex: 1, minWidth: 0, maxWidth: 280 }}>
        <SearchableSelect
          options={searchOptions}
          value={null}
          onChange={(v) => { if (v) onSelectRecord(v); }}
          placeholder={`${resultCount} card${resultCount !== 1 ? 's' : ''}…`}
          searchPlaceholder="Jump to card…"
          minWidth={200}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* Filter icon button */}
      <div ref={filterBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setFilterOpen(o => !o)}
          title="Filter by mindset & tools"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: filterOpen || activeFilterCount > 0 ? 'var(--tag-active-bg)' : 'transparent',
            border: `1px solid ${filterOpen || activeFilterCount > 0 ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 4,
            color: activeFilterCount > 0 ? 'var(--accent)' : 'var(--text2)',
            cursor: 'pointer',
            position: 'relative',
            transition: 'all 0.15s',
          }}
        >
          {/* Filter icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M1 3h12M3 7h8M5 11h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          {activeFilterCount > 0 && (
            <span style={{
              position: 'absolute',
              top: -4,
              right: -4,
              width: 14,
              height: 14,
              background: 'var(--accent)',
              color: 'var(--bg)',
              borderRadius: '50%',
              fontSize: 9,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'IBM Plex Mono, monospace',
              fontWeight: 600,
            }}>
              {activeFilterCount}
            </span>
          )}
        </button>
        {filterOpen && (
          <FilterPopover
            mindsetOptions={mindsetOptions}
            toolOptions={toolOptions}
            selectedMindset={selectedMindset}
            selectedTools={selectedTools}
            onMindsetChange={onMindsetChange}
            onToolChange={onToolChange}
            onClose={() => setFilterOpen(false)}
          />
        )}
      </div>

      {/* Tools manager icon button */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <button
          onClick={() => setToolsOpen(o => !o)}
          title="Your AI tools"
          style={{
            width: 32,
            height: 32,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: toolsOpen ? 'var(--tag-active-bg)' : 'transparent',
            border: `1px solid ${toolsOpen ? 'var(--accent)' : 'var(--border)'}`,
            borderRadius: 4,
            color: toolsOpen ? 'var(--accent)' : 'var(--text2)',
            cursor: 'pointer',
            transition: 'all 0.15s',
          }}
          onMouseEnter={e => { if (!toolsOpen) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}}
          onMouseLeave={e => { if (!toolsOpen) { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}}
        >
          {/* Plug / tools icon */}
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M4 1v3M10 1v3M3 4h8v2a4 4 0 01-8 0V4zM7 10v3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {toolsOpen && (
          <ToolsPopover selectedClients={selectedClients} onClose={() => setToolsOpen(false)} />
        )}
      </div>

      {/* Folder change icon button */}
      <button
        onClick={onReconnect}
        disabled={isLoading}
        title="Change folder"
        style={{
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          border: '1px solid var(--border)',
          borderRadius: 4,
          color: 'var(--text2)',
          cursor: isLoading ? 'not-allowed' : 'pointer',
          opacity: isLoading ? 0.5 : 1,
          flexShrink: 0,
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => { if (!isLoading) { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}}
        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}
      >
        {/* Folder icon */}
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M1 3.5C1 2.67 1.67 2 2.5 2H5l1.5 1.5H11.5C12.33 3.5 13 4.17 13 5v5.5C13 11.33 12.33 12 11.5 12h-9C1.67 12 1 11.33 1 10.5V3.5z" stroke="currentColor" strokeWidth="1.2" fill="none"/>
        </svg>
      </button>
    </header>
  );
}
