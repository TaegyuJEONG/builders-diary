'use client';

import React, { useEffect, useState } from 'react';
import { loadFolderHandleFromStorage, readInstallMarker } from '@/lib/fileSystem';
import { ImportRun } from '@/lib/types';
import { ImportProgress } from '@/components/ImportProgress';
import { ImportSelectionTable } from '@/components/ImportSelectionTable';
import { ClaudeExportDownload } from '@/components/ClaudeExportDownload';
import { ClientRootsSettings } from '@/components/ClientRootsSettings';
import installerPackage from '../../../npm/package.json';

interface OnboardingScreenProps {
  onSelectFolder: () => void;
  isLoading: boolean;
  error?: string | null;
  folderConnected?: boolean;
  connectNonce?: number;
  folderPath?: string;
  selectedClients: string[];
  setSelectedClients: (tools: string[]) => void;
  onComplete: () => void;
  importRuns?: ImportRun[];
  importRefreshKey?: number;
}

const IMPORT_PROMPT = '/builders-diary-import';
const RECORD_PROMPT = '/builders-diary';
const INSTALL_COMMAND = `npx --yes builders-diary@${installerPackage.version} install --tools claude`;
const FOLDER_TOOLS = [
  { id: 'cursor', label: 'Cursor', instruction: 'Choose the folder containing your Cursor conversation history.' },
  { id: 'codex', label: 'Codex CLI', instruction: 'Choose the folder containing your Codex CLI session history.' },
  { id: 'hermes', label: 'Hermes', instruction: 'Choose the folder containing your Hermes conversation history.' },
] as const;

type CaptureRoute = 'choose' | 'bulk' | 'individual';
type BulkTool = 'claude' | typeof FOLDER_TOOLS[number]['id'] | null;
type MarkerStatus = 'unchecked' | 'checking' | 'ok' | 'missing';

