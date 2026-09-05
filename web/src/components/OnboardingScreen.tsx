'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  loadFolderHandleFromStorage,
  verifyFolderPermission,
  scanFolderStructure,
} from '@/lib/fileSystem';
import { Portfolio } from '@/lib/types';

interface OnboardingScreenProps {
  onSelectFolder: () => void;
  isLoading: boolean;
  error?: string | null;
  folderConnected?: boolean;
  folderPath?: string;
}

const CLIENTS = [
  { id: 'claude',   label: 'Claude Code',  desc: 'Anthropic',         available: true  },
  { id: 'cursor',   label: 'Cursor',        desc: 'Anysphere',         available: true  },
  { id: 'windsurf', label: 'Windsurf',      desc: 'Codeium',           available: true  },
  { id: 'cline',    label: 'Cline',         desc: 'VS Code extension', available: true  },
  { id: 'chatgpt',  label: 'ChatGPT',       desc: 'OpenAI',            available: false },
  { id: 'codex',    label: 'Codex CLI',     desc: 'OpenAI',            available: false },
];

type Phase = 'select' | 'steps';

export function OnboardingScreen({
  onSelectFolder, isLoading, error, folderConnected, folderPath,
}: OnboardingScreenProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [copied, setCopied] = useState<string | null>(null);
  const [firstRecord, setFirstRecord] = useState<Portfolio | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // folder connected (step 2) → advance to step 3
  useEffect(() => {
    if (folderConnected && step === 2) setStep(3);
  }, [folderConnected, step]);

  // step 3 → poll for first record
  useEffect(() => {
    if (step !== 3) return;
    pollingRef.current = setInterval(async () => {
      try {
        const handle = await loadFolderHandleFromStorage();
        if (!handle) return;
        const ok = await verifyFolderPermission(handle);
        if (!ok) return;
        const data = await scanFolderStructure(handle);
        const hasRecords = data.projects.some(p =>
          p.goals.some(g => g.records.length > 0)
        );
        if (hasRecords) {
          setFirstRecord(data);
          clearInterval(pollingRef.current!);
        }
      } catch { /* ignore */ }
    }, 3000);
    return () => { if (pollingRef.current) clearInterval(pollingRef.current); };
  }, [step]);

  // Install snippet — one command installs the skill for all selected tools
  const toolFlag = selectedClients.join(',');
  const installSnippet = `npx builders-diary@latest install --tools ${toolFlag || 'claude'}`;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function toggleClient(id: string) {
    setSelectedClients(prev =>
      prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
    );
  }

  function goBackToSelect() {
    setPhase('select');
    setStep(1);
    setFirstRecord(null);
    if (pollingRef.current) clearInterval(pollingRef.current);
  }

  const toolName = CLIENTS.find(c => selectedClients.includes(c.id))?.label ?? 'your AI tool';

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '56px 24px 60px',
    }}>
      <div style={{ maxWidth: 560, width: '100%' }}>

        {/* ── HERO ── */}
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 className="serif" style={{ fontSize: 40, fontWeight: 400, margin: 0 }}>
            Builder&apos;s Diary
          </h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10, letterSpacing: '0.04em' }}>
            Record every build. Get discovered by recruiters.
          </p>
        </div>

        {/* ── PRIVACY NOTE ── */}
        <div className="mono" style={{
          textAlign: 'center',
          fontSize: 10,
          color: 'var(--text3)',
          marginTop: 14,
          marginBottom: 48,
          lineHeight: 1.8,
        }}>
          All records are stored locally on your machine.<br />
          Only what you explicitly share is sent to our servers and shown to recruiters.
        </div>

        {/* ════ PHASE: SELECT ════ */}
        {phase === 'select' && (
          <>
            <p className="mono" style={{
              fontSize: 10, color: 'var(--text3)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
            }}>
              I use
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
              {CLIENTS.map(c => {
                const active = selectedClients.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => c.available && toggleClient(c.id)}
                    className="mono"
                    style={{
                      width: '100%',
                      padding: '12px 16px',
                      borderRadius: 6,
                      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                      background: active ? 'var(--tag-active-bg)' : 'var(--surface)',
                      color: c.available ? (active ? 'var(--accent)' : 'var(--text)') : 'var(--text3)',
                      cursor: c.available ? 'pointer' : 'default',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      textAlign: 'left',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      {/* checkbox */}
                      <div style={{
                        width: 16, height: 16, borderRadius: 3, flexShrink: 0,
                        border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
                        background: active ? 'var(--accent)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 10, color: 'var(--bg)',
                        opacity: c.available ? 1 : 0.4,
                      }}>
                        {active && '✓'}
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: active ? 600 : 400, opacity: c.available ? 1 : 0.5 }}>
                          {c.label}
                        </div>
                        <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2, opacity: c.available ? 1 : 0.5 }}>
                          {c.desc}
                        </div>
                      </div>
                    </div>
                    {!c.available && (
                      <div style={{
                        fontSize: 10, color: 'var(--text3)',
                        border: '1px solid var(--border)',
                        borderRadius: 3, padding: '2px 8px',
                      }}>
                        Upcoming
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => selectedClients.length > 0 && setPhase('steps')}
              disabled={selectedClients.length === 0}
              className="mono"
              style={{
                width: '100%',
                padding: '13px',
                background: selectedClients.length > 0 ? 'var(--accent)' : 'var(--border)',
                color: selectedClients.length > 0 ? 'var(--bg)' : 'var(--text3)',
                border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
                cursor: selectedClients.length > 0 ? 'pointer' : 'not-allowed',
                transition: 'background 0.2s',
              }}
            >
              {selectedClients.length === 0
                ? 'Select at least one tool to continue'
                : `Continue with ${selectedClients.map(id => CLIENTS.find(c => c.id === id)?.label).join(', ')} →`}
            </button>
          </>
        )}

        {/* ════ PHASE: STEPS ════ */}
        {phase === 'steps' && (
          <>
            {/* back link */}
            <button
              onClick={goBackToSelect}
              className="mono"
              style={{
                background: 'none', border: 'none',
                color: 'var(--text3)', fontSize: 11,
                cursor: 'pointer', padding: '0 0 28px',
                display: 'flex', alignItems: 'center', gap: 6,
              }}
            >
              ← Change tools
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── STEP 1: Install Skill ── */}
              <StepCard n={1} active={step === 1} done={step > 1} title="Install the skill">
                {step >= 1 && (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 16px' }}>
                      Run this in your terminal. It adds the Builder&apos;s Diary skill to {toolName} so you can type <code className="mono" style={{ color: 'var(--accent)', fontSize: 12 }}>@builders-diary</code> at the end of any session.
                    </p>

                    {/* install command */}
                    <div style={{
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '12px 14px',
                      display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20,
                    }}>
                      <code className="mono" style={{ fontSize: 11, color: 'var(--text2)', flex: 1, wordBreak: 'break-all', lineHeight: 1.6 }}>
                        <span style={{ color: 'var(--text3)' }}>$ </span>{installSnippet}
                      </code>
                      <button
                        onClick={() => copy(installSnippet, 'install')}
                        className="mono"
                        style={{
                          flexShrink: 0,
                          padding: '5px 12px', fontSize: 11,
                          background: copied === 'install' ? 'var(--tag-active-bg)' : 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          color: copied === 'install' ? 'var(--accent)' : 'var(--text3)',
                          cursor: 'pointer', whiteSpace: 'nowrap',
                        }}
                      >
                        {copied === 'install' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>

                    {step === 1 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        <button
                          onClick={() => setStep(2)}
                          className="mono"
                          style={{
                            padding: '9px 20px', fontSize: 12, fontWeight: 600,
                            background: 'var(--accent)', color: 'var(--bg)',
                            border: 'none', borderRadius: 4, cursor: 'pointer',
                          }}
                        >
                          Done, I ran it →
                        </button>
                        <span className="mono" style={{ fontSize: 11, color: 'var(--text3)' }}>
                          then restart {selectedClients.includes('claude') ? 'Claude Code' : toolName}
                        </span>
                      </div>
                    )}

                    {step > 1 && (
                      <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>✓ Skill installed</div>
                    )}
                  </>
                )}
              </StepCard>

              {/* ── STEP 2: Connect Folder ── */}
              <StepCard n={2} active={step === 2} done={step > 2} title="Connect your folder" locked={step < 2}>
                {step >= 2 && (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 20px' }}>
                      Choose the folder where your work records will be saved — and visualised here. We suggest <code className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>~/builders-diary</code>.
                    </p>
                    {step === 2 && (
                      <button
                        onClick={onSelectFolder}
                        disabled={isLoading}
                        className="mono"
                        style={{
                          padding: '10px 24px',
                          background: isLoading ? 'var(--border)' : 'var(--accent)',
                          color: isLoading ? 'var(--text3)' : 'var(--bg)',
                          border: 'none', borderRadius: 4,
                          fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                          cursor: isLoading ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isLoading ? 'Connecting…' : 'Choose Folder'}
                      </button>
                    )}
                    {error && (
                      <p className="mono" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8 }}>{error}</p>
                    )}
                    {step > 2 && (
                      <div className="mono" style={{ fontSize: 11, color: 'var(--accent)' }}>
                        ✓ {folderPath || 'folder connected'}
                      </div>
                    )}
                  </>
                )}
              </StepCard>

              {/* ── STEP 3: First Record ── */}
              <StepCard n={3} active={step === 3} done={!!firstRecord} title="Make your first record" locked={step < 3}>
                {step >= 3 && (
                  <>
                    <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 16px' }}>
                      In {selectedClients.includes('claude') ? 'Claude Code' : toolName}, finish any work session and type:
                    </p>
                    <div style={{
                      background: 'var(--bg)', border: '1px solid var(--border)',
                      borderRadius: 4, padding: '12px 16px',
                      display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16,
                    }}>
                      <code className="mono" style={{ fontSize: 14, color: 'var(--accent)', flex: 1 }}>
                        @builders-diary
                      </code>
                      <button
                        onClick={() => copy('@builders-diary', 'skill')}
                        className="mono"
                        style={{
                          flexShrink: 0,
                          padding: '5px 12px', fontSize: 11,
                          background: copied === 'skill' ? 'var(--tag-active-bg)' : 'transparent',
                          border: '1px solid var(--border)',
                          borderRadius: 3,
                          color: copied === 'skill' ? 'var(--accent)' : 'var(--text3)',
                          cursor: 'pointer',
                        }}
                      >
                        {copied === 'skill' ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                    <p style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.7, margin: '0 0 24px' }}>
                      The AI will ask a few questions, summarise the session, and save a work record to your folder. Your card will appear here automatically.
                    </p>

                    {!firstRecord ? (
                      <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-block', animation: 'spin 1.2s linear infinite' }}>⟳</span>
                        Waiting for your first record…
                      </div>
                    ) : (
                      <div style={{
                        background: 'var(--surface)', border: '1px solid var(--accent)',
                        borderRadius: 6, padding: '16px 18px',
                      }}>
                        <div className="mono" style={{ fontSize: 11, color: 'var(--accent)', marginBottom: 8 }}>
                          ✓ First record saved!
                        </div>
                        {firstRecord.projects[0]?.goals[0]?.records[0] && (
                          <p style={{ fontSize: 13, color: 'var(--text)', margin: '0 0 14px' }}>
                            {firstRecord.projects[0].goals[0].records[0].title}
                          </p>
                        )}
                        <button
                          onClick={() => window.location.reload()}
                          className="mono"
                          style={{
                            padding: '8px 18px', fontSize: 12, fontWeight: 600,
                            background: 'var(--accent)', color: 'var(--bg)',
                            border: 'none', borderRadius: 4, cursor: 'pointer',
                          }}
                        >
                          View my portfolio →
                        </button>
                      </div>
                    )}
                  </>
                )}
              </StepCard>

            </div>
          </>
        )}
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

/* ── helper ── */
function StepCard({ n, active, done, locked, title, children }: {
  n: number; active: boolean; done: boolean; locked?: boolean; title: string; children?: React.ReactNode;
}) {
  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
      borderRadius: 6,
      padding: '18px 20px',
      opacity: locked ? 0.35 : 1,
      transition: 'opacity 0.3s, border-color 0.3s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: (active || done) ? 14 : 0 }}>
        <div style={{
          width: 22, height: 22, borderRadius: 4, flexShrink: 0,
          border: `1px solid ${done ? 'var(--accent)' : active ? 'var(--accent)' : 'var(--border)'}`,
          background: done ? 'var(--accent)' : 'transparent',
          color: done ? 'var(--bg)' : active ? 'var(--accent)' : 'var(--text3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, fontWeight: 700,
        }} className="mono">
          {done ? '✓' : n}
        </div>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: active || done ? 'var(--text)' : 'var(--text3)', margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
