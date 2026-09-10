/** The decisive moment. Legacy records carry a single string; new records carry
 *  a structured AI-vs-builder contrast {ai, builder, why}. The UI renders both. */
export type Judgment = string | { ai?: string; builder?: string; why?: string };
export type Highlight = Judgment;  // v3 name; same shape

/** A named narrative block parsed from body_md / legacy body markdown H2 headers. */
export interface NarrativeSection {
  heading: string;   // e.g. "Context", "How it converged", "Result"
  body: string;      // markdown/plain text under that heading
}

/** Builder lifecycle stages (v3). The section is the process spine + cross-project axis. */
export const SECTIONS = ['Think', 'Plan', 'Build', 'Review', 'Test', 'Ship', 'Reflect'] as const;
export type SectionStage = typeof SECTIONS[number] | string;

export const SECTION_META: { [k: string]: { color: string; order: number } } = {
  Think:   { color: 'var(--cat-research)',    order: 0 },
  Plan:    { color: 'var(--cat-planning)',    order: 1 },
  Build:   { color: 'var(--cat-engineering)', order: 2 },
  Review:  { color: 'var(--cat-design)',      order: 3 },
  Test:    { color: 'var(--cat-research)',    order: 4 },
  Ship:    { color: 'var(--cat-growth)',      order: 5 },
  Reflect: { color: 'var(--cat-planning)',    order: 6 },
};

/** Task progress — builder-facing, not PM status. */
export type Progress = 'done' | 'ongoing' | 'dropped' | 'undecided';
export const PROGRESS_META: { [k in Progress]: { label: string; color: string } } = {
  done:      { label: 'Done',      color: 'var(--cat-growth)' },
  ongoing:   { label: 'Ongoing',   color: 'var(--cat-planning)' },
  dropped:   { label: 'Dropped',   color: 'var(--muted-foreground)' },
  undecided: { label: 'Undecided', color: 'var(--cat-research)' },
};

export interface Evidence {
  label: string;
  url?: string;
  type?: 'input' | 'judgment' | 'quote' | 'artifact' | 'github' | 'doc' | 'figma' | 'loom' | 'other';
  meta?: string;    // e.g. "+412 −80, 7 files" or "6 respondents, 12k words"
  detail?: string;  // for judgment: why it was rejected/changed
  quote?: string;   // verbatim line from source or output
  path?: string;    // local image path for screenshots
}

export const CATEGORY_META: { [k: string]: { color: string } } = {
  Planning:    { color: 'var(--cat-planning)' },
  Design:      { color: 'var(--cat-design)' },
  Engineering: { color: 'var(--cat-engineering)' },
  Research:    { color: 'var(--cat-research)' },
  Growth:      { color: 'var(--cat-growth)' },
};

export interface Record {
  id: string;
  title: string;
  summary: string;
  tags: string[];            // combined (mindset + tool), used for filtering
  mindsetTags?: string[];    // mindset category tags
  toolTags?: string[];       // tool category tags
  created_at: string;
  updated_at?: string;
  content: string;           // work detail (side panel body)
  body?: string;             // raw markdown body from record.json
  judgment?: Judgment | null; // the decisive moment (string = legacy, object = AI-vs-builder)
  category?: string | null;  // legacy v2 category

  // ── v3 task fields ──
  date?: string;             // YYYY-MM-DD display date
  section?: SectionStage;    // lifecycle stage (Think/Plan/Build/...)
  subPurpose?: string | null;    // the specific aim of this task
  tools?: string[];          // AI tools/stacks used
  mindset?: string[];        // mindset tags (v3 explicit field)
  progress?: Progress | null;    // done | ongoing | dropped | undecided
  highlight?: Highlight | null;  // v3 name for judgment
  narrative?: NarrativeSection[];// parsed body_md/body into named blocks

  result?: string;           // result one-liner
  file_path: string;
  folder?: string;           // folder name e.g. 20260905-000-title-slug
  status?: string;           // completed | in_progress | blocked | shared | draft
  share_id?: string | null;
  project_slug?: string;
  goal_slug?: string;
  // Context breadcrumb (populated at load time)
  projectId?: string;
  projectTitle?: string;
  goalId?: string;
  goalTitle?: string;
  // Evidence & media
  evidence?: Evidence[];
  images?: string[];
}

export interface Goal {
  id: string;
  slug: string;
  title: string;
  stage?: SectionStage;      // v3 lifecycle stage (defaults to title if absent)
  order?: number;            // lifecycle order for stable section-box layout
  description?: string;
  created_at?: string;
  records: Record[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  name?: string;             // v3 alias of title
  sector?: string;           // v3 — e.g. "Marketplace SaaS"
  oneLiner?: string;         // v3 — one-line description
  role?: string;             // v3 — e.g. "Zero-to-One"
  logo?: string | null;      // v3 — optional logo path
  tags?: string[];           // v3 — project-level tags
  description?: string;
  created_at?: string;
  goals: Goal[];             // sections live here (goal.json on disk)
}

export interface Portfolio {
  path: string;
  projects: Project[];
}

// Tag taxonomy: category name -> list of tags in that category
export type TagCategories = { [category: string]: string[] };

export interface ParsedFrontMatter {
  id: string;
  project_id: string;
  project_slug: string;
  goal_id: string;
  goal_slug: string;
  goal_title: string;
  title: string;
  summary: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
  status?: string;
  [key: string]: any;
}
