'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Header } from '@/components/Header';
import { CardTimeline } from '@/components/CardTimeline';
import { DetailPanel } from '@/components/DetailPanel';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Portfolio, Record } from '@/lib/types';
import {
  selectFolder, scanFolderStructure, verifyFolderPermission,
  loadFolderHandleFromStorage, saveFolderHandleToStorage, saveRecordToFile,
} from '@/lib/fileSystem';
import {
  convertMockToPortfolio, buildTagOptions,
  scopedRecords, FilterState,
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

  useEffect(() => {
    const forceDemo = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('demo') === '1';

    const forceReset = typeof window !== 'undefined'
      && new URLSearchParams(window.location.search).get('reset') === '1';

    if (forceReset) {
      localStorage.removeItem(CONNECTED_KEY);
      setConnected(false);
      setPortfolio(null);
      setHydrated(true);
      // Remove ?reset=1 from URL without reload
      window.history.replaceState({}, '', window.location.pathname);
      return;
    }

    if (forceDemo) {
      // ?demo=1 이면 무조건 목 데이터
      const data = convertMockToPortfolio();
      setPortfolio(data);
      setConnected(true);
      initSelection(data);
      setHydrated(true);
      return;
    }

    const wasConnected = typeof window !== 'undefined'
      && localStorage.getItem(CONNECTED_KEY) === '1';

    if (wasConnected) {
      // 이전에 연결된 적 있으면 IndexedDB에서 폴더 핸들 복원 시도
      (async () => {
        try {
          const handle = await loadFolderHandleFromStorage();
          if (handle) {
            const ok = await verifyFolderPermission(handle);
            if (ok) {
              const data = await scanFolderStructure(handle);
              // 실제 데이터가 있으면 그걸 쓰고, 빈 폴더면 빈 portfolio 그대로 표시
              setPortfolio(data);
              setConnected(true);
              initSelection(data);
              setHydrated(true);
              return;
            }
          }
        } catch {
          // 권한 만료 등 — 연결 해제 상태로 되돌림
        }
        // 핸들 없거나 권한 없으면 연결 해제
        localStorage.removeItem(CONNECTED_KEY);
        setConnected(false);
        setPortfolio(null);
        setHydrated(true);
      })();
      return;
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

  // ── derived ────────────────────────────────────────────────
  const filterState: FilterState = useMemo(
    () => ({ mindset: selectedMindset, tools: selectedTools, keyword: '' }),
    [selectedMindset, selectedTools]
  );

  const tagOptions = useMemo(
    () => (portfolio ? buildTagOptions(portfolio) : { mindset: [], tool: [] }),
    [portfolio]
  );

  const filteredRecords = useMemo(() => {
    if (!portfolio) return [];
    return scopedRecords(portfolio, selectedProjectId, selectedGoalId, filterState);
  }, [portfolio, selectedProjectId, selectedGoalId, filterState]);

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
    return (
      <OnboardingScreen
        onSelectFolder={handleConnect}
        isLoading={isLoading}
        error={error}
        folderConnected={connected}
        folderPath={portfolio?.path}
      />
    );
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', overflow: 'hidden' }}>
      <Header
        projects={portfolio.projects}
        selectedProjectId={selectedProjectId}
        selectedGoalId={selectedGoalId}
        resultCount={filteredRecords.length}
        mindsetOptions={tagOptions.mindset}
        toolOptions={tagOptions.tool}
        selectedMindset={selectedMindset}
        selectedTools={selectedTools}
        onProjectChange={(v) => { setSelectedProjectId(v); setSelectedGoalId(null); setSelectedRecordId(null); }}
        onGoalChange={(v) => { setSelectedGoalId(v); setSelectedRecordId(null); }}
        onMindsetChange={setSelectedMindset}
        onToolChange={setSelectedTools}
        onReconnect={handleConnect}
        onSelectRecord={setSelectedRecordId}
        isLoading={isLoading}
      />

      {error && (
        <div className="mono" style={{
          padding: '7px 20px', fontSize: 11, color: 'var(--danger)',
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
        }}>
          {error}
        </div>
      )}

      {/* Main 2-zone: timeline + optional detail panel */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>
        {/* Timeline (takes remaining width) */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          <CardTimeline
            records={filteredRecords}
            selectedRecordId={selectedRecordId}
            onSelectRecord={setSelectedRecordId}
          />
        </div>

        {/* Right: detail panel (slides in on selection) */}
        {selectedRecord && (
          <div style={{ width: 400, flexShrink: 0, overflow: 'hidden' }} className="detail-col">
            <DetailPanel record={selectedRecord} onClose={() => setSelectedRecordId(null)} onSave={handleSaveRecord} />
          </div>
        )}
      </div>
    </div>
  );
}
