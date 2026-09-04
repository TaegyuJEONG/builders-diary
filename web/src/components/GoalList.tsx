'use client';

import React from 'react';
import { GoalData } from '@/lib/mockData';

interface GoalListProps {
  goals: GoalData[];
  selectedGoalId: string | null;
  onSelectGoal: (goalId: string) => void;
}

export function GoalList({ goals, selectedGoalId, onSelectGoal }: GoalListProps) {
  return (
    <div className="h-full flex flex-col border-r border-slate-700">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-700">
        <h3 className="text-sm font-semibold text-slate-300">목표</h3>
        <p className="text-xs text-slate-500 mt-1">{goals.length}개 목표</p>
      </div>

      {/* Goals List */}
      <div className="flex-1 overflow-y-auto">
        {goals.map((goal) => (
          <button
            key={goal.id}
            onClick={() => onSelectGoal(goal.id)}
            className={`w-full text-left px-6 py-4 border-l-4 transition-all ${
              selectedGoalId === goal.id
                ? 'border-l-green-500 bg-green-500/10 text-slate-100'
                : 'border-l-slate-600 text-slate-400 hover:bg-slate-800/50 hover:text-slate-300'
            }`}
          >
            <h4 className="text-sm font-semibold line-clamp-2 mb-1">{goal.title}</h4>
            <p className="text-xs text-slate-500 line-clamp-2">{goal.description}</p>
            <div className="text-xs text-slate-600 mt-2">
              {goal.cards.length}개 카드
            </div>
          </button>
        ))}
      </div>

      {/* Empty State */}
      {goals.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-slate-500">
          <p className="text-sm">목표가 없습니다</p>
        </div>
      )}
    </div>
  );
}
