import { useEffect, useState } from 'react'
import type { TaskBlock } from '@shared/types/course'
import { IPCError, agentEvaluate, fsList, fsRead, getCourseProgress, markSectionComplete } from '../ipc/client'
import { CodeEditorPanel } from '../components/CodeEditorPanel'
import { FileTreePanel } from '../components/FileTreePanel'
import { SectionRenderer } from '../components/SectionRenderer'
import { TerminalPanel } from '../components/TerminalPanel'
import { useAgentStore } from '../store/agentStore'
import { useCourseStore } from '../store/courseStore'

interface TaskResult {
  status: 'idle' | 'running' | 'complete' | 'error'
  feedback?: string
  pass?: boolean
}

export function LearnMode({ courseId }: { courseId: string }): JSX.Element {
  const course = useCourseStore((state) => state.courses.find((item) => item.id === courseId))
  const activeSectionFile = useCourseStore((state) => state.activeSectionFile)
  const activeChapterId = useCourseStore((state) => state.activeChapterId)
  const updateCourseProgress = useCourseStore((state) => state.updateCourseProgress)
  const { jobs, startJob, subscribeToJobEvents } = useAgentStore()

  const [selectedScratchFile, setSelectedScratchFile] = useState<string | null>(null)
  const [taskResults, setTaskResults] = useState<Record<string, TaskResult>>({})
  const [evaluationJobId, setEvaluationJobId] = useState<string | null>(null)
  const evaluationJob = evaluationJobId ? jobs[evaluationJobId] : undefined

  useEffect(() => {
    if (!course?.scratchPath) return

    let cancelled = false
    void (async () => {
      try {
        const entries = (await fsList(course.scratchPath)).filter((entry) => !entry.isDirectory)
        if (!cancelled && entries[0]) {
          setSelectedScratchFile(entries[0].path)
        }
      } catch {
        if (!cancelled) {
          setSelectedScratchFile(null)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [course?.scratchPath])

  useEffect(() => {
    if (!evaluationJob || evaluationJob.status === 'running') return

    const taskId = Object.keys(taskResults).find(
      (key) => taskResults[key]?.status === 'running'
    )
    if (!taskId || !course || !activeChapterId || !activeSectionFile) return

    if (evaluationJob.status === 'error') {
      setTaskResults((state) => ({
        ...state,
        [taskId]: { status: 'error', feedback: evaluationJob.error },
      }))
      return
    }

    const nextResult: TaskResult = {
      status: 'complete',
      pass: evaluationJob.pass,
      feedback: evaluationJob.feedback,
    }
    setTaskResults((state) => ({ ...state, [taskId]: nextResult }))

    if (evaluationJob.pass) {
      void (async () => {
        await markSectionComplete(course.id, activeChapterId, activeSectionFile)
        const progress = await getCourseProgress(course.id)
        updateCourseProgress(course.id, progress)
      })()
    }
  }, [activeChapterId, activeSectionFile, course, evaluationJob, taskResults, updateCourseProgress])

  async function handleTaskSubmit(taskBlock: TaskBlock): Promise<void> {
    if (!course || !activeSectionFile) return

    setTaskResults((state) => ({
      ...state,
      [taskBlock.id]: { status: 'running' },
    }))

    try {
      const entries = await fsList(course.scratchPath)
      const scratchFiles = await Promise.all(
        entries
          .filter((entry) => !entry.isDirectory)
          .map(async (entry) => {
            const file = await fsRead(entry.path)
            return { path: entry.path, content: file.content }
          })
      )

      const result = await agentEvaluate({
        courseId: course.id,
        sectionFile: activeSectionFile,
        taskBlock,
        scratchFiles,
      })

      startJob(result.jobId, 'evaluation')
      const cleanup = subscribeToJobEvents(result.jobId)
      setEvaluationJobId(result.jobId)

      window.setTimeout(() => {
        cleanup()
      }, 30000)
    } catch (err) {
      const ipcError = err as IPCError
      setTaskResults((state) => ({
        ...state,
        [taskBlock.id]: { status: 'error', feedback: ipcError.message },
      }))
    }
  }

  if (!course) {
    return <div className="p-6 text-sm text-text-secondary">Course not loaded.</div>
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
      <div className="grid min-h-0 grid-rows-[minmax(0,0.9fr)_minmax(220px,1fr)_minmax(220px,0.9fr)] border-r border-border bg-surface">
        <div className="min-h-0 overflow-hidden border-b border-border px-3 py-3">
          <FileTreePanel
            rootPath={course.scratchPath}
            selectedFile={selectedScratchFile}
            onSelectFile={setSelectedScratchFile}
          />
        </div>
        <div className="min-h-0 overflow-hidden border-b border-border bg-background">
          <CodeEditorPanel filePath={selectedScratchFile} />
        </div>
        <div className="min-h-0 overflow-hidden bg-surface px-3 py-3">
          <TerminalPanel courseId={course.id} cwd={course.scratchPath} />
        </div>
      </div>

      {activeSectionFile ? (
        <SectionRenderer
          courseId={course.id}
          sectionFile={activeSectionFile}
          readOnly
          onTaskSubmit={(taskBlock) => void handleTaskSubmit(taskBlock)}
          taskResults={taskResults}
        />
      ) : (
        <div className="p-6 text-sm text-text-secondary">Choose a section from the sidebar.</div>
      )}
    </div>
  )
}
