'use client';

import React, { useState } from 'react';

interface FirstRecordBannerProps {
  toolId?: string;
}

const TOOL_PROMPTS: Record<string, { name: string; invocation: string }> = {
  claude: { name: 'Claude Code', invocation: '/builders-diary --dry-run' },
  antigravity: { name: 'Antigravity', invocation: '/builders-diary --dry-run' },
  cursor: { name: 'Cursor', invocation: 'Use the builders-diary skill. Run a dry run first.' },
  windsurf: { name: 'Windsurf', invocation: 'Use the builders-diary skill. Run a dry run first.' },
};

/**
 * Shown over the (empty) card view once onboarding is done but no records exist yet.
 * Nudges the user to preview their first record. Dismissible for the session.
 */
export function FirstRecordBanner({ toolId = '' }: FirstRecordBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);
  const tool = TOOL_PROMPTS[toolId] || {
    name: 'your AI tool',
    invocation: 'Use the builders-diary skill. Run a dry run first.',
  };

  if (dismissed) return null;

  const copy = () => {
    navigator.clipboard.writeText(tool.invocation).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      padding: '11px 16px',
      background: 'var(--tag-active-bg)',
      borderBottom: '1px solid var(--accent-dim)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--accent)' }}>◆</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 12.5, color: 'var(--text)' }}>
          No cards yet. Finish a session in {tool.name}, then preview your first record with{' '}
        </span>
        <code className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>{tool.invocation}</code>
        <span style={{ fontSize: 12.5, color: 'var(--text)' }}> — review it before anything is saved.</span>
      </div>
      <button
        onClick={copy}
        className="mono"
        style={{
          flexShrink: 0, padding: '4px 10px', fontSize: 11,
          background: copied ? 'var(--surface)' : 'transparent',
          border: '1px solid var(--border)', borderRadius: 3,
          color: copied ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {copied ? '✓ Copied' : 'Copy'}
      </button>
      <button
        onClick={() => setDismissed(true)}
        aria-label="Dismiss"
        style={{
          flexShrink: 0, width: 22, height: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent', border: 'none',
          color: 'var(--text3)', fontSize: 15, lineHeight: 1, cursor: 'pointer',
        }}
      >
        ×
      </button>
    </div>
  );
}