export function OnboardingScreen({
  onSelectFolder, isLoading, error, folderConnected, connectNonce = 0, folderPath,
  selectedClients, setSelectedClients, onComplete, importRuns = [], importRefreshKey = 0,
}: OnboardingScreenProps) {
  const [markerStatus, setMarkerStatus] = useState<MarkerStatus>('unchecked');
  const [installAcknowledged, setInstallAcknowledged] = useState(false);
  const [captureRoute, setCaptureRoute] = useState<CaptureRoute>('choose');
  const [bulkTool, setBulkTool] = useState<BulkTool>(null);
  const [individualTool, setIndividualTool] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const latestRun = importRuns[0];
  const needsReview = latestRun?.status === 'project_selection';

  useEffect(() => {
    if (!folderConnected) return;
    let cancelled = false;
    (async () => {
      setMarkerStatus('checking');
      try {
        const handle = await loadFolderHandleFromStorage();
        const marker = handle ? await readInstallMarker(handle) : null;
        if (!cancelled) setMarkerStatus(marker ? 'ok' : 'missing');
      } catch {
        if (!cancelled) setMarkerStatus('missing');
      }
    })();
    return () => { cancelled = true; };
  }, [folderConnected, connectNonce]);

  function copy(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  function chooseBulkTool(tool: BulkTool) {
    setBulkTool(tool);
    if (tool) setSelectedClients([tool]);
  }

  function backToRoutes() {
    setCaptureRoute('choose');
    setBulkTool(null);
    setIndividualTool(null);
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '56px 24px 60px' }}>
      <div style={{ maxWidth: needsReview ? 1000 : 620, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <h1 className="serif" style={{ fontSize: 40, fontWeight: 400, margin: 0 }}>Builder&apos;s Diary</h1>
          <p className="mono" style={{ fontSize: 12, color: 'var(--text2)', marginTop: 10, letterSpacing: '0.04em' }}>Record every build. Get discovered by recruiters.</p>
        </div>
        <div className="mono" style={{ textAlign: 'center', fontSize: 10, color: 'var(--text3)', marginTop: 14, marginBottom: 48, lineHeight: 1.8 }}>
          Everything stays on your computer.<br />Only the records you choose to share are ever sent to us.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <StepCard n={1} active={!installAcknowledged && markerStatus !== 'ok'} done={installAcknowledged || markerStatus === 'ok'} title="Install Builder&apos;s Diary">
            {markerStatus === 'ok' || installAcknowledged ? <div className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>✓ Installed</div> : <>
              <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 12px' }}>
                Run this once. It adds the skills needed for Claude Code.
              </p>
              <code className="mono" style={{ display: 'block', padding: '10px 12px', marginBottom: 14, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11.5, overflowX: 'auto' }}>{INSTALL_COMMAND}</code>
              <button onClick={() => setInstallAcknowledged(true)} className="mono" style={primaryButton(false)}>Installed — continue</button>
            </>}
          </StepCard>

          {(installAcknowledged && markerStatus !== 'ok') && <StepCard n={2} active done={false} title="Connect your folder">
            <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 16px' }}>
              The installer created <code className="mono">Documents/builders-diary</code>. Choose that folder to keep your portfolio private and on this computer.
            </p>
            <button onClick={onSelectFolder} disabled={isLoading || markerStatus === 'checking'} className="mono" style={primaryButton(isLoading || markerStatus === 'checking')}>
              {isLoading ? 'Connecting…' : markerStatus === 'checking' ? 'Checking…' : markerStatus === 'missing' ? 'Choose another folder' : 'Choose folder'}
            </button>
            {error && <p className="mono" style={{ fontSize: 11, color: 'var(--danger)', marginTop: 8 }}>{error}</p>}
            {markerStatus === 'missing' && <p className="mono" style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.6, margin: '12px 0 0' }}>
              This folder is not a Builder&apos;s Diary portfolio{folderPath ? ` (you picked “${folderPath}”)` : ''}. Choose the folder where you already set up Builder&apos;s Diary.
            </p>}
          </StepCard>}

          {markerStatus === 'ok' && <StepCard n={2} active={false} done title="Connect your folder">
            <div className="mono" style={{ fontSize: 12, color: 'var(--accent)' }}>✓ Folder connected</div>
          </StepCard>}

          {markerStatus === 'ok' && <StepCard n={3} active done={false} title="Import your portfolio">
            {needsReview ? (
              <>
                <p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 14px' }}>Your import is ready. Confirm the projects you want in your portfolio.</p>
                <ImportSelectionTable onSaved={onComplete} refreshKey={importRefreshKey} />
              </>
            ) : (
              <>
                {latestRun && <div style={{ marginBottom: 14 }}><ImportProgress runs={importRuns} toolId={selectedClients[0] || 'claude'} /></div>}
                {captureRoute === 'choose' && <RouteChoices onBulk={() => setCaptureRoute('bulk')} onIndividual={() => setCaptureRoute('individual')} />}
                {captureRoute === 'bulk' && <BulkRoute bulkTool={bulkTool} chooseBulkTool={chooseBulkTool} copied={copied} copy={copy} onBack={backToRoutes} />}
                {captureRoute === 'individual' && <IndividualRoute individualTool={individualTool} setIndividualTool={setIndividualTool} copied={copied} copy={copy} onBack={backToRoutes} />}
              </>
            )}
          </StepCard>}
        </div>
      </div>
    </div>
  );
}

