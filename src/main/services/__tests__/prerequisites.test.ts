import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// Mock child_process before importing the module under test
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

import { execFile } from 'child_process'
import { prerequisitesService } from '../prerequisites'

const mockExecFile = execFile as unknown as Mock

function makeExecFileImpl(present: string[]) {
  return (
    _cmd: string,
    args: string[],
    callback: (err: Error | null, stdout: string, stderr: string) => void
  ) => {
    const tool = args[0]
    if (present.includes(tool)) {
      callback(null, `/usr/bin/${tool}`, '')
    } else {
      callback(new Error(`${tool} not found`), '', `${tool}: not found`)
    }
  }
}

describe('PrerequisitesService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('all tools present: agentCLI is claude, missing is empty', async () => {
    mockExecFile.mockImplementation(makeExecFileImpl(['git', 'gh', 'claude', 'codex']))
    const result = await prerequisitesService.check()
    expect(result.agentCLI).toBe('claude')
    expect(result.missing).toEqual([])
  })

  it('git missing: missing includes git', async () => {
    mockExecFile.mockImplementation(makeExecFileImpl(['gh', 'claude', 'codex']))
    const result = await prerequisitesService.check()
    expect(result.missing).toContain('git')
    expect(result.agentCLI).toBe('claude')
  })

  it('both claude and codex missing: agentCLI is null, missing includes claude', async () => {
    mockExecFile.mockImplementation(makeExecFileImpl(['git', 'gh']))
    const result = await prerequisitesService.check()
    expect(result.agentCLI).toBeNull()
    expect(result.missing).toContain('claude')
  })

  it('only codex present: agentCLI is codex', async () => {
    mockExecFile.mockImplementation(makeExecFileImpl(['git', 'gh', 'codex']))
    const result = await prerequisitesService.check()
    expect(result.agentCLI).toBe('codex')
    expect(result.missing).not.toContain('claude')
    expect(result.missing).not.toContain('codex')
  })
})
