'use client';

import React, { useState } from 'react';
import { TaskProposal } from '@/lib/fileSystem';

interface Props {
  proposal: TaskProposal;
  busy?: boolean;
  onApprove: (proposal: TaskProposal, edited: Partial<TaskProposal>) => void;
  onDrop: (proposal: TaskProposal) => void;
  onSave: (proposal: TaskProposal, edited: Partial<TaskProposal>) => void;
}

const pill = (items: string[]) => items.length ? items.join(' · ') : 'None listed';
const split = (value: string) => value.split(',').map(item => item.trim()).filter(Boolean);

export function TaskProposalCard({ proposal, busy = false, onApprove, onDrop, onSave }: Props) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(proposal.title);
  const [body, setBody] = useState(proposal.body);
  const [activities, setActivities] = useState(proposal.activities.join(', '));
  const [tools, setTools] = useState(proposal.tools.join(', '));
  const [mindset, setMindset] = useState(proposal.mindset.join(', '));
  const [selectedEvidence, setSelectedEvidence] = useState<Set<string>>(new Set());
  const [evidenceVisibility, setEvidenceVisibility] = useState<Record<string, 'private' | 'public'>>({});
  const edited = () => ({ title, body, activities: split(activities), tools: split(tools), mindset: split(mindset), evidence_candidates: proposal.evidence_candidates.filter(item => selectedEvidence.has(item.id)).map(item => ({ ...item, visibility: evidenceVisibility[item.id] || 'private' })) });
  const excerpt = proposal.body.length > 260 ? `${proposal.body.slice(0, 260)}…` : proposal.body;
  const approveWithEvidence = () => onApprove(proposal, edited());
  const toggleEvidence = (id: string) => setSelectedEvidence(current => { const next = new Set(current); if (next.has(id)) next.delete(id); else next.add(id); return next; });
  return <article style={{ border: '1px solid var(--border)', borderRadius: 7, background: 'var(--surface)', padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
    <div style={{ display: 'flex', gap: 10, alignItems: 'baseline' }}><strong style={{ fontSize: 14, flex: 1 }}>{proposal.project || 'Unassigned project'}</strong><span className="mono" style={{ fontSize: 10, color: 'var(--text3)' }}>{proposal.date}</span></div>
    <div className="mono" style={{ fontSize: 10, color: 'var(--accent)' }}>{proposal.stage} · {proposal.purpose || 'No Purpose'}</div>
    {editing ? <>
      <label style={{ fontSize: 11 }}>Title<input aria-label="Task title" value={title} onChange={event => setTitle(event.target.value)} style={input} /></label>
      <label style={{ fontSize: 11 }}>Summary / body<textarea aria-label="Task body" value={body} onChange={event => setBody(event.target.value)} rows={5} style={input} /></label>
      <label style={{ fontSize: 11 }}>Activities<input aria-label="Activities" value={activities} onChange={event => setActivities(event.target.value)} style={input} /></label>
      <label style={{ fontSize: 11 }}>Tools<input aria-label="Tools" value={tools} onChange={event => setTools(event.target.value)} style={input} /></label>
      <label style={{ fontSize: 11 }}>Mindset<input aria-label="Mindset" value={mindset} onChange={event => setMindset(event.target.value)} style={input} /></label>
    </> : <><h3 style={{ margin: 0, fontSize: 15 }}>{proposal.title}</h3><div><b style={{ fontSize: 11 }}>Purpose</b><div style={{ fontSize: 12, color: 'var(--text2)' }}>{proposal.task_aim || 'No task aim provided.'}</div></div><div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>{excerpt || 'No summary or body excerpt provided.'}</div></>}
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, fontSize: 11, color: 'var(--text2)' }}><div><b>Activities</b><div>{pill(editing ? split(activities) : proposal.activities)}</div></div><div><b>Tools</b><div>{pill(editing ? split(tools) : proposal.tools)}</div>{Object.entries(proposal.tool_categories || {}).filter(([, items]) => items.length).map(([category, items]) => <div key={category} className="mono" style={{ fontSize: 9 }}>{category}: {items.join(' · ')}</div>)}</div><div><b>Mindset</b><div>{pill(editing ? split(mindset) : proposal.mindset)}</div></div></div>
    <div style={{ fontSize: 11, color: 'var(--text2)' }}><b>Evidence candidates</b>{proposal.evidence_candidates.length ? <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 5 }}>{proposal.evidence_candidates.map(item => <label key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}><input type="checkbox" aria-label={`Select evidence ${item.label}`} checked={selectedEvidence.has(item.id)} onChange={() => toggleEvidence(item.id)} /><span>{item.label}</span><span className="mono" style={{ fontSize: 9, color: item.verified ? 'var(--accent)' : 'var(--danger)' }}>{item.verified ? 'Verified' : 'Unverified'}</span>{item.quote && <span style={{ fontStyle: 'italic' }}>“{item.quote}”</span>}{item.url?.startsWith('http') && <a href={item.url} target="_blank" rel="noreferrer">Source</a>}<select aria-label={`Evidence visibility for ${item.label}`} value={evidenceVisibility[item.id] || 'private'} onChange={event => setEvidenceVisibility(current => ({ ...current, [item.id]: event.target.value as 'private' | 'public' }))} style={{ marginLeft: 'auto', background: 'var(--bg)', color: 'var(--text2)', border: '1px solid var(--border)', borderRadius: 3, fontSize: 10 }}><option value="private">Private</option><option value="public" disabled={!item.verified}>Public</option></select></label>)}</div> : <div style={{ marginTop: 4, color: 'var(--text3)' }}>No evidence candidates. You can still save this Task.</div>}</div>
    <div style={{ display: 'flex', gap: 7, justifyContent: 'flex-end', paddingTop: 4 }}><button disabled={busy} onClick={() => onDrop(proposal)} className="mono" style={dangerButton}>Drop</button>{editing ? <><button disabled={busy} onClick={() => { onSave(proposal, edited()); setEditing(false); }} className="mono" style={button}>Save</button><button disabled={busy} onClick={() => setEditing(false)} className="mono" style={button}>Cancel</button></> : <button disabled={busy} onClick={() => setEditing(true)} className="mono" style={button}>Edit</button>} {!editing && <button disabled={busy} onClick={approveWithEvidence} className="mono" style={approveButton}>Approve</button>}</div>
  </article>;
}
const input: React.CSSProperties = { display: 'block', width: '100%', marginTop: 4, padding: 7, background: 'var(--bg)', color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 4 };
const button: React.CSSProperties = { padding: '6px 9px', background: 'transparent', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 4 };
const dangerButton: React.CSSProperties = { ...button, color: 'var(--danger)' };
const approveButton: React.CSSProperties = { ...button, background: 'var(--accent)', color: 'var(--bg)', borderColor: 'var(--accent)' };
