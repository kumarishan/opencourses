import { ipcMain, BrowserWindow } from 'electron'
import { dirname } from 'path'
import { IPC } from '@shared/ipc'
import type { AgentGenerationRequest, AgentEvaluationRequest } from '@shared/ipc'
import { agentService, loadSkill } from '../services/agent'
import { prerequisitesService } from '../services/prerequisites'
import { stateManager } from '../state/stateManager'

async function resolveAgentCLI(): Promise<'claude' | 'codex'> {
  const current = stateManager.getState().agentPreference
  if (current) return current

  const prerequisites = await prerequisitesService.check()
  if (!prerequisites.agentCLI) {
    throw new Error('No supported agent CLI available. Install Claude Code or Codex.')
  }

  stateManager.setAgentPreference(prerequisites.agentCLI)
  return prerequisites.agentCLI
}

export function registerAgentHandlers(): void {
  ipcMain.handle(
    IPC.agent.startGeneration,
    async (event, req: AgentGenerationRequest) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) throw new Error('No BrowserWindow found')

        const course = stateManager.getCourse(req.courseId)
        if (!course) {
          return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${req.courseId}` } }
        }

        const agentCLI = await resolveAgentCLI()
        const skillContent = await loadSkill('course-creation')

        return await agentService.startGeneration(win, req, agentCLI, skillContent, course.localPath)
      } catch (err: unknown) {
        const error = err as Error
        return { error: { code: 'AGENT_START_FAILED', message: error.message } }
      }
    }
  )

  ipcMain.handle(
    IPC.agent.evaluate,
    async (event, req: AgentEvaluationRequest) => {
      try {
        const win = BrowserWindow.fromWebContents(event.sender)
        if (!win) throw new Error('No BrowserWindow found')

        const course = stateManager.getCourse(req.courseId)
        if (!course) {
          return { error: { code: 'COURSE_NOT_FOUND', message: `Course not found: ${req.courseId}` } }
        }

        const agentCLI = await resolveAgentCLI()
        const skillContent = await loadSkill('course-evaluation')
        const scratchPath = course.scratchPath || dirname(req.sectionFile)

        return await agentService.evaluate(win, req, agentCLI, skillContent, scratchPath)
      } catch (err: unknown) {
        const error = err as Error
        return { error: { code: 'AGENT_EVALUATE_FAILED', message: error.message } }
      }
    }
  )

  ipcMain.handle(IPC.agent.cancel, async (_event, jobId: string) => {
    try {
      agentService.cancel(jobId)
      return { ok: true }
    } catch (err: unknown) {
      const error = err as Error
      return { error: { code: 'AGENT_CANCEL_FAILED', message: error.message } }
    }
  })
}
