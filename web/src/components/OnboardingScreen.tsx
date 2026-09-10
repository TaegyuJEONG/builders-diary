'use client';

import React, { useState, useEffect } from 'react';
import {
  loadFolderHandleFromStorage,
  readInstallMarker,
} from '@/lib/fileSystem';
import { detectOS, terminalHint } from '@/lib/os';

interface OnboardingScreenProps {
  /** Opens the native folder picker; resolves when a folder is connected. */
  onSelectFolder: () => void;
  isLoading: boolean;
  error?: string | null;
  /** True once a folder handle is connected (set by parent after picker). */
  folderConnected?: boolean;
  /** Increments every time a folder is (re)connected — re-triggers verification. */
  connectNonce?: number;
  folderPath?: string;
  /** Selected AI tools, lifted to parent so they persist + drive the header later. */
  selectedClients: string[];
  setSelectedClients: (tools: string[]) => void;
  /** Called when the user finishes onboarding and enters the portfolio. */
  onComplete: () => void;
}

const CLIENTS = [
  { id: 'claude',   label: 'Claude Code',  desc: 'Anthropic',         available: true  },
  { id: 'cursor',   label: 'Cursor',        desc: 'Anysphere',         available: true  },
  { id: 'windsurf', label: 'Windsurf',      desc: 'Codeium',           available: true  },
  { id: 'antigravity', label: 'Antigravity', desc: 'Google',           available: true  },
  { id: 'cline',    label: 'Cline',         desc: 'VS Code extension', available: true  },
  { id: 'chatgpt',  label: 'ChatGPT',       desc: 'OpenAI',            available: false },
  { id: 'codex',    label: 'Codex CLI',     desc: 'OpenAI',            available: false },
];

type Phase = 'select' | 'steps';
type MarkerStatus = 'unchecked' | 'checking' | 'ok' | 'missing';

