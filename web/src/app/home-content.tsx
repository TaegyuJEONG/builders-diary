'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { ProjectTree } from '@/components/ProjectTree';
import { RecordDetail } from '@/components/RecordDetail';
import { TagFilter } from '@/components/TagFilter';
import { Portfolio, Project, Record } from '@/lib/types';
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
  const [filteredPortfolio, setFilteredPortfolio] = useState<Portfolio | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
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
          setAllTags(extractAllTags(cached.projects));
          setFilteredPortfolio(cached);
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
            setAllTags(extractAllTags(data.projects));
            setFilteredPortfolio(data);
            setHasFolder(true);

            // Handle deep links
            handleDeepLink(data);
            return;
          }
        }

        setError('No portfolio folder selected. Click "Select Folder" to get started.');
        setHasFolder(false);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load portfolio';
        setError(`Error: ${message}`);
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
      setAllTags(extractAllTags(data.projects));
      setFilteredPortfolio(data);
      setSelectedRecordId(null);
      setSelectedTags([]);
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
      setAllTags(extractAllTags(data.projects));
      setFilteredPortfolio(data);
      setSelectedRecordId(null);
      setSelectedTags([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to refresh portfolio';
      setError(`Error: ${message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTagChange = useCallback((tags: string[]) => {
    setSelectedTags(tags);
    if (portfolio) {
      const filtered = filterByTags(portfolio, tags);
      setFilteredPortfolio(filtered);
      setSelectedRecordId(null);
    }
  }, [portfolio]);

  const selectedRecord =
    filteredPortfolio && selectedRecordId
      ? findRecordById(filteredPortfolio.projects, selectedRecordId)
      : null;

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

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Left Panel: Tree + Tags */}
        <div className="w-full md:w-80 md:border-r border-slate-200 bg-white flex flex-col overflow-hidden">
          {hasFolder && filteredPortfolio ? (
            <>
              <ProjectTree
                projects={filteredPortfolio.projects}
                selectedRecordId={selectedRecordId || undefined}
                onSelectRecord={setSelectedRecordId}
              />
              <TagFilter
                allTags={allTags}
                selectedTags={selectedTags}
                onTagChange={handleTagChange}
              />
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-500 p-4 text-center">
              <p>Select a folder to start viewing your portfolio</p>
            </div>
          )}
        </div>

        {/* Right Panel: Record Detail */}
        <div className="w-full md:flex-1 bg-white overflow-hidden">
          {hasFolder && filteredPortfolio ? (
            <RecordDetail record={selectedRecord} />
          ) : (
            <div className="flex items-center justify-center h-full text-slate-500">
              <p>Select a folder to get started</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
