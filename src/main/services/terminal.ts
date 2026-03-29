import * as os from 'os'
import * as crypto from 'crypto'
import pty from 'node-pty'
import type { IPty } from 'node-pty'
import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { stateManager } from '../state/stateManager'

interface TerminalSession {
  id: string
  pty: IPty
  cwd: string
}

class TerminalService {
  private sessions: Map<string, TerminalSession> = new Map()

  create(win: BrowserWindow, courseId: string, cwd?: string): { sessionId: string } {
    const resolvedCwd = cwd ?? stateManager.getCourse(courseId)?.scratchPath ?? os.homedir()
    const shell = process.env.SHELL || '/bin/bash'
    const sessionId = crypto.randomUUID()

    const ptyProcess = pty.spawn(shell, [], {
      name: 'xterm-256color',
      cols: 80,
      rows: 24,
      cwd: resolvedCwd,
      env: process.env as Record<string, string>,
    })

    ptyProcess.onData((data) => {
      win.webContents.send(IPC.terminal.data, { sessionId, data })
    })

    this.sessions.set(sessionId, { id: sessionId, pty: ptyProcess, cwd: resolvedCwd })

    return { sessionId }
  }

  input(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.pty.write(data)
  }

  resize(sessionId: string, cols: number, rows: number): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.pty.resize(cols, rows)
  }

  destroy(sessionId: string): void {
    const session = this.sessions.get(sessionId)
    if (!session) return
    session.pty.kill()
    this.sessions.delete(sessionId)
  }
}

export const terminalService = new TerminalService()
