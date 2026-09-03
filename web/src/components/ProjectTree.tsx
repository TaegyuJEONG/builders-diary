'use client';

import { useState } from 'react';
import { Project, Goal, Record } from '@/lib/types';
import { copyToClipboard, generateResumeLink } from '@/utils/resumeLink';

interface ProjectTreeProps {
  projects: Project[];
  selectedRecordId?: string;
  onSelectRecord: (recordId: string) => void;
}

export function ProjectTree({ projects, selectedRecordId, onSelectRecord }: ProjectTreeProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());

  const toggleProject = (projectSlug: string) => {
    const newSet = new Set(expandedProjects);
    if (newSet.has(projectSlug)) {
      newSet.delete(projectSlug);
    } else {
      newSet.add(projectSlug);
    }
    setExpandedProjects(newSet);
  };

  const toggleGoal = (goalSlug: string) => {
    const newSet = new Set(expandedGoals);
    if (newSet.has(goalSlug)) {
      newSet.delete(goalSlug);
    } else {
      newSet.add(goalSlug);
    }
    setExpandedGoals(newSet);
  };

  const handleCopyProjectLink = (e: React.MouseEvent, projectSlug: string) => {
    e.stopPropagation();
    const link = generateResumeLink(window.location.origin, 'project', projectSlug);
    copyToClipboard(link).then(() => {
      alert('Link copied to clipboard!');
    });
  };

  const handleCopyGoalLink = (e: React.MouseEvent, projectSlug: string, goalSlug: string) => {
    e.stopPropagation();
    const link = generateResumeLink(window.location.origin, 'goal', goalSlug, projectSlug);
    copyToClipboard(link).then(() => {
      alert('Link copied to clipboard!');
    });
  };

  if (projects.length === 0) {
    return (
      <div className="p-4 text-center text-slate-600">
        <p>No projects found. Select a folder to get started.</p>
      </div>
    );
  }

  return (
    <nav className="divide-y divide-slate-200">
      {projects.map(project => (
        <div key={project.id} className="py-2">
          <div className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer rounded">
            <button
              onClick={() => toggleProject(project.slug)}
              className="flex-shrink-0 w-5 h-5 flex items-center justify-center"
            >
              {project.goals.length > 0 ? (
                <span className={`transform transition-transform ${expandedProjects.has(project.slug) ? 'rotate-90' : ''}`}>
                  ▶
                </span>
              ) : (
                <span className="text-slate-300">•</span>
              )}
            </button>
            <span className="flex-grow font-semibold text-slate-900">{project.title}</span>
            <button
              onClick={(e) => handleCopyProjectLink(e, project.slug)}
              className="text-xs text-slate-500 hover:text-blue-600 px-2 py-1 hidden group-hover:block"
              title="Copy resume link"
            >
              🔗
            </button>
          </div>

          {expandedProjects.has(project.slug) && (
            <div className="ml-6">
              {project.goals.map(goal => (
                <ProjectGoal
                  key={goal.id}
                  goal={goal}
                  projectSlug={project.slug}
                  expanded={expandedGoals.has(goal.slug)}
                  onToggle={() => toggleGoal(goal.slug)}
                  selectedRecordId={selectedRecordId}
                  onSelectRecord={onSelectRecord}
                  onCopyGoalLink={(e) => handleCopyGoalLink(e, project.slug, goal.slug)}
                />
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}

interface ProjectGoalProps {
  goal: Goal;
  projectSlug: string;
  expanded: boolean;
  onToggle: () => void;
  selectedRecordId?: string;
  onSelectRecord: (recordId: string) => void;
  onCopyGoalLink: (e: React.MouseEvent) => void;
}

function ProjectGoal({
  goal,
  projectSlug,
  expanded,
  onToggle,
  selectedRecordId,
  onSelectRecord,
  onCopyGoalLink,
}: ProjectGoalProps) {
  return (
    <div className="py-1">
      <div className="flex items-center gap-2 px-4 py-2 hover:bg-slate-50 cursor-pointer rounded">
        <button onClick={onToggle} className="flex-shrink-0 w-5 h-5 flex items-center justify-center">
          {goal.records.length > 0 ? (
            <span className={`transform transition-transform text-sm ${expanded ? 'rotate-90' : ''}`}>▶</span>
          ) : (
            <span className="text-slate-300">•</span>
          )}
        </button>
        <span className="flex-grow font-medium text-slate-800">{goal.title}</span>
        <button
          onClick={onCopyGoalLink}
          className="text-xs text-slate-500 hover:text-blue-600 px-2 py-1 hidden group-hover:block"
          title="Copy resume link"
        >
          🔗
        </button>
      </div>

      {expanded && (
        <div className="ml-6">
          {goal.records.map(record => (
            <RecordItem
              key={record.id}
              record={record}
              selected={selectedRecordId === record.id}
              onSelect={() => onSelectRecord(record.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface RecordItemProps {
  record: Record;
  selected: boolean;
  onSelect: () => void;
}

function RecordItem({ record, selected, onSelect }: RecordItemProps) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left px-4 py-2 rounded text-sm transition-colors ${
        selected
          ? 'bg-blue-100 text-blue-900 font-medium'
          : 'text-slate-700 hover:bg-slate-100'
      }`}
      title={record.title}
    >
      <div className="truncate">• {record.title}</div>
      {record.tags.length > 0 && (
        <div className="text-xs text-slate-500 mt-1 truncate">
          {record.tags.join(', ')}
        </div>
      )}
    </button>
  );
}
