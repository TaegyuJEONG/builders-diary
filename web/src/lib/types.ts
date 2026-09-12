/** The decisive moment. Legacy records carry a single string; new records carry
 *  a structured AI-vs-builder contrast {ai, builder, why}. The UI renders both. */
export type Judgment = string | { ai?: string; builder?: string; why?: string };
export type Highlight = Judgment;  // v3 name; same shape

/** A named narrative block parsed from body_md / legacy body markdown H2 headers. */
export interface NarrativeSection {
  heading: string;   // e.g. "Context", "How it converged", "Result"
  body: string;      // markdown/plain text under that heading
}

/** Builder lifecycle stages (v4): find the problem, make it, meet the market.
 *  Users can add/rename/remove/reorder these via stages.json in their data root,
 *  so nothing here may be treated as a closed set. */
export const DEFAULT_STAGES = ['Discovery', 'Build', 'Growth'] as const;
export const SECTIONS = DEFAULT_STAGES;
export type SectionStage = string;

/** Legacy v2/v3 stage names → the three defaults. Applied only when the name is
 *  not one of the builder's own configured stages. */
export const LEGACY_STAGE_ALIASES: { [k: string]: string } = {
  think: 'Discovery', plan: 'Discovery', research: 'Discovery', planning: 'Discovery',
  build: 'Build', review: 'Build', test: 'Build', design: 'Build', engineering: 'Build',
  ship: 'Growth', reflect: 'Growth', growth: 'Growth',
};

const STAGE_PALETTE = [
  'var(--cat-research)', 'var(--cat-engineering)', 'var(--cat-growth)',
  'var(--cat-planning)', 'var(--cat-design)',
];

/** Colour/order for the default stages. Custom stages fall back to
 *  stageMeta(), which assigns a palette colour by position. */
export const SECTION_META: { [k: string]: { color: string; order: number } } = {
  Discovery: { color: 'var(--cat-research)',    order: 0 },
  Build:     { color: 'var(--cat-engineering)', order: 1 },
  Growth:    { color: 'var(--cat-growth)',      order: 2 },
};

/** Resolve a stage name against the builder's configured stage list. */
export function normalizeStage(stage: string | undefined, configured: string[] = [...DEFAULT_STAGES]): string {
  const name = (stage || '').trim();
  if (!name) return '';
  const own = configured.find(s => s.toLowerCase() === name.toLowerCase());
  if (own) return own;
  const mapped = LEGACY_STAGE_ALIASES[name.toLowerCase()];
  if (!mapped) return name;
  return configured.find(s => s.toLowerCase() === mapped.toLowerCase()) || mapped;
}

/** Display metadata for any stage, including user-defined ones. */
export function stageMeta(stage: string, configured: string[] = [...DEFAULT_STAGES]): { color: string; order: number } {
  const index = configured.findIndex(s => s.toLowerCase() === (stage || '').toLowerCase());
  if (index >= 0) {
    return SECTION_META[configured[index]] ?? { color: STAGE_PALETTE[index % STAGE_PALETTE.length], order: index };
  }
  return SECTION_META[stage] ?? { color: 'var(--text3)', order: 900 };
}

/** Task progress — builder-facing, not PM status. */
export type Progress = 'done' | 'ongoing' | 'dropped' | 'undecided';

/** A project has a third-party-readable story; a learning entry is skill
 *  acquisition that belongs to no single product storyline. */
export type EntryType = 'project' | 'learning';
export const ENTRY_TYPES: EntryType[] = ['project', 'learning'];
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
  visibility?: 'private' | 'approved';
  source_path?: string; // local trace; never shown to recruiters
  artifact_path?: string; // copied, approved artifact inside the data root
}

export type ToolCategory =
  | 'Coding agent'
  | 'Programming language'
  | 'Framework / library'
  | 'Data / backend'
  | 'Deployment / infrastructure'
  | 'Research / validation'
  | 'Other';

export interface ToolboxGroup {
  category: ToolCategory;
  tools: string[];
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
  section?: SectionStage;    // lifecycle stage (Discovery/Build/Growth or custom)
  entryType?: EntryType;     // project (has a story) | learning (skill acquisition)
  purpose?: string | null;       // the specific aim of this task
  subPurpose?: string | null;    // legacy alias; read-only compatibility
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
  // `goal.json` remains the compatibility filename; this is the human-facing Purpose.
  id: string;
  slug: string;
  title: string;
  // A Purpose spans the lifecycle and has NO stage of its own; each Task carries
  // its own `section`. `stage`/`order` survive only to read pre-v4 folders.
  stage?: SectionStage;
  order?: number;
  description?: string;
  created_at?: string;
  records: Record[];
}

export interface ImportRun {
  id: string;
  source: string;
  status: string;
  created_at: string;
  counts?: {
    chat_conversations?: number;
    chat_projects?: number;
    code_sessions?: number;
    code_workspaces?: number;
  };
  warnings?: string[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  name?: string;             // v3 alias of title
  type?: EntryType;          // project (default) | learning
  order?: number;            // user-defined portfolio order
  sector?: string;           // v3 — e.g. "Marketplace SaaS"
  oneLiner?: string;         // v3 — one-line description
  role?: string;             // legacy optional metadata; not inferred or displayed
  logo?: string | null;      // v3 — optional logo path
  tags?: string[];           // v3 — project-level tags
  description?: string;
  created_at?: string;
  goals: Goal[];             // Purposes stored as goal.json folders for compatibility
}

export interface Portfolio {
  path: string;
  projects: Project[];
  /** The builder's configured stage list; defaults when stages.json is absent. */
  stages?: string[];
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
