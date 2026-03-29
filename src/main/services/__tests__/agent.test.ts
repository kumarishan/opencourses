import { describe, it, expect, vi, beforeEach } from 'vitest'
import { EventEmitter } from 'events'

// --- Mocks ---

vi.mock('electron', () => ({
  app: {
    getAppPath: vi.fn().mockReturnValue('/mock/app'),
  },
}))

vi.mock('fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}))

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}))

// --- Imports after mocks ---

import { spawn } from 'child_process'
import { readFile, readdir } from 'fs/promises'
import { app } from 'electron'
import { IPC } from '@shared/ipc'
import type { AgentGenerationRequest, AgentEvaluationRequest } from '@shared/ipc'

const mockSpawn = spawn as ReturnType<typeof vi.fn>
const mockReadFile = readFile as ReturnType<typeof vi.fn>
const mockReaddir = readdir as ReturnType<typeof vi.fn>
const mockGetAppPath = app.getAppPath as ReturnType<typeof vi.fn>

// Build a stream-like EventEmitter compatible with readline createInterface
function makeStream() {
  const s = new EventEmitter() as EventEmitter & {
    readable: boolean
    resume: ReturnType<typeof vi.fn>
    pipe: ReturnType<typeof vi.fn>
    destroy: ReturnType<typeof vi.fn>
  }
  s.readable = true
  s.resume = vi.fn().mockReturnThis()
  s.pipe = vi.fn()
  s.destroy = vi.fn()
  return s
}

// Build a mock ChildProcess EventEmitter
function makeMockChild() {
  const child = new EventEmitter() as EventEmitter & {
    stdout: ReturnType<typeof makeStream>
    stderr: ReturnType<typeof makeStream>
    kill: ReturnType<typeof vi.fn>
  }
  child.stdout = makeStream()
  child.stderr = makeStream()
  child.kill = vi.fn()
  return child
}

// Build a mock BrowserWindow
function makeMockWin() {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as import('electron').BrowserWindow
}

describe('loadSkill', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAppPath.mockReturnValue('/mock/app')
  })

  it('concatenates SKILL.md with reference files', async () => {
    mockReadFile.mockImplementation(async (p: string) => {
      if (String(p).endsWith('SKILL.md')) return 'skill content'
      if (String(p).endsWith('ref1.md')) return 'ref1 content'
      return ''
    })
    mockReaddir.mockResolvedValue(['ref1.md'] as unknown as import('fs').Dirent[])

    const { loadSkill } = await import('../agent')
    const result = await loadSkill('course-creation')

    expect(result).toContain('skill content')
    expect(result).toContain('ref1.md')
    expect(result).toContain('ref1 content')
  })

  it('returns just SKILL.md when references dir is missing', async () => {
    mockReadFile.mockResolvedValue('skill only')
    mockReaddir.mockRejectedValue(new Error('ENOENT'))

    const { loadSkill } = await import('../agent')
    const result = await loadSkill('course-evaluation')
    expect(result).toBe('skill only')
  })
})

describe('AgentService.startGeneration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAppPath.mockReturnValue('/mock/app')
  })

  it('returns a jobId and forwards stdout lines as stream chunks', async () => {
    const child = makeMockChild()
    mockSpawn.mockReturnValue(child)

    const { agentService } = await import('../agent')
    const win = makeMockWin()
    const req: AgentGenerationRequest = {
      courseId: 'c1',
      phase: 'outline',
      instructions: 'create outline',
    }

    const { jobId } = await agentService.startGeneration(win, req, 'claude', 'system prompt', '/course/path')

    expect(jobId).toBeTruthy()
    expect(mockSpawn).toHaveBeenCalledWith(
      'claude',
      ['--print', '--system-prompt', 'system prompt', expect.any(String)],
      { cwd: '/course/path' }
    )

    // Simulate a line of stdout
    child.stdout.emit('data', Buffer.from('hello line\n'))
    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.agent.streamChunk,
      expect.objectContaining({ jobId, chunk: 'hello line' })
    )
  })

  it('emits agent:complete with parsed outline on exit code 0', async () => {
    const child = makeMockChild()
    mockSpawn.mockReturnValue(child)

    const { agentService } = await import('../agent')
    const win = makeMockWin()
    const req: AgentGenerationRequest = {
      courseId: 'c1',
      phase: 'outline',
      instructions: 'create outline',
    }

    await agentService.startGeneration(win, req, 'claude', 'system prompt', '/course/path')

    const outlineData = [{ title: 'Ch1', description: 'desc', sections: [] }]
    child.stdout.emit('data', Buffer.from(JSON.stringify(outlineData)))
    child.emit('close', 0)

    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.agent.complete,
      expect.objectContaining({ outline: outlineData })
    )
  })

  it('emits agent:error with stderr on non-zero exit', async () => {
    const child = makeMockChild()
    mockSpawn.mockReturnValue(child)

    const { agentService } = await import('../agent')
    const win = makeMockWin()
    const req: AgentGenerationRequest = {
      courseId: 'c1',
      phase: 'outline',
      instructions: 'create outline',
    }

    await agentService.startGeneration(win, req, 'codex', 'system prompt', '/course/path')

    expect(mockSpawn).toHaveBeenCalledWith(
      'codex',
      ['--system', 'system prompt', expect.any(String)],
      { cwd: '/course/path' }
    )

    child.stderr.emit('data', Buffer.from('something went wrong'))
    child.emit('close', 1)

    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.agent.error,
      expect.objectContaining({ error: 'something went wrong' })
    )
  })
})

