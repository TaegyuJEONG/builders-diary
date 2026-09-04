'use client';

import { useEffect, useState, useCallback } from 'react';
import { Header } from '@/components/Header';
import { FilterBar } from '@/components/FilterBar';
import { CardScrollable } from '@/components/CardScrollable';
import { DetailPanel } from '@/components/DetailPanel';
import { OnboardingScreen } from '@/components/OnboardingScreen';
import { mockPortfolioV2, CardData, GoalData, ProjectData } from '@/lib/mockData';

// Convert mockData to match Record interface
interface MockRecord {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  created_at: string;
  status?: 'in_progress' | 'completed' | 'blocked';
  content: string;
  file_path: string;
  updated_at?: string;
}

export function HomeContent() {
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedGoalId, setSelectedGoalId] = useState<string | null>(null);
  const [selectedRecordId, setSelectedRecordId] = useState<string | null>(null);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFolder, setHasFolder] = useState(true); // Mock data is always available

  // Convert CardData to MockRecord
  const convertCardToRecord = (card: CardData): MockRecord => {
    return {
      id: card.id,
      title: card.title,
      summary: card.summary,
      tags: card.tags,
      created_at: card.created_at,
      status: card.status,
      content: card.summary, // Use summary as content for now
      file_path: `/mock/${card.id}`,
      updated_at: card.created_at
    };
  };

  // Convert mockData to component structure
  const projectsForUI = mockPortfolioV2.projects.map((project: ProjectData) => ({
    id: project.id,
    slug: project.id,
    title: project.title,
    goals: project.goals.map((goal: GoalData) => ({
      id: goal.id,
      slug: goal.id,
      title: goal.title,
      records: goal.cards.map(convertCardToRecord)
    }))
  }));

  // Get filtered records based on project, goal, and search
  const filteredRecords = useMemo(() => {
    let records: MockRecord[] = [];

    if (selectedProjectId) {
      const project = projectsForUI.find(p => p.id === selectedProjectId);
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
      records = projectsForUI.flatMap(p => p.goals.flatMap(g => g.records));
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
  }, [selectedProjectId, selectedGoalId, searchKeyword, projectsForUI]);

  // Get selected record
  const selectedRecord = filteredRecords.find(r => r.id === selectedRecordId) || null;

  const handleSelectFolder = async () => {
    // Mock implementation - just select the first project
    if (projectsForUI.length > 0) {
      setSelectedProjectId(projectsForUI[0].id);
      setSelectedGoalId(null);
      setSelectedRecordId(null);
      setSearchKeyword('');
    }
  };

  const handleRefresh = async () => {
    // Mock implementation - just clear selections
    setSelectedProjectId(null);
    setSelectedGoalId(null);
    setSelectedRecordId(null);
    setSearchKeyword('');
  };

  // Auto-select first project on mount
  useEffect(() => {
    if (!selectedProjectId && projectsForUI.length > 0) {
      setSelectedProjectId(projectsForUI[0].id);
    }
  }, []);

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
        {/* Filter Bar - Top Left */}
        <div className="bg-white border-b border-slate-200">
          <FilterBar
            projects={projectsForUI}
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
          {/* Left Panel: Goals List */}
          <div className="hidden lg:flex lg:w-64 bg-white border-r border-slate-200 flex-col overflow-hidden">
            <div className="p-4 border-b border-slate-200">
              <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
                {selectedProjectId 
                  ? `${filteredRecords.length} Cards`
                  : 'Select a Project'
                }
              </p>
            </div>
            {selectedProjectId && projectsForUI.find(p => p.id === selectedProjectId) && (
              <div className="flex-1 overflow-y-auto p-2">
                {projectsForUI.find(p => p.id === selectedProjectId)?.goals.map(goal => (
                  <button
                    key={goal.id}
                    onClick={() => setSelectedGoalId(goal.id === selectedGoalId ? null : goal.id)}
                    className={`w-full text-left px-3 py-2 mb-1 rounded text-sm transition-colors ${
                      goal.id === selectedGoalId
                        ? 'bg-emerald-100 text-emerald-900 font-semibold'
                        : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    {goal.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Center Panel: Card Scrollable */}
          <div className="flex-1 bg-slate-50 border-r border-slate-200 flex flex-col overflow-hidden">
            {filteredRecords.length === 0 ? (
              <div className="flex-1 flex items-center justify-center text-slate-400 p-4">
                <div className="text-center">
                  <p className="text-sm">No cards found</p>
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
          <div className="hidden md:flex md:w-96 bg-white overflow-hidden flex-col">
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
