import { app, BrowserWindow } from 'electron'
import { bootstrap, createWindow } from './bootstrap'

app.whenReady().then(() => {
  bootstrap()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})