function RouteChoices({ onBulk, onIndividual }: { onBulk: () => void; onIndividual: () => void }) {
  return <><p style={{ fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 16px' }}>How would you like to add work?</p><div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
    <button onClick={onBulk} style={routeButton(true)}><strong>Bulk import</strong><span>Bring in past conversations and sessions.</span></button>
    <button onClick={onIndividual} style={routeButton(false)}><strong>Add one conversation</strong><span>Capture one conversation as you work.</span></button>
  </div></>;
}

function BulkRoute({ bulkTool, chooseBulkTool, copied, copy, onBack }: { bulkTool: BulkTool; chooseBulkTool: (tool: BulkTool) => void; copied: string | null; copy: (text: string, key: string) => void; onBack: () => void }) {
  return <div><BackButton onClick={onBack} /><p style={body}>Choose where your past work lives.</p>
    <SectionLabel>Chat exports</SectionLabel>
    <ToolChoice active={bulkTool === 'claude'} onClick={() => chooseBulkTool('claude')} label="Claude" description="Import conversations from a Claude export." />
    {bulkTool === 'claude' && <div style={detail}><p style={body}>In Claude, request an export in <strong>Claude Settings &gt; Privacy</strong>. Download the export manifest, then use it here to reveal its download links.</p><button onClick={() => copy(IMPORT_PROMPT, 'import')} className="mono" style={smallPrimary}>{copied === 'import' ? '✓ Copied' : 'Copy /builders-diary-import'}</button><div style={{ marginTop: 12 }}><ClaudeExportDownload /></div></div>}
    <SectionLabel>From a folder</SectionLabel>
    {FOLDER_TOOLS.map(tool => <React.Fragment key={tool.id}><ToolChoice active={bulkTool === tool.id} onClick={() => chooseBulkTool(tool.id)} label={tool.label} description={tool.instruction} />{bulkTool === tool.id && <div style={detail}><ClientRootsSettings clientId={tool.id} /></div>}</React.Fragment>)}
    <p className="mono" style={{ color: 'var(--text3)', fontSize: 10.5, margin: '14px 0 0', lineHeight: 1.6 }}>Antigravity imports are not available yet because its local format has not been verified.</p>
  </div>;
}

function IndividualRoute({ individualTool, setIndividualTool, copied, copy, onBack }: { individualTool: string | null; setIndividualTool: (tool: string) => void; copied: string | null; copy: (text: string, key: string) => void; onBack: () => void }) {
  return <div><BackButton onClick={onBack} /><p style={body}>Choose a tool for the conversation you are working on now.</p>
    <ToolChoice active={individualTool === 'claude'} onClick={() => setIndividualTool('claude')} label="Claude Code" description="Capture a conversation directly from Claude Code or Desktop Code." />
    {individualTool === 'claude' && <div style={detail}><p style={body}>Open a new Claude Code or Desktop Code chat, paste or use <code className="mono">/builders-diary</code>, then continue your conversation.</p><button onClick={() => copy(RECORD_PROMPT, 'record')} className="mono" style={smallPrimary}>{copied === 'record' ? '✓ Copied' : 'Copy /builders-diary'}</button></div>}
  </div>;
}

function ToolChoice({ active, onClick, label, description }: { active: boolean; onClick: () => void; label: string; description: string }) {
  return <button type="button" onClick={onClick} style={{ width: '100%', textAlign: 'left', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 5, padding: '11px 12px', marginBottom: 8, background: active ? 'var(--tag-active-bg)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}><strong style={{ fontSize: 13 }}>{label}</strong><span style={{ display: 'block', fontSize: 11.5, color: 'var(--text2)', marginTop: 4, lineHeight: 1.5 }}>{description}</span></button>;
}

function BackButton({ onClick }: { onClick: () => void }) { return <button onClick={onClick} className="mono" style={{ background: 'none', border: 0, padding: '0 0 14px', color: 'var(--text3)', fontSize: 11, cursor: 'pointer' }}>← Back</button>; }
function SectionLabel({ children }: { children: React.ReactNode }) { return <p className="mono" style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', margin: '18px 0 8px' }}>{children}</p>; }
function StepCard({ n, active, done, title, children }: { n: number; active: boolean; done: boolean; title: string; children: React.ReactNode }) { return <div style={{ background: 'var(--surface)', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, padding: '18px 20px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}><div className="mono" style={{ width: 22, height: 22, borderRadius: 4, border: '1px solid var(--accent)', background: done ? 'var(--accent)' : 'transparent', color: done ? 'var(--bg)' : 'var(--accent)', display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 700 }}>{done ? '✓' : n}</div><h3 style={{ fontSize: 13, fontWeight: 600, margin: 0 }}>{title}</h3></div>{children}</div>; }

const body: React.CSSProperties = { fontSize: 13, color: 'var(--text2)', lineHeight: 1.7, margin: '0 0 12px' };
const detail: React.CSSProperties = { margin: '-1px 0 10px', padding: 12, border: '1px solid var(--border)', borderRadius: 5, background: 'var(--bg)' };
const smallPrimary: React.CSSProperties = { padding: '8px 11px', background: 'var(--accent)', color: 'var(--bg)', border: 0, borderRadius: 4, cursor: 'pointer', fontSize: 11 };
const primaryButton = (disabled: boolean): React.CSSProperties => ({ padding: '10px 18px', background: disabled ? 'var(--border)' : 'var(--accent)', color: disabled ? 'var(--text3)' : 'var(--bg)', border: 0, borderRadius: 4, fontSize: 12, fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer' });
const routeButton = (primary: boolean): React.CSSProperties => ({ padding: '15px', border: `1px solid ${primary ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 6, background: primary ? 'var(--tag-active-bg)' : 'var(--surface)', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' as const });
