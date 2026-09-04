'use client';

import React, { useState, useMemo } from 'react';

interface FilterBarProps {
  projects: any[];
  selectedProjectId: string | null;
  selectedGoalId: string | null;
  searchKeyword: string;
  onProjectChange: (projectId: string | null) => void;
  onGoalChange: (goalId: string | null) => void;
  onSearchChange: (keyword: string) => void;
}

export function FilterBar({
  projects,
  selectedProjectId,
  selectedGoalId,
  searchKeyword,
  onProjectChange,
  onGoalChange,
  onSearchChange
}: FilterBarProps) {
  const selectedProject = projects.find(p => p.id === selectedProjectId);
  const goals = selectedProject?.goals || [];

  const handleClear = () => {
    onProjectChange(null);
    onGoalChange(null);
    onSearchChange('');
  };

  const hasActiveFilters = selectedProjectId || selectedGoalId || searchKeyword;

  return (
    <div className="bg-white border-b border-slate-200 p-4">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Project Filter */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Project
          </label>
          <select
            value={selectedProjectId || ''}
            onChange={(e) => {
              const newProjectId = e.target.value || null;
              onProjectChange(newProjectId);
              onGoalChange(null); // Reset goal when project changes
            }}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.title}
              </option>
            ))}
          </select>
        </div>

        {/* Goal Filter */}
        {selectedProject && (
          <div>
            <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
              Goal
            </label>
            <select
              value={selectedGoalId || ''}
              onChange={(e) => onGoalChange(e.target.value || null)}
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
            >
              <option value="">All Goals</option>
              {goals.map((goal: any) => (
                <option key={goal.id} value={goal.id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Keyword Search */}
        <div>
          <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">
            Search
          </label>
          <input
            type="text"
            placeholder="Search cards..."
            value={searchKeyword}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>
      </div>

      {/* Clear Filters Button */}
      {hasActiveFilters && (
        <div className="mt-3">
          <button
            onClick={handleClear}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 transition-colors underline"
          >
            Clear Filters
          </button>
        </div>
      )}
    </div>
  );
}
