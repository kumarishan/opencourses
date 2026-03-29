import { create } from 'zustand'

export interface TerminalSessionInfo {
  sessionId: string
  courseId: string
  cwd: string
  connected: boolean
}

export interface TerminalStoreState {
  sessions: Record<string, TerminalSessionInfo>
  addSession: (courseId: string, sessionId: string, cwd: string) => void
  removeSession: (sessionId: string) => void
  getSessionForCourse: (courseId: string) => TerminalSessionInfo | undefined
}

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  sessions: {},
  addSession: (courseId, sessionId, cwd) =>
    set((state) => ({
      sessions: {
        ...state.sessions,
        [sessionId]: {
          sessionId,
          courseId,
          cwd,
          connected: true,
        },
      },
    })),
  removeSession: (sessionId) =>
    set((state) => {
      const nextSessions = { ...state.sessions }
      delete nextSessions[sessionId]
      return { sessions: nextSessions }
    }),
  getSessionForCourse: (courseId) => {
    return Object.values(get().sessions).find((session) => session.courseId === courseId)
  },
}))
