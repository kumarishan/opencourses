import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { AddCourseRequest, ModeSetResult } from '@shared/ipc'
import type { CourseState } from '@shared/types/state'
import { gitService } from '@main/services/git'
import { githubService } from '@main/services/github'
import { stateManager } from '@main/state/stateManager'

function deriveCourseSlug(repoUrl: string): string {
  const rawName = repoUrl.split('/').pop() ?? repoUrl
  return rawName.replace(/\.git$/, '').replace(/[^a-zA-Z0-9-_]/g, '-')
}

function normalizeRepoUrl(repoUrl: string): string {
  const trimmed = repoUrl.trim()
  if (!trimmed) {
    return ''
  }

  const scpLikeMatch = trimmed.match(/^[^@]+@([^:]+):(.+)$/)
  if (scpLikeMatch) {
    const host = scpLikeMatch[1]?.trim().toLowerCase()
    const pathname = scpLikeMatch[2]
      ?.trim()
      .replace(/^\/+/, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .toLowerCase()

    return host && pathname ? `https://${host}/${pathname}` : trimmed
  }

  try {
    const parsed = new URL(trimmed)
    const pathname = parsed.pathname
      .trim()
      .replace(/^\/+/, '')
      .replace(/\.git$/i, '')
      .replace(/\/+$/, '')
      .toLowerCase()
    return `https://${parsed.hostname.toLowerCase()}/${pathname}`
  } catch {
    return trimmed.toLowerCase().replace(/\.git$/i, '').replace(/\/+$/, '')
  }
}

async function inspectCoursePath(candidatePath: string): Promise<'missing' | 'empty-dir' | 'occupied'> {
  try {
    const stat = await fs.promises.stat(candidatePath)
    if (!stat.isDirectory()) {
      return 'occupied'
    }

    const entries = await fs.promises.readdir(candidatePath)
    return entries.length === 0 ? 'empty-dir' : 'occupied'
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return 'missing'
    }
    throw err
  }
}

async function resolveCourseLocation(
  repoUrl: string,
  coursesDir: string,
  baseName: string
): Promise<{ name: string; localPath: string; shouldClone: boolean }> {
  const normalizedRepoUrl = normalizeRepoUrl(repoUrl)

  for (let suffix = 0; suffix < 1000; suffix += 1) {
    const name = suffix === 0 ? baseName : `${baseName}-${suffix + 1}`
    const localPath = path.join(coursesDir, name)
    const pathState = await inspectCoursePath(localPath)

    if (pathState === 'missing' || pathState === 'empty-dir') {
      return { name, localPath, shouldClone: true }
    }

    const remoteUrl = await gitService.getRemoteUrl(localPath)
    if (remoteUrl && normalizeRepoUrl(remoteUrl) === normalizedRepoUrl) {
      return { name, localPath, shouldClone: false }
    }
  }

  const error = new Error(`Unable to allocate a course directory for ${baseName}`) as Error & {
    code: string
  }
  error.code = 'COURSE_DIRECTORY_UNAVAILABLE'
  throw error
}

