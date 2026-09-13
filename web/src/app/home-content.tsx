'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { ProjectSectionView, ExploreMode } from '@/components/ProjectSectionView';
import { DetailPanel } from '@/components/DetailPanel';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { FirstRecordBanner } from '@/components/FirstRecordBanner';
import { ManagePanel } from '@/components/ManagePanel';
import { ImportProgress } from '@/components/ImportProgress';
import { ImportReview } from '@/components/ImportReview';
import { ProjectDetailPanel } from '@/components/ProjectDetailPanel';
import { SkillUpdateBanner } from '@/components/SkillUpdateBanner';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Portfolio, Project, Record, ImportRun } from '@/lib/types';
import {
  selectFolder, scanFolderStructure, verifyFolderPermission, hasFolderPermission,
  loadFolderHandleFromStorage, saveFolderHandleToStorage, saveRecordToFile, deleteRecordFromFile,
  readInstallMarker, scanImportRuns, updateProjectInFolder, deleteProjectFromFolder, writeStages,
} from '@/lib/fileSystem';
import {
  convertMockToPortfolio, buildTagOptions,
  scopedRecords, FilterState,
} from '@/lib/portfolio';

const CONNECTED_KEY = 'builders-diary-connected';
const ONBOARDING_DONE_KEY = 'builders-diary-onboarding-done';
const TOOLS_KEY = 'builders-diary-tools';
// Keep this aligned with npm/package.json when a release is prepared.
const CURRENT_INSTALLER_VERSION = '1.9.1';

