export interface Record {
  id: string;
  title: string;
  summary: string;
  tags: string[];
  created_at: string;
  updated_at?: string;
  content: string;
  file_path: string;
  status?: string;
}

export interface Goal {
  id: string;
  slug: string;
  title: string;
  records: Record[];
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  goals: Goal[];
}

export interface Portfolio {
  path: string;
  projects: Project[];
}

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
