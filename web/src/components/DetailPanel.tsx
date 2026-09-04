'use client';

import React from 'react';
import { Record } from '@/lib/types';

interface DetailPanelProps {
  record: Record | null;
  onClose: () => void;
}

const STATUS_META: { [k: string]: { label: string; color: string } } = {
  completed: { label: '완료', color: 'var(--status-completed)' },
  in_progress: { label: '진행 중', color: 'var(--status-progress)' },
  blocked: { label: '막힘', color: 'var(--status-blocked)' },
};

export function DetailPanel({ record, onClose }: DetailPanelProps) {
  if (!record) return null;

  const status = record.status ? STATUS_META[record.status] : null;

  return (
    <div style={{
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      background: 'var(--surface)',
      borderLeft: '1px solid var(--border)',
    }}>
      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, padding: '18px 20px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
            {status && (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: status.color,
              }} className="mono">
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: status.color, display: 'inline-block' }} />
                {status.label}
              </span>
            )}
            <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
              {record.created_at}
            </span>
          </div>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
            {record.title}
          </h2>
        </div>
        <button
          onClick={onClose}
          aria-label="닫기"
          style={{
            flexShrink: 0, background: 'none', border: '1px solid var(--border)',
            borderRadius: 4, color: 'var(--text2)', width: 28, height: 28,
            fontSize: 16, lineHeight: 1, cursor: 'pointer',
          }}
          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--text)'; }}
          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text2)'; }}
        >
          ×
        </button>
      </div>

      {/* Body */}
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '18px 20px' }}>
        {/* Summary */}
        {record.summary && (
          <Section label="요약">
            <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
              {record.summary}
            </p>
          </Section>
        )}

        {/* Content / 작업 상세 */}
        {record.content && (
          <Section label="작업 상세">
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
              {record.content}
            </p>
          </Section>
        )}

        {/* Result / 결과 */}
        {record.result && (
          <Section label="결과">
            <div style={{
              fontSize: 13,
              color: 'var(--accent)',
              lineHeight: 1.6,
              background: 'var(--tag-active-bg)',
              border: '1px solid var(--accent-dim)',
              borderRadius: 4,
              padding: '10px 12px',
            }} className="mono">
              {record.result}
            </div>
          </Section>
        )}

        {/* Tags */}
        {record.tags.length > 0 && (
          <Section label="태그">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {record.tags.map(tag => (
                <span key={tag} className="mono" style={{
                  fontSize: 11, padding: '3px 8px', borderRadius: 3,
                  background: 'var(--tag-bg)', color: 'var(--text2)', border: '1px solid var(--border)',
                }}>
                  {tag}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* File path */}
        {record.file_path && (
          <div style={{ marginTop: 20, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <div className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
              경로
            </div>
            <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', wordBreak: 'break-all' }}>
              {record.file_path}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 8,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
