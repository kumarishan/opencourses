import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import type { AppState, CourseState } from '@shared/types/state'
import type { PRInfo } from '@shared/types/state'
import type { ModeType } from '@shared/types/course'

const DEFAULT_STATE: AppState = {
  version: 1,
  agentPreference: null,
  courses: {},
}

export class StateManager {
  private state: AppState = { ...DEFAULT_STATE, courses: {} }
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private readonly baseDir: string

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(os.homedir(), '.opencourses')
  }

  private get stateFilePath(): string {
    return path.join(this.baseDir, 'state.json')
  }

  async load(): Promise<void> {
    // Create required directories
    await fs.promises.mkdir(this.baseDir, { recursive: true })
    await fs.promises.mkdir(path.join(this.baseDir, 'repositories'), { recursive: true })
    await fs.promises.mkdir(path.join(this.baseDir, 'courses'), { recursive: true })
    await fs.promises.mkdir(path.join(this.baseDir, 'logs'), { recursive: true })

    try {
      const raw = await fs.promises.readFile(this.stateFilePath, 'utf8')
      this.state = JSON.parse(raw) as AppState
    } catch (err: unknown) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist — write default
        this.state = { ...DEFAULT_STATE, courses: {} }
        await this.writeImmediately()
      } else {
        throw err
      }
    }
  }

  getState(): AppState {
    return this.state
  }

  getCourse(courseId: string): CourseState | undefined {
    return this.state.courses[courseId]
  }

  setCourse(courseId: string, course: CourseState): void {
    this.state.courses[courseId] = course
    this.scheduleSave()
  }

  removeCourse(courseId: string): void {
    delete this.state.courses[courseId]
    this.scheduleSave()
  }

  markSectionComplete(courseId: string, chapterId: string, sectionFile: string): void {
    const course = this.state.courses[courseId]
    if (!course) return

    if (!course.learnerProgress[chapterId]) {
      course.learnerProgress[chapterId] = { completed: false, sections: {} }
    }

    course.learnerProgress[chapterId].sections[sectionFile] = {
      completed: true,
      completedAt: new Date().toISOString(),
    }

    // Check if all sections in the chapter are complete
    const chapterProgress = course.learnerProgress[chapterId]
    const allComplete = Object.values(chapterProgress.sections).every((s) => s.completed)
    chapterProgress.completed = allComplete

    this.scheduleSave()
  }

  setMode(courseId: string, mode: ModeType): void {
    const course = this.state.courses[courseId]
    if (!course) return
    course.activeMode = mode
    this.scheduleSave()
  }

  setBranch(courseId: string, branch: string): void {
    const course = this.state.courses[courseId]
    if (!course) return
    course.activeBranch = branch
    this.scheduleSave()
  }

  setCreationBranch(courseId: string, branch: string | null, pr: PRInfo): void {
    const course = this.state.courses[courseId]
    if (!course) return
    course.creationBranch = branch
    course.creationPR = pr
    this.scheduleSave()
  }

  setActiveSection(courseId: string, chapterId: string, sectionFile: string): void {
    const course = this.state.courses[courseId]
    if (!course) return
    course.activeSection = { chapterId, sectionFile }
    this.scheduleSave()
  }

  setAgentPreference(pref: 'claude' | 'codex' | null): void {
    this.state.agentPreference = pref
    this.scheduleSave()
  }

  async flush(): Promise<void> {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    await this.writeImmediately()
  }

  private scheduleSave(): void {
    if (this.debounceTimer !== null) {
      clearTimeout(this.debounceTimer)
    }
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null
      this.writeImmediately().catch((err) => {
        console.error('[StateManager] Failed to persist state:', err)
      })
    }, 300)
  }

  private async writeImmediately(): Promise<void> {
    const tmpPath = this.stateFilePath + '.tmp'
    await fs.promises.writeFile(tmpPath, JSON.stringify(this.state, null, 2), 'utf8')
    await fs.promises.rename(tmpPath, this.stateFilePath)
  }
}

export const stateManager = new StateManager()
