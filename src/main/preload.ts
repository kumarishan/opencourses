import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

export type ElectronAPI = {
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>
  on: (
    channel: string,
    listener: (event: IpcRendererEvent, ...args: unknown[]) => void
  ) => () => void
  off: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void) => void
}

const electronAPI: ElectronAPI = {
  invoke: (channel: string, ...args: unknown[]): Promise<unknown> => {
    return ipcRenderer.invoke(channel, ...args)
  },
  on: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void): (() => void) => {
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
  },
  off: (channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void => {
    ipcRenderer.removeListener(channel, listener)
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)
