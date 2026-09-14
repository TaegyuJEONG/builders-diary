'use client';

import React, { useState } from 'react';
import { TaskProposal } from '@/lib/fileSystem';

interface Props {
  proposal: TaskProposal;
  busy?: boolean;
  onApprove: (proposal: TaskProposal, edited: Partial<TaskProposal>) => void;
  onDrop: (proposal: TaskProposal) => void;
}

const pill = (items: string[]) => items.length ? items.join(' · ') : 'None listed';

export function TaskProposalCard({ proposal, busy = false, onApprove, onDrop }: Props) {
  const [editing, setEditing] = useState(false);
  const [evidenceVisibility, setEvidenceVisibility] = useState<Record<string, 'private' | 'public'>>(() => Object.fromEntries(proposal.evidence_candidates.map(item => [item.id, item.verified ? 'public' : 'private'])));
  const [title, setTitle] = useState(proposal.title);
  const [body, setBody] = useState(proposal.body);
  const excerpt = proposal.body.length > 260 ? `${proposal.body.slice(0, 260)}…` : proposal.body;
  const approveWithEvidence = () => onApprove(proposal, { evidence_candidates: proposal.evidence_candidates.map(item => ({ ...item, visibility: evidenceVisibility[item.id] || 'private' })) });
  return <article style={{ border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}>
      <strong style={{ fontSize: 14, flex: 1 }}>{proposal.project || 'Unassigned project'}</strong>
      <span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>{proposal.date}</span>
    </div>
    <div className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>{proposal.stage} · {proposal.purpose || 'No Purpose'}</div>
    {editing ? <>
      <label style={{ fontSize: 11 }}>Title<input aria-label="Task title" value={title} onChange={event => setTitle(event.target.value)} style={{ display: 'block', width: '100%', marginTop: 4, padding: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 4 }} /></label>
      <label style={{ fontSize: 11 }}>Summary / body<textarea aria-label="Task body" value={body} onChange={event => setBody(event.target.value)} rows={5} style={{ display: 'block', width: '100%', marginTop: 4, padding: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 4 }} /></label>
    </> : <>
      <h3 style={{ margin: 0, fontSize: 15 }}>{proposal.title}</h3>
      <div><b style={{ fontSize: 11 }}>Purpose</b><div style={{ fontSize: 12, color: 'var(--text2)' }}>{proposal.task_aim || 'No task aim provided.'}</div></div>
      <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{excerpt || 'No summary or body excerpt provided.'}</div>
    </>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, fontSize: 11, color: 'var(--text2)' }}>
      <div><b>Activities</b><div>{pill(proposal.activities)}</div></div>
      <div><b>Tools</b><div>{pill(proposal.tools)}</div></div>
      <div><b>Mindset</b><div>{pill(proposal.mindset)}</div></div>
    </div>
    <div style={{ fontSize: 11, color: 'var(--text2)' }}><b>Evidence candidates</b>{proposal.evidence_candidates.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 5 }}>{proposal.evidence_candidates.map(item => <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><span>{item.label}</span><span className="mono" style={{ fontSize: 9, color: item.verified ? 'var(--accent)' : 'var(--danger)' }}>{item.verified ? 'Verified' : 'Unverified'}</span>{item.quote && <span style={{ fontStyle: 'italic' }}>“{item.quote}”</span>}<select aria-label={`Evidence visibility for ${item.label}`} value={evidenceVisibility[item.id] || 'private'} onChange={event => setEvidenceVisibility(current => ({ ...current, [item.id]: event.target.value as 'private' | 'public' }))} style={{ marginLeft: 'auto', background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 10 }}><option value="private">Private</option><option value="public" disabled={!item.verified}>Public</option></select></div>)}</div> : <div style={{ marginTop: 4, color: 'var(--text3)' }}>No evidence candidates. You can still save this Task.</div>}</div>
    <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', paddingTop: 4 }}>
      <button disabled={busy} onClick={() => onDrop(proposal)} className="mono" style={{ padding: '6px 9px', background: 'transparent', color: 'var(--danger)', border: '1px solid var(--border)', borderRadius: 4 }}>Drop</button>
      <button disabled={busy} onClick={() => { if (editing) { onApprove(proposal, { title, body, evidence_candidates: proposal.evidence_candidates.map(item => ({ ...item, visibility: evidenceVisibility[item.id] || 'private' })) }); } else setEditing(true); }} className="mono" style={{ padding: '6px 9px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 }}>{editing ? 'Edit and approve' : 'Edit and approve'}</button>
      {!editing && <button disabled={busy} onClick={approveWithEvidence} className="mono" style={{ padding: '6px 9px', background: 'var(--accent)', color: 'var(--bg)', border: '1px solid var(--accent)', borderRadius: 4 }}>Approve</button>}
    </div>
  </article>;
}
