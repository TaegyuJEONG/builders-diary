'use client';

import React, { useRef, useEffect } from 'react';
import { Record } from '@/lib/types';

interface CardScrollableProps {
  records: Record[];
  selectedRecordId: string | null;
  onSelectRecord: (recordId: string) => void;
}

const STATUS_META: { [k: string]: { label: string; color: string } } = {
  completed: { label: '완료', color: 'var(--status-completed)' },
  in_progress: { label: '진행', color: 'var(--status-progress)' },
  blocked: { label: '막힘', color: 'var(--status-blocked)' },
};

export function CardScrollable({
  records,
  selectedRecordId,
  onSelectRecord,
}: CardScrollableProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedRecordId && scrollRef.current) {
      const el = scrollRef.current.querySelector(`[data-record-id="${selectedRecordId}"]`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedRecordId]);

  if (records.length === 0) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8, color: 'var(--text3)',
      }}>
        <div style={{ fontSize: 26, opacity: 0.4 }}>◌</div>
        <div className="mono" style={{ fontSize: 13 }}>해당하는 작업 카드가 없습니다</div>
        <div className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>필터를 조정해 보세요</div>
      </div>
    );
  }

  return (
    <div
      ref={scrollRef}
      className="thin-scroll"
      style={{
        display: 'flex',
        gap: 12,
        padding: '20px 24px',
        overflowX: 'auto',
        overflowY: 'hidden',
        alignItems: 'flex-start',
        height: '100%',
        scrollSnapType: 'x proximity',
      }}
    >
      {records.map(record => {
        const selected = record.id === selectedRecordId;
        const status = record.status ? STATUS_META[record.status] : null;
        return (
          <div
            key={record.id}
            data-record-id={record.id}
            role="button"
            tabIndex={0}
            onClick={() => onSelectRecord(record.id)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSelectRecord(record.id); }}
            style={{
              flexShrink: 0,
              width: 250,
              height: 176,
              display: 'flex',
              flexDirection: 'column',
              background: 'var(--surface)',
              border: `1px solid ${selected ? 'var(--accent)' : 'var(--border)'}`,
              borderRadius: 6,
              cursor: 'pointer',
              scrollSnapAlign: 'start',
              transition: 'border-color 0.15s, transform 0.15s',
              overflow: 'hidden',
              boxShadow: selected ? '0 0 0 1px var(--accent)' : 'none',
            }}
            onMouseEnter={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border2)'; }}
            onMouseLeave={e => { if (!selected) e.currentTarget.style.borderColor = 'var(--border)'; }}
          >
            {/* Top row: date + status */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 14px 0',
            }}>
              <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                {record.created_at}
              </span>
              {status && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  fontSize: 10, color: status.color,
                }} className="mono">
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block' }} />
                  {status.label}
                </span>
              )}
            </div>

            {/* Title (main) */}
            <div style={{
              flex: 1,
              padding: '10px 14px 12px',
              fontSize: 14,
              lineHeight: 1.5,
              color: 'var(--text)',
              fontWeight: 500,
              display: '-webkit-box',
              WebkitLineClamp: 4,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {record.title}
            </div>

            {/* Tags */}
            <div style={{
              padding: '0 14px 12px',
              display: 'flex', flexWrap: 'wrap', gap: 5,
            }}>
              {record.tags.slice(0, 4).map(tag => (
                <span key={tag} className="mono" style={{
                  fontSize: 10,
                  padding: '2px 6px',
                  borderRadius: 2,
                  background: 'var(--tag-bg)',
                  color: 'var(--text3)',
                  border: '1px solid var(--border)',
                  whiteSpace: 'nowrap',
                }}>
                  {tag}
                </span>
              ))}
              {record.tags.length > 4 && (
                <span className="mono" style={{ fontSize: 10, color: 'var(--text3)', padding: '2px 2px' }}>
                  +{record.tags.length - 4}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
