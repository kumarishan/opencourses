import { createPortal } from 'react-dom'
import { useDeferredValue, useEffect, useMemo, useState } from 'react'
import { Plus, Search, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  IPCError,
  addCourse,
  gitCreateBranch,
  listRegistry,
  setMode,
} from '../ipc/client'
import { cn } from '../lib/utils'
import { useCourseStore } from '../store/courseStore'

type Tab = 'registry' | 'create' | 'github'

interface AddCourseModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddCourseModal({ isOpen, onClose }: AddCourseModalProps): JSX.Element {
  const navigate = useNavigate()
  const upsertCourse = useCourseStore((state) => state.upsertCourse)
  const setActiveCourse = useCourseStore((state) => state.setActiveCourse)
  const updateCourseMode = useCourseStore((state) => state.updateCourseMode)
  const updateCourseBranch = useCourseStore((state) => state.updateCourseBranch)

  const [tab, setTab] = useState<Tab>('registry')
  const [registry, setRegistry] = useState<Awaited<ReturnType<typeof listRegistry>>>([])
  const [registrySelection, setRegistrySelection] = useState<string | null>(null)
  const [registrySearch, setRegistrySearch] = useState('')
  const [githubUrl, setGithubUrl] = useState('')
  const [sourceRepo, setSourceRepo] = useState('')
  const [objective, setObjective] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const deferredSearch = useDeferredValue(registrySearch)

