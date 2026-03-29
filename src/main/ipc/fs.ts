import { ipcMain, BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import { fsService } from '../services/fs'

export function registerFsHandlers(): void {
  ipcMain.handle(IPC.fs.read, async (_event, filePath: string) => {
    try {
      return await fsService.read(filePath)
    } catch (err: unknown) {
      const error = err as Error
      return { error: { code: (err as NodeJS.ErrnoException).code ?? 'FS_READ_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.fs.write, async (_event, filePath: string, content: string) => {
    try {
      await fsService.write(filePath, content)
      return { ok: true }
    } catch (err: unknown) {
      const error = err as Error
      return { error: { code: (err as NodeJS.ErrnoException).code ?? 'FS_WRITE_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.fs.list, async (_event, dirPath: string) => {
    try {
      const entries = await fsService.list(dirPath)
      return { entries }
    } catch (err: unknown) {
      const error = err as Error
      return { error: { code: (err as NodeJS.ErrnoException).code ?? 'FS_LIST_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.fs.watch, (event, watchPath: string) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) {
        return { error: { code: 'FS_WATCH_FAILED', message: 'Could not get owner BrowserWindow' } }
      }
      const result = fsService.watch(win, watchPath)
      return result
    } catch (err: unknown) {
      const error = err as Error
      return { error: { code: (err as NodeJS.ErrnoException).code ?? 'FS_WATCH_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.fs.unwatch, (_event, watchId: string) => {
    try {
      fsService.unwatch(watchId)
      return { ok: true }
    } catch (err: unknown) {
      const error = err as Error
      return { error: { code: (err as NodeJS.ErrnoException).code ?? 'FS_UNWATCH_FAILED', message: error.message } }
    }
  })
}
