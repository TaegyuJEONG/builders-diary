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
  judgment?: string | null;  // the AI-proposed option rejected/changed + why
  category?: string | null;  // Planning | Design | Engineering | Research | Growth
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
  description?: string;
  created_at?: string;
  records: Record[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  description?: string;
  created_at?: string;
  goals: Goal[];
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
