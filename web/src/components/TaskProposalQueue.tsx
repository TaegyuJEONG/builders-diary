'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadFolderHandleFromStorage,
  readTaskProposals,
  TaskApproval,
  TaskProposal,
  waitForTaskActionResult,
  writeTaskApproveAction,
  writeTaskDropAction,
} from '@/lib/fileSystem';
import { TaskProposalCard } from '@/components/TaskProposalCard';

interface Props { refreshKey?: number; onSaved?: () => void }

export function TaskProposalQueue({ refreshKey = 0, onSaved }: Props) {
  const [runId, setRunId] = useState<string | null>(null);
  const [proposals, setProposals] = useState<TaskProposal[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const handledIds = useRef(new Set<string>());

  const load = useCallback(async () => {
    const handle = await loadFolderHandleFromStorage();
    if (!handle) return;
    const data = await readTaskProposals(handle);
    if (data) { setRunId(data.runId); setProposals(data.proposals.filter(item => item.status === 'pending' && !handledIds.current.has(item.id))); }
  }, []);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { const timer = window.setInterval(() => void load(), 2500); return () => window.clearInterval(timer); }, [load]);

  const approve = async (proposal: TaskProposal, edited: Partial<TaskProposal>) => {
    if (!runId) return;
    setBusyId(proposal.id); setMessage('Waiting for Claude Code to save the approved Task…');
    try {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) throw new Error('Folder is not connected');
      const task: TaskApproval = {
        proposal_id: proposal.id,
        project: proposal.project, goal: proposal.purpose, stage: proposal.stage,
        title: String(edited.title || proposal.title), date: proposal.date,
        activity: edited.activities || proposal.activities, purpose: String(edited.task_aim || proposal.task_aim),
        tools: edited.tools || proposal.tools, mindset: edited.mindset || proposal.mindset, body: String(edited.body || proposal.body),
        evidence: (edited.evidence_candidates || proposal.evidence_candidates).map(item => ({ candidate_id: item.id, kind: item.kind, type: item.kind, label: item.label, url: item.url, meta: item.meta, detail: item.detail, quote: item.quote, visibility: item.visibility === 'public' ? 'public' : 'private', verified: item.verified })), highlight: proposal.highlight,
      };
      await writeTaskApproveAction(handle, runId, task);
      const result = await waitForTaskActionResult(handle, runId, 'approve');
      if (result?.status !== 'applied') throw new Error(result?.error || 'Claude Code did not save the Task.');
      setProposals(items => items.filter(item => item.id !== proposal.id));
      handledIds.current.add(proposal.id);
      setMessage('Task saved.');
      onSaved?.();
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Task approval failed.'); }
    finally { setBusyId(null); }
  };

  const save = (proposal: TaskProposal, edited: Partial<TaskProposal>) => {
    setProposals(items => items.map(item => item.id === proposal.id ? { ...item, ...edited } : item));
    setMessage('Task draft saved.');
  };

  const drop = async (proposal: TaskProposal) => {
    if (!runId) return;
    setBusyId(proposal.id); setMessage('Waiting for Claude Code to record the dropped Task…');
    try {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) throw new Error('Folder is not connected');
      await writeTaskDropAction(handle, runId, proposal.id);
      const result = await waitForTaskActionResult(handle, runId, 'drop');
      if (result?.status !== 'applied') throw new Error(result?.error || 'Claude Code did not record the drop.');
      setProposals(items => items.filter(item => item.id !== proposal.id));
      handledIds.current.add(proposal.id);
      setMessage('Task dropped.');
    } catch (error) { setMessage(error instanceof Error ? error.message : 'Task drop failed.'); }
    finally { setBusyId(null); }
  };

  if (!proposals.length) return message ? <div className="mono" style={{ color: 'var(--text2)', fontSize: 11 }}>{message}</div> : null;
  return <section style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
    <div><strong style={{ fontSize: 13 }}>Task proposals</strong><div className="mono" style={{ color: 'var(--text2)', fontSize: 10, marginTop: 3 }}>Purpose · Activities · Tools · Mindset · Evidence · Review each proposed Task before it enters your portfolio.</div></div>
    {message && <div className="mono" style={{ color: 'var(--text2)', fontSize: 11 }}>{message}</div>}
    {proposals.map(proposal => <TaskProposalCard key={proposal.id} proposal={proposal} busy={busyId === proposal.id} onApprove={approve} onDrop={drop} onSave={save} />)}
  </section>;
}
