export type ModeType = 'learn' | 'create';

export interface CourseMetadata {
  id: string;
  title: string;
  description: string;
  objective: string;
  version: string;
  sourceRepo: string;
  courseRepo: string;
  registryEntry: {
    title: string;
    description: string;
    tags: string[];
  };
  createdAt: string;
  updatedAt: string;
}

export interface ChapterMetadata {
  id: string;
  title: string;
  description: string;
  order: number;
}

export interface SectionFrontmatter {
  id: string;
  title: string;
  order: number;
  hasTask: boolean;
}

export interface TaskBlock {
  id: string;
  title: string;
  objective: string;
  hints: string[];
  criteria: string[];
}

export interface ChapterOutline {
  title: string;
  description: string;
  sections: Array<{
    title: string;
    description: string;
    hasTask: boolean;
  }>;
}
