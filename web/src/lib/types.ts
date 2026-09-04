export interface Record {
  id: string;
  title: string;
  summary: string;
  tags: string[];            // combined (mindset + tool), used for filtering
  mindsetTags?: string[];    // 마인드셋 category tags
  toolTags?: string[];       // 도구 category tags
  created_at: string;
  updated_at?: string;
  content: string;           // 작업 상세 (side panel body)
  result?: string;           // 결과 한 줄
  file_path: string;
  status?: string;           // completed | in_progress | blocked
}

export interface Goal {
  id: string;
  slug: string;
  title: string;
  description?: string;
  records: Record[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  description?: string;
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
