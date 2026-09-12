'use client';

import React, { useState, useEffect } from 'react';
import { Record, Evidence, DEFAULT_STAGES, stageMeta } from '@/lib/types';

interface DetailPanelProps {
  record: Record | null;
  stages?: string[];
  onClose: () => void;
  onSave: (updated: Record) => Promise<void>;
  onDelete?: (record: Record) => Promise<void>;
}

const EVIDENCE_META: { [k: string]: { icon: string; label: string } } = {
  input:    { icon: '⊳', label: 'Input' },
  judgment: { icon: '◆', label: 'Judgment' },
  quote:    { icon: '❝', label: 'Quote' },
  artifact: { icon: '↗', label: 'Artifact' },
  // legacy
  github:   { icon: '⌥', label: 'GitHub' },
  doc:      { icon: '📄', label: 'Doc' },
  figma:    { icon: '✦', label: 'Figma' },
  loom:     { icon: '▶', label: 'Loom' },
  other:    { icon: '↗', label: 'Link' },
};


function EvidenceItem({ ev }: { ev: Evidence }) {
  const meta = EVIDENCE_META[ev.type || 'other'] || EVIDENCE_META.other;
  const color = ev.type === 'judgment' ? 'var(--accent)' : 'var(--text2)';
  const visibility = ev.visibility
    ? (ev.visibility === 'approved' || ev.artifact_path ? 'Approved artifact' : 'Private trace')
    : 'Evidence';

  const inner = (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: 3,
      padding: '8px 11px', fontSize: 11, borderRadius: 4,
      border: `1px solid ${ev.type === 'judgment' ? 'var(--accent-dim)' : 'var(--border)'}`,
      background: ev.type === 'judgment' ? 'var(--tag-active-bg)' : 'var(--surface)',
      transition: 'all 0.15s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color }}>{meta.icon}</span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
          {meta.label}
        </span>
        {ev.meta && (
          <span className="mono" style={{ fontSize: 9, color: 'var(--text3)', marginLeft: 'auto' }}>{ev.meta}</span>
        )}
        <span className="mono" style={{ fontSize: 8, color: ev.visibility === 'approved' ? 'var(--accent)' : 'var(--text3)', marginLeft: ev.meta ? 0 : 'auto' }}>
          {visibility}
        </span>
      </div>
      <div style={{ color: 'var(--text)', fontSize: 12, lineHeight: 1.5 }}>{ev.label}</div>
      {ev.quote && (
        <div style={{ color: 'var(--text2)', fontSize: 11, fontStyle: 'italic', lineHeight: 1.5, borderLeft: '2px solid var(--border2)', paddingLeft: 8, marginTop: 2 }}>
          “{ev.quote}”
        </div>
      )}
      {ev.detail && (
        <div style={{ color: 'var(--text2)', fontSize: 11, lineHeight: 1.5, marginTop: 2 }}>{ev.detail}</div>
      )}
    </div>
  );

  if (ev.url) {
    return (
      <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', display: 'block' }}>
        {inner}
      </a>
    );
  }
  return inner;
}

// ── Editable field ──
function EditTextarea({
  label,
  value,
  onChange,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 5,
      }}>
        {label}
      </div>
      <textarea
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        style={{
          width: '100%',
          background: 'var(--bg)',
          border: '1px solid var(--border2)',
          borderRadius: 3,
          color: 'var(--text)',
          fontSize: 12,
          lineHeight: 1.6,
          padding: '8px 10px',
          resize: 'vertical',
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 0.15s',
        }}
        onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
        onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; }}
      />
    </div>
  );
}

function narrativeLabel(heading: string): string {
  const h = heading.trim();
  if (!h) return 'Context';
  if (/problem|context|situation|question/i.test(h)) return 'Context';
  if (/done|work|action|converged|approach|what i dug into|design decisions|outreach approach/i.test(h)) return 'Work';
  if (/result|outcome|finding/i.test(h)) return 'Result';
  if (/judgment|judgement/i.test(h)) return '';
  return h;
}

