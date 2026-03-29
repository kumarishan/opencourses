import { useEffect, useRef, useState } from 'react'
import type { ChapterOutline } from '@shared/types/course'
import { IPCError, agentCancel, startAgentGeneration } from '../ipc/client'
import { cn } from '../lib/utils'
import { useAgentStore } from '../store/agentStore'
import { useCourseStore } from '../store/courseStore'

interface Message {
  role: 'user' | 'agent' | 'system'
  content: string
}

interface AgentChatPanelProps {
  courseId: string
}

export function AgentChatPanel({ courseId }: AgentChatPanelProps): JSX.Element {
  const activeChapterId = useCourseStore((state) => state.activeChapterId)
  const activeSectionFile = useCourseStore((state) => state.activeSectionFile)
  const { jobs, startJob, subscribeToJobEvents } = useAgentStore()

  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [phase, setPhase] = useState<'idle' | 'outline' | 'outline-review' | 'content' | 'complete'>('idle')
  const [pendingOutline, setPendingOutline] = useState<ChapterOutline[] | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const cleanupRef = useRef<(() => void) | null>(null)
  const handledJobs = useRef<Record<string, boolean>>({})

  const currentJob = currentJobId ? jobs[currentJobId] : undefined

  useEffect(() => {
    return () => {
      cleanupRef.current?.()
    }
  }, [])

  useEffect(() => {
    if (!currentJob || currentJob.status === 'running' || handledJobs.current[currentJob.jobId]) {
      return
    }

    handledJobs.current[currentJob.jobId] = true

    if (currentJob.status === 'error') {
      setMessages((state) => [...state, { role: 'system', content: currentJob.error ?? 'Agent failed.' }])
      setPhase('idle')
      return
    }

    const transcript = currentJob.chunks.join('\n').trim()
    if (transcript) {
      setMessages((state) => [...state, { role: 'agent', content: transcript }])
    }

    if (currentJob.phase === 'outline' && currentJob.outline) {
      setPendingOutline(currentJob.outline)
      setPhase('outline-review')
      return
    }

    setPhase('complete')
  }, [currentJob])

  async function runJob(
    nextPhase: 'outline' | 'content' | 'section-update',
    instructions: string
  ): Promise<void> {
    try {
      const result = await startAgentGeneration({
        courseId,
        phase: nextPhase,
        instructions,
        targetChapter: nextPhase === 'section-update' ? activeChapterId ?? undefined : undefined,
        targetSection: nextPhase === 'section-update' ? activeSectionFile ?? undefined : undefined,
      })

      cleanupRef.current?.()
      startJob(result.jobId, nextPhase)
      cleanupRef.current = subscribeToJobEvents(result.jobId)
      setCurrentJobId(result.jobId)
      setPhase(nextPhase === 'outline' ? 'outline' : 'content')
    } catch (err) {
      const ipcError = err as IPCError
      setMessages((state) => [...state, { role: 'system', content: ipcError.message }])
    }
  }

  async function handleSend(): Promise<void> {
    const trimmed = input.trim()
    if (!trimmed) return

    setMessages((state) => [...state, { role: 'user', content: trimmed }])
    setInput('')

    if (phase === 'idle' || phase === 'complete') {
      const nextPhase = pendingOutline ? 'section-update' : 'outline'
      await runJob(nextPhase, trimmed)
    }
  }

  async function handleAcceptOutline(): Promise<void> {
    if (!pendingOutline) return
    await runJob('content', JSON.stringify(pendingOutline))
  }

  function updateOutlineChapter(
    index: number,
    updates: Partial<ChapterOutline>
  ): void {
    setPendingOutline((outline) =>
      outline?.map((chapter, chapterIndex) =>
        chapterIndex === index ? { ...chapter, ...updates } : chapter
      ) ?? null
    )
  }

  function updateOutlineSection(
    chapterIndex: number,
    sectionIndex: number,
    value: string
  ): void {
    setPendingOutline((outline) =>
      outline?.map((chapter, currentChapterIndex) =>
        currentChapterIndex === chapterIndex
          ? {
              ...chapter,
              sections: chapter.sections.map((section, currentSectionIndex) =>
                currentSectionIndex === sectionIndex ? { ...section, title: value } : section
              ),
            }
          : chapter
      ) ?? null
    )
  }

  return (
    <div className="grid h-full grid-rows-[minmax(0,1fr)_auto]">
      <div className="grid gap-3 overflow-auto px-4 py-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
            Agent Chat
          </div>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
            Build the course outline, then the content
          </h2>
        </div>

        {messages.map((message, index) => (
          <div
            key={`${message.role}-${index}`}
            className={cn(
              'max-w-[88%] whitespace-pre-wrap rounded-lg border px-3.5 py-3 text-sm leading-6',
              message.role === 'user'
                ? 'justify-self-end border-accent/20 bg-accent/10 text-text-primary'
                : message.role === 'agent'
                  ? 'justify-self-start border-border bg-background text-text-primary'
                  : 'justify-self-start border border-red-400/20 bg-red-500/10 text-red-200'
            )}
          >
            {message.content}
          </div>
        ))}

        {currentJob?.status === 'running' ? (
          <div className="max-w-[88%] justify-self-start whitespace-pre-wrap rounded-lg border border-border bg-background px-3.5 py-3 text-sm leading-6 text-text-primary">
            {currentJob.chunks.join('\n') || 'Waiting for agent output...'}
          </div>
        ) : null}

        {phase === 'outline-review' && pendingOutline ? (
          <div className="grid gap-4 rounded-xl border border-border bg-background p-4">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Outline Review
              </div>
              <p className="mt-2 text-sm leading-6 text-text-secondary">
                Adjust chapter and section titles before content generation begins.
              </p>
            </div>

            {pendingOutline.map((chapter, chapterIndex) => (
              <div
                key={`${chapter.title}-${chapterIndex}`}
                className="grid gap-2.5 rounded-lg border border-border bg-surface p-3"
              >
                <input
                  value={chapter.title}
                  onChange={(event) =>
                    updateOutlineChapter(chapterIndex, { title: event.target.value })
                  }
                  className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                />
                <textarea
                  value={chapter.description}
                  onChange={(event) =>
                    updateOutlineChapter(chapterIndex, { description: event.target.value })
                  }
                  rows={3}
                  className="resize-y rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                />
                <div className="grid gap-2">
                  {chapter.sections.map((section, sectionIndex) => (
                    <input
                      key={`${section.title}-${sectionIndex}`}
                      value={section.title}
                      onChange={(event) =>
                        updateOutlineSection(chapterIndex, sectionIndex, event.target.value)
                      }
                      className="rounded-md border border-border bg-background px-3 py-2 text-sm text-text-primary outline-none transition focus:border-accent"
                    />
                  ))}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => void handleAcceptOutline()}
                className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
              >
                Accept Outline
              </button>
              <button
                onClick={() => {
                  setPendingOutline(null)
                  setPhase('idle')
                }}
                className="rounded-md border border-border bg-transparent px-3.5 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
              >
                Regenerate
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-3 border-t border-border bg-surface px-4 py-3">
        <textarea
          value={input}
          onChange={(event) => setInput(event.target.value)}
          rows={4}
          placeholder="Describe the outline you want, or request a targeted update."
          className="resize-y rounded-md border border-border bg-background px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
        />
        <div className="flex justify-between gap-3">
          <div className="text-sm text-text-secondary">
            {phase === 'outline-review'
              ? 'Review the outline before starting content generation.'
              : 'The current section can be updated with targeted instructions after generation.'}
          </div>
          <div className="flex gap-2.5">
            {currentJob?.status === 'running' && currentJobId ? (
              <button
                onClick={() => void agentCancel(currentJobId)}
                className="rounded-md border border-red-400/30 bg-red-500/10 px-3.5 py-2 text-sm font-medium text-red-200 transition hover:border-red-300/40 hover:bg-red-500/15"
              >
                Cancel
              </button>
            ) : null}
            <button
              onClick={() => void handleSend()}
              className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
