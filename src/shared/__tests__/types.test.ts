import { describe, it, expectTypeOf } from 'vitest'
import type {
  ModeType,
  CourseMetadata,
  ChapterMetadata,
  SectionFrontmatter,
  TaskBlock,
  ChapterOutline,
} from '../types/course'
import type {
  SectionProgress,
  ChapterProgress,
  PRInfo,
  CourseState,
  AppState,
} from '../types/state'
import type { RegistryCourse } from '../types/registry'
import type {
  AgentGenerationRequest,
  AgentEvaluationRequest,
  EvaluationResult,
  AgentCompleteEvent,
} from '../types/agent'
import type { PrerequisitesResult, GitStatus, FSEntry, ModeSetResult } from '../ipc'

describe('shared types - compile-time shape verification', () => {
  it('ModeType is "learn" | "create"', () => {
    const learn: ModeType = 'learn'
    const create: ModeType = 'create'
    expectTypeOf<ModeType>().toEqualTypeOf<'learn' | 'create'>()
    expectTypeOf(learn).toMatchTypeOf<ModeType>()
    expectTypeOf(create).toMatchTypeOf<ModeType>()
  })

  it('AppState satisfies interface shape', () => {
    const state: AppState = {
      version: 1,
      agentPreference: null,
      courses: {},
    }
    expectTypeOf(state).toMatchTypeOf<AppState>()
  })

  it('CourseState satisfies interface shape', () => {
    const cs: CourseState = {
      id: 'abc',
      name: 'my-course',
      title: 'My Course',
      localPath: '/home/user/.opencourses/courses/my-course',
      scratchPath: '/home/user/.opencourses/courses/my-course/scratch',
      sourceRepo: 'https://github.com/foo/bar',
      courseRepo: 'https://github.com/foo/my-course',
      activeMode: 'learn',
      activeBranch: 'main',
      creationBranch: null,
      creationPR: { number: null, url: null, state: null },
      activeSection: null,
      learnerProgress: {},
      addedAt: new Date().toISOString(),
    }
    expectTypeOf(cs).toMatchTypeOf<CourseState>()
  })

  it('PRInfo state is open | merged | closed | null', () => {
    const pr: PRInfo = { number: 1, url: 'https://github.com/foo/bar/pull/1', state: 'open' }
    expectTypeOf(pr).toMatchTypeOf<PRInfo>()
  })

  it('RegistryCourse has required fields', () => {
    const rc: RegistryCourse = {
      id: 'rc-1',
      title: 'Test Course',
      description: 'A test',
      tags: ['ts'],
      objective: 'Learn TS',
      courseRepo: 'https://github.com/foo/course',
      sourceRepo: 'https://github.com/foo/source',
      authorGitHub: 'foo',
      latestVersion: '1.0.0',
      addedAt: new Date().toISOString(),
    }
    expectTypeOf(rc).toMatchTypeOf<RegistryCourse>()
  })

  it('AgentGenerationRequest has courseId, phase, instructions', () => {
    const req: AgentGenerationRequest = {
      courseId: 'abc',
      phase: 'outline',
      instructions: 'Build a course about TypeScript generics',
    }
    expectTypeOf(req).toMatchTypeOf<AgentGenerationRequest>()
  })

  it('EvaluationResult has pass and feedback', () => {
    const result: EvaluationResult = {
      jobId: 'job-1',
      pass: true,
      feedback: 'All criteria met.',
    }
    expectTypeOf(result).toMatchTypeOf<EvaluationResult>()
  })

  it('PrerequisitesResult has missing array and agentCLI', () => {
    const pr: PrerequisitesResult = {
      missing: ['claude'],
      agentCLI: null,
    }
    expectTypeOf(pr).toMatchTypeOf<PrerequisitesResult>()
  })

  it('GitStatus has clean boolean and arrays', () => {
    const status: GitStatus = {
      clean: true,
      modified: [],
      untracked: [],
      staged: [],
    }
    expectTypeOf(status).toMatchTypeOf<GitStatus>()
  })

  it('FSEntry has name, path, isDirectory', () => {
    const entry: FSEntry = {
      name: 'file.ts',
      path: '/foo/file.ts',
      isDirectory: false,
    }
    expectTypeOf(entry).toMatchTypeOf<FSEntry>()
  })

  it('ModeSetResult union covers ok, needs-branch-name, pr-merged', () => {
    const ok: ModeSetResult = { status: 'ok', mode: 'learn', branch: 'main' }
    const needsBranch: ModeSetResult = { status: 'needs-branch-name' }
    const merged: ModeSetResult = { status: 'pr-merged', prUrl: 'https://github.com/pr/1' }
    expectTypeOf(ok).toMatchTypeOf<ModeSetResult>()
    expectTypeOf(needsBranch).toMatchTypeOf<ModeSetResult>()
    expectTypeOf(merged).toMatchTypeOf<ModeSetResult>()
  })

  it('ChapterOutline has title, description, sections array', () => {
    const outline: ChapterOutline = {
      title: 'Chapter 1',
      description: 'Intro',
      sections: [{ title: 'Sec 1', description: 'First', hasTask: false }],
    }
    expectTypeOf(outline).toMatchTypeOf<ChapterOutline>()
  })

  it('TaskBlock has id, title, objective, hints, criteria', () => {
    const task: TaskBlock = {
      id: 'task-01',
      title: 'Build it',
      objective: 'Implement X',
      hints: ['hint 1'],
      criteria: ['criterion 1'],
    }
    expectTypeOf(task).toMatchTypeOf<TaskBlock>()
  })
})
