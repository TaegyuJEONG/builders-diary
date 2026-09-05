'use client';

import React, { useRef, useEffect } from 'react';
import { Record, CATEGORY_META } from '@/lib/types';

interface CardTimelineProps {
  records: Record[];
  selectedRecordId: string | null;
  onSelectRecord: (id: string) => void;
}

/** Group records by YYYY-MM, newest month first. */
function groupByMonth(records: Record[]): { key: string; label: string; items: Record[] }[] {
  const map = new Map<string, Record[]>();
  for (const r of records) {
    const key = r.created_at.slice(0, 7); // YYYY-MM
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(r);
  }
  const keys = Array.from(map.keys()).sort((a, b) => b.localeCompare(a));
  return keys.map(key => {
    const [yr, mo] = key.split('-');
    const date = new Date(Number(yr), Number(mo) - 1, 1);
    const label = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    return { key, label, items: map.get(key)! };
  });
}

const CARD_W = 220;

// Count evidence present as a simple 0–4 signal for the "verified" strength.
function evidenceSummary(record: Record): { count: number; hasJudgment: boolean } {
  const ev = record.evidence || [];
  const types = new Set(ev.map(e => e.type));
  const hasJudgment = !!record.judgment || types.has('judgment');
  return { count: ev.length, hasJudgment };
}

// ── Single card — a POSTER: title + result + signal chips. No 3-line previews. ──
function TimelineCard({
  record,
  selected,
  onSelect,
}: {
  record: Record;
  selected: boolean;
  onSelect: () => void;
}) {
  const cat = record.category ? CATEGORY_META[record.category] : null;
  const { count: evCount, hasJudgment } = evidenceSummary(record);

  // One-line takeaway for the poster: prefer Result, else first line of the body.
  const takeaway = (record.result || record.summary || '')
    .replace(/^#+\s*/gm, '')
    .split('\n')
    .find(l => l.trim().length > 0) || '';

  return (
    <div
      data-rid={record.id}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter') onSelect(); }}
      style={{
        width: CARD_W,
        minWidth: CARD_W,
        flexShrink: 0,
        background: 'var(--surface)',
        border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 5,
        padding: '11px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 0,
        cursor: 'pointer',
        transition: 'border-color 0.15s, box-shadow 0.15s',
        boxShadow: selected
          ? '0 0 0 1px var(--accent), 0 4px 16px rgba(74,222,128,0.07)'
          : 'none',
        alignSelf: 'flex-start',
      }}
      onMouseEnter={e => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border2)';
      }}
      onMouseLeave={e => {
        if (!selected) (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
      }}
    >
      {/* Category + date */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
        {cat ? (
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: cat.color, display: 'inline-block', flexShrink: 0,
            }} />
            <span className="mono" style={{
              fontSize: 9, color: cat.color,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}>
              {record.category}
            </span>
          </span>
        ) : <span />}
        <span className="mono" style={{ fontSize: 9, color: 'var(--text3)' }}>
          {record.created_at.slice(0, 10)}
        </span>
      </div>

      {/* Title — the headline */}
      <div style={{
        fontSize: 12.5,
        fontWeight: 600,
        color: 'var(--text)',
        lineHeight: 1.4,
        marginBottom: takeaway ? 7 : 0,
      }}>
        {record.title}
      </div>

      {/* One-line takeaway (result), clamped to 2 lines max */}
      {takeaway && (
        <div style={{
          fontSize: 11,
          color: 'var(--text2)',
          lineHeight: 1.5,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical' as any,
          overflow: 'hidden',
        }}>
          {takeaway}
        </div>
      )}

      {/* Signal row: judgment badge + evidence strength */}
      {(hasJudgment || evCount > 0) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          marginTop: 9, paddingTop: 8, borderTop: '1px solid var(--border)',
          flexWrap: 'wrap',
        }}>
          {hasJudgment && (
            <span className="mono" title="This card records a human judgment call" style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 9, padding: '2px 6px', borderRadius: 3,
              background: 'var(--tag-active-bg)', color: 'var(--accent)',
              border: '1px solid var(--accent-dim)', whiteSpace: 'nowrap',
            }}>
              ◆ judgment
            </span>
          )}
          {evCount > 0 && (
            <span className="mono" title={`${evCount} piece(s) of evidence`} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: 9, padding: '2px 6px', borderRadius: 3,
              background: 'var(--tag-bg)', color: 'var(--text2)',
              border: '1px solid var(--border)', whiteSpace: 'nowrap',
            }}>
              ✓ {evCount} evidence
            </span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Timeline container ───────────────────────────────────────────────────────
export function CardTimeline({ records, selectedRecordId, onSelectRecord }: CardTimelineProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedRecordId && scrollRef.current) {
      const el = scrollRef.current.querySelector<HTMLElement>(`[data-rid="${selectedRecordId}"]`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedRecordId]);

  if (records.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        gap: 8, color: 'var(--text3)',
      }}>
        <div className="mono" style={{ fontSize: 12 }}>No work cards match the current filters</div>
      </div>
    );
  }

  const groups = groupByMonth(records);

  return (
    <div
      ref={scrollRef}
      className="thin-scroll"
      style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 0,
        padding: '14px 0 18px',
        overflowX: 'auto',
        overflowY: 'auto',
        height: '100%',
      }}
    >
      {groups.map(group => (
        <div
          key={group.key}
          style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', flexShrink: 0 }}
        >
          {/* ── Month label column ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: 68,
            flexShrink: 0,
            paddingTop: 0,
          }}>
            <div style={{
              width: 1,
              background: 'var(--border)',
              opacity: 0.5,
              height: 1200,
              maxHeight: '100%',
            }} />
            <div className="mono" style={{
              fontSize: 9,
              color: 'var(--text3)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              marginTop: 5,
              whiteSpace: 'nowrap',
            }}>
              {group.label}
            </div>
          </div>

          {/* ── Cards ── */}
          <div style={{
            display: 'flex',
            flexDirection: 'row',
            flexWrap: 'nowrap',
            gap: 10,
            padding: '0 0 0 0',
            alignItems: 'flex-start',
          }}>
            {group.items.map(record => (
              <TimelineCard
                key={record.id}
                record={record}
                selected={record.id === selectedRecordId}
                onSelect={() => onSelectRecord(record.id)}
              />
            ))}
          </div>
        </div>
      ))}

      {/* Right sentinel */}
      <div style={{ flexShrink: 0, width: 24 }} />
    </div>
  );
}
