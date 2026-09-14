'use client';

import React from 'react';
import { ImportSelectionTable } from '@/components/ImportSelectionTable';
import { TaskProposalQueue } from '@/components/TaskProposalQueue';
import { ImportDedupReport, loadFolderHandleFromStorage, readProjectProposal } from '@/lib/fileSystem';
import { useEffect, useState } from 'react';

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
  const [dedup, setDedup] = useState<ImportDedupReport | null>(null);
  useEffect(() => { (async () => { const handle = await loadFolderHandleFromStorage(); if (handle) setDedup((await readProjectProposal(handle))?.dedupReport || null); })(); }, [refreshKey]);
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
          {dedup && (dedup.exact_duplicates.length > 0 || dedup.merge_candidates.length > 0) && <div style={{ marginTop: 14, padding: 10, border: '1px solid var(--border)', borderRadius: 5 }}>
            <strong style={{ fontSize: 12 }}>Deduplication review</strong>
            {dedup.exact_duplicates.length > 0 && <p style={{ fontSize: 11, color: 'var(--text2)', margin: '8px 0 4px' }}>{dedup.exact_duplicates.length} exact duplicate group(s) collapsed automatically.</p>}
            {dedup.merge_candidates.length > 0 && <p style={{ fontSize: 11, color: 'var(--text2)', margin: '4px 0 0' }}>{dedup.merge_candidates.length} semantic merge candidate(s) need review; semantic matches are never merged automatically.</p>}
          </div>}
          <div style={{ marginTop: 24, borderTop: '1px solid var(--border)', paddingTop: 16 }}>
            <TaskProposalQueue onSaved={onSaved} refreshKey={refreshKey} />
          </div>
        </div>
      </aside>
    </div>
  );
}
