'use client';

import React, { useState } from 'react';

interface SkillUpdateBannerProps {
  installedVersion: string;
  currentVersion: string;
  tools: string[];
}

export function SkillUpdateBanner({ installedVersion, currentVersion, tools }: SkillUpdateBannerProps) {
  const [copied, setCopied] = useState(false);
  const toolFlag = tools.length > 0 ? tools.join(',') : 'claude';
  const command = `npx --yes builders-diary@latest install --tools ${toolFlag}`;

  const copy = () => {
    navigator.clipboard.writeText(command).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '9px 16px',
      background: 'var(--tag-active-bg)',
      borderBottom: '1px solid var(--accent-dim)',
    }}>
      <span style={{ fontSize: 13, color: 'var(--accent)' }}>↻</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <span className="mono" style={{ fontSize: 11, color: 'var(--text)' }}>
          Skill update available · {installedVersion} → {currentVersion}
        </span>
        <span style={{ fontSize: 11.5, color: 'var(--text2)', marginLeft: 10 }}>
          Update once to keep every AI tool on the current workflow.
        </span>
      </div>
      <button
        onClick={copy}
        className="mono"
        style={{
          flexShrink: 0, padding: '5px 11px', fontSize: 10.5,
          background: copied ? 'var(--surface)' : 'var(--accent)',
          border: '1px solid var(--accent)', borderRadius: 4,
          color: copied ? 'var(--accent)' : 'var(--bg)', cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        {copied ? '✓ Copied' : 'Copy update'}
      </button>
    </div>
  );
}
