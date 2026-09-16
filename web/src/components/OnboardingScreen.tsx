'use client';

import React, { useEffect, useState } from 'react';
import { loadFolderHandleFromStorage, readInstallMarker } from '@/lib/fileSystem';
import { ImportRun } from '@/lib/types';
import { ImportProgress } from '@/components/ImportProgress';
import { ImportSelectionTable } from '@/components/ImportSelectionTable';
import installerPackage from '../../../npm/package.json';

interface OnboardingScreenProps {
  onSelectFolder: () => void; isLoading: boolean; error?: string | null;
  folderConnected?: boolean; connectNonce?: number; folderPath?: string;
  selectedClients: string[]; setSelectedClients: (tools: string[]) => void;
  onComplete: () => void; importRuns?: ImportRun[]; importRefreshKey?: number;
}

const IMPORT_PROMPT = '/builders-diary-import';
const RECORD_PROMPT = '/builders-diary';
const SOURCES = [
  { id: 'claude', label: 'Claude', description: 'Past Claude conversations and Claude Code sessions.' },
  { id: 'cursor', label: 'Cursor', description: 'Local Cursor conversation history.' },
  { id: 'codex', label: 'Codex CLI', description: 'Local Codex CLI sessions.' },
  { id: 'hermes', label: 'Hermes', description: 'Local Hermes sessions.' },
] as const;
type SourceId = typeof SOURCES[number]['id'];
type CaptureRoute = 'choose' | 'bulk' | 'individual';
type MarkerStatus = 'unchecked' | 'checking' | 'ok' | 'missing';

function installCommand(sources: SourceId[]) {
  const tools = ['claude'];
  if (sources.includes('cursor')) tools.push('cursor');
  if (sources.includes('codex')) tools.push('codex');
  return `npx --yes builders-diary@${installerPackage.version} install --tools ${tools.join(',')} --sources ${sources.join(',')}`;
}

