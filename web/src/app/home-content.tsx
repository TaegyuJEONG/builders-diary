'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { GoalList } from '@/components/GoalList';
import { CardScrollable } from '@/components/CardScrollable';
import { DetailPanel } from '@/components/DetailPanel';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Portfolio } from '@/lib/types';
import {
  selectFolder, scanFolderStructure, verifyFolderPermission,
  loadFolderHandleFromStorage, saveFolderHandleToStorage,
} from '@/lib/fileSystem';
import {
  convertMockToPortfolio, buildTagOptions,
  scopedRecords, visibleCountByGoal, FilterState,
} from '@/lib/portfolio';

const CONNECTED_KEY = 'builders-diary-connected';

export function HomeContent() {
  const [connected, setConnected] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // selection
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);

  // filters
  const [selectedMindset, setSelectedMindset] = useState<string[]>([]);
  const [selectedTools, setSelectedTools] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState('');

  // Restore "connected" state on mount (prototype: mock data)
  useEffect(() => {
    const forceDemo = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('demo') === '1';
    const wasConnected = typeof window !== 'undefined'
      && localStorage.getItem(CONNECTED_KEY) === '1';
    if (forceDemo || wasConnected) {
      const data = convertMockToPortfolio();
      setPortfolio(data);
      setConnected(true);
      initSelection(data);
    }
    setHydrated(true);
  }, []);

  const initSelection = (data: Portfolio) => {
    if (data.projects.length > 0) {
      setSelectedProjectId(data.projects[0].id);
      setSelectedGoalId(null);
    }
  };

  const doConnect = useCallback(async (data: Portfolio) => {
    setPortfolio(data);
    setConnected(true);
    localStorage.setItem(CONNECTED_KEY, '1');
    setSelectedGoalId(null);
    setSelectedRecordId(null);
    setSelectedMindset([]);
    setSelectedTools([]);
    setSearchKeyword('');
    initSelection(data);
  }, []);

  const handleConnect = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Try real folder picker; fall back to mock (prototype demo data).
      let scanned: Portfolio | null = null;
      try {
        const handle = await selectFolder();
        if (handle) {
          const ok = await verifyFolderPermission(handle);
          if (ok) {
            await saveFolderHandleToStorage(handle);
            const data = await scanFolderStructure(handle);
            if (data.projects.length > 0) scanned = data;
          }
        }
      } catch {
        // File System Access API unavailable or dismissed — use mock.
      }
      await doConnect(scanned || convertMockToPortfolio());
    } catch (err) {
      setError(err instanceof Error ? err.message : '연결에 실패했습니다');
    } finally {
      setIsLoading(false);
    }
  }, [doConnect]);

  const handleRefresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const handle = await loadFolderHandleFromStorage();
      if (handle && (await verifyFolderPermission(handle))) {
        const data = await scanFolderStructure(handle);
        if (data.projects.length > 0) {
          setPortfolio(data);
          setSelectedRecordId(null);
          setIsLoading(false);
          return;
        }
      }
      // prototype: refresh mock
      setPortfolio(convertMockToPortfolio());
      setSelectedRecordId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '새로고침 실패');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── derived ────────────────────────────────────────────────
  const filterState: FilterState = useMemo(
    () => ({ mindset: selectedMindset, tools: selectedTools, keyword: searchKeyword }),
    [selectedMindset, selectedTools, searchKeyword]
  );

  const tagOptions = useMemo(
    () => (portfolio ? buildTagOptions(portfolio) : { mindset: [], tool: [] }),
    [portfolio]
  );

  const selectedProject = useMemo(
    () => portfolio?.projects.find(p => p.id === selectedProjectId),
    [portfolio, selectedProjectId]
  );

  const filteredRecords = useMemo(() => {
    if (!portfolio) return [];
    return scopedRecords(portfolio, selectedProjectId, selectedGoalId, filterState);
  }, [portfolio, selectedProjectId, selectedGoalId, filterState]);

  const goalCounts = useMemo(
    () => visibleCountByGoal(selectedProject, filterState),
    [selectedProject, filterState]
  );

  const selectedRecord = useMemo(
    () => filteredRecords.find(r => r.id === selectedRecordId) || null,
    [filteredRecords, selectedRecordId]
  );

  // reset card selection if it falls out of the filtered set
  useEffect(() => {
    if (selectedRecordId && !filteredRecords.some(r => r.id === selectedRecordId)) {
      setSelectedRecordId(null);
    }
  }, [filteredRecords, selectedRecordId]);

  // ── render ─────────────────────────────────────────────────
  if (!hydrated) {
    return <div style={{ minHeight: '100vh', background: 'var(--bg)' }} />;
  }

  if (!connected || !portfolio) {
    return <OnboardingScreen onSelectFolder={handleConnect} isLoading={isLoading} error={error} />;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <Header
        projectName={selectedProject?.title}
        mindsetOptions={tagOptions.mindset}
        toolOptions={tagOptions.tool}
        selectedMindset={selectedMindset}
        selectedTools={selectedTools}
        onMindsetChange={setSelectedMindset}
        onToolChange={setSelectedTools}
        onRefresh={handleRefresh}
        onReconnect={handleConnect}
        isLoading={isLoading}
      />

      {error && (
        <div className="mono" style={{
          padding: '8px 24px', fontSize: 12, color: 'var(--danger)',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
          {error}
        </div>
      )}

      <FilterBar
        projects={portfolio.projects}
        selectedProjectId={selectedProjectId}
        selectedGoalId={selectedGoalId}
        searchKeyword={searchKeyword}
        resultCount={filteredRecords.length}
        onProjectChange={setSelectedProjectId}
        onGoalChange={setSelectedGoalId}
        onSearchChange={setSearchKeyword}
      />

      {/* Main 3-zone */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Left: goal list */}
        <div style={{
          width: 260, flexShrink: 0, borderRight: '1px solid var(--border)',
          background: 'var(--bg)', overflow: 'hidden',
        }} className="goal-col">
          <GoalList
            project={selectedProject}
            selectedGoalId={selectedGoalId}
            onSelectGoal={setSelectedGoalId}
            visibleCountByGoal={goalCounts}
          />
        </div>

        {/* Center: cards */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <CardScrollable
            records={filteredRecords}
            selectedRecordId={selectedRecordId}
            onSelectRecord={setSelectedRecordId}
          />
        </div>

        {/* Right: detail (slides in on selection) */}
        {selectedRecord && (
          <div style={{ width: 400, flexShrink: 0, overflow: 'hidden' }} className="detail-col">
            <DetailPanel record={selectedRecord} onClose={() => setSelectedRecordId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}
