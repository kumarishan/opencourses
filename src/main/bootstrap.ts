import * as fs from 'fs'
import * as os from 'os'
import { BrowserWindow, app, shell } from 'electron'
import { join } from 'path'
import { registerAgentHandlers } from './ipc/agent'
import { registerCoursesHandlers } from './ipc/courses'
import { registerFsHandlers } from './ipc/fs'
import { registerGitHandlers } from './ipc/git'
import { registerGitHubHandlers } from './ipc/github'
import { registerPrerequisitesHandlers } from './ipc/prerequisites'
import { registerRegistryHandlers } from './ipc/registry'
import { registerTerminalHandlers } from './ipc/terminal'
import { prerequisitesService } from './services/prerequisites'
import { stateManager } from './state/stateManager'

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined
declare const MAIN_WINDOW_VITE_NAME: string

let handlersRegistered = false
let lifecycleRegistered = false

async function logStartup(): Promise<void> {
  const logDir = join(os.homedir(), '.opencourses', 'logs')
  await fs.promises.mkdir(logDir, { recursive: true })
  await fs.promises.appendFile(
    join(logDir, 'main.log'),
    `[${new Date().toISOString()}] [info] opencourses bootstrap started\n`,
    'utf8'
  )
}

export function createWindow(): BrowserWindow {
  const mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: process.platform === 'darwin' ? { x: 16, y: 12 } : undefined,
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    backgroundColor: '#0a0a0b',
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`))
  }

  return mainWindow
}

export async function bootstrap(): Promise<BrowserWindow> {
  await stateManager.load()
  await logStartup()

  const prerequisites = await prerequisitesService.check()
  stateManager.setAgentPreference(prerequisites.agentCLI)

  if (!handlersRegistered) {
    registerPrerequisitesHandlers()
    registerRegistryHandlers()
    registerCoursesHandlers()
    registerGitHandlers()
    registerGitHubHandlers()
    registerAgentHandlers()
    registerTerminalHandlers()
    registerFsHandlers()
    handlersRegistered = true
  }

  if (!lifecycleRegistered) {
    app.on('window-all-closed', () => {
      if (process.platform !== 'darwin') {
        app.quit()
      }
    })

    app.on('before-quit', () => stateManager.flush())
    lifecycleRegistered = true
  }

  return createWindow()
}
