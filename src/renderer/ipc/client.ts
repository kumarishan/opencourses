import {
  IPC,
  type AddCourseRequest,
  type AgentEvaluationRequest,
  type AgentGenerationRequest,
  type CourseState,
  type CreatePRRequest,
  type CreateReleaseRequest,
  type EvaluationResult,
  type FSEntry,
  type GitStatus,
  type LearnerProgress,
  type ModeSetResult,
  type ModeType,
  type PRInfo,
  type PrerequisitesResult,
  type RegistryCourse,
  type ReleaseInfo,
} from '@shared/ipc'

declare global {
  interface Window {
    electron: {
      invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
      on: (
        channel: string,
        listener: (event: unknown, ...args: unknown[]) => void
      ) => () => void
      off: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
    }
  }
}

type ErrorResult = { error?: { code: string; message: string } }

export class IPCError extends Error {
  constructor(
    public readonly code: string,
    message: string
  ) {
    super(message)
    this.name = 'IPCError'
  }
}

function handleResult<T>(result: unknown): T {
  const maybeError = result as ErrorResult
  if (maybeError?.error) {
    throw new IPCError(maybeError.error.code, maybeError.error.message)
  }

  return result as T
}

async function invoke<T>(channel: string, ...args: unknown[]): Promise<T> {
  return handleResult<T>(await window.electron.invoke(channel, ...args))
}

export async function getPrerequisites(): Promise<PrerequisitesResult> {
  return invoke<PrerequisitesResult>(IPC.prerequisites.get)
}

export async function listRegistry(): Promise<RegistryCourse[]> {
  return invoke<RegistryCourse[]>(IPC.registry.list)
}

export async function refreshRegistry(): Promise<RegistryCourse[]> {
  return invoke<RegistryCourse[]>(IPC.registry.refresh)
}

export async function listCourses(): Promise<CourseState[]> {
  return invoke<CourseState[]>(IPC.courses.list)
}

export async function addCourse(req: AddCourseRequest): Promise<CourseState> {
  return invoke<CourseState>(IPC.courses.add, req)
}

export async function removeCourse(courseId: string): Promise<void> {
  await invoke(IPC.courses.remove, courseId)
}

export async function setMode(courseId: string, mode: ModeType): Promise<ModeSetResult> {
  return invoke<ModeSetResult>(IPC.courses.setMode, courseId, mode)
}

export async function getCourseProgress(courseId: string): Promise<LearnerProgress> {
  return invoke<LearnerProgress>(IPC.courses.getProgress, courseId)
}

export async function markSectionComplete(
  courseId: string,
  chapterId: string,
  sectionFile: string
): Promise<void> {
  await invoke(IPC.courses.markSectionComplete, courseId, chapterId, sectionFile)
}

export async function setActiveSection(
  courseId: string,
  chapterId: string,
  sectionFile: string
): Promise<void> {
  await invoke(IPC.courses.setActiveSection, courseId, chapterId, sectionFile)
}

export async function gitClone(url: string, dest: string): Promise<void> {
  await invoke(IPC.git.clone, url, dest)
}

export async function gitListBranches(courseId: string): Promise<string[]> {
  const result = await invoke<{ branches: string[] }>(IPC.git.listBranches, courseId)
  return result.branches
}

export async function gitCreateBranch(courseId: string, name: string): Promise<void> {
  await invoke(IPC.git.createBranch, courseId, name)
}

export async function gitCheckout(courseId: string, branch: string): Promise<void> {
  await invoke(IPC.git.checkout, courseId, branch)
}

export async function gitCommitAndPush(courseId: string, message: string): Promise<void> {
  await invoke(IPC.git.commitAndPush, courseId, message)
}

export async function gitDiscard(courseId: string): Promise<void> {
  await invoke(IPC.git.discard, courseId)
}

export async function gitStatus(courseId: string): Promise<GitStatus> {
  const result = await invoke<{ status: GitStatus }>(IPC.git.status, courseId)
  return result.status
}

export async function createPR(req: CreatePRRequest): Promise<PRInfo> {
  return invoke<PRInfo>(IPC.github.createPR, req)
}

export async function getPRState(courseId: string, prNumber: number): Promise<PRInfo> {
  return invoke<PRInfo>(IPC.github.getPRState, courseId, prNumber)
}

export async function createRelease(req: CreateReleaseRequest): Promise<ReleaseInfo> {
  return invoke<ReleaseInfo>(IPC.github.createRelease, req)
}

export async function submitRegistryPR(
  courseId: string,
  registryRepoOwner: string
): Promise<PRInfo> {
  return invoke<PRInfo>(IPC.github.submitRegistryPR, courseId, registryRepoOwner)
}

export async function startAgentGeneration(
  req: AgentGenerationRequest
): Promise<{ jobId: string }> {
  return invoke<{ jobId: string }>(IPC.agent.startGeneration, req)
}

export async function agentEvaluate(
  req: AgentEvaluationRequest
): Promise<{ jobId: string }> {
  return invoke<{ jobId: string }>(IPC.agent.evaluate, req)
}

export async function agentCancel(jobId: string): Promise<void> {
  await invoke(IPC.agent.cancel, jobId)
}

export async function createTerminal(
  courseId: string,
  cwd?: string
): Promise<{ sessionId: string }> {
  return invoke<{ sessionId: string }>(IPC.terminal.create, { courseId, cwd })
}

export async function terminalInput(sessionId: string, data: string): Promise<void> {
  await invoke(IPC.terminal.input, { sessionId, data })
}

export async function terminalResize(
  sessionId: string,
  cols: number,
  rows: number
): Promise<void> {
  await invoke(IPC.terminal.resize, { sessionId, cols, rows })
}

export async function terminalDestroy(sessionId: string): Promise<void> {
  await invoke(IPC.terminal.destroy, { sessionId })
}

export async function fsRead(path: string): Promise<{ content: string }> {
  return invoke<{ content: string }>(IPC.fs.read, path)
}

export async function fsWrite(path: string, content: string): Promise<void> {
  await invoke(IPC.fs.write, path, content)
}

export async function fsList(path: string): Promise<FSEntry[]> {
  const result = await invoke<{ entries: FSEntry[] }>(IPC.fs.list, path)
  return result.entries
}

export async function fsWatch(path: string): Promise<{ watchId: string }> {
  return invoke<{ watchId: string }>(IPC.fs.watch, path)
}

export async function fsUnwatch(watchId: string): Promise<void> {
  await invoke(IPC.fs.unwatch, watchId)
}

export function subscribe<T>(channel: string, listener: (data: T) => void): () => void {
  return window.electron.on(channel, (_event: unknown, ...args: unknown[]) => {
    listener(args[0] as T)
  })
}

export type AgentEvaluationEvent = EvaluationResult
