import { useEffect, useRef } from 'react'
import { IPC, type TerminalDataEvent } from '@shared/ipc'
import { FitAddon } from 'xterm-addon-fit'
import { Terminal } from 'xterm'
import 'xterm/css/xterm.css'
import { createTerminal, terminalDestroy, terminalInput, terminalResize, subscribe } from '../ipc/client'
import { useTerminalStore } from '../store/terminalStore'

interface TerminalPanelProps {
  courseId: string
  cwd: string
}

export function TerminalPanel({ courseId, cwd }: TerminalPanelProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const addSession = useTerminalStore((state) => state.addSession)
  const removeSession = useTerminalStore((state) => state.removeSession)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const term = new Terminal({
      fontFamily: '"SFMono-Regular", Menlo, monospace',
      fontSize: 13,
      theme: {
        background: '#111113',
        foreground: '#e4e4e7',
        cursor: '#6366f1',
      },
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(container)
    fitAddon.fit()

    let sessionId: string | null = null
    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      if (sessionId) {
        void terminalResize(sessionId, term.cols, term.rows)
      }
    })
    resizeObserver.observe(container)

    let cleanup = () => {}
    let disposeInput = () => {}

    void (async () => {
      const result = await createTerminal(courseId, cwd)
      sessionId = result.sessionId
      addSession(courseId, sessionId, cwd)
      cleanup = subscribe<TerminalDataEvent>(IPC.terminal.data, (event) => {
        if (event.sessionId === sessionId) {
          term.write(event.data)
        }
      })
      const disposable = term.onData((data) => {
        if (sessionId) {
          void terminalInput(sessionId, data)
        }
      })
      disposeInput = () => disposable.dispose()
      await terminalResize(sessionId, term.cols, term.rows)
    })()

    return () => {
      cleanup()
      disposeInput()
      resizeObserver.disconnect()
      term.dispose()
      if (sessionId) {
        removeSession(sessionId)
        void terminalDestroy(sessionId)
      }
    }
  }, [addSession, courseId, cwd, removeSession])

  return (
    <div
      ref={containerRef}
      className="h-full min-h-[220px] overflow-hidden rounded-lg border border-border bg-background p-2"
    />
  )
}
