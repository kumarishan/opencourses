import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { ArrowLeft, ArrowRight, ChevronRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  createPR,
  getCourseProgress,
  gitCheckout,
  gitCommitAndPush,
  gitCreateBranch,
  gitListBranches,
  markSectionComplete,
  setMode,
} from '../ipc/client'
import { cn } from '../lib/utils'
import { getActiveCourse, useCourseStore } from '../store/courseStore'
import { useBranchNameDialog } from './BranchNameDialog'

function prettifyChapter(chapterId: string | null): string {
  if (!chapterId) return 'Overview'
  return chapterId.replace(/^\d+-/, '').replace(/-/g, ' ')
}

interface TopNavbarProps {
  sidebarCollapsed: boolean
  onToggleSidebar: () => void
}

export function TopNavbar({ sidebarCollapsed, onToggleSidebar }: TopNavbarProps): JSX.Element {
  const navigate = useNavigate()
  const courseStore = useCourseStore()
  const activeCourse = useMemo(() => getActiveCourse(courseStore), [courseStore])
  const { dialog: branchNameDialog, requestBranchName } = useBranchNameDialog()
  const [branches, setBranches] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const noDragStyle: CSSProperties = { WebkitAppRegion: 'no-drag' }
  const leftInset = navigator.userAgent.includes('Mac') ? 80 : 12

  useEffect(() => {
    if (!activeCourse) {
      setBranches([])
      return
    }

    let cancelled = false

    void (async () => {
      try {
        const branchList = await gitListBranches(activeCourse.id)
        if (!cancelled) {
          setBranches(branchList)
        }
      } catch {
        if (!cancelled) {
          setBranches([activeCourse.activeBranch])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [activeCourse?.id, activeCourse?.activeBranch])

  async function handleModeChange(nextMode: 'learn' | 'create'): Promise<void> {
    if (!activeCourse) return

    setBusy(true)
    setStatusMessage(null)

    try {
      let result = await setMode(activeCourse.id, nextMode)

      if (result.status === 'needs-branch-name') {
        const branchName = await requestBranchName({
          title: 'Create a working branch',
          description: 'Create mode needs a branch before this course can switch into editing mode.',
          confirmLabel: 'Create Branch',
        })
        if (!branchName) return
        await gitCreateBranch(activeCourse.id, branchName)
        result = await setMode(activeCourse.id, 'create')
      }

      if (result.status === 'pr-merged') {
        const branchName = await requestBranchName({
          title: 'Start a new branch',
          description: `The previous PR was already merged: ${result.prUrl}`,
          confirmLabel: 'Create Branch',
        })
        if (!branchName) return
        await gitCreateBranch(activeCourse.id, branchName)
        result = await setMode(activeCourse.id, 'create')
      }

      if (result.status === 'ok') {
        courseStore.updateCourseMode(activeCourse.id, result.mode)
        courseStore.updateCourseBranch(activeCourse.id, result.branch)
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleBranchChange(branch: string): Promise<void> {
    if (!activeCourse) return
    setBusy(true)
    setStatusMessage(null)

    try {
      await gitCheckout(activeCourse.id, branch)
      courseStore.updateCourseBranch(activeCourse.id, branch)
    } finally {
      setBusy(false)
    }
  }

  async function handleMarkComplete(): Promise<void> {
    if (!activeCourse || !courseStore.activeChapterId || !courseStore.activeSectionFile) return

    setBusy(true)
    setStatusMessage(null)

    try {
      await markSectionComplete(
        activeCourse.id,
        courseStore.activeChapterId,
        courseStore.activeSectionFile
      )
      const progress = await getCourseProgress(activeCourse.id)
      courseStore.updateCourseProgress(activeCourse.id, progress)
      setStatusMessage('Section marked complete.')
    } finally {
      setBusy(false)
    }
  }

  async function handlePushAndCreatePr(): Promise<void> {
    if (!activeCourse) return

    setBusy(true)
    setStatusMessage(null)

    try {
      await gitCommitAndPush(activeCourse.id, 'Update course content')
      const pr = await createPR({
        cwd: activeCourse.localPath,
        title: `Update ${activeCourse.title}`,
        body: 'Created from opencourses create mode.',
        base: 'main',
      })
      setStatusMessage(pr.url ? `PR created: ${pr.url}` : 'Changes pushed and PR requested.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <header
      className="electron-drag relative flex h-10 w-full shrink-0 items-center border-b border-border bg-surface pr-3"
      style={{ paddingLeft: leftInset }}
    >
      <div className="electron-no-drag flex shrink-0 items-center gap-0.5 pl-2" style={noDragStyle}>
        <button
          onClick={onToggleSidebar}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
          title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {sidebarCollapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        </button>
        <button
          onClick={() => navigate(-1)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
          title="Back"
        >
          <ArrowLeft size={14} />
        </button>
        <button
          onClick={() => navigate(1)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-2 hover:text-text-primary"
          title="Forward"
        >
          <ArrowRight size={14} />
        </button>
      </div>

      {activeCourse ? (
        <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
          <div
            className="pointer-events-auto flex items-center rounded-md border border-border bg-surface-2 p-0.5"
            style={noDragStyle}
          >
            {(['learn', 'create'] as const).map((mode) => (
              <button
                key={mode}
                disabled={busy || !activeCourse}
                onClick={() => void handleModeChange(mode)}
                className={cn(
                  'rounded px-2.5 py-0.5 text-xs font-medium transition-colors',
                  activeCourse.activeMode === mode
                    ? 'bg-surface-3 text-text-primary'
                    : 'text-text-muted hover:text-text-secondary'
                )}
              >
                {mode === 'learn' ? 'Learn' : 'Create'}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div
        className="electron-no-drag ml-2 flex min-w-0 flex-1 items-center gap-1 text-xs"
        style={noDragStyle}
      >
        {activeCourse ? (
          <>
            <span className="truncate font-medium text-text-primary">{activeCourse.title}</span>
            <ChevronRight size={12} className="shrink-0 text-text-muted" />
            <span className="truncate text-text-secondary">
              {prettifyChapter(courseStore.activeChapterId)}
            </span>
            {statusMessage ? (
              <>
                <span className="text-text-muted">·</span>
                <span className="truncate text-text-muted">{statusMessage}</span>
              </>
            ) : null}
          </>
        ) : (
          <>
            <span className="font-medium text-text-primary">OpenCourses</span>
            <span className="text-text-muted">Workspace</span>
          </>
        )}
      </div>

      <div
        className="electron-no-drag ml-auto flex items-center gap-2"
        style={noDragStyle}
      >
        {activeCourse?.activeMode === 'create' ? (
          <button
            onClick={() => void handlePushAndCreatePr()}
            disabled={busy}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-white transition-colors hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/30 disabled:text-white/50"
          >
            Push PR
          </button>
        ) : (
          <button
            onClick={() => void handleMarkComplete()}
            disabled={busy || !activeCourse}
            className="rounded-md border border-border bg-surface-2 px-2.5 py-1 text-xs font-medium text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary disabled:cursor-not-allowed disabled:text-text-muted/50"
          >
            Complete
          </button>
        )}

        <select
          value={activeCourse?.activeBranch ?? ''}
          disabled={!activeCourse || busy}
          onChange={(event) => void handleBranchChange(event.target.value)}
          className={cn(
            'h-6 min-w-32 rounded-md border border-border bg-surface-2 px-2 text-xs text-text-primary outline-none transition focus:border-accent',
            !activeCourse || busy ? 'cursor-not-allowed text-text-muted' : 'cursor-pointer'
          )}
        >
          {!activeCourse ? <option value="">No branch</option> : null}
          {branches.map((branch) => (
            <option key={branch} value={branch}>
              {branch}
            </option>
          ))}
        </select>

        {!activeCourse ? null : (
          <div className="rounded-md border border-border bg-surface-2 px-2 py-1 text-[10px] uppercase tracking-[0.16em] text-text-secondary">
            {activeCourse.activeMode}
          </div>
        )}
      </div>

      {branchNameDialog}
    </header>
  )
}
