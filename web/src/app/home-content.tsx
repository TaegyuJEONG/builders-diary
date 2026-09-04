'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { CardScrollable } from '@/components/CardScrollable';
import { DetailPanel } from '@/components/DetailPanel';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { Portfolio, Project, Record, Goal } from '@/lib/types';
import { selectFolder, scanFolderStructure, verifyFolderPermission, loadFolderHandleFromStorage, saveFolderHandleToStorage } from '@/lib/fileSystem';
import { extractAllTags, filterByTags, findRecordById, findProjectBySlug, findGoalBySlug } from '@/lib/filter';
import { parseDeepLink } from '@/utils/resumeLink';
import { getCachedPortfolio, setCachedPortfolio } from '@/utils/cache';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export function HomeContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFolder, setHasFolder] = useState(false);

  // Initialize portfolio on mount
  useEffect(() => {
    const initialize = async () => {
      setIsLoading(true);
      setError(null);

      try {
        // Try to load cached portfolio first
        const cached = getCachedPortfolio();
        if (cached) {
          setPortfolio(cached);
          setHasFolder(true);

          // Try to load folder handle for refresh capability
          const handle = await loadFolderHandleFromStorage();
          if (handle) {
            await verifyFolderPermission(handle);
          }

          // Handle deep links
          handleDeepLink(cached);
          return;
        }

        // Try to restore folder from storage
        const handle = await loadFolderHandleFromStorage();
        if (handle) {
          const hasPermission = await verifyFolderPermission(handle);
          if (hasPermission) {
            const data = await scanFolderStructure(handle);
            setPortfolio(data);
            setCachedPortfolio(data);
            setHasFolder(true);

            // Handle deep links
            handleDeepLink(data);
            return;
          }
        }

        setHasFolder(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load portfolio';
        console.error('Portfolio load error:', err);
      } finally {
        setIsLoading(false);
      }
    };

    initialize();
  }, []);

  const handleDeepLink = (data: Portfolio) => {
    const deepLink = parseDeepLink(pathname, searchParams.toString());
    
    if (deepLink.type === 'record' && deepLink.recordId) {
      const record = findRecordById(data.projects, deepLink.recordId);
      if (record) {
        setSelectedRecordId(deepLink.recordId);
      }
    } else if (deepLink.type === 'project' && deepLink.projectId) {
      const project = findProjectBySlug(data.projects, deepLink.projectId);
      if (project && deepLink.goalId) {
        const goal = findGoalBySlug(project, deepLink.goalId);
        if (goal && goal.records.length > 0) {
          setSelectedRecordId(goal.records[0].id);
        }
      }
    }
  };

  const handleSelectFolder = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const handle = await selectFolder();
      if (!handle) {
        setError('No folder selected');
        setIsLoading(false);
        return;
      }

      const hasPermission = await verifyFolderPermission(handle);
      if (!hasPermission) {
        setError('Permission denied. Please grant access to the folder.');
        setIsLoading(false);
        return;
      }

      await saveFolderHandleToStorage(handle);

      const data = await scanFolderStructure(handle);
      setPortfolio(data);
      setCachedPortfolio(data);
      setSelectedRecordId(null);
      setSelectedProjectId(null);
      setSelectedGoalId(null);
      setSearchKeyword('');
      setHasFolder(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to select folder';
      setError(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const handle = await loadFolderHandleFromStorage();
      if (!handle) {
        setError('No portfolio folder selected');
        setIsLoading(false);
        return;
      }

      const hasPermission = await verifyFolderPermission(handle);
      if (!hasPermission) {
        setError('Permission denied');
        setIsLoading(false);
        return;
      }

      const data = await scanFolderStructure(handle);
      setPortfolio(data);
      setCachedPortfolio(data);
      setSelectedRecordId(null);
      setSelectedProjectId(null);
      setSelectedGoalId(null);
      setSearchKeyword('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh portfolio';
      setError(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  // Get filtered records based on project, goal, and search
  const filteredRecords = useMemo(() => {
    if (!portfolio) return [];

    let records: Record[] = [];

    if (selectedProjectId) {
      const project = portfolio.projects.find(p => p.id === selectedProjectId);
      if (project) {
        if (selectedGoalId) {
          const goal = project.goals.find(g => g.id === selectedGoalId);
          if (goal) {
            records = goal.records;
          }
        } else {
          // All goals in project
          records = project.goals.flatMap(g => g.records);
        }
      }
    } else {
      // All records
      records = portfolio.projects.flatMap(p => p.goals.flatMap(g => g.records));
    }

    // Apply keyword search
    if (searchKeyword) {
      const keyword = searchKeyword.toLowerCase();
      records = records.filter(r =>
        r.title.toLowerCase().includes(keyword) ||
        r.summary.toLowerCase().includes(keyword) ||
        r.tags.some(t => t.toLowerCase().includes(keyword))
      );
    }

    return records;
  }, [portfolio, selectedProjectId, selectedGoalId, searchKeyword]);

  // Get selected record
  const selectedRecord = filteredRecords.find(r => r.id === selectedRecordId) || null;

  // If no folder is selected, show onboarding
  if (!hasFolder) {
    return <OnboardingScreen onSelectFolder={handleSelectFolder} isLoading={isLoading} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      <Header
        onSelectFolder={handleSelectFolder}
        onRefresh={handleRefresh}
        isLoading={isLoading}
      />

      {error && (
        <div className="bg-red-50 border-b border-red-200 p-4 text-red-700">
          <p className="font-medium">{error}</p>
        </div>
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Filter Bar - Full Width */}
        <div className="bg-white border-b border-slate-200">
          <FilterBar
            projects={portfolio?.projects || []}
            selectedProjectId={selectedProjectId}
            selectedGoalId={selectedGoalId}
            searchKeyword={searchKeyword}
            onProjectChange={setSelectedProjectId}
            onGoalChange={setSelectedGoalId}
            onSearchChange={setSearchKeyword}
          />
        </div>

        {/* Main Content Area - 3 Column Layout */}
        <div className="flex-1 flex overflow-hidden gap-0">
          {/* Left Panel: Empty Space or Additional Info */}
          <div className="hidden lg:flex lg:w-64 bg-white border-r border-slate-200 p-4">
            <div className="text-sm text-slate-600">
              {selectedProjectId && portfolio ? (
                <div>
                  <p className="font-semibold mb-2">
                    {portfolio.projects.find(p => p.id === selectedProjectId)?.title}
                  </p>
                  <p className="text-xs text-slate-500">
                    {filteredRecords.length} record{filteredRecords.length !== 1 ? 's' : ''} found
                  </p>
                </div>
              ) : (
                <p>Select a project to start</p>
              )}
            </div>
          </div>

          {/* Center Panel: Card Scrollable */}
          <div className="flex-1 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden">
            {filteredRecords.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 p-4">
                <div className="text-center">
                  <p className="text-sm">No records found</p>
                  {searchKeyword && <p className="text-xs mt-2">Try adjusting your search</p>}
                </div>
              </div>
            ) : (
              <CardScrollable
                records={filteredRecords}
                selectedRecordId={selectedRecordId}
                onSelectRecord={setSelectedRecordId}
              />
            )}
          </div>

          {/* Right Panel: Detail */}
          <div className="hidden md:flex md:w-96 bg-white overflow-hidden">
            <DetailPanel record={selectedRecord} />
          </div>
        </div>
      </div>

      {/* Mobile Detail Panel - Shows on small screens */}
      {selectedRecord && (
        <div className="md:hidden border-t border-slate-200 bg-white max-h-80 overflow-y-auto">
          <DetailPanel record={selectedRecord} />
        </div>
      )}
    </div>
  );
}

function useMemo<T>(factory: () => T, deps: React.DependencyList): T {
  const ref = useState(() => ({ deps, value: factory() }))[0];
  
  const depsChanged = deps.length !== ref.deps.length || 
    deps.some((dep, i) => dep !== ref.deps[i]);
  
  if (depsChanged) {
    ref.deps = deps;
    ref.value = factory();
  }
  
  return ref.value;
}