function isOlderVersion(installed: string, current: string): boolean {
  const parse = (value: string) => value.split('-', 1)[0].split('.').slice(0, 3).map(Number);
  const a = parse(installed);
  const b = parse(current);
  if (a.length !== 3 || b.length !== 3 || [...a, ...b].some(Number.isNaN)) return false;
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

export function HomeContent() {
  const [connected, setConnected] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installMarker, setInstallMarker] = useState<{ version?: string; tools?: string[] } | null>(null);
  const [importRuns, setImportRuns] = useState<ImportRun[]>([]);

  // AI tools the user selected in onboarding (drives --tools + header manager)
  const [selectedClients, setSelectedClientsState] = useState<string[]>([]);
  // Bumped on every successful folder connect so onboarding re-verifies the marker.
  const [connectNonce, setConnectNonce] = useState(0);

  // selection
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedStage, setSelectedStage] = useState<string | null>(null);
  const [selectedActivity, setSelectedActivity] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [exploreMode, setExploreMode] = useState<ExploreMode>('project');

  // filters
  const [selectedMindset, setSelectedMindset] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [managerOpen, setManagerOpen] = useState(false);
  const [importReviewOpen, setImportReviewOpen] = useState(false);
  const [projectPanelId, setProjectPanelId] = useState<string | null>(null);
  const [managerTab, setManagerTab] = useState<'projects' | 'stages' | 'task'>('projects');
  const [managerStage, setManagerStage] = useState<string | undefined>();
  const [managerProjectSlug, setManagerProjectSlug] = useState<string | undefined>();
  const [stageDeleteTarget, setStageDeleteTarget] = useState<string | null>(null);

  const refreshPortfolio = useCallback(async () => {
    const handle = await loadFolderHandleFromStorage();
    if (!handle || !(await hasFolderPermission(handle))) return;
    setPortfolio(await scanFolderStructure(handle));
  }, []);

  // Persist selected AI tools so the header manager can show them post-onboarding.
  const setSelectedClients = useCallback((tools: string[]) => {
    setSelectedClientsState(tools);
    try { localStorage.setItem(TOOLS_KEY, JSON.stringify(tools)); } catch { /* ignore */ }
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboardingDone(true);
    try { localStorage.setItem(ONBOARDING_DONE_KEY, '1'); } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    const forceDemo = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('demo') === '1';

    const forceReset = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('reset') === '1';

    // Always restore selected tools (used by onboarding + header manager).
    try {
      const savedTools = localStorage.getItem(TOOLS_KEY);
      if (savedTools) setSelectedClientsState(JSON.parse(savedTools));
    } catch { /* ignore */ }

    if (forceReset) {
      localStorage.removeItem(CONNECTED_KEY);
      localStorage.removeItem(ONBOARDING_DONE_KEY);
      setConnected(false);
      setOnboardingDone(false);
      setPortfolio(null);
      setHydrated(true);
      // Remove ?reset=1 from URL without reload
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (forceDemo) {
      // ?demo=1 이면 무조건 목 데이터
      const data = convertMockToPortfolio();
      const demoInstalledVersion = new URLSearchParams(window.location.search).get('installed');
      if (demoInstalledVersion) {
        setInstallMarker({ version: demoInstalledVersion, tools: ['claude'] });
      }
      setPortfolio(data);
      setConnected(true);
      setOnboardingDone(true);
      initSelection(data);
      setHydrated(true);
      return;
    }

    const wasDone = typeof window !== 'undefined'
      && localStorage.getItem(ONBOARDING_DONE_KEY) === '1';

    if (wasDone) {
      // 온보딩을 마친 적 있으면 IndexedDB에서 폴더 핸들 복원 시도
      (async () => {
        try {
          const handle = await loadFolderHandleFromStorage();
          if (handle) {
            const ok = await verifyFolderPermission(handle);
            if (ok) {
              setInstallMarker(await readInstallMarker(handle));
              setImportRuns(await scanImportRuns(handle));
              const data = await scanFolderStructure(handle);
              // 실제 데이터가 있으면 그걸 쓰고, 빈 폴더면 빈 portfolio 그대로 표시
              setPortfolio(data);
              setConnected(true);
              setOnboardingDone(true);
              initSelection(data);
              setHydrated(true);
              return;
            }
          }
        } catch {
          // 권한 만료 등 — 온보딩 다시 시작
        }
        // 핸들 없거나 권한 없으면 온보딩으로 되돌림 (도구 선택은 유지)
        localStorage.removeItem(ONBOARDING_DONE_KEY);
        setConnected(false);
        setOnboardingDone(false);
        setPortfolio(null);
        setHydrated(true);
      })();
      return;
    }

    setHydrated(true);
  }, []);

  const initSelection = (_data: Portfolio) => {
    // Default to "All Projects" — never hide sibling projects behind an
    // auto-picked first project (users read that as "my records are gone").
    setSelectedProjectId(null);
    setSelectedGoalId(null);
  };

  // Refresh the portfolio whenever the user returns to this tab — records
  // saved from an AI session appear without a manual reload. Read-only
  // permission check (no gesture needed); selection/filters are preserved.
  useEffect(() => {
    if (!onboardingDone || !connected) return;
    const rescan = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const handle = await loadFolderHandleFromStorage();
        if (!handle) return;
        if (!(await hasFolderPermission(handle))) return;
        setInstallMarker(await readInstallMarker(handle));
        setImportRuns(await scanImportRuns(handle));
        const data = await scanFolderStructure(handle);
        setPortfolio(data);
      } catch { /* transient FS errors — keep current view */ }
    };
    window.addEventListener('focus', rescan);
    document.addEventListener('visibilitychange', rescan);
    return () => {
      window.removeEventListener('focus', rescan);
      document.removeEventListener('visibilitychange', rescan);
    };
  }, [onboardingDone, connected]);

  // Import runs are written by the local skill while this page stays open beside
  // the AI chat. Polling is deliberately bounded and read-only; it makes newly
  // confirmed projects/cards visible without the user switching browser tabs.
  useEffect(() => {
    if (!onboardingDone || !connected) return;
    const poll = async () => {
      try {
        const handle = await loadFolderHandleFromStorage();
        if (!handle || !(await hasFolderPermission(handle))) return;
        setImportRuns(await scanImportRuns(handle));
        setPortfolio(await scanFolderStructure(handle));
      } catch { /* keep the current UI on transient filesystem errors */ }
    };
    const interval = window.setInterval(poll, 2500);
    return () => window.clearInterval(interval);
  }, [onboardingDone, connected]);

  const doConnect = useCallback(async (data: Portfolio) => {
    setPortfolio(data);
    setConnected(true);
    setConnectNonce(n => n + 1);
    localStorage.setItem(CONNECTED_KEY, '1');
    setSelectedGoalId(null);
    setSelectedRecordId(null);
    setSelectedMindset([]);
    setSelectedTools([]);
    initSelection(data);
  }, []);

  const handleConnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      let scanned: Portfolio | null = null;
      try {
        const handle = await selectFolder();
        if (handle) {
          const ok = await verifyFolderPermission(handle);
          if (ok) {
            await saveFolderHandleToStorage(handle);
            setInstallMarker(await readInstallMarker(handle));
            setImportRuns(await scanImportRuns(handle));
            scanned = await scanFolderStructure(handle);
          }
        }
      } catch {
        // File System Access API unavailable or dismissed
      }
      // Never fall back to mock data — show real folder contents (even if empty)
      if (scanned === null) return; // user cancelled picker
      await doConnect(scanned);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed');
    } finally {
      setIsLoading(false);
    }
  }, [doConnect]);

  // ── Save edited record ──────────────────────────────────────
  const handleSaveRecord = useCallback(async (updated: Record) => {
    // Write to file (no-op in demo mode if no folder handle)
    await saveRecordToFile({
      file_path:  updated.file_path,
      title:      updated.title,
      summary:    updated.summary,
      content:    updated.content,
      result:     updated.result,
      status:     updated.status,
      updated_at: updated.updated_at,
      tags:       updated.tags,
      section:    updated.section,
      purpose:    updated.purpose,
      activities: updated.activities,
      tools:      updated.tools,
      mindset:    updated.mindset,
    });
    // Patch in-memory portfolio so card list reflects changes immediately
    setPortfolio(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        projects: prev.projects.map(p => ({
          ...p,
          goals: p.goals.map(g => ({
            ...g,
            records: g.records.map(r => r.id === updated.id ? updated : r),
          })),
        })),
      };
    });
  }, []);

  const handleDeleteRecord = useCallback(async (record: Record) => {
    await deleteRecordFromFile(record.file_path);
    setPortfolio(prev => prev ? ({
      ...prev,
      projects: prev.projects.map(p => ({
        ...p,
        goals: p.goals.map(g => ({
          ...g,
          records: g.records.filter(r => r.id !== record.id),
        })),
      })),
    }) : prev);
    setSelectedRecordId(null);
  }, []);

  const openManager = useCallback((tab: 'projects' | 'stages' | 'task', stage?: string) => {
    setManagerTab(tab);
    setManagerStage(stage);
    setManagerProjectSlug(selectedProjectId ? portfolio?.projects.find(p => p.id === selectedProjectId)?.slug : portfolio?.projects[0]?.slug);
    setManagerOpen(true);
  }, [portfolio, selectedProjectId]);

  const handleReorderProjects = useCallback(async (sourceId: string, targetId: string) => {
    if (!portfolio || sourceId === targetId) return;
    const next = [...portfolio.projects];
    const from = next.findIndex(p => p.id === sourceId); const to = next.findIndex(p => p.id === targetId);
    if (from < 0 || to < 0) return;
    const moved = next.splice(from, 1)[0]; next.splice(to, 0, moved);
    for (let i = 0; i < next.length; i++) await updateProjectInFolder({ ...next[i], order: i });
    await refreshPortfolio();
  }, [portfolio, refreshPortfolio]);

  const handleReorderStages = useCallback(async (source: string, target: string) => {
    if (!portfolio || source === target) return;
    const stages = [...(portfolio.stages || [])]; const from = stages.indexOf(source); const to = stages.indexOf(target);
    if (from < 0 || to < 0) return;
    stages.splice(to, 0, stages.splice(from, 1)[0]);
    const handle = await loadFolderHandleFromStorage();
    if (handle) { await writeStages(handle, stages); await refreshPortfolio(); }
  }, [portfolio, refreshPortfolio]);


  const projectPanel = projectPanelId ? portfolio?.projects.find(p => p.id === projectPanelId) : null;
  const handleSaveProject = useCallback(async (project: Project) => {
    await updateProjectInFolder(project);
    await refreshPortfolio();
    setProjectPanelId(null);
  }, [refreshPortfolio]);
  const handleDeleteProject = useCallback(async (project: Project) => {
    await deleteProjectFromFolder(project.slug);
    await refreshPortfolio();
    setProjectPanelId(null);
    setSelectedProjectId(null);
  }, [refreshPortfolio]);

  // ── derived ────────────────────────────────────────────────
  const filterState: FilterState = useMemo(
    () => ({ mindset: selectedMindset, tools: selectedTools, keyword: '', stage: selectedStage, activity: selectedActivity }),
    [selectedMindset, selectedTools, selectedStage, selectedActivity]
  );

  const tagOptions = useMemo(
    () => (portfolio ? buildTagOptions(portfolio) : { mindset: [], tool: [], activity: [] }),
    [portfolio]
  );

  const filteredRecords = useMemo(() => {
    if (!portfolio) return [];
    return scopedRecords(portfolio, selectedProjectId, selectedGoalId, filterState);
  }, [portfolio, selectedProjectId, selectedGoalId, filterState]);

  // All records across the whole portfolio (for detail-panel lookup, independent of the section view).
  const allRecords = useMemo(() => {
    if (!portfolio) return [];
    return portfolio.projects.flatMap(p => p.goals.flatMap(g => g.records));
  }, [portfolio]);

  const handleMoveTaskToStage = useCallback(async (sourceId: string, targetStage: string, beforeId?: string) => {
    if (!portfolio) return;
    const record = allRecords.find(r => r.id === sourceId);
    if (!record) return;
    const stageRecords = allRecords.filter(r => r.section === targetStage && r.id !== sourceId);
    const insertionIndex = beforeId ? Math.max(0, stageRecords.findIndex(r => r.id === beforeId)) : stageRecords.length;
    const moved = { ...record, section: targetStage, order: insertionIndex };
    stageRecords.splice(insertionIndex, 0, moved);
    for (let i = 0; i < stageRecords.length; i++) {
      const task = stageRecords[i];
      await saveRecordToFile({ file_path: task.file_path, title: task.title, section: targetStage, order: i });
    }
    await refreshPortfolio();
  }, [allRecords, portfolio, refreshPortfolio]);

  const handleDeleteStage = useCallback((stage: string) => {
    setStageDeleteTarget(stage);
  }, []);

  const deleteStageAfterConfirm = useCallback(async () => {
    if (!portfolio || !stageDeleteTarget) return;
    const stageRecords = allRecords.filter(r => r.section === stageDeleteTarget);
    try {
      for (const record of stageRecords) await deleteRecordFromFile(record.file_path);
      const handle = await loadFolderHandleFromStorage();
      if (!handle) throw new Error('Builder’s Diary folder is not connected');
      await writeStages(handle, (portfolio.stages || []).filter(s => s !== stageDeleteTarget));
      setStageDeleteTarget(null);
      await refreshPortfolio();
    } catch (error) {
      console.error(error);
      setStageDeleteTarget(null);
    }
  }, [allRecords, portfolio, refreshPortfolio, stageDeleteTarget]);

  // Total records across the whole portfolio (ignores filters) — drives the empty banner.
  const totalRecordCount = allRecords.length;
  const installedVersion = installMarker?.version;
  const updateAvailable = !!installedVersion
    && isOlderVersion(installedVersion, CURRENT_INSTALLER_VERSION);
  const updateTools = installMarker?.tools?.length ? installMarker.tools : selectedClients;

  const selectedRecord = useMemo(
    () => allRecords.find(r => r.id === selectedRecordId) || null,
    [allRecords, selectedRecordId]
  );

  // reset card selection if the selected record no longer exists in the portfolio
  useEffect(() => {
    if (selectedRecordId && !allRecords.some(r => r.id === selectedRecordId)) {
      setSelectedRecordId(null);
    }
  }, [allRecords, selectedRecordId]);

  // ── render ─────────────────────────────────────────────────
  if (!hydrated) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  }

  if (!onboardingDone) {
    return (
      <OnboardingScreen
        onSelectFolder={handleConnect}
        isLoading={isLoading}
        error={error}
        folderConnected={connected}
        connectNonce={connectNonce}
        folderPath={portfolio?.path}
        selectedClients={selectedClients}
        setSelectedClients={setSelectedClients}
        onComplete={completeOnboarding}
      />
    );
  }

  // Onboarding done but portfolio not yet loaded (edge case) — keep a neutral canvas.
  if (!portfolio) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <Header
        projects={portfolio.projects}
        stages={portfolio.stages || []}
        selectedProjectId={selectedProjectId}
        selectedStage={selectedStage}
        selectedActivity={selectedActivity}
        resultCount={filteredRecords.length}
        activityOptions={tagOptions.activity}
        mindsetOptions={tagOptions.mindset}
        toolOptions={tagOptions.tool}
        selectedMindset={selectedMindset}
        selectedTools={selectedTools}
        onProjectChange={(v) => { setExploreMode('project'); setSelectedProjectId(v); setSelectedStage(null); setSelectedActivity(null); setSelectedGoalId(null); setSelectedRecordId(null); }}
        onStageChange={(v) => { setSelectedStage(v); setSelectedRecordId(null); }}
        onActivityChange={(v) => { setSelectedActivity(v); setSelectedRecordId(null); }}
        onMindsetChange={setSelectedMindset}
        onToolChange={setSelectedTools}
        onReconnect={handleConnect}
        isLoading={isLoading}
        selectedClients={selectedClients}
      />

      {updateAvailable && installedVersion && (
        <SkillUpdateBanner
          installedVersion={installedVersion}
          currentVersion={CURRENT_INSTALLER_VERSION}
          tools={updateTools}
        />
      )}

      <ImportProgress runs={importRuns} toolId={selectedClients[0]} onReview={() => setImportReviewOpen(true)} />

      {/* First-record nudge — shown only when the whole portfolio is empty */}
      {totalRecordCount === 0 && (
        <FirstRecordBanner toolId={selectedClients[0]} />
      )}

      {error && (
        <div className="mono" style={{
          padding: '7px 20px', fontSize: 11, color: 'var(--danger)',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
          {error}
        </div>
      )}

      {/* Main 2-zone: 3-level project/section view + optional detail panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* 3-level view (takes remaining width) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <ProjectSectionView
            projects={portfolio.projects}
            stages={portfolio.stages}
            selectedProjectId={selectedProjectId}
            selectedGoalId={selectedGoalId}
            filterState={filterState}
            mode={exploreMode}
            onModeChange={(mode) => { setExploreMode(mode); setSelectedGoalId(null); setSelectedRecordId(null); }}
            onSelectProject={(id) => { setExploreMode('project'); setSelectedProjectId(id); setProjectPanelId(null); setSelectedStage(null); setSelectedActivity(null); setSelectedGoalId(null); setSelectedRecordId(null); }}
            onEditProject={(id) => { setSelectedProjectId(id); setProjectPanelId(null); setManagerProjectSlug(portfolio?.projects.find(p => p.id === id)?.slug || undefined); setManagerTab('projects'); setManagerOpen(true); }}
            onCreateProject={() => { setManagerTab('projects'); setManagerProjectSlug(undefined); setManagerOpen(true); }}
            onDropTaskToStage={handleMoveTaskToStage}
            onCreateTask={(stage) => openManager('task', stage)}
            onDeleteStage={handleDeleteStage}
            onDropStage={handleReorderStages}
            onCreateStage={() => openManager('stages')}
            selectedRecordId={selectedRecordId}
            onSelectRecord={setSelectedRecordId}
          />
        </div>

        {/* Right: detail panel (slides in on selection) */}
        {selectedRecord && (
          <div style={{ width: 400, flexShrink: 0, overflow: 'hidden' }} className="detail-col">
            <DetailPanel
              record={selectedRecord}
              stages={portfolio.stages}
              onClose={() => setSelectedRecordId(null)}
              onSave={handleSaveRecord}
              onDelete={handleDeleteRecord}
            />
          </div>
        )}
        {!selectedRecord && projectPanel && (
          <ProjectDetailPanel
            project={projectPanel}
            onClose={() => setProjectPanelId(null)}
            onSave={handleSaveProject}
            onDelete={handleDeleteProject}
          />
        )}
      </div>

      {managerOpen && (
        <ManagePanel
          portfolio={portfolio}
          initialTab={managerTab}
          initialStage={managerStage}
          initialProjectSlug={managerProjectSlug}
          createOnly={!managerProjectSlug}
          onClose={() => setManagerOpen(false)}
          onRefresh={refreshPortfolio}
        />
      )}

      {stageDeleteTarget && (() => {
        const stageRecords = allRecords.filter(r => r.section === stageDeleteTarget);
        const visibleCount = selectedProjectId ? stageRecords.filter(r => r.project_slug === portfolio?.projects.find(p => p.id === selectedProjectId)?.slug).length : stageRecords.length;
        const projectNames = [...new Set(stageRecords.map(r => r.projectTitle || r.project_slug || 'Unknown project'))];
        const scope = projectNames.length === 1 ? projectNames[0] : 'ALL PROJECTS';
        const token = `${scope} / ${stageDeleteTarget}`;
        return <ConfirmDialog
          open
          danger
          title={`Delete ${stageDeleteTarget} stage?`}
          message={<><p style={{ margin: 0 }}>This permanently deletes the Stage and its Tasks.</p><p style={{ margin: '10px 0 0' }}><strong style={{ color: 'var(--danger)' }}>{visibleCount} visible Task{visibleCount === 1 ? '' : 's'}</strong> ({stageRecords.length} total across all projects) will be deleted. This cannot be undone.</p></>}
          confirmLabel="Delete stage"
          requireText={token}
          onCancel={() => setStageDeleteTarget(null)}
          onConfirm={deleteStageAfterConfirm}
        />;
      })()}
      {importReviewOpen && (
        <ImportReview onClose={() => setImportReviewOpen(false)} onSaved={refreshPortfolio} />
      )}
    </div>
  );
}
