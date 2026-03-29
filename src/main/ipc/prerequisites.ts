import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { prerequisitesService } from '../services/prerequisites'

export function registerPrerequisitesHandlers(): void {
  ipcMain.handle(IPC.prerequisites.get, async () => {
    try {
      return await prerequisitesService.check()
    } catch (err: unknown) {
      const error = err as Error
      return { error: { code: 'PREREQUISITES_CHECK_FAILED', message: error.message } }
    }
  })
}
