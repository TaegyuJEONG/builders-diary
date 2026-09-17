'use client';

import React, { useState } from 'react';
import { ImportRun } from '@/lib/types';

interface ImportProgressProps {
  runs: ImportRun[];
  toolId?: string;
  onReview?: () => void;
}

const IMPORT_PROMPT = '/builders-diary-import';

/**
 * A compact, local-only bridge between the web portfolio and the AI-client skill.
 * The helper writes imports/<run>/manifest.json; this component never reads raw
 * conversations, export URLs, source indexes, or account metadata. Read-only:
 * pause and resume live in the AI-client chat, and the manifest is the checkpoint.
 */
export function ImportProgress({ runs, toolId }: ImportProgressProps) {
  const latest = runs[0];

  if (!latest) {
    return null;
  }

  const counts = latest.counts || {};
  const ready = latest.status === 'project_selection' || latest.phase === 'source_task_curation' || latest.phase === 'complete';
  const toolLabel = toolId === 'claude' ? 'Claude' : toolId === 'cursor' ? 'Cursor' : toolId === 'codex' ? 'Codex CLI' : toolId === 'hermes' ? 'Hermes' : toolId || 'Claude';
  const route = typeof window !== 'undefined' && localStorage.getItem('bd-route') === 'single' ? 'Single import' : 'Bulk import';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      {ready
        ? <span className="mono" style={{ width: 16, height: 16, borderRadius: '50%', border: '1px solid var(--accent)', background: 'var(--accent)', color: 'var(--bg)', display: 'grid', placeItems: 'center', fontSize: 9, flexShrink: 0 }}>✓</span>
        : <span className="mono bd-import-spinner" style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid var(--border)', borderTopColor: 'var(--accent)', flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: ready ? 'var(--text2)' : 'var(--accent)', marginBottom: 3 }}>
          {toolLabel} · {route}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2)' }}>
          {counts.chat_conversations ?? 0} chat conversations · {counts.chat_projects ?? 0} chat projects · {counts.code_sessions ?? 0} Claude Code sessions
        </div>
        {!!latest.warnings?.length && (
          <div className="mono" style={{ marginTop: 3, fontSize: 10, color: 'var(--text3)' }}>
            {latest.warnings.length} source notice{latest.warnings.length === 1 ? '' : 's'} — review in the import skill.
          </div>
        )}
      </div>
      <style>{`@keyframes bd-import-spin { to { transform: rotate(360deg) } } .bd-import-spinner { animation: bd-import-spin 1s linear infinite }`}</style>
    </div>
  );
}
