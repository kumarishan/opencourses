import { ipcMain } from 'electron'
import { IPC } from '@shared/ipc'
import { registryService } from '../services/registry'

export function registerRegistryHandlers(): void {
  ipcMain.handle(IPC.registry.list, async () => {
    try {
      return await registryService.list()
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      return { error: { code: error.code ?? 'REGISTRY_FETCH_FAILED', message: error.message } }
    }
  })

  ipcMain.handle(IPC.registry.refresh, async () => {
    try {
      return await registryService.refresh()
    } catch (err: unknown) {
      const error = err as Error & { code?: string }
      return { error: { code: error.code ?? 'REGISTRY_FETCH_FAILED', message: error.message } }
    }
  })
}
