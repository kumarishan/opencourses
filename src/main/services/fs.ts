import * as fs from 'fs/promises'
import { watch as fsWatch } from 'fs'
import type { FSWatcher } from 'fs'
import * as path from 'path'
import * as os from 'os'
import * as crypto from 'crypto'
import type { BrowserWindow } from 'electron'
import { IPC } from '@shared/ipc'
import type { FSEntry } from '@shared/ipc'

export class FileSystemService {
  private readonly baseDir: string
  private watchers: Map<string, FSWatcher> = new Map()

  constructor(baseDir?: string) {
    this.baseDir = baseDir ?? path.join(os.homedir(), '.opencourses')
  }

  private assertSafe(filePath: string): void {
    const resolved = path.resolve(filePath)
    if (!resolved.startsWith(this.baseDir)) {
      throw new Error(`PATH_TRAVERSAL: ${filePath} escapes baseDir`)
    }
  }

  private async log(message: string): Promise<void> {
    const logDir = path.join(os.homedir(), '.opencourses', 'logs')
    const logFile = path.join(logDir, 'main.log')
    try {
      await fs.mkdir(logDir, { recursive: true })
      const timestamp = new Date().toISOString()
      await fs.appendFile(logFile, `[${timestamp}] [debug] ${message}\n`)
    } catch {
      // Ignore logging errors
    }
  }

  async read(filePath: string): Promise<{ content: string }> {
    this.assertSafe(filePath)
    await this.log(`read: ${filePath}`)
    const content = await fs.readFile(filePath, 'utf-8')
    return { content }
  }

  async write(filePath: string, content: string): Promise<void> {
    this.assertSafe(filePath)
    await this.log(`write: ${filePath}`)
    const dir = path.dirname(filePath)
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(filePath, content, 'utf-8')
  }

  async list(dirPath: string): Promise<FSEntry[]> {
    this.assertSafe(dirPath)
    await this.log(`list: ${dirPath}`)
    const entries = await fs.readdir(dirPath, { withFileTypes: true })
    return entries.map((entry) => ({
      name: entry.name,
      path: path.join(dirPath, entry.name),
      isDirectory: entry.isDirectory(),
    }))
  }

  watch(win: BrowserWindow, watchPath: string): { watchId: string } {
    this.assertSafe(watchPath)
    const watchId = crypto.randomUUID()
    const watcher = fsWatch(watchPath, { recursive: false }, (event, filename) => {
      const filePath = filename ? path.join(watchPath, filename) : watchPath
      win.webContents.send(IPC.fs.changed, { watchId, path: filePath })
    })
    this.watchers.set(watchId, watcher)
    this.log(`watch: ${watchPath} (watchId=${watchId})`).catch(() => {})
    return { watchId }
  }

  unwatch(watchId: string): void {
    const watcher = this.watchers.get(watchId)
    if (watcher) {
      watcher.close()
      this.watchers.delete(watchId)
      this.log(`unwatch: ${watchId}`).catch(() => {})
    }
  }
}

export const fsService = new FileSystemService()
