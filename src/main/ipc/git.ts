import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { gitService } from '../services/git'
import { stateManager } from '../state/stateManager'

export function registerGitHandlers(): void {
  ipcMain.handle(IPC.git.clone, async (_event, url: string, dest: string) => {
    try {
      await gitService.clone(url, dest)
      return { ok: true }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException
      return { error: { code: error.code ?? 'GIT_CLONE_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.git.listBranches, async (_event, courseId: string) => {
    try {
      const course = stateManager.getCourse(courseId)
      if (!course) {
        return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${courseId}` } }
      }
      const branches = await gitService.listBranches(course.localPath)
      return { branches }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException
      return { error: { code: error.code ?? 'GIT_LISTBRANCHES_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.git.createBranch, async (_event, courseId: string, name: string) => {
    try {
      const course = stateManager.getCourse(courseId)
      if (!course) {
        return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${courseId}` } }
      }
      await gitService.createBranch(course.localPath, name)
      stateManager.setCreationBranch(courseId, name, { number: null, url: null, state: null })
      return { ok: true }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException
      return { error: { code: error.code ?? 'GIT_CREATEBRANCH_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.git.checkout, async (_event, courseId: string, branch: string) => {
    try {
      const course = stateManager.getCourse(courseId)
      if (!course) {
        return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${courseId}` } }
      }
      await gitService.checkout(course.localPath, branch)
      stateManager.setBranch(courseId, branch)
      return { ok: true }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException
      return { error: { code: error.code ?? 'GIT_CHECKOUT_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.git.commitAndPush, async (_event, courseId: string, message: string) => {
    try {
      const course = stateManager.getCourse(courseId)
      if (!course) {
        return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${courseId}` } }
      }
      await gitService.commitAndPush(course.localPath, message)
      return { ok: true }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException
      return { error: { code: error.code ?? 'GIT_COMMITANDPUSH_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.git.discard, async (_event, courseId: string) => {
    try {
      const course = stateManager.getCourse(courseId)
      if (!course) {
        return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${courseId}` } }
      }
      await gitService.discard(course.localPath)
      return { ok: true }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException
      return { error: { code: error.code ?? 'GIT_DISCARD_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.git.status, async (_event, courseId: string) => {
    try {
      const course = stateManager.getCourse(courseId)
      if (!course) {
        return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${courseId}` } }
      }
      const status = await gitService.status(course.localPath)
      return { status }
    } catch (err: unknown) {
      const error = err as NodeJS.ErrnoException
      return { error: { code: error.code ?? 'GIT_STATUS_FAILED', message: error.message } }
    }
  })
}
