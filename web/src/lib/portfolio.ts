import { Portfolio, Record, Project, ToolCategory, ToolboxGroup } from './types';
import { mockPortfolioV2 } from './mockData';
import { SelectOption } from '@/components/SearchableSelect';

/** Legacy mock category → lifecycle section, so ?demo=1 renders the 3-level view. */
const MOCK_CATEGORY_TO_SECTION: { [k: string]: string } = {
  Planning: 'Discovery', Research: 'Discovery',
  Design: 'Build', Engineering: 'Build', Growth: 'Growth',
};

const TOOL_CATEGORY_ORDER: ToolCategory[] = [
  'Coding agent',
  'Programming language',
  'Framework / library',
  'Data / backend',
  'Deployment / infrastructure',
  'Research / validation',
  'Other',
];

/** Categorize display names without changing stored task-level tool strings. */
export function classifyTool(tool: string): ToolCategory {
  const t = tool.trim().toLowerCase();
  if (/claude|cursor|windsurf|codex|antigravity|cline|chatgpt/.test(t)) return 'Coding agent';
  if (/react|next|vite|fastapi|flask|django|node|express|web worker|tailwind|pandas/.test(t)) return 'Framework / library';
  if (/python|typescript|javascript|js|ts|rust|golang|go|java|kotlin|swift|sql/.test(t)) return 'Programming language';
  if (/supabase|postgres|postgresql|mysql|sqlite|redis|mongodb|database|prisma/.test(t)) return 'Data / backend';
  if (/vercel|railway|docker|github actions|cloud run|aws|gcp|google cloud|kubernetes|netlify/.test(t)) return 'Deployment / infrastructure';
  if (/lighthouse|chrome devtools|browser|web search|figma|playwright|testing|benchmark/.test(t)) return 'Research / validation';
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
        const category = classifyTool(name);
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
            progress: card.status === 'in_progress' ? 'ongoing' : (card.status === 'blocked' ? 'undecided' : 'done'),
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
} {
  const mindsetCounts = new Map<string, number>();
  const toolCounts = new Map<string, number>();
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
      }
    }
  }
  const toOptions = (counts: Map<string, number>) => [...counts.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([value, count]) => ({ value, label: value, count }));
  const mindset = toOptions(mindsetCounts);
  const tool = toOptions(toolCounts);
  return { mindset, tool };
}

export interface FilterState {
  mindset: string[];
  tools: string[];
  keyword: string;
  stage?: string | null;
}

export function recordPasses(r: Record, f: FilterState): boolean {
  if (f.stage && r.section !== f.stage) return false;
  if (f.mindset.length > 0) {
    const rm = r.mindset || r.mindsetTags || [];
    if (!f.mindset.some(t => rm.includes(t))) return false;
  }
  if (f.tools.length > 0) {
    const rt = r.tools || r.toolTags || [];
    if (!f.tools.some(t => rt.includes(t))) return false;
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
