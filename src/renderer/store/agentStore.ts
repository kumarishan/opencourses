import { create } from 'zustand'
import { IPC } from '@shared/ipc'
import type {
  AgentCompleteEvent,
  AgentErrorEvent,
  AgentStreamChunkEvent,
  EvaluationResult,
} from '@shared/ipc'
import { subscribe } from '../ipc/client'

export interface AgentJob {
  jobId: string
  phase: string
  status: 'running' | 'complete' | 'error'
  chunks: string[]
  outline?: AgentCompleteEvent['outline']
  pass?: boolean
  feedback?: string
  error?: string
}

export interface AgentStoreState {
  jobs: Record<string, AgentJob>
  startJob: (jobId: string, phase: string) => void
  appendChunk: (jobId: string, chunk: string) => void
  completeJob: (jobId: string, event: Partial<AgentCompleteEvent & EvaluationResult>) => void
  failJob: (jobId: string, error: string) => void
  clearJob: (jobId: string) => void
  subscribeToJobEvents: (jobId: string) => () => void
}

export const useAgentStore = create<AgentStoreState>((set, get) => ({
  jobs: {},
  startJob: (jobId, phase) =>
    set((state) => ({
      jobs: {
        ...state.jobs,
        [jobId]: {
          jobId,
          phase,
          status: 'running',
          chunks: [],
        },
      },
    })),
  appendChunk: (jobId, chunk) =>
    set((state) => {
      const job = state.jobs[jobId]
      if (!job) return state

      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...job,
            chunks: [...job.chunks, chunk],
          },
        },
      }
    }),
  completeJob: (jobId, event) =>
    set((state) => {
      const job = state.jobs[jobId]
      if (!job) return state

      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...job,
            status: 'complete',
            outline: event.outline ?? job.outline,
            pass: event.pass ?? job.pass,
            feedback: event.feedback ?? job.feedback,
          },
        },
      }
    }),
  failJob: (jobId, error) =>
    set((state) => {
      const job = state.jobs[jobId]
      if (!job) return state

      return {
        jobs: {
          ...state.jobs,
          [jobId]: {
            ...job,
            status: 'error',
            error,
          },
        },
      }
    }),
  clearJob: (jobId) =>
    set((state) => {
      const nextJobs = { ...state.jobs }
      delete nextJobs[jobId]
      return { jobs: nextJobs }
    }),
  subscribeToJobEvents: (jobId) => {
    const cleanups = [
      subscribe<AgentStreamChunkEvent>(IPC.agent.streamChunk, (event) => {
        if (event.jobId === jobId) {
          get().appendChunk(jobId, event.chunk)
        }
      }),
      subscribe<AgentCompleteEvent>(IPC.agent.complete, (event) => {
        if (event.jobId === jobId) {
          get().completeJob(jobId, event)
        }
      }),
      subscribe<AgentErrorEvent>(IPC.agent.error, (event) => {
        if (event.jobId === jobId) {
          get().failJob(jobId, event.error)
        }
      }),
      subscribe<EvaluationResult>(IPC.agent.evaluationResult, (event) => {
        if (event.jobId === jobId) {
          get().completeJob(jobId, event)
        }
      }),
    ]

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  },
}))
