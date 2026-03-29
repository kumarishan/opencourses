import * as crypto from 'crypto'
import { spawn, ChildProcess } from 'child_process'
import { createInterface } from 'readline'
import { readFile, readdir } from 'fs/promises'
import { join } from 'path'
import { app } from 'electron'
import type { BrowserWindow } from 'electron'
import { IPC, AgentGenerationRequest, AgentEvaluationRequest } from '@shared/ipc'
import type { ChapterOutline } from '@shared/ipc'

function getSkillsDir(): string {
  if (app.isPackaged) {
    return join(process.resourcesPath, 'skills')
  }

  return join(app.getAppPath(), 'resources', 'skills')
}

export async function loadSkill(skillName: 'course-creation' | 'course-evaluation'): Promise<string> {
  const skillDir = join(getSkillsDir(), skillName)
  const skillMd = await readFile(join(skillDir, 'SKILL.md'), 'utf-8')

  const refsDir = join(skillDir, 'references')
  let refContents = ''
  try {
    const refFiles = (await readdir(refsDir)).sort()
    const refTexts = await Promise.all(
      refFiles.map(async (f) => {
        const text = await readFile(join(refsDir, f), 'utf-8')
        return `\n\n--- ${f} ---\n${text}`
      })
    )
    refContents = refTexts.join('')
  } catch {
    // references directory may not exist or be empty
  }

  return skillMd + refContents
}

class AgentService {
  private jobs: Map<string, ChildProcess> = new Map()

  async startGeneration(
    win: BrowserWindow,
    req: AgentGenerationRequest,
    agentCLI: 'claude' | 'codex',
    skillContent: string,
    courseLocalPath: string
  ): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID()

    const taskPrompt = JSON.stringify({
      phase: req.phase,
      instructions: req.instructions,
      targetChapter: req.targetChapter,
      targetSection: req.targetSection,
    })

    const args =
      agentCLI === 'claude'
        ? ['--print', '--system-prompt', skillContent, taskPrompt]
        : ['--system', skillContent, taskPrompt]

    const child = spawn(agentCLI, args, { cwd: courseLocalPath })
    this.jobs.set(jobId, child)

    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (line) => {
      win.webContents.send(IPC.agent.streamChunk, { jobId, chunk: line })
    })

    let stderrBuf = ''
    child.stderr?.on('data', (data: Buffer) => {
      stderrBuf += data.toString()
    })

    let stdoutFull = ''
    child.stdout?.on('data', (data: Buffer) => {
      stdoutFull += data.toString()
    })

    child.on('close', (code) => {
      this.jobs.delete(jobId)
      if (code === 0) {
        let outline: ChapterOutline[] | undefined
        try {
          const parsed = JSON.parse(stdoutFull.trim())
          outline = Array.isArray(parsed) ? parsed : parsed.outline
        } catch {
          outline = undefined
        }
        win.webContents.send(IPC.agent.complete, { jobId, outline })
      } else {
        win.webContents.send(IPC.agent.error, { jobId, error: stderrBuf || `Process exited with code ${code}` })
      }
    })

    return { jobId }
  }

  async evaluate(
    win: BrowserWindow,
    req: AgentEvaluationRequest,
    agentCLI: 'claude' | 'codex',
    skillContent: string,
    scratchPath: string
  ): Promise<{ jobId: string }> {
    const jobId = crypto.randomUUID()

    const taskPrompt = JSON.stringify({
      sectionFile: req.sectionFile,
      taskBlock: req.taskBlock,
      scratchFiles: req.scratchFiles,
    })

    const args =
      agentCLI === 'claude'
        ? ['--print', '--system-prompt', skillContent, taskPrompt]
        : ['--system', skillContent, taskPrompt]

    const child = spawn(agentCLI, args, { cwd: scratchPath })
    this.jobs.set(jobId, child)

    const rl = createInterface({ input: child.stdout! })
    rl.on('line', (line) => {
      win.webContents.send(IPC.agent.streamChunk, { jobId, chunk: line })
    })

    let stderrBuf = ''
    child.stderr?.on('data', (data: Buffer) => {
      stderrBuf += data.toString()
    })

    let stdoutFull = ''
    child.stdout?.on('data', (data: Buffer) => {
      stdoutFull += data.toString()
    })

    child.on('close', (code) => {
      this.jobs.delete(jobId)
      if (code === 0) {
        let pass = false
        let feedback = ''
        try {
          const parsed = JSON.parse(stdoutFull.trim())
          pass = parsed.pass === true
          feedback = parsed.feedback ?? ''
        } catch {
          feedback = stdoutFull.trim()
        }
        win.webContents.send(IPC.agent.complete, { jobId, pass, feedback })
        win.webContents.send(IPC.agent.evaluationResult, { jobId, pass, feedback })
      } else {
        win.webContents.send(IPC.agent.error, { jobId, error: stderrBuf || `Process exited with code ${code}` })
      }
    })

    return { jobId }
  }

  cancel(jobId: string): void {
    const child = this.jobs.get(jobId)
    if (child) {
      child.kill('SIGINT')
      this.jobs.delete(jobId)
    }
  }
}

export const agentService = new AgentService()
