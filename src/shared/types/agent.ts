import { ChapterOutline, TaskBlock } from './course';

export interface AgentGenerationRequest {
  courseId: string;
  phase: 'outline' | 'content' | 'section-update';
  instructions: string;
  targetChapter?: string;
  targetSection?: string;
}

export interface AgentEvaluationRequest {
  courseId: string;
  sectionFile: string;
  taskBlock: TaskBlock;
  scratchFiles: Array<{ path: string; content: string }>;
}

export interface AgentCompleteEvent {
  jobId: string;
  outline?: ChapterOutline[];
  pass?: boolean;
  feedback?: string;
}

export interface EvaluationResult {
  jobId: string;
  pass: boolean;
  feedback: string;
}