// ── Main panel ──
export function DetailPanel({ record, stages = [...DEFAULT_STAGES], onClose, onSave, onDelete }: DetailPanelProps) {
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({
    title: '', summary: '', content: '', result: '',
    section: '', purpose: '', activities: '', tools: '', mindset: '',
  });

  // Reset edit mode + draft when record changes
  useEffect(() => {
    setEditMode(false);
    if (record) {
      setDraft({
        title:    record.title,
        summary:  record.summary  || '',
        content:  record.content  || '',
        result:   record.result   || '',
        section:  record.section  || 'Build',
        purpose:  record.purpose || record.subPurpose || '',
        activities: (record.activities || []).join(', '),
        tools:    (record.tools || record.toolTags || []).join(', '),
        mindset:  (record.mindset || record.mindsetTags || []).join(', '),
      });
    }
  }, [record?.id]);

  if (!record) return null;

  const section = (editMode ? draft.section : record.section) || 'Build';
  const sectionMeta = stageMeta(section, stages);

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated: Record = {
        ...record,
        title:      draft.title,
        summary:    draft.summary,
        content:    draft.content,
        result:     draft.result,
        section:    draft.section || 'Build',
        purpose:    draft.purpose || null,
        activities: draft.activities.split(',').map(v => v.trim()).filter(Boolean),
        tools:      draft.tools.split(',').map(v => v.trim()).filter(Boolean),
        toolTags:   draft.tools.split(',').map(v => v.trim()).filter(Boolean),
        mindset:    draft.mindset.split(',').map(v => v.trim()).filter(Boolean),
        mindsetTags:draft.mindset.split(',').map(v => v.trim()).filter(Boolean),
        updated_at: new Date().toISOString().slice(0, 10),
      };
      await onSave(updated);
      setEditMode(false);
    } finally {
      setSaving(false);
    }
  };

  const setField = (k: keyof typeof draft) => (v: string) =>
    setDraft(d => ({ ...d, [k]: v }));

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'var(--surface)', borderLeft: '1px solid var(--border)',
    }}>
      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
        gap: 12, padding: '14px 16px 11px',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Breadcrumb */}
          {(record.projectTitle || record.goalTitle) && (
            <div className="mono" style={{
              fontSize: 10, color: 'var(--text3)', marginBottom: 5,
              display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap',
            }}>
              {record.projectTitle && <span>{record.projectTitle}</span>}
              {record.projectTitle && record.goalTitle && <span style={{ color: 'var(--border2)' }}>›</span>}
              {record.goalTitle && <span>{record.goalTitle}</span>}
            </div>
          )}

          {/* Stage + date */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 7 }}>
            {editMode ? (
              <select
                value={draft.section}
                onChange={e => setField('section')(e.target.value)}
                style={{
                  background: 'var(--bg)', border: '1px solid var(--border2)',
                  color: 'var(--text2)', borderRadius: 3, fontSize: 11,
                  padding: '3px 6px', fontFamily: 'IBM Plex Mono, monospace',
                }}
              >
                {stages.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
                {!stages.includes(draft.section) && draft.section && (
                  <option value={draft.section}>{draft.section}</option>
                )}
              </select>
            ) : (
              <span className="mono" style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                fontSize: 11, color: sectionMeta.color,
              }}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: sectionMeta.color, display: 'inline-block',
                }} />
                {section}
              </span>
            )}
            <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>
              {record.updated_at ? `updated ${record.updated_at.slice(0, 10)}` : (record.created_at || '').slice(0, 10)}
            </span>
          </div>

          {/* Title */}
          {editMode ? (
            <input
              value={draft.title}
              onChange={e => setField('title')(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg)',
                border: '1px solid var(--border2)', borderRadius: 3,
                color: 'var(--text)', fontSize: 14, fontWeight: 600,
                padding: '6px 8px', outline: 'none', fontFamily: 'inherit',
                transition: 'border-color 0.15s',
              }}
              onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
              onBlur={e => { e.currentTarget.style.borderColor = 'var(--border2)'; }}
            />
          ) : (
            <h2 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4, margin: 0 }}>
              {record.title}
            </h2>
          )}
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {editMode ? (
            <>
              <button
                onClick={() => setEditMode(false)}
                disabled={saving}
                className="mono"
                style={{
                  padding: '5px 10px', fontSize: 11, borderRadius: 3,
                  border: '1px solid var(--border)', background: 'transparent',
                  color: 'var(--text2)', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="mono"
                style={{
                  padding: '5px 12px', fontSize: 11, borderRadius: 3,
                  border: '1px solid var(--accent)',
                  background: saving ? 'var(--tag-active-bg)' : 'var(--accent)',
                  color: saving ? 'var(--accent)' : 'var(--bg)',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontWeight: 600, transition: 'all 0.15s',
                }}
              >
                {saving ? 'Saving…' : 'Save'}
              </button>
            </>
          ) : (
            <>
              {onDelete && (
                <button
                  onClick={async () => {
                    if (!window.confirm(`Delete “${record.title}”? This cannot be undone.`)) return;
                    setSaving(true);
                    try { await onDelete(record); } finally { setSaving(false); }
                  }}
                  title="Delete task"
                  disabled={saving}
                  className="mono"
                  style={{
                    height: 28, padding: '0 8px', background: 'transparent',
                    border: '1px solid var(--border)', borderRadius: 4,
                    color: 'var(--danger)', cursor: saving ? 'not-allowed' : 'pointer', fontSize: 10,
                  }}
                >
                  Delete
                </button>
              )}
              <button
                onClick={() => setEditMode(true)}
                title="Edit"
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 4,
                  color: 'var(--text2)', cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                  <path d="M7.5 1.5l3 3-7 7H.5v-3l7-7z" stroke="currentColor" strokeWidth="1.1" strokeLinejoin="round"/>
                </svg>
              </button>
              <button
                onClick={onClose}
                aria-label="Close"
                style={{
                  width: 28, height: 28, display: 'flex', alignItems: 'center',
                  justifyContent: 'center', background: 'transparent',
                  border: '1px solid var(--border)', borderRadius: 4,
                  color: 'var(--text2)', fontSize: 16, lineHeight: 1, cursor: 'pointer',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                ×
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Body ── */}
      <div className="thin-scroll" style={{ flex: 1, overflowY: 'auto', padding: '14px 16px' }}>

        {editMode ? (
          // ── Edit form ──
          <>
            <EditTextarea label="Purpose" value={draft.purpose} onChange={setField('purpose')} rows={2} />
            <EditTextarea label="Activities · comma separated" value={draft.activities} onChange={setField('activities')} rows={2} />
            <EditTextarea label="Summary" value={draft.summary} onChange={setField('summary')} rows={3} />
            <EditTextarea label="Work" value={draft.content} onChange={setField('content')} rows={6} />
            <EditTextarea label="Result" value={draft.result} onChange={setField('result')} rows={3} />
            <EditTextarea label="Tools · comma separated" value={draft.tools} onChange={setField('tools')} rows={2} />
            <EditTextarea label="Mindset · comma separated" value={draft.mindset} onChange={setField('mindset')} rows={2} />
          </>
        ) : (
          // ── Read view ──
          <>
            {/* The judgment call — the heart of the record, shown first */}
            {record.judgment && (
              <div style={{
                marginBottom: 18, padding: '13px 15px', borderRadius: 5,
                background: 'var(--tag-active-bg)', border: '1px solid var(--accent-dim)',
              }}>
                <div className="mono" style={{
                  fontSize: 10, color: 'var(--accent)', textTransform: 'uppercase',
                  letterSpacing: '0.08em', marginBottom: 9, display: 'flex', alignItems: 'center', gap: 6,
                }}>
                  ◆ The judgment call
                </div>

                {typeof record.judgment === 'string' ? (
                  /* Legacy records: single string */
                  <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
                    {record.judgment}
                  </p>
                ) : (
                  /* Structured: the AI-vs-builder contrast — the product's core claim.
                     The agent in the chat is the witness: it knows what it proposed
                     and what the builder did with it. */
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {record.judgment.ai && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div className="mono" style={{
                          flexShrink: 0, width: 88, fontSize: 9.5, color: 'var(--text3)',
                          textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2,
                        }}>
                          AI proposed
                        </div>
                        <p style={{
                          fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, margin: 0,
                          textDecoration: record.judgment.builder ? 'line-through' : 'none',
                          textDecorationColor: 'var(--text3)', textDecorationThickness: 1,
                        }}>
                          {record.judgment.ai}
                        </p>
                      </div>
                    )}
                    {record.judgment.builder && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div className="mono" style={{
                          flexShrink: 0, width: 88, fontSize: 9.5, color: 'var(--accent)',
                          textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2,
                        }}>
                          Builder&apos;s call
                        </div>
                        <p style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, lineHeight: 1.6, margin: 0 }}>
                          {record.judgment.builder}
                        </p>
                      </div>
                    )}
                    {record.judgment.why && (
                      <div style={{ display: 'flex', gap: 10 }}>
                        <div className="mono" style={{
                          flexShrink: 0, width: 88, fontSize: 9.5, color: 'var(--text3)',
                          textTransform: 'uppercase', letterSpacing: '0.06em', paddingTop: 2,
                        }}>
                          Why
                        </div>
                        <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.6, margin: 0, fontStyle: 'italic' }}>
                          {record.judgment.why}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {(record.purpose || record.subPurpose) && (
              <Section label="Purpose">
                <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
                  {record.purpose || record.subPurpose}
                </p>
              </Section>
            )}

            {record.narrative && record.narrative.length > 0 ? (
              // v3 + parsed legacy body: render named blocks, never the raw markdown blob.
              record.narrative.map((block, i) => {
                const label = narrativeLabel(block.heading);
                if (!label || !block.body) return null;
                return (
                  <Section key={`${block.heading}-${i}`} label={label}>
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {block.body}
                    </p>
                  </Section>
                );
              })
            ) : (
              // Legacy fallback for records without parseable H2 sections.
              <>
                {!(record.purpose || record.subPurpose) && record.summary && (
                  <Section label="Purpose">
                    <p style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.65, margin: 0 }}>
                      {record.summary}
                    </p>
                  </Section>
                )}
                {record.content && (
                  <Section label="Work">
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: 0, whiteSpace: 'pre-wrap' }}>
                      {record.content}
                    </p>
                  </Section>
                )}
                {record.result && (
                  <Section label="Result">
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.65, margin: 0 }}>
                      {record.result}
                    </p>
                  </Section>
                )}
              </>
            )}
          </>
        )}

        {/* Evidence — 4 types (input/judgment/quote/artifact), always shown */}
        {!editMode && record.evidence && record.evidence.length > 0 && (
          <Section label={`Evidence (${record.evidence.length})`}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {record.evidence.map((ev, i) => (
                <EvidenceItem key={i} ev={ev} />
              ))}
            </div>
          </Section>
        )}

        {/* Images — always shown */}
        {!editMode && record.images && record.images.length > 0 && (
          <Section label="Images">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {record.images.map((src, i) => (
                <img
                  key={i}
                  src={src}
                  alt={`Image ${i + 1}`}
                  style={{
                    width: '100%', borderRadius: 4,
                    border: '1px solid var(--border)', display: 'block',
                  }}
                />
              ))}
            </div>
          </Section>
        )}

        {/* Tags — always shown */}
        {!editMode && ((record.mindsetTags && record.mindsetTags.length > 0) ||
          (record.toolTags && record.toolTags.length > 0)) && (
          <Section label="Tags">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {record.mindsetTags && record.mindsetTags.length > 0 && (
                <div>
                  <div className="mono" style={{
                    fontSize: 9, color: 'var(--text3)', marginBottom: 4,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>Mindset</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {record.mindsetTags.map(tag => (
                      <span key={tag} className="mono" style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 3,
                        background: 'var(--tag-active-bg)', color: 'var(--accent)',
                        border: '1px solid var(--accent-dim)',
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
              {record.toolTags && record.toolTags.length > 0 && (
                <div>
                  <div className="mono" style={{
                    fontSize: 9, color: 'var(--text3)', marginBottom: 4,
                    textTransform: 'uppercase', letterSpacing: '0.06em',
                  }}>Tools</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                    {record.toolTags.map(tag => (
                      <span key={tag} className="mono" style={{
                        fontSize: 11, padding: '3px 8px', borderRadius: 3,
                        background: 'var(--tag-bg)', color: 'var(--text2)',
                        border: '1px solid var(--border)',
                      }}>{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        )}

        {/* File path */}
        {!editMode && record.file_path && (
          <div style={{ marginTop: 18, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
            <div className="mono" style={{
              fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase',
              letterSpacing: '0.08em', marginBottom: 3,
            }}>
              Source
            </div>
            <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', wordBreak: 'break-all' }}>
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
    <div style={{ marginBottom: 18 }}>
      <div className="mono" style={{
        fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase',
        letterSpacing: '0.08em', marginBottom: 7,
      }}>
        {label}
      </div>
      {children}
    </div>
  );
}
