import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { IPty } from 'node-pty'

// Mock node-pty before importing the module under test
vi.mock('node-pty', () => {
  const spawn = vi.fn()
  return { default: { spawn } }
})

// Mock stateManager
vi.mock('../../state/stateManager', () => ({
  stateManager: {
    getCourse: vi.fn(),
  },
}))

// Mock electron
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn() },
}))

import pty from 'node-pty'
import { stateManager } from '../../state/stateManager'
import { terminalService } from '../terminal'

const mockSpawn = pty.spawn as ReturnType<typeof vi.fn>
const mockGetCourse = stateManager.getCourse as ReturnType<typeof vi.fn>

function makeMockPty(): IPty & {
  _onDataCallback: ((data: string) => void) | null
} {
  const mock = {
    _onDataCallback: null as ((data: string) => void) | null,
    onData: vi.fn(function (this: typeof mock, cb: (data: string) => void) {
      this._onDataCallback = cb
      return { dispose: vi.fn() }
    }),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
    // satisfy IPty interface minimally
    pid: 1234,
    process: 'bash',
    cols: 80,
    rows: 24,
    handleFlowControl: false,
    onExit: vi.fn(() => ({ dispose: vi.fn() })),
    pause: vi.fn(),
    resume: vi.fn(),
  } as unknown as IPty & { _onDataCallback: ((data: string) => void) | null }
  return mock
}

function makeMockWindow() {
  return {
    webContents: {
      send: vi.fn(),
    },
  } as unknown as import('electron').BrowserWindow
}

describe('TerminalService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Reset internal sessions map by re-importing would not work cleanly;
    // instead we destroy any sessions created in tests via the service itself.
  })

  it('create stores session and wires onData to win.webContents.send', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)
    mockGetCourse.mockReturnValue({ scratchPath: '/some/path' })

    const win = makeMockWindow()
    const { sessionId } = terminalService.create(win, 'course-1')

    expect(sessionId).toBeTruthy()
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({
        name: 'xterm-256color',
        cols: 80,
        rows: 24,
        cwd: '/some/path',
      })
    )
    expect(mockPty.onData).toHaveBeenCalled()

    // Simulate data coming from pty
    const data = 'hello terminal'
    mockPty._onDataCallback!(data)
    expect(win.webContents.send).toHaveBeenCalledWith('terminal:data', { sessionId, data })

    // cleanup
    terminalService.destroy(sessionId)
  })

  it('create uses os.homedir() when no cwd and no scratchPath', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)
    mockGetCourse.mockReturnValue(undefined)

    const win = makeMockWindow()
    const { sessionId } = terminalService.create(win, 'course-unknown')

    const os = require('os')
    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({ cwd: os.homedir() })
    )

    terminalService.destroy(sessionId)
  })

  it('create uses provided cwd when given', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)

    const win = makeMockWindow()
    const { sessionId } = terminalService.create(win, 'course-1', '/custom/cwd')

    expect(mockSpawn).toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({ cwd: '/custom/cwd' })
    )

    terminalService.destroy(sessionId)
  })

  it('input calls pty.write with data', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)
    mockGetCourse.mockReturnValue(undefined)

    const win = makeMockWindow()
    const { sessionId } = terminalService.create(win, 'course-1')

    terminalService.input(sessionId, 'ls -la\n')
    expect(mockPty.write).toHaveBeenCalledWith('ls -la\n')

    terminalService.destroy(sessionId)
  })

  it('input does nothing for unknown sessionId', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)

    terminalService.input('nonexistent-session', 'data')
    expect(mockPty.write).not.toHaveBeenCalled()
  })

  it('resize calls pty.resize with cols and rows', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)
    mockGetCourse.mockReturnValue(undefined)

    const win = makeMockWindow()
    const { sessionId } = terminalService.create(win, 'course-1')

    terminalService.resize(sessionId, 120, 40)
    expect(mockPty.resize).toHaveBeenCalledWith(120, 40)

    terminalService.destroy(sessionId)
  })

  it('resize does nothing for unknown sessionId', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)

    terminalService.resize('nonexistent-session', 80, 24)
    expect(mockPty.resize).not.toHaveBeenCalled()
  })

  it('destroy calls pty.kill and removes session from map', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)
    mockGetCourse.mockReturnValue(undefined)

    const win = makeMockWindow()
    const { sessionId } = terminalService.create(win, 'course-1')

    terminalService.destroy(sessionId)
    expect(mockPty.kill).toHaveBeenCalled()

    // Subsequent input/resize/destroy should do nothing (session removed)
    vi.clearAllMocks()
    terminalService.input(sessionId, 'data')
    expect(mockPty.write).not.toHaveBeenCalled()
  })

  it('destroy does nothing for unknown sessionId', () => {
    const mockPty = makeMockPty()
    mockSpawn.mockReturnValue(mockPty)

    terminalService.destroy('nonexistent-session')
    expect(mockPty.kill).not.toHaveBeenCalled()
  })
})
