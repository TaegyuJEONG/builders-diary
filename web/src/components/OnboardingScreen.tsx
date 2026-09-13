'use client';

import React, { useState, useEffect } from 'react';
import {
  loadFolderHandleFromStorage,
  readInstallMarker,
} from '@/lib/fileSystem';
import { detectOS, terminalHint } from '@/lib/os';
import { ImportRun } from '@/lib/types';
import { ImportProgress } from '@/components/ImportProgress';
import { ImportSelectionTable } from '@/components/ImportSelectionTable';

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
  /** Import runs written by the local skill — drives the step 3 selection table. */
  importRuns?: ImportRun[];
  /** Bumped by the parent's poll so the table re-reads candidates live. */
  importRefreshKey?: number;
}

const IMPORT_PROMPT = '/builders-diary-import';

// Launch ecosystem is Claude Code only for now. Other clients are surfaced so
// heavy Claude Code users understand the roadmap without being slowed down by
// dead options.
const CLIENTS = [
  { id: 'claude',   label: 'Claude Code',  desc: 'Anthropic',         available: true  },
  { id: 'cursor',   label: 'Cursor',        desc: 'Anysphere',         available: false },
  { id: 'windsurf', label: 'Windsurf',      desc: 'Codeium',           available: false },
  { id: 'antigravity', label: 'Antigravity', desc: 'Google',           available: false },
  { id: 'codex',    label: 'Codex CLI',     desc: 'OpenAI',            available: false },
];

type Phase = 'select' | 'steps';
type MarkerStatus = 'unchecked' | 'checking' | 'ok' | 'missing';

