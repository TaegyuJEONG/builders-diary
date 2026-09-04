'use client';

import React, { useState, useEffect } from 'react';
import { mockPortfolioV2, ProjectData, GoalData, CardData } from '@/lib/mockData';
import { FilterBar } from '@/components/FilterBar';
import { GoalList } from '@/components/GoalList';
import { CardListScrollable } from '@/components/CardListScrollable';
import { CardDetailPanel } from '@/components/CardDetailPanel';
import { OnboardingScreen } from '@/components/OnboardingScreen';

type ViewMode = 'onboarding' | 'main';

export function HomeContentV2() {
  const [viewMode, setViewMode] = useState<ViewMode>('onboarding');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [selectedGoalId, setSelectedGoalId] = useState<string>('');
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // 선택된 프로젝트 가져오기
  const selectedProject: ProjectData | undefined = mockPortfolioV2.projects.find(
    (p) => p.id === selectedProjectId
  ) || mockPortfolioV2.projects[0];

  // 선택된 목표 가져오기
  const selectedGoal: GoalData | undefined = selectedProject?.goals.find(
    (g) => g.id === selectedGoalId
  );

  // 필터링된 목표 (검색어)
  const filteredGoals = selectedProject?.goals.filter((goal) =>
    goal.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    goal.description.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  // 선택된 목표의 카드들
  const cards = selectedGoal?.cards || [];

  // 검색어로 필터링된 카드들
  const filteredCards = cards.filter((card) =>
    card.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
    card.tags.some((tag) =>
      tag.toLowerCase().includes(searchQuery.toLowerCase())
    )
  );

  // 선택된 카드 가져오기
  const selectedCard = filteredCards.find(
    (c) => c.id === selectedCardId
  ) || null;

  // 초기 목표 선택
  useEffect(() => {
    if (viewMode === 'main' && selectedProject && selectedProject.goals.length > 0) {
      if (!selectedGoalId) {
        setSelectedGoalId(selectedProject.goals[0].id);
      }
    }
  }, [viewMode, selectedProject, selectedGoalId]);

  // 프로젝트 변경 시 목표 리셋
  const handleSelectProject = (projectId: string | null) => {
    setSelectedProjectId(projectId || mockPortfolioV2.projects[0].id);
    setSelectedGoalId('');
    setSelectedCardId(null);
    setSearchQuery('');
  };

  // 목표 변경 시 카드 리셋
  const handleSelectGoal = (goalId: string | null) => {
    setSelectedGoalId(goalId || '');
    setSelectedCardId(null);
  };

  const handleStart = () => {
    setViewMode('main');
    if (mockPortfolioV2.projects.length > 0) {
      const firstProject = mockPortfolioV2.projects[0];
      setSelectedProjectId(firstProject.id);
      if (firstProject.goals.length > 0) {
        setSelectedGoalId(firstProject.goals[0].id);
      }
    }
  };

  if (viewMode === 'onboarding') {
    return <OnboardingScreen onSelectFolder={handleStart} isLoading={false} />;
  }

  return (
    <div className="min-h-screen flex flex-col bg-slate-900">
      {/* Header with Filter */}
      <FilterBar
        projects={mockPortfolioV2.projects}
        selectedProjectId={selectedProjectId || null}
        selectedGoalId={selectedGoalId || null}
        searchKeyword={searchQuery}
        onProjectChange={handleSelectProject}
        onGoalChange={handleSelectGoal}
        onSearchChange={setSearchQuery}
      />

      {/* Main Layout: 3-column on desktop */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Goal List */}
        <div className="hidden md:flex md:w-64 flex-col bg-slate-800 overflow-hidden">
          <GoalList
            goals={filteredGoals}
            selectedGoalId={selectedGoalId}
            onSelectGoal={handleSelectGoal}
          />
        </div>

        {/* Center Panel: Card Scroll */}
        <div className="flex-1 flex flex-col bg-slate-900 overflow-hidden">
          <CardListScrollable
            cards={filteredCards}
            selectedCardId={selectedCardId}
            onSelectCard={setSelectedCardId}
          />
        </div>

        {/* Right Panel: Card Detail */}
        <div className="hidden lg:flex lg:w-96 flex-col bg-slate-800 overflow-hidden border-l border-slate-700">
          <CardDetailPanel card={selectedCard || null} />
        </div>
      </div>

      {/* Mobile Bottom Sheet for Card Detail */}
      {selectedCard && (
        <div className="lg:hidden fixed inset-0 bg-black/50 z-40 flex items-end">
          <div className="w-full max-h-[80vh] bg-slate-800 rounded-t-lg overflow-y-auto">
            <div className="p-4 border-b border-slate-700 flex items-center justify-between">
              <h2 className="font-semibold text-slate-200">상세 정보</h2>
              <button
                onClick={() => setSelectedCardId(null)}
                className="text-slate-400 hover:text-slate-200"
              >
                ✕
              </button>
            </div>
            <CardDetailPanel card={selectedCard} />
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredGoals.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <div className="text-center">
            <p className="text-sm mb-2">검색 결과가 없습니다</p>
            <button
              onClick={() => setSearchQuery('')}
              className="text-xs text-green-400 hover:text-green-300"
            >
              검색 초기화
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
