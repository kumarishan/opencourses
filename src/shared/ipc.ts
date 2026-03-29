import type { ModeType, ChapterOutline } from './types/course'
import type { CourseState, AppState, PRInfo } from './types/state'
import type { RegistryCourse } from './types/registry'
import type {
  AgentGenerationRequest,
  AgentEvaluationRequest,
  EvaluationResult,
  AgentCompleteEvent,
} from './types/agent'

export type { ModeType, ChapterOutline, CourseState, AppState, PRInfo, RegistryCourse }
export type {
  AgentGenerationRequest,
  AgentEvaluationRequest,
  EvaluationResult,
  AgentCompleteEvent,
}

export const IPC = {
  prerequisites: {
    get: 'prerequisites/get',
  },
  registry: {
    list: 'registry/list',
    refresh: 'registry/refresh',
  },
  courses: {
    list: 'courses/list',
    add: 'courses/add',
    remove: 'courses/remove',
    setMode: 'courses/setMode',
    getProgress: 'courses/getProgress',
    markSectionComplete: 'courses/markSectionComplete',
    setActiveSection: 'courses/setActiveSection',
  },
  git: {
    clone: 'git/clone',
    listBranches: 'git/listBranches',
    createBranch: 'git/createBranch',
    checkout: 'git/checkout',
    commitAndPush: 'git/commitAndPush',
    discard: 'git/discard',
    status: 'git/status',
  },
  github: {
    createPR: 'github/createPR',
    getPRState: 'github/getPRState',
    createRelease: 'github/createRelease',
    submitRegistryPR: 'github/submitRegistryPR',
  },
  agent: {
    startGeneration: 'agent/startGeneration',
    evaluate: 'agent/evaluate',
    cancel: 'agent/cancel',
    streamChunk: 'agent:stream-chunk',
    complete: 'agent:complete',
    error: 'agent:error',
    evaluationResult: 'agent:evaluation-result',
  },
  terminal: {
    create: 'terminal/create',
    input: 'terminal/input',
    resize: 'terminal/resize',
    destroy: 'terminal/destroy',
    data: 'terminal:data',
  },
  fs: {
    read: 'fs/read',
    write: 'fs/write',
    list: 'fs/list',
    watch: 'fs/watch',
    unwatch: 'fs/unwatch',
    changed: 'fs:changed',
  },
} as const;

// ─── Request / Response types ──────────────────────────────────────────────

export interface PrerequisitesResult {
  missing: Array<'git' | 'gh' | 'claude' | 'codex'>
  agentCLI: 'claude' | 'codex' | null
}

export interface AddCourseRequest {
  courseRepo: string
  sourceRepo?: string
  scratchPath?: string
}

export type ModeSetResult =
  | { status: 'ok'; mode: ModeType; branch: string }
  | { status: 'needs-branch-name' }
  | { status: 'pr-merged'; prUrl: string }

export interface GitStatus {
  clean: boolean
  modified: string[]
  untracked: string[]
  staged: string[]
}

export interface GitLogEntry {
  hash: string
  message: string
  date: string
}

export interface FSEntry {
  name: string
  path: string
  isDirectory: boolean
}

export interface CreatePRRequest {
  cwd: string
  title: string
  body?: string
  base?: string
}

export interface CreateReleaseRequest {
  cwd: string
  tag: string
  title: string
  notes?: string
}

export interface ReleaseInfo {
  tag: string
  url: string
  title: string
}

export interface AgentStreamChunkEvent {
  jobId: string
  chunk: string
}

export interface AgentErrorEvent {
  jobId: string
  error: string
}

export interface TerminalDataEvent {
  sessionId: string
  data: string
}

export interface FSChangedEvent {
  watchId: string
  path: string
}

export type LearnerProgress = Record<string, import('./types/state').ChapterProgress>