export function OnboardingScreen({
  onSelectFolder, isLoading, error, folderConnected, connectNonce = 0, folderPath,
  selectedClients, setSelectedClients, onComplete, importRuns = [], importRefreshKey = 0,
}: OnboardingScreenProps) {
  const [phase, setPhase] = useState<Phase>('select');
  const [copied, setCopied] = useState<string | null>(null);
  const [markerStatus, setMarkerStatus] = useState<MarkerStatus>('unchecked');
  const [installConfirmed, setInstallConfirmed] = useState(false);

  // A run waiting on project selection turns step 3 into the selection table, so the
  // web route is reachable without first leaving onboarding.
  const latestRun = importRuns[0];
  const needsReview = latestRun?.status === 'project_selection';

  const hint = terminalHint(detectOS());

  // Claude Code is the only launch client today — select it by default.
  useEffect(() => {
    if (selectedClients.length === 0) setSelectedClients(['claude']);
  }, [selectedClients, setSelectedClients]);

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
        } else {
          setMarkerStatus('missing');
        }
      } catch {
        if (!cancelled) setMarkerStatus('missing');
      }
    })();
    return () => { cancelled = true; };
  }, [folderConnected, connectNonce]);

  // Install snippet — one command installs the skill for the selected tool.
  const toolFlag = selectedClients.join(',');
  const installSnippet = `npx --yes builders-diary@latest install --tools ${toolFlag || 'claude'}`;

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function goBackToSelect() {
    setPhase('select');
    setMarkerStatus('unchecked');
    setInstallConfirmed(false);
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
      <div style={{ maxWidth: needsReview ? 1000 : 560, width: '100%' }}>

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
              Works with
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 32 }}>
              {CLIENTS.map(c => {
                const active = selectedClients.includes(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => c.available && setSelectedClients(['claude'])}
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
                        Coming soon
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => setPhase('steps')}
              className="mono"
              style={{
                width: '100%',
                padding: '13px',
                background: 'var(--accent)',
                color: 'var(--bg)',
                border: 'none', borderRadius: 6,
                fontSize: 13, fontWeight: 600, letterSpacing: '0.04em',
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
            >
              Continue →
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
              ← Change tool
            </button>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* ── STEP 1: Install (shown alone first) ── */}
              <StepCard n={1} active={!installConfirmed} done={installConfirmed} title="Install the skill">
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

                <div className="mono" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.7 }}>
                  {hint.label}: press{' '}
                  <span style={{
                    color: 'var(--text2)', border: '1px solid var(--border)',
                    borderRadius: 3, padding: '1px 6px',
                  }}>{hint.keys}</span>
                  {hint.type && <>, type <span style={{ color: 'var(--text2)' }}>{hint.type}</span>, hit Enter</>}, then paste.
                </div>

                {!installConfirmed && (
                  <button
                    onClick={() => setInstallConfirmed(true)}
                    className="mono"
                    style={{
                      width: '100%', marginTop: 14,
                      padding: '11px', fontSize: 12, fontWeight: 600,
                      background: 'var(--accent)', color: 'var(--bg)',
                      border: 'none', borderRadius: 4, cursor: 'pointer',
                    }}
                  >
                    Installed — continue →
                  </button>
                )}
              </StepCard>

              {/* ── STEP 2: Connect the folder (revealed after install) ── */}
              {installConfirmed && (
                <StepCard n={2} active={markerStatus !== 'ok'} done={markerStatus === 'ok'} title="Connect your folder">
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

                  {markerStatus === 'ok' && (
                    <div className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>
                      ✓ Folder connected
                    </div>
                  )}

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
              )}

              {/* ── STEP 3: Start importing (revealed after folder connects) ── */}
              {markerStatus === 'ok' && (
                <StepCard n={3} active done={false} title="Bring in your past work">
                  {latestRun && (
                    <div style={{ marginBottom: 14 }}>
                      <ImportProgress runs={importRuns} toolId={selectedClients[0] || 'claude'} />
                    </div>
                  )}

                  <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 16px' }}>
                    {needsReview
                      ? 'Your export is indexed. Tick the projects to bring in, rename or merge them, then save — or answer in the chat instead. Both write the same choice.'
                      : 'Open Claude Code next to this page, then run the import skill. Confirmed projects, stages, and tasks will appear here live as you approve them.'}
                  </p>

                  {needsReview ? (
                    <div style={{ marginBottom: 14 }}>
                      <ImportSelectionTable refreshKey={importRefreshKey} />
                    </div>
                  ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <a
                      href="claude://"
                      className="mono"
                      style={{
                        display: 'block', textAlign: 'center', textDecoration: 'none',
                        padding: '11px', fontSize: 12, fontWeight: 600,
                        background: 'var(--accent)', color: 'var(--bg)',
                        border: 'none', borderRadius: 4,
                      }}
                    >
                      Open Claude Code
                    </a>
                    <button
                      onClick={() => copy(IMPORT_PROMPT, 'import')}
                      className="mono"
                      style={{
                        padding: '11px', fontSize: 12, fontWeight: 600,
                        background: copied === 'import' ? 'var(--tag-active-bg)' : 'transparent',
                        color: copied === 'import' ? 'var(--accent)' : 'var(--text2)',
                        border: '1px solid var(--border)', borderRadius: 4,
                        cursor: 'pointer',
                      }}
                    >
                      {copied === 'import' ? '✓ Copied' : `Copy ${IMPORT_PROMPT}`}
                    </button>
                  </div>
                  )}

                  <button
                    onClick={onComplete}
                    className="mono"
                    style={{
                      width: '100%', marginTop: 14,
                      padding: '11px', fontSize: 12, fontWeight: 600,
                      background: 'transparent', color: 'var(--accent)',
                      border: '1px solid var(--accent)', borderRadius: 4,
                      cursor: 'pointer',
                    }}
                  >
                    Enter portfolio →
                  </button>

                  <div className="mono" style={{ fontSize: 10.5, color: 'var(--text3)', lineHeight: 1.65, marginTop: 12 }}>
                    In Claude Code, start a new session and run{' '}
                    <code style={{ color: 'var(--text2)' }}>{IMPORT_PROMPT}</code>. Keep this page open beside it —
                    it updates as the skill confirms each project and task.
                  </div>
                </StepCard>
              )}

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
