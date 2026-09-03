import { Portfolio, Project, Goal, Record } from './types';

/**
 * Extract all unique tags from all records in a portfolio
 */
export function extractAllTags(projects: Project[]): string[] {
  try {
    const tags = new Set<string>();
    
    for (const project of projects) {
      for (const goal of project.goals) {
        for (const record of goal.records) {
          record.tags.forEach((tag: string) => tags.add(tag));
        }
      }
    }
    
    return Array.from(tags).sort();
  } catch (error) {
    console.error('Error extracting tags:', error);
    return [];
  }
}

export function filterByTags(portfolio: Portfolio, selectedTags: string[]): Portfolio {
  if (selectedTags.length === 0) {
    return portfolio;
  }

  const filteredProjects = portfolio.projects
    .map(project => filterProject(project, selectedTags))
    .filter(project => project.goals.length > 0);

  return {
    ...portfolio,
    projects: filteredProjects,
  };
}

function filterProject(project: Project, selectedTags: string[]): Project {
  const filteredGoals = project.goals
    .map(goal => filterGoal(goal, selectedTags))
    .filter(goal => goal.records.length > 0);

  return {
    ...project,
    goals: filteredGoals,
  };
}

function filterGoal(goal: Goal, selectedTags: string[]): Goal {
  const filteredRecords = goal.records.filter(record =>
    selectedTags.some(tag => record.tags.includes(tag))
  );

  return {
    ...goal,
    records: filteredRecords,
  };
}

export function findRecordById(projects: Project[], recordId: string): Record | null {
  for (const project of projects) {
    for (const goal of project.goals) {
      const record = goal.records.find(r => r.id === recordId);
      if (record) return record;
    }
  }
  return null;
}

export function findProjectBySlug(projects: Project[], slug: string): Project | null {
  return projects.find(p => p.slug === slug) || null;
}

export function findGoalBySlug(project: Project, slug: string): Goal | null {
  return project.goals.find(g => g.slug === slug) || null;
}