describe('AgentService.evaluate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAppPath.mockReturnValue('/mock/app')
  })

  it('returns a jobId', async () => {
    const child = makeMockChild()
    mockSpawn.mockReturnValue(child)

    const { agentService } = await import('../agent')
    const win = makeMockWin()
    const req: AgentEvaluationRequest = {
      courseId: 'c1',
      sectionFile: 'section.md',
      taskBlock: { id: 't1', title: 'T1', objective: 'obj', hints: [], criteria: [] },
      scratchFiles: [{ path: 'answer.ts', content: 'const x = 1' }],
    }

    const { jobId } = await agentService.evaluate(win, req, 'claude', 'eval skill', '/scratch')
    expect(jobId).toBeTruthy()
  })

  it('emits agent:complete with pass and feedback on exit code 0', async () => {
    const child = makeMockChild()
    mockSpawn.mockReturnValue(child)

    const { agentService } = await import('../agent')
    const win = makeMockWin()
    const req: AgentEvaluationRequest = {
      courseId: 'c1',
      sectionFile: 'section.md',
      taskBlock: { id: 't1', title: 'T1', objective: 'obj', hints: [], criteria: [] },
      scratchFiles: [],
    }

    const { jobId } = await agentService.evaluate(win, req, 'claude', 'eval skill', '/scratch')

    const evalResult = { pass: true, feedback: 'Well done!' }
    child.stdout.emit('data', Buffer.from(JSON.stringify(evalResult)))
    child.emit('close', 0)

    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.agent.complete,
      expect.objectContaining({ jobId, pass: true, feedback: 'Well done!' })
    )
  })

  it('emits agent:error on non-zero exit', async () => {
    const child = makeMockChild()
    mockSpawn.mockReturnValue(child)

    const { agentService } = await import('../agent')
    const win = makeMockWin()
    const req: AgentEvaluationRequest = {
      courseId: 'c1',
      sectionFile: 'section.md',
      taskBlock: { id: 't1', title: 'T1', objective: 'obj', hints: [], criteria: [] },
      scratchFiles: [],
    }

    const { jobId } = await agentService.evaluate(win, req, 'codex', 'eval skill', '/scratch')

    child.stderr.emit('data', Buffer.from('eval failed'))
    child.emit('close', 2)

    expect(win.webContents.send).toHaveBeenCalledWith(
      IPC.agent.error,
      expect.objectContaining({ jobId, error: 'eval failed' })
    )
  })
})

describe('AgentService.cancel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetAppPath.mockReturnValue('/mock/app')
  })

  it('sends SIGINT and removes job from map', async () => {
    const child = makeMockChild()
    mockSpawn.mockReturnValue(child)

    const { agentService } = await import('../agent')
    const win = makeMockWin()
    const req: AgentGenerationRequest = {
      courseId: 'c1',
      phase: 'outline',
      instructions: 'create outline',
    }

    const { jobId } = await agentService.startGeneration(win, req, 'claude', 'skill', '/course')

    agentService.cancel(jobId)

    expect(child.kill).toHaveBeenCalledWith('SIGINT')
  })

  it('does nothing for an unknown jobId', async () => {
    const { agentService } = await import('../agent')
    // Should not throw
    expect(() => agentService.cancel('non-existent-id')).not.toThrow()
  })
})