  useEffect(() => {
    if (!isOpen) return

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  useEffect(() => {
    if (!isOpen || tab !== 'registry' || registry.length > 0) return

    let cancelled = false
    void (async () => {
      try {
        const courses = await listRegistry()
        if (!cancelled) {
          setRegistry(courses)
        }
      } catch (err) {
        if (!cancelled) {
          const ipcError = err as IPCError
          setError(ipcError.message)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [isOpen, tab, registry.length])

  const filteredRegistry = useMemo(() => {
    const needle = deferredSearch.trim().toLowerCase()
    if (!needle) return registry

    return registry.filter((course) => {
      const haystack = [
        course.title,
        course.description,
        course.objective,
        course.tags.join(' '),
      ]
        .join(' ')
        .toLowerCase()

      return haystack.includes(needle)
    })
  }, [registry, deferredSearch])

  async function handleCreateMode(courseId: string): Promise<void> {
    let result = await setMode(courseId, 'create')

    if (result.status === 'needs-branch-name') {
      const branchName = window.prompt('Enter branch name:')
      if (!branchName) return
      await gitCreateBranch(courseId, branchName)
      result = await setMode(courseId, 'create')
    }

    if (result.status === 'ok') {
      updateCourseMode(courseId, result.mode)
      updateCourseBranch(courseId, result.branch)
    }
  }

  async function handleSubmit(): Promise<void> {
    setLoading(true)
    setError(null)

    try {
      if (tab === 'registry') {
        const selected = registry.find((course) => course.id === registrySelection)
        if (!selected) {
          setError('Choose a registry course first.')
          return
        }

        const newCourse = await addCourse({ courseRepo: selected.courseRepo })
        upsertCourse(newCourse)
        setActiveCourse(newCourse.id)
        navigate(`/courses/${newCourse.name}`)
        onClose()
        return
      }

      if (tab === 'github') {
        if (!githubUrl.trim()) {
          setError('Enter a GitHub course repository URL.')
          return
        }

        const newCourse = await addCourse({ courseRepo: githubUrl.trim() })
        upsertCourse(newCourse)
        setActiveCourse(newCourse.id)
        navigate(`/courses/${newCourse.name}`)
        onClose()
        return
      }

      if (!sourceRepo.trim()) {
        setError('Enter a source repository URL.')
        return
      }

      const newCourse = await addCourse({
        courseRepo: sourceRepo.trim(),
        sourceRepo: sourceRepo.trim(),
      })
      upsertCourse(newCourse)
      setActiveCourse(newCourse.id)
      navigate(`/courses/${newCourse.name}`)
      await handleCreateMode(newCourse.id)
      if (objective.trim()) {
        window.alert(`Course created for objective: ${objective.trim()}`)
      }
      onClose()
    } catch (err) {
      const ipcError = err as IPCError
      setError(ipcError.message)
    } finally {
      setLoading(false)
    }
  }

  const tabButton = (id: Tab, label: string): JSX.Element => (
    <button
      key={id}
      onClick={() => setTab(id)}
      className={cn(
        'rounded-md px-3 py-1.5 text-sm font-medium transition',
        tab === id
          ? 'bg-surface-3 text-text-primary'
          : 'bg-surface text-text-secondary hover:bg-surface-2 hover:text-text-primary'
      )}
    >
      {label}
    </button>
  )

  if (!isOpen) {
    return <></>
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-4"
      onMouseDown={onClose}
    >
      <div
        className="max-h-[calc(100vh-32px)] w-[calc(100vw-40px)] max-w-[860px] overflow-hidden rounded-xl border border-border bg-surface text-text-primary shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6">
          <div className="px-6 pt-6">
            <p className="m-0 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Add Course
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
              Bring a course into the workspace
            </h2>
          </div>
          <button
            onClick={onClose}
            className="mr-6 mt-6 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-text-secondary transition hover:border-border-hover hover:bg-surface-3 hover:text-text-primary"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-5 flex gap-2 px-6">
          {tabButton('registry', 'Registry')}
          {tabButton('create', 'Create New')}
          {tabButton('github', 'GitHub URL')}
        </div>

        <div className="mx-6 mb-0 mt-5 min-h-[360px] overflow-auto rounded-xl border border-border bg-background p-5">
          {tab === 'registry' ? (
            <div>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
                />
                <input
                  value={registrySearch}
                  onChange={(event) => setRegistrySearch(event.target.value)}
                  placeholder="Search by title, tag, or objective"
                  className="w-full rounded-md border border-border bg-surface pl-9 pr-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
                />
              </div>
              <div className="mt-4 grid gap-3">
                {filteredRegistry.map((course) => (
                  <button
                    key={course.id}
                    onClick={() => setRegistrySelection(course.id)}
                    className={cn(
                      'rounded-lg border p-4 text-left transition',
                      registrySelection === course.id
                        ? 'border-accent/30 bg-accent/10'
                        : 'border-border bg-surface hover:border-border-hover hover:bg-surface-2'
                    )}
                  >
                    <div className="flex justify-between gap-4">
                      <strong className="text-text-primary">{course.title}</strong>
                      <span className="text-xs text-text-muted">
                        v{course.latestVersion}
                      </span>
                    </div>
                    <p className="mt-2.5 text-sm leading-6 text-text-secondary">
                      {course.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {course.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-text-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          {tab === 'create' ? (
            <div className="grid gap-[14px]">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-text-secondary">Source repo URL</span>
                <input
                  value={sourceRepo}
                  onChange={(event) => setSourceRepo(event.target.value)}
                  placeholder="https://github.com/org/repo"
                  className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-text-secondary">Learning objective</span>
                <textarea
                  value={objective}
                  onChange={(event) => setObjective(event.target.value)}
                  rows={6}
                  placeholder="What should learners build or understand by the end?"
                  className="resize-y rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
                />
              </label>
            </div>
          ) : null}

          {tab === 'github' ? (
            <label className="grid gap-2">
              <span className="text-sm font-medium text-text-secondary">Course repo URL</span>
              <input
                value={githubUrl}
                onChange={(event) => setGithubUrl(event.target.value)}
                placeholder="https://github.com/org/course-repo"
                className="rounded-md border border-border bg-surface px-3 py-2.5 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
              />
            </label>
          ) : null}
        </div>

        {error ? (
          <div className="mx-6 mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-3.5 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex justify-end gap-3 border-t border-border px-6 py-5">
          <button
            onClick={onClose}
            className="rounded-md border border-border bg-transparent px-3.5 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleSubmit()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/30 disabled:text-white/50"
          >
            <Plus size={14} />
            {loading ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