export function OnboardingScreen({
  onSelectFolder, isLoading, error, folderConnected, connectNonce = 0, folderPath,
  selectedClients, setSelectedClients, onComplete,
}: OnboardingScreenProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [copied, setCopied] = useState<string | null>(null);
  const [markerStatus, setMarkerStatus] = useState<MarkerStatus>('unchecked');

  const hint = terminalHint(detectOS());

  // When a folder gets connected (or re-connected), verify it's the installer's folder.
  useEffect(() => {
    if (!folderConnected) return;
    let cancelled = false;
    (async () => {
      setMarkerStatus('checking');
      try {
        const handle = await loadFolderHandleFromStorage();
        const marker = handle ? await readInstallMarker(handle) : null;
        if (cancelled) return;
        if (marker) {
          setMarkerStatus('ok');
          // Brief beat so the user sees the confirmation, then enter the portfolio.
          setTimeout(() => { if (!cancelled) onComplete(); }, 900);
        } else {
          setMarkerStatus('missing');
        }
      } catch {
        if (!cancelled) setMarkerStatus('missing');
      }
    })();
    return () => { cancelled = true; };
  }, [folderConnected, connectNonce, onComplete]);

  // Install snippet — one command installs the skill for all selected tools
  const toolFlag = selectedClients.join(',');
  const installSnippet = `npx --yes builders-diary@latest install --tools ${toolFlag || 'claude'}`;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function toggleClient(id: string) {
    setSelectedClients(
      selectedClients.includes(id)
        ? selectedClients.filter(c => c !== id)
        : [...selectedClients, id]
    );
  }

  function goBackToSelect() {
    setPhase('select');
    setMarkerStatus('unchecked');
  }

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
          Everything stays on your computer.<br />
          Only the records you choose to share are ever sent to us.
        </div>

        {/* ════ PHASE: SELECT ════ */}
        {phase === 'select' && (
          <>
            <p className="mono" style={{
              fontSize: 10, color: 'var(--text3)',
              textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 16,
            }}>
              Which AI tools do you use?
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
                ? 'Pick at least one to continue'
                : `Continue →`}
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

              {/* ── STEP 1: Install (the npx command is the hero) ── */}
              <StepCard n={1} active={!folderConnected} done={markerStatus === 'ok'} title="Install the skill">
                {/* install command — hero */}
                <div style={{
                  background: 'var(--bg)',
                  border: '1px solid var(--accent)',
                  borderRadius: 6, padding: '14px 16px',
                  display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12,
                }}>
                  <code className="mono" style={{ fontSize: 12.5, color: 'var(--text)', flex: 1, wordBreak: 'break-all', lineHeight: 1.6 }}>
                    <span style={{ color: 'var(--text3)' }}>$ </span>{installSnippet}
                  </code>
                  <button
                    onClick={() => copy(installSnippet, 'install')}
                    className="mono"
                    style={{
                      flexShrink: 0,
                      padding: '7px 16px', fontSize: 12, fontWeight: 600,
                      background: copied === 'install' ? 'var(--tag-active-bg)' : 'var(--accent)',
                      border: '1px solid var(--accent)',
                      borderRadius: 4,
                      color: copied === 'install' ? 'var(--accent)' : 'var(--bg)',
                      cursor: 'pointer', whiteSpace: 'nowrap',
                    }}
                  >
                    {copied === 'install' ? '✓ Copied' : 'Copy'}
                  </button>
                </div>

                {/* OS-aware terminal hint */}
                <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
                  {hint.label}: press{' '}
                  <span style={{
                    color: 'var(--text2)', border: '1px solid var(--border)',
                    borderRadius: 3, padding: '1px 6px',
                  }}>{hint.keys}</span>
                  {hint.type && <>, type <span style={{ color: 'var(--text2)' }}>{hint.type}</span>, hit Enter</>}, then paste.
                </div>

                {selectedClients.includes('claude') && (
                  <div className="mono" style={{
                    fontSize: 10.5, color: 'var(--text2)', lineHeight: 1.65,
                    marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)',
                  }}>
                    Claude Code: use the <strong>Code</strong> tab with a <strong>Local</strong> project.
                    This installer does not update Claude Chat or Settings → Skills.
                  </div>
                )}
              </StepCard>

              {/* ── STEP 2: Connect the folder the installer created ── */}
              <StepCard n={2} active={!!folderConnected || markerStatus !== 'unchecked'} done={markerStatus === 'ok'} title="Connect your folder">
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 16px' }}>
                  The installer just created a{' '}
                  <code className="mono" style={{ fontSize: 12, color: 'var(--text)' }}>builders-diary</code>{' '}
                  folder in your <strong>Documents</strong>. Pick it — the picker opens right there.
                </p>

                {markerStatus !== 'ok' && (
                  <button
                    onClick={onSelectFolder}
                    disabled={isLoading || markerStatus === 'checking'}
                    className="mono"
                    style={{
                      padding: '10px 24px',
                      background: (isLoading || markerStatus === 'checking') ? 'var(--border)' : 'var(--accent)',
                      color: (isLoading || markerStatus === 'checking') ? 'var(--text3)' : 'var(--bg)',
                      border: 'none', borderRadius: 4,
                      fontSize: 12, fontWeight: 600, letterSpacing: '0.05em',
                      cursor: (isLoading || markerStatus === 'checking') ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {isLoading ? 'Connecting…'
                      : markerStatus === 'checking' ? 'Checking…'
                      : markerStatus === 'missing' ? 'Choose folder again'
                      : 'Choose folder'}
                  </button>
                )}

                {error && (
                  <p className="mono" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8 }}>{error}</p>
                )}

                {/* verified */}
                {markerStatus === 'ok' && (
                  <div className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>
                    ✓ Install verified — opening your portfolio…
                  </div>
                )}

                {/* failure caught: wrong folder or install never ran */}
                {markerStatus === 'missing' && (
                  <div style={{
                    marginTop: 14,
                    background: 'var(--surface)',
                    border: '1px solid var(--danger)',
                    borderRadius: 6, padding: '12px 14px',
                  }}>
                    <div className="mono" style={{ fontSize: 11, color: 'var(--danger)', marginBottom: 6 }}>
                      That folder wasn&apos;t set up by the installer{folderPath ? ` (you picked “${folderPath}”)` : ''}.
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
                      Make sure the command in step 1 ran without errors, then pick the{' '}
                      <code className="mono" style={{ fontSize: 11.5, color: 'var(--text)' }}>builders-diary</code>{' '}
                      folder in your Documents.
                    </div>
                    <button
                      onClick={onComplete}
                      className="mono"
                      style={{
                        marginTop: 10, background: 'none', border: 'none',
                        color: 'var(--text3)', fontSize: 10.5, cursor: 'pointer',
                        padding: 0, textDecoration: 'underline',
                      }}
                    >
                      I know what I&apos;m doing — use this folder anyway
                    </button>
                  </div>
                )}
              </StepCard>

            </div>
          </>
        )}
      </div>
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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
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
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', margin: 0 }}>
          {title}
        </h3>
      </div>
      {children}
    </div>
  );
}