export function OnboardingScreen({ onSelectFolder, isLoading, error, folderConnected, connectNonce = 0, folderPath, selectedClients, setSelectedClients, onComplete, importRuns = [], importRefreshKey = 0 }: OnboardingScreenProps) {
  const [markerStatus, setMarkerStatus] = useState<MarkerStatus>('unchecked');
  const [installAcknowledged, setInstallAcknowledged] = useState(false);
  const [captureRoute, setCaptureRoute] = useState<CaptureRoute>('choose');
  const [copied, setCopied] = useState<string | null>(null);
  const selectedSources = selectedClients.filter((id): id is SourceId => SOURCES.some(source => source.id === id));
  const viewerUrl = typeof window !== 'undefined' ? window.location.origin : 'https://web-one-alpha-57.vercel.app';
  const latestRun = importRuns[0];
  const needsReview = latestRun?.status === 'project_selection';

  useEffect(() => { if (!folderConnected) return; let cancelled = false; (async () => { setMarkerStatus('checking'); try { const handle = await loadFolderHandleFromStorage(); const marker = handle ? await readInstallMarker(handle) : null; if (!cancelled) setMarkerStatus(marker ? 'ok' : 'missing'); } catch { if (!cancelled) setMarkerStatus('missing'); } })(); return () => { cancelled = true; }; }, [folderConnected, connectNonce]);
  function toggleSource(source: SourceId) { setSelectedClients(selectedSources.includes(source) ? selectedSources.filter(id => id !== source) : [...selectedSources, source]); }
  function copy(text: string, key: string) { navigator.clipboard.writeText(text).then(() => { setCopied(key); setTimeout(() => setCopied(null), 2000); }); }

  return <div style={page}><div style={{ maxWidth: needsReview ? 1000 : 620, width: '100%' }}>
    <div style={{ textAlign: 'center', marginBottom: 42 }}><h1 className="serif" style={{ fontSize: 40, fontWeight: 400, margin: 0 }}>Builder&apos;s Diary</h1><p className="mono" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.8 }}>Everything stays on your computer.<br />Only records you choose to share are sent to us.</p></div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <StepCard n={1} active={!selectedSources.length} done={selectedSources.length > 0} title="Choose your sources">
        <p style={body}>Where should we bring in past work from?</p><p style={hint}>Choose one or more. We remove duplicates before review, and the review runs in Claude Code.</p>
        {SOURCES.map(source => <ToolChoice key={source.id} active={selectedSources.includes(source.id)} onClick={() => toggleSource(source.id)} label={source.label} description={source.description} />)}
      </StepCard>
      {selectedSources.length > 0 && <StepCard n={2} active={!installAcknowledged && markerStatus !== 'ok'} done={installAcknowledged || markerStatus === 'ok'} title="Install Builder&apos;s Diary">
        {markerStatus === 'ok' || installAcknowledged ? <div className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>✓ Installed</div> : <><p style={body}>Run this once. It installs the import skill in Claude Code.</p><div style={commandBox}><code className="mono" style={code}>{installCommand(selectedSources)}</code><button onClick={() => copy(installCommand(selectedSources), 'install')} aria-label="Copy command" title="Copy command" className="mono" style={secondaryButton}>{copied === 'install' ? '✓' : '⧉'}</button></div><button onClick={() => setInstallAcknowledged(true)} className="mono" style={primaryButton(false)}>Installed — continue</button></>}
      </StepCard>}
      {(selectedSources.length > 0 && installAcknowledged && markerStatus !== 'ok') && <StepCard n={3} active done={false} title="Connect your folder"><p style={body}>The installer created <code className="mono">Documents/builders-diary</code>. Choose that folder to keep your portfolio private and on this computer.</p><button onClick={onSelectFolder} disabled={isLoading || markerStatus === 'checking'} className="mono" style={primaryButton(isLoading || markerStatus === 'checking')}>{isLoading ? 'Connecting…' : markerStatus === 'checking' ? 'Checking…' : markerStatus === 'missing' ? 'Choose another folder' : 'Choose folder'}</button>{error && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8 }}>{error}</p>}{markerStatus === 'missing' && <p style={hint}>This folder is not a Builder&apos;s Diary portfolio{folderPath ? ` (you picked “${folderPath}”)` : ''}. Choose the folder where you already set up Builder&apos;s Diary.</p>}</StepCard>}
      {markerStatus === 'ok' && <StepCard n={3} active={false} done title="Connect your folder"><div className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>✓ Connected folder</div>{folderPath && <div className="mono" style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{folderPath}</div>}</StepCard>}
      {markerStatus === 'ok' && <StepCard n={4} active done={false} title="Import your portfolio">{needsReview ? <><p style={body}>Your import is ready. Confirm the projects you want in your portfolio.</p><ImportSelectionTable onSaved={onComplete} refreshKey={importRefreshKey} /></> : <>{latestRun && <ImportProgress runs={importRuns} toolId={selectedSources[0] || 'claude'} />}{captureRoute === 'choose' && <RouteChoices onBulk={() => setCaptureRoute('bulk')} onIndividual={() => setCaptureRoute('individual')} />}{captureRoute === 'bulk' && <BulkRoute copied={copied} copy={copy} folderPath={folderPath} viewerUrl={viewerUrl} onBack={() => setCaptureRoute('choose')} />}{captureRoute === 'individual' && <IndividualRoute copied={copied} copy={copy} folderPath={folderPath} viewerUrl={viewerUrl} onBack={() => setCaptureRoute('choose')} />}</>}</StepCard>}
    </div></div></div>;
}
function RouteChoices({ onBulk, onIndividual }: { onBulk: () => void; onIndividual: () => void }) { return <><p style={body}>How would you like to add work?</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}><button onClick={onBulk} style={routeButton(false)}><strong>Bulk import</strong><span style={routeDescription}>Build your portfolio from your past conversations.</span></button><button onClick={onIndividual} style={routeButton(false)}><strong>Single import</strong><span style={routeDescription}>Start with one conversation and create your first portfolio entry.</span></button></div></>; }
function skillPrompt(prompt: string, folderPath?: string, viewerUrl?: string) {
  const folderName = (folderPath || 'connected-folder-name').replace(/["\\\r\n]/g, '');
  const viewer = viewerUrl || 'https://web-one-alpha-57.vercel.app';
  return `${prompt}\nViewer: ${viewer}\nPortfolio folder: "$HOME/Documents/${folderName}"`;
}
function BulkRoute({ copied, copy, folderPath, viewerUrl, onBack }: { copied: string | null; copy: (text: string, key: string) => void; folderPath?: string; viewerUrl?: string; onBack: () => void }) { const prompt = skillPrompt(IMPORT_PROMPT, folderPath, viewerUrl); return <div><BackButton onClick={onBack} /><p style={body}>Open a new Claude Code chat and use the import skill.</p><div style={commandBox}><code className="mono" style={code}>{prompt}</code><button onClick={() => copy(prompt, 'import')} aria-label="Copy import skill" title="Copy import skill" className="mono" style={secondaryButton}>{copied === 'import' ? '✓' : '⧉'}</button></div><ModelRecommendation /></div>; }
function IndividualRoute({ copied, copy, folderPath, viewerUrl, onBack }: { copied: string | null; copy: (text: string, key: string) => void; folderPath?: string; viewerUrl?: string; onBack: () => void }) { const prompt = skillPrompt(RECORD_PROMPT, folderPath, viewerUrl); return <div><BackButton onClick={onBack} /><p style={body}>Open the Claude chat, Cowork space, or Claude Code session you want to turn into a portfolio entry, then use the regular skill.</p><div style={commandBox}><code className="mono" style={code}>{prompt}</code><button onClick={() => copy(prompt, 'record')} aria-label="Copy regular skill" title="Copy regular skill" className="mono" style={secondaryButton}>{copied === 'record' ? '✓' : '⧉'}</button></div><ModelRecommendation /></div>; }
function ModelRecommendation() { return <div style={recommendation}><strong>Recommended</strong><span>Claude Sonnet 5 / Medium with enough of your 5-hour limit remaining.</span></div>; }
function ToolChoice({ active, onClick, label, description }: { active: boolean; onClick: () => void; label: string; description: string }) { return <button type="button" onClick={onClick} style={{ width: '100%', textAlign: 'left', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 5, padding: '11px 12px', marginBottom: 8, background: active ? 'var(--tag-active-bg)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}><strong style={{ fontSize: 13 }}>{label}</strong><span style={{ display: 'block', fontSize: 11.5, color: 'var(--text2)', marginTop: 4 }}>{description}</span></button>; }
function BackButton({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="mono" style={{ background: 'none', border: 0, padding: '0 0 14px', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>← Back</button>; }
function StepCard({ n, active, done, title, children }: { n: number; active: boolean; done: boolean; title: string; children: React.ReactNode }) { return <div style={{ background: 'var(--surface)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, padding: '18px 20px' }}><div style={{ display: 'flex', gap: 12, marginBottom: 14 }}><div className="mono" style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--accent)', background: done ? 'var(--accent)' : 'transparent', color: done ? 'var(--bg)' : 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 10 }}>{done ? '✓' : n}</div><h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{title}</h3></div>{children}</div>; }
const page: React.CSSProperties = { minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px 60px' };
const body: React.CSSProperties = { fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 12px' };
const hint: React.CSSProperties = { fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6, margin: '0 0 12px' };
const commandBox: React.CSSProperties = { position: 'relative', display: 'flex', alignItems: 'center', marginBottom: 14, padding: '3px 4px 3px 0', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4 };
const code: React.CSSProperties = { display: 'block', flex: 1, minWidth: 0, padding: '7px 10px', paddingRight: 80, fontSize: 11.5, overflowX: 'auto' };
const secondaryButton: React.CSSProperties = { alignSelf: 'center', width: 28, height: 28, padding: 0, display: 'grid', placeItems: 'center', background: 'transparent', color: 'var(--text2)', border: 0, borderRadius: 4, cursor: 'pointer', fontSize: 15 };
const recommendation: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 3, marginTop: 2, padding: '9px 11px', borderLeft: '2px solid var(--accent)', background: 'var(--tag-active-bg)', color: 'var(--text2)', fontSize: 11.5, lineHeight: 1.5 };
const smallPrimary: React.CSSProperties = { padding: '8px 11px', background: 'var(--accent)', color: 'var(--bg)', border: 0, borderRadius: 4, cursor: 'pointer', fontSize: 11 };
const primaryButton = (disabled: boolean): React.CSSProperties => ({ padding: '10px 18px', background: disabled ? 'var(--border)' : 'var(--accent)', color: disabled ? 'var(--text3)' : 'var(--bg)', border: 0, borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' });
const routeButton = (_active: boolean): React.CSSProperties => ({ padding: '15px', border: '1px solid var(--border)', borderRadius: 6, background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' as const });
const routeDescription: React.CSSProperties = { display: 'block', marginTop: 7, fontSize: 11.5, color: 'var(--text2)', lineHeight: 1.5 };
