import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import type { CreatePRRequest, CreateReleaseRequest } from '@shared/ipc'
import { githubService } from '../services/github'
import { stateManager } from '../state/stateManager'

export function registerGitHubHandlers(): void {
  ipcMain.handle(
    IPC.github.createPR,
    async (_event, req: CreatePRRequest) => {
      try {
        return await githubService.createPR(req)
      } catch (err: unknown) {
        const error = err as Error & { code?: string }
        return { error: { code: error.code ?? 'GH_CREATE_PR_FAILED', message: error.message } }
      }
    }
  )

  ipcMain.handle(
    IPC.github.getPRState,
    async (_event, courseId: string, prNumber: number) => {
      try {
        const course = stateManager.getCourse(courseId)
        if (!course) {
          return { error: { code: 'COURSE_NOT_FOUND', message: `Course ${courseId} not found` } }
        }
        return await githubService.getPRState(course.localPath, prNumber)
      } catch (err: unknown) {
        const error = err as Error & { code?: string }
        return { error: { code: error.code ?? 'GH_GET_PR_STATE_FAILED', message: error.message } }
      }
    }
  )

  ipcMain.handle(
    IPC.github.createRelease,
    async (_event, req: CreateReleaseRequest) => {
      try {
        return await githubService.createRelease(req)
      } catch (err: unknown) {
        const error = err as Error & { code?: string }
        return {
          error: { code: error.code ?? 'GH_CREATE_RELEASE_FAILED', message: error.message },
        }
      }
    }
  )

  ipcMain.handle(
    IPC.github.submitRegistryPR,
    async (_event, courseId: string, registryRepoOwner: string) => {
      try {
        return await githubService.submitRegistryPR(courseId, registryRepoOwner)
      } catch (err: unknown) {
        const error = err as Error & { code?: string }
        return {
          error: {
            code: error.code ?? 'GH_SUBMIT_REGISTRY_PR_FAILED',
            message: error.message,
          },
        }
      }
    }
  )
}
