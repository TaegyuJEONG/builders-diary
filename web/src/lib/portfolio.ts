import { Portfolio, Record, Project, ToolCategory, ToolboxGroup, TOOL_CATEGORIES } from './types';
import { mockPortfolioV2 } from './mockData';
import { SelectOption } from '@/components/SearchableSelect';

/** Legacy mock category → lifecycle section, so ?demo=1 renders the 3-level view. */
const MOCK_CATEGORY_TO_SECTION: { [k: string]: string } = {
  Planning: 'Discovery', Research: 'Discovery',
  Design: 'Build', Engineering: 'Build', Growth: 'Growth',
};

const TOOL_CATEGORY_ORDER: ToolCategory[] = TOOL_CATEGORIES;

/** Read the category assigned by the source; never infer one from a name/topic. */
export function classifyTool(tool: string, categories?: { [category in ToolCategory]?: string[] }): ToolCategory {
  if (categories) {
    for (const category of TOOL_CATEGORIES) if ((categories[category] || []).includes(tool)) return category;
  }
  return 'Other';
}

/** Project Toolbox is derived from confirmed task tools; no separate form field. */
export function buildProjectToolbox(project: Project): ToolboxGroup[] {
  const byCategory = new Map<ToolCategory, Set<string>>();
  for (const goal of project.goals) {
    for (const record of goal.records) {
      for (const tool of record.tools || record.toolTags || []) {
        const name = tool.trim();
        if (!name) continue;
        const category = classifyTool(name, record.toolCategories);
        if (!byCategory.has(category)) byCategory.set(category, new Set());
        byCategory.get(category)!.add(name);
      }
    }
  }
  return TOOL_CATEGORY_ORDER
    .filter(category => byCategory.has(category))
    .map(category => ({ category, tools: Array.from(byCategory.get(category)!).sort((a, b) => a.localeCompare(b)) }));
}

/** Convert the V2 mock into the runtime Portfolio shape. */
export function convertMockToPortfolio(): Portfolio {
  return {
    path: '/portfolio (mock)',
    projects: mockPortfolioV2.projects.map(proj => ({
      id: proj.id,
      slug: proj.id.replace(/^project-/, ''),
      title: proj.title,
      name: proj.title,
      sector: (proj as any).sector,
      oneLiner: proj.description,
      role: (proj as any).role,
      description: proj.description,
      goals: proj.goals.map(goal => ({
        id: goal.id,
        slug: goal.id.replace(/^goal-/, ''),
        title: goal.title,
        description: goal.description,
        records: goal.cards.map(card => {
          const section = card.category ? (MOCK_CATEGORY_TO_SECTION[card.category] || card.category) : undefined;
          return {
            id: card.id,
            title: card.title,
            summary: card.summary,
            content: card.content,
            result: card.result,
            tags: [...card.mindsetTags, ...card.toolTags],
            mindsetTags: card.mindsetTags,
            toolTags: card.toolTags,
            mindset: card.mindsetTags,
            tools: card.toolTags,
            created_at: card.created_at,
            date: card.created_at,
            status: card.status,
            category: card.category ?? null,
            section,
            judgment: card.judgment ?? null,
            highlight: card.judgment ?? null,
            file_path: `content/${proj.id}/goals/${goal.id}/records/${card.id}.md`,
            projectId: proj.id,
            projectTitle: proj.title,
            goalId: goal.id,
            goalTitle: goal.title,
            evidence: card.evidence,
            images: card.images,
          } as Record;
        }),
      })),
    })),
  };
}

/** Build grouped tag options with occurrence counts across the whole portfolio. */
export function buildTagOptions(portfolio: Portfolio): {
  mindset: SelectOption[];
  tool: SelectOption[];
  toolCategory: SelectOption[];
  activity: SelectOption[];
} {
  const mindsetCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();
  const activityCounts = new Map<string, number>();
  const toolCategoryCounts = new Map<string, number>();
  for (const p of portfolio.projects) {
    for (const g of p.goals) {
      for (const r of g.records) {
        for (const t of r.mindset || r.mindsetTags || []) {
          const name = t.trim();
          if (name) mindsetCounts.set(name, (mindsetCounts.get(name) || 0) + 1);
        }
        for (const t of r.tools || r.toolTags || []) {
          const name = t.trim();
          if (name) toolCounts.set(name, (toolCounts.get(name) || 0) + 1);
        }
        for (const category of Object.keys(r.toolCategories || {})) {
          toolCategoryCounts.set(category, (toolCategoryCounts.get(category) || 0) + 1);
        }
        for (const activity of r.activities || []) {
          const name = activity.trim();
          if (name) activityCounts.set(name, (activityCounts.get(name) || 0) + 1);
        }
      }
    }
  }
  const toOptions = (counts: Map<string, number>) => [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, label: value, count }));
  const mindset = toOptions(mindsetCounts);
  const tool = toOptions(toolCounts);
  const toolCategory = toOptions(toolCategoryCounts);
  const activity = toOptions(activityCounts);
  return { mindset, tool, toolCategory, activity };
}

export interface FilterState {
  mindset: string[];
  tools: string[];
  toolCategories?: string[];
  keyword: string;
  stage?: string | null;
  activity?: string | null;
}

export function recordPasses(r: Record, f: FilterState): boolean {
  if (f.stage && r.section !== f.stage) return false;
  if (f.activity && !(r.activities || []).includes(f.activity)) return false;
  if (f.mindset.length > 0) {
    const rm = r.mindset || r.mindsetTags || [];
    if (!f.mindset.some(t => rm.includes(t))) return false;
  }
  if (f.tools.length > 0) {
    const rt = r.tools || r.toolTags || [];
    if (!f.tools.some(t => rt.includes(t))) return false;
  }
  if ((f.toolCategories || []).length > 0) {
    const categories = Object.keys(r.toolCategories || {});
    if (!(f.toolCategories || []).some(category => categories.includes(category))) return false;
  }
  if (f.keyword.trim()) {
    const k = f.keyword.trim().toLowerCase();
    const hay = (
      (r.title || '') + ' ' + (r.summary || '') + ' ' + (r.content || '') + ' ' + (r.tags || []).join(' ')
    ).toLowerCase();
    if (!hay.includes(k)) return false;
  }
  return true;
}

export function scopedRecords(
  portfolio: Portfolio,
  projectId: string | null,
  goalId: string | null,
  f: FilterState,
): Record[] {
  let base: Record[] = [];
  if (projectId) {
    const p = portfolio.projects.find(pp => pp.id === projectId);
    if (p) {
      if (goalId) {
        base = p.goals.find(g => g.id === goalId)?.records || [];
      } else {
        base = p.goals.flatMap(g => g.records);
      }
    }
  } else if (goalId) {
    // No project selected but a goal is — filter that goal across all projects.
    base = portfolio.projects.flatMap(p =>
      p.goals.filter(g => g.id === goalId).flatMap(g => g.records)
    );
  } else {
    base = portfolio.projects.flatMap(p => p.goals.flatMap(g => g.records));
  }
  return base.filter(r => recordPasses(r, f));
}

export function visibleCountByGoal(
  project: Project | undefined,
  f: FilterState,
): { [goalId: string]: number } {
  const out: { [goalId: string]: number } = {};
  if (!project) return out;
  for (const g of project.goals) {
    out[g.id] = g.records.filter(r => recordPasses(r, f)).length;
  }
  return out;
}
