'use client';

import React, { useState, useRef, useEffect } from 'react';
import { SelectOption, SearchableSelect } from './SearchableSelect';
import { Project } from '@/lib/types';

interface HeaderProps {
  projects: Project[];
  stages: string[];
  selectedProjectId: string | null;
  selectedStage: string | null;
  selectedActivity: string | null;
  resultCount: number;
  activityOptions: SelectOption[];
  mindsetOptions: SelectOption[];
  toolOptions: SelectOption[];
  selectedMindset: string[];
  selectedTools: string[];
  onProjectChange: (id: string | null) => void;
  onStageChange: (stage: string | null) => void;
  onActivityChange: (activity: string | null) => void;
  onMindsetChange: (v: string[]) => void;
  onToolChange: (v: string[]) => void;
  onOpenManager: () => void;
  onReconnect: () => void;

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
};
const ADDABLE_TOOLS = ['claude'];
const COMING_SOON_TOOLS = ['cursor', 'windsurf', 'antigravity', 'codex'];

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

  const snippet = `npx --yes builders-diary@latest install --tools ${addTool ?? 'claude'}`;
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
        <div className="mono" style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', fontSize: 9.5, color: 'var(--text3)', lineHeight: 1.6 }}>
          Coming soon: {COMING_SOON_TOOLS.map(t => TOOL_LABELS[t] ?? t).join(', ')}
        </div>
      </div>
    </div>
  );
}

export function Header({
  projects,
  stages,
  selectedProjectId,
  selectedStage,
  selectedActivity,
  resultCount,
  activityOptions,
  mindsetOptions,
  toolOptions,
  selectedMindset,
  selectedTools,
  onProjectChange,
  onStageChange,
  onActivityChange,
  onMindsetChange,
  onToolChange,
  onOpenManager,
  onReconnect,

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

  const projectScopedRecords = selectedProject
    ? selectedProject.goals.flatMap(g => g.records)
    : projects.flatMap(p => p.goals.flatMap(g => g.records));
  const stageNames = Array.from(new Set([
    ...stages,
    ...projectScopedRecords.map(r => r.section).filter((s): s is string => !!s),
  ]));
  const stageOptions: SelectOption[] = stageNames.map(stage => ({
    value: stage,
    label: stage,
    count: projectScopedRecords.filter(r => r.section === stage).length,
  })).filter(o => (o.count || 0) > 0);


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
        onChange={(v) => { onProjectChange(v); onStageChange(null); onActivityChange(null); }}
        placeholder="Select project"
        searchPlaceholder="Search projects…"
        allOptionLabel="All Projects"
        minWidth={180}
      />

      {/* Stage dropdown */}
      <SearchableSelect
        options={stageOptions}
        value={selectedStage}
        onChange={onStageChange}
        placeholder="All Stages"
        searchPlaceholder="Search stages…"
        allOptionLabel="All Stages"
        minWidth={160}
      />

      <span style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

      {/* Activity dropdown */}
      <SearchableSelect
        options={activityOptions}
        value={selectedActivity}
        onChange={onActivityChange}
        placeholder={`${resultCount} tasks · All Activities`}
        searchPlaceholder="Search activities…"
        allOptionLabel="All Activities"
        minWidth={220}
      />

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

      {/* Portfolio manager */}
      <button
        onClick={onOpenManager}
        title="Manage portfolio"
        style={{
          width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: '1px solid var(--border)', borderRadius: 4,
          color: 'var(--text2)', cursor: 'pointer', flexShrink: 0,
        }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M7 1.5v2M7 10.5v2M1.5 7h2M10.5 7h2M3.1 3.1l1.4 1.4M9.5 9.5l1.4 1.4M10.9 3.1L9.5 4.5M4.5 9.5l-1.4 1.4" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
          <circle cx="7" cy="7" r="2.2" stroke="currentColor" strokeWidth="1.1"/>
        </svg>
      </button>

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
