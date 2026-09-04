'use client';

import React, { useState } from 'react';
import { ProjectData } from '@/lib/mockData';

interface FilterBarProps {
  projects: ProjectData[];
  selectedProjectId: string | null;
  onSelectProject: (projectId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function FilterBar({
  projects,
  selectedProjectId,
  onSelectProject,
  searchQuery,
  onSearchChange
}: FilterBarProps) {
  const [showProjectDropdown, setShowProjectDropdown] = useState(false);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="border-b border-slate-700 bg-slate-800">
      <div className="px-6 py-4 space-y-4">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Builder's Diary V2</h1>
          <p className="text-xs text-slate-500 mt-1">폴더 연결 후 실제로 보고 싶은 UI 경험 프로토타입</p>
        </div>

        {/* Filter Row */}
        <div className="flex flex-col md:flex-row gap-3">
          {/* Project Dropdown */}
          <div className="relative flex-shrink-0 w-full md:w-64">
            <button
              onClick={() => setShowProjectDropdown(!showProjectDropdown)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-left text-sm font-medium text-slate-200 hover:border-slate-500 transition-colors flex items-center justify-between"
            >
              <span>{selectedProject?.title || '프로젝트 선택'}</span>
              <span className="text-xs">▼</span>
            </button>

            {/* Dropdown Menu */}
            {showProjectDropdown && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-slate-700 border border-slate-600 rounded shadow-lg z-10">
                <button
                  onClick={() => {
                    onSelectProject('');
                    setShowProjectDropdown(false);
                  }}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-600 transition-colors first:rounded-t ${
                    !selectedProjectId ? 'bg-slate-600 text-green-400' : 'text-slate-200'
                  }`}
                >
                  모든 프로젝트
                </button>
                {projects.map((project) => (
                  <button
                    key={project.id}
                    onClick={() => {
                      onSelectProject(project.id);
                      setShowProjectDropdown(false);
                    }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-slate-600 transition-colors last:rounded-b ${
                      selectedProjectId === project.id
                        ? 'bg-slate-600 text-green-400'
                        : 'text-slate-200'
                    }`}
                  >
                    {project.title}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Search Input */}
          <div className="flex-1">
            <input
              type="text"
              placeholder="목표/카드 검색..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded text-sm font-medium text-slate-200 placeholder-slate-500 hover:border-slate-500 focus:border-green-500 focus:outline-none transition-colors"
            />
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 text-xs text-slate-400">
            <span>{projects.length} 프로젝트</span>
            <span>
              {selectedProject ? selectedProject.goals.length : projects.reduce((acc, p) => acc + p.goals.length, 0)} 목표
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