export function registerCoursesHandlers(): void {
  ipcMain.handle(IPC.courses.list, () => {
    try {
      return Object.values(stateManager.getState().courses) as CourseState[]
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      return { error: { code: error.code ?? 'COURSES_LIST_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.courses.add, async (_event, req: AddCourseRequest) => {
    try {
      const repoUrl = req.courseRepo
      const normalizedRepoUrl = normalizeRepoUrl(repoUrl)
      const existingCourse = Object.values(stateManager.getState().courses).find(
        (course) => normalizeRepoUrl(course.courseRepo) === normalizedRepoUrl
      )
      if (existingCourse) {
        const existingRemoteUrl = await gitService.getRemoteUrl(existingCourse.localPath)
        if (existingRemoteUrl && normalizeRepoUrl(existingRemoteUrl) === normalizedRepoUrl) {
          return existingCourse
        }
      }

      const baseName = deriveCourseSlug(repoUrl)
      const coursesDir = path.join(os.homedir(), '.opencourses', 'courses')
      const { name, localPath, shouldClone } = await resolveCourseLocation(
        repoUrl,
        coursesDir,
        baseName
      )
      const scratchPath = req.scratchPath ?? path.join(localPath, 'scratch')

      if (shouldClone) {
        await gitService.clone(repoUrl, localPath)
      }
      await fs.promises.mkdir(scratchPath, { recursive: true })

      // Read course.json from cloned repo to get title
      let title = name
      try {
        const courseJsonPath = path.join(localPath, 'course.json')
        const raw = await fs.promises.readFile(courseJsonPath, 'utf8')
        const courseJson = JSON.parse(raw) as { title?: string }
        if (courseJson.title) {
          title = courseJson.title
        }
      } catch {
        // course.json missing or invalid — keep name as title
      }

      let activeBranch = 'main'
      try {
        activeBranch = await gitService.currentBranch(localPath)
      } catch {
        activeBranch = 'main'
      }

      const courseId = crypto.randomUUID()

      const courseState: CourseState = {
        id: courseId,
        name,
        title,
        localPath,
        scratchPath,
        sourceRepo: req.sourceRepo ?? '',
        courseRepo: repoUrl,
        activeMode: 'learn',
        activeBranch,
        creationBranch: null,
        creationPR: { number: null, url: null, state: null },
        activeSection: null,
        learnerProgress: {},
        addedAt: new Date().toISOString(),
      }

      stateManager.setCourse(courseId, courseState)
      return courseState
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      return { error: { code: error.code ?? 'COURSES_ADD_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.courses.remove, async (_event, courseId: string) => {
    try {
      const course = stateManager.getCourse(courseId)
      if (!course) {
        return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${courseId}` } }
      }

      await fs.promises.rm(course.localPath, { recursive: true, force: true })
      stateManager.removeCourse(courseId)
      return { ok: true }
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      return { error: { code: error.code ?? 'COURSES_REMOVE_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.courses.setMode, async (_event, courseId: string, mode: string) => {
    try {
      const course = stateManager.getCourse(courseId)
      if (!course) {
        return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${courseId}` } }
      }

      if (mode === 'learn') {
        stateManager.setMode(courseId, 'learn')
        return { status: 'ok', mode: 'learn', branch: course.activeBranch } as ModeSetResult
      }

      if (mode === 'create') {
        const { creationBranch, creationPR, localPath } = course

        if (!creationBranch) {
          return { status: 'needs-branch-name' } as ModeSetResult
        }

        if (creationPR.number != null) {
          const prInfo = await githubService.getPRState(localPath, creationPR.number)
          if (prInfo.state === 'merged') {
            return { status: 'pr-merged', prUrl: prInfo.url ?? '' } as ModeSetResult
          }
          // open or other state — checkout branch and update state
          await gitService.checkout(localPath, creationBranch)
          stateManager.setMode(courseId, 'create')
          stateManager.setBranch(courseId, creationBranch)
          return { status: 'ok', mode: 'create', branch: creationBranch } as ModeSetResult
        }

        // creationBranch exists but no PR — checkout branch and update state
        await gitService.checkout(localPath, creationBranch)
        stateManager.setMode(courseId, 'create')
        stateManager.setBranch(courseId, creationBranch)
        return { status: 'ok', mode: 'create', branch: creationBranch } as ModeSetResult
      }

      // Fallback for any other mode
      stateManager.setMode(courseId, mode as 'learn' | 'create')
      return { status: 'ok', mode, branch: course.activeBranch } as ModeSetResult
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      return { error: { code: error.code ?? 'COURSES_SETMODE_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.courses.getProgress, (_event, courseId: string) => {
    try {
      return stateManager.getCourse(courseId)?.learnerProgress ?? {}
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      return { error: { code: error.code ?? 'COURSES_GETPROGRESS_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(
    IPC.courses.markSectionComplete,
    (_event, courseId: string, chapterId: string, sectionFile: string) => {
      try {
        stateManager.markSectionComplete(courseId, chapterId, sectionFile)
        return { ok: true }
      } catch (err: unknown) {
        const error = err as Error & { code?: string }
        return {
          error: {
            code: error.code ?? 'COURSES_MARK_SECTION_COMPLETE_FAILED',
            message: error.message,
          },
        }
      }
    }
  )

  ipcMain.handle(
    IPC.courses.setActiveSection,
    (_event, courseId: string, chapterId: string, sectionFile: string) => {
      try {
        stateManager.setActiveSection(courseId, chapterId, sectionFile)
        return { ok: true }
      } catch (err: unknown) {
        const error = err as Error & { code?: string }
        return {
          error: {
            code: error.code ?? 'COURSES_SET_ACTIVE_SECTION_FAILED',
            message: error.message,
          },
        }
      }
    }
  )
}
