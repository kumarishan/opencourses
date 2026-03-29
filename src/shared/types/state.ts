import { ModeType } from './course';

export interface SectionProgress {
  completed: boolean;
  completedAt: string | null;
}

export interface ChapterProgress {
  completed: boolean;
  sections: Record<string, SectionProgress>;
}

export interface PRInfo {
  number: number | null;
  url: string | null;
  state: 'open' | 'merged' | 'closed' | null;
}

export interface CourseState {
  id: string;
  name: string;
  title: string;
  localPath: string;
  scratchPath: string;
  sourceRepo: string;
  courseRepo: string;
  activeMode: ModeType;
  activeBranch: string;
  creationBranch: string | null;
  creationPR: PRInfo;
  activeSection: { chapterId: string; sectionFile: string } | null;
  learnerProgress: Record<string, ChapterProgress>;
  addedAt: string;
}

export interface AppState {
  version: number;
  agentPreference: 'claude' | 'codex' | null;
  courses: Record<string, CourseState>;
}
