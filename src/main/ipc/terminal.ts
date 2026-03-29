import { BrowserWindow, ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { terminalService } from '../services/terminal'

export function registerTerminalHandlers(): void {
  ipcMain.handle(
    IPC.terminal.create,
    (event, { courseId, cwd }: { courseId: string; cwd?: string }) => {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) throw new Error('No owner BrowserWindow found')
      return terminalService.create(win, courseId, cwd)
    }
  )

  ipcMain.handle(
    IPC.terminal.input,
    (_event, { sessionId, data }: { sessionId: string; data: string }) => {
      terminalService.input(sessionId, data)
    }
  )

  ipcMain.handle(
    IPC.terminal.resize,
    (_event, { sessionId, cols, rows }: { sessionId: string; cols: number; rows: number }) => {
      terminalService.resize(sessionId, cols, rows)
    }
  )

  ipcMain.handle(IPC.terminal.destroy, (_event, { sessionId }: { sessionId: string }) => {
    terminalService.destroy(sessionId)
  })
}
