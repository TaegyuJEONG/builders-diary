'use client';

import React, { useState } from 'react';
import { ImportRun } from '@/lib/types';

interface ImportProgressProps {
  runs: ImportRun[];
  toolId?: string;
}

const IMPORT_PROMPT = '/builders-diary-import';

/**
 * A compact, local-only bridge between the web portfolio and the AI-client skill.
 * The helper writes imports/<run>/manifest.json; this component never reads raw
 * conversations, export URLs, source indexes, or account metadata.
 */
export function ImportProgress({ runs, toolId }: ImportProgressProps) {
  const [copied, setCopied] = useState(false);
  const latest = runs[0];
  const copy = () => {
    navigator.clipboard.writeText(IMPORT_PROMPT).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (!latest) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', background: 'var(--tag-active-bg)', borderBottom: '1px solid var(--accent-dim)' }}>
        <span style={{ fontSize: 13, color: 'var(--accent)' }}>↙</span>
        <div style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: 'var(--text)' }}>
          Import past Claude work from a local export and Claude Code sessions. In {toolId === 'claude' ? 'Claude Code' : 'your AI client'}, start a new session and run <code className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{IMPORT_PROMPT}</code>.
        </div>
        <button onClick={copy} className="mono" style={{ flexShrink: 0, padding: '4px 10px', fontSize: 11, background: copied ? 'var(--surface)' : 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: copied ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    );
  }

  const counts = latest.counts || {};
  const status = latest.status.replace(/_/g, ' ');
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '11px 16px', background: 'var(--surface)', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 13, color: 'var(--accent)' }}>◌</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: 3 }}>
          Claude import · {status}
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
      <button onClick={copy} className="mono" style={{ flexShrink: 0, padding: '4px 10px', fontSize: 11, background: copied ? 'var(--tag-active-bg)' : 'transparent', border: '1px solid var(--border)', borderRadius: 3, color: copied ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
        {copied ? '✓ Copied' : 'Continue'}
      </button>
    </div>
  );
}
