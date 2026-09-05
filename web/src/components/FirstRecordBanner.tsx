'use client';

import React, { useState } from 'react';

interface FirstRecordBannerProps {
  toolName?: string;
}

/**
 * Shown over the (empty) card view once onboarding is done but no records exist yet.
 * Nudges the user to run @builders-diary. Dismissible for the session.
 */
export function FirstRecordBanner({ toolName = 'your AI tool' }: FirstRecordBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (dismissed) return null;

  const copy = () => {
    navigator.clipboard.writeText('@builders-diary').then(() => {
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
          No cards yet. Finish a session in {toolName} and type{' '}
        </span>
        <code className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>@builders-diary</code>
        <span style={{ fontSize: 12.5, color: 'var(--text)' }}> — your first card lands here automatically.</span>
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
