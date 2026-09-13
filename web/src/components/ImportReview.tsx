'use client';

import React from 'react';
import { ImportSelectionTable } from '@/components/ImportSelectionTable';

interface ImportReviewProps {
  onClose: () => void;
  onSaved: () => void;
  /** Bump to re-read candidates while the skill writes. */
  refreshKey?: number;
}

/**
 * Right-hand drawer around the shared selection table, opened from the header tools
 * popover. The table itself is shared with onboarding step 3 so both routes show the
 * same columns and write the same selections.json.
 */
export function ImportReview({ onClose, onSaved, refreshKey = 0 }: ImportReviewProps) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.62)', display: 'flex', justifyContent: 'flex-end' }}
      onMouseDown={event => { if (event.target === event.currentTarget) onClose(); }}
    >
      <aside style={{ width: 740, maxWidth: '96vw', height: '100%', background: 'var(--surface)', borderLeft: '1px solid var(--border2)', display: 'flex', flexDirection: 'column' }}>
        <div style={{ height: 52, padding: '0 16px', display: 'flex', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
          <strong style={{ fontSize: 13 }}>Review import</strong>
          <button
            onClick={onClose}
            aria-label="Close"
            className="mono"
            style={{ marginLeft: 'auto', width: 28, height: 28, background: 'transparent', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text2)', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>
        <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: 14 }}>
          <p style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.6, margin: '0 0 12px' }}>
            Tick the projects to import, rename any of them, merge duplicates by dropping one row under
            another, then save. Claude Code picks up your choices and writes the projects.
          </p>
          <ImportSelectionTable onSaved={onSaved} refreshKey={refreshKey} />
        </div>
      </aside>
    </div>
  );
}
