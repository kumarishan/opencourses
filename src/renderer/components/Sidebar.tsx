import { useEffect, useState, type MouseEvent as ReactMouseEvent } from 'react'
import { Check, ChevronDown, ChevronRight, Circle, MoreHorizontal, Plus, Trash2 } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import {
  IPCError,
  fsList,
  fsRead,
  setActiveSection as persistActiveSection,
} from '../ipc/client'
import { useRemoveCourse } from '../hooks/useCourses'
import { cn } from '../lib/utils'
import { buildCourseRoute } from '../lib/courseRoute'
import { useCourseStore } from '../store/courseStore'
import { AddCourseModal } from './AddCourseModal'

interface LoadedSection {
  title: string
  order: number
  path: string
}

interface LoadedChapter {
  id: string
  title: string
  order: number
  sections: LoadedSection[]
}

interface LoadedCourseTree {
  chapters: LoadedChapter[]
}

interface SidebarProps {
  collapsed: boolean
}

interface ContextMenuState {
  courseId: string
  x: number
  y: number
}

const CONTEXT_MENU_WIDTH = 190
const CONTEXT_MENU_MARGIN = 12

function parseFrontmatter(markdown: string): { title: string; order: number } {
  const match = markdown.match(/^---\n([\s\S]*?)\n---/)
  if (!match) {
    return { title: 'Untitled section', order: Number.MAX_SAFE_INTEGER }
  }

  const fields = Object.fromEntries(
    match[1]
      .split('\n')
      .map((line) => line.split(':'))
      .filter((parts) => parts.length >= 2)
      .map(([key, ...value]) => [key.trim(), value.join(':').trim()])
  )

  return {
    title: fields.title ?? 'Untitled section',
    order: Number(fields.order ?? Number.MAX_SAFE_INTEGER),
  }
}

async function loadCourseTree(coursePath: string): Promise<LoadedCourseTree> {
  const chapterEntries = (await fsList(`${coursePath}/chapters`)).filter((entry) => entry.isDirectory)
  const chapters = await Promise.all(
    chapterEntries.map(async (chapterEntry) => {
      let chapterTitle = chapterEntry.name
      let chapterOrder = Number.MAX_SAFE_INTEGER

      try {
        const chapterMeta = await fsRead(`${chapterEntry.path}/chapter.json`)
        const parsed = JSON.parse(chapterMeta.content) as { title?: string; order?: number }
        chapterTitle = parsed.title ?? chapterTitle
        chapterOrder = parsed.order ?? chapterOrder
      } catch {
        chapterTitle = chapterEntry.name.replace(/^\d+-/, '').replace(/-/g, ' ')
      }

      const sectionEntries = (await fsList(`${chapterEntry.path}/sections`))
        .filter((entry) => !entry.isDirectory && entry.name.endsWith('.md'))
        .sort((left, right) => left.name.localeCompare(right.name))

      const sections = await Promise.all(
        sectionEntries.map(async (sectionEntry) => {
          try {
            const markdown = await fsRead(sectionEntry.path)
            const parsed = parseFrontmatter(markdown.content)
            return {
              title: parsed.title,
              order: parsed.order,
              path: sectionEntry.path,
            }
          } catch {
            return {
              title: sectionEntry.name.replace(/^\d+-/, '').replace(/\.md$/, '').replace(/-/g, ' '),
              order: Number.MAX_SAFE_INTEGER,
              path: sectionEntry.path,
            }
          }
        })
      )

      return {
        id: chapterEntry.name,
        title: chapterTitle,
        order: chapterOrder,
        sections: sections.sort((left, right) => left.order - right.order),
      }
    })
  )

  return {
    chapters: chapters.sort((left, right) => left.order - right.order),
  }
}

export function Sidebar({ collapsed }: SidebarProps): JSX.Element {
  const navigate = useNavigate()
  const removeCourseMutation = useRemoveCourse()
  const {
    courses,
    activeCourseId,
    activeChapterId,
    activeSectionFile,
    setActiveCourse,
    setActiveSection,
    removeCourse,
  } = useCourseStore()
  const [trees, setTrees] = useState<Record<string, LoadedCourseTree>>({})
  const [expandedCourses, setExpandedCourses] = useState<Record<string, boolean>>({})
  const [expandedChapters, setExpandedChapters] = useState<Record<string, boolean>>({})
  const [loadingCourseId, setLoadingCourseId] = useState<string | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [removingCourseId, setRemovingCourseId] = useState<string | null>(null)

  async function ensureCourseTree(courseId: string, coursePath: string): Promise<void> {
    if (trees[courseId]) return
    setLoadingCourseId(courseId)
    try {
      const tree = await loadCourseTree(coursePath)
      setTrees((state) => ({ ...state, [courseId]: tree }))
    } finally {
      setLoadingCourseId(null)
    }
  }

  useEffect(() => {
    if (!activeCourseId) return
    const activeCourse = courses.find((course) => course.id === activeCourseId)
    if (!activeCourse) return

    setExpandedCourses((state) =>
      state[activeCourseId] ? state : { ...state, [activeCourseId]: true }
    )

    void ensureCourseTree(activeCourse.id, activeCourse.localPath)
  }, [activeCourseId, courses])

  useEffect(() => {
    if (!activeCourseId || !activeChapterId) return
    const chapterKey = `${activeCourseId}:${activeChapterId}`
    setExpandedChapters((state) => (state[chapterKey] ? state : { ...state, [chapterKey]: true }))
  }, [activeChapterId, activeCourseId])

  useEffect(() => {
    if (!contextMenu) return

    function closeContextMenu(): void {
      setContextMenu(null)
    }

    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        closeContextMenu()
      }
    }

    window.addEventListener('mousedown', closeContextMenu)
    window.addEventListener('contextmenu', closeContextMenu)
    window.addEventListener('keydown', onKeyDown)

    return () => {
      window.removeEventListener('mousedown', closeContextMenu)
      window.removeEventListener('contextmenu', closeContextMenu)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [contextMenu])

  async function toggleCourse(courseId: string, coursePath: string): Promise<void> {
    const nextExpanded = !expandedCourses[courseId]
    setExpandedCourses((state) => ({ ...state, [courseId]: nextExpanded }))

    if (nextExpanded) {
      await ensureCourseTree(courseId, coursePath)
    }
  }

  async function openSection(
    courseId: string,
    courseName: string,
    courseMode: 'learn' | 'create',
    chapterId: string,
    sectionFile: string
  ): Promise<void> {
    setActiveCourse(courseId)
    setActiveSection(chapterId, sectionFile)
    await persistActiveSection(courseId, chapterId, sectionFile)
    navigate(buildCourseRoute(courseMode, courseName, chapterId, sectionFile))
  }

  function openCourse(courseId: string, courseName: string, coursePath: string): void {
    setActiveCourse(courseId)
    setExpandedCourses((state) => ({ ...state, [courseId]: true }))
    void ensureCourseTree(courseId, coursePath)
    navigate(`/courses/${courseName}`)
  }

  function openCourseContextMenuAt(courseId: string, x: number, y: number): void {
    const maxX = window.innerWidth - CONTEXT_MENU_WIDTH - CONTEXT_MENU_MARGIN
    const maxY = window.innerHeight - 60

    setContextMenu({
      courseId,
      x: Math.max(CONTEXT_MENU_MARGIN, Math.min(x, maxX)),
      y: Math.max(CONTEXT_MENU_MARGIN, Math.min(y, maxY)),
    })
  }

  function openCourseContextMenu(
    event: ReactMouseEvent<HTMLButtonElement>,
    courseId: string
  ): void {
    event.preventDefault()
    event.stopPropagation()
    openCourseContextMenuAt(courseId, event.clientX, event.clientY)
  }

  async function handleRemoveCourse(courseId: string): Promise<void> {
    const course = courses.find((item) => item.id === courseId)
    if (!course) return

    setContextMenu(null)

    const confirmed = window.confirm(
      `Remove "${course.title}" from the workspace and delete its local checkout?`
    )
    if (!confirmed) return

    setRemovingCourseId(courseId)

    try {
      await removeCourseMutation.mutateAsync(courseId)
      removeCourse(courseId)
      setTrees((state) => {
        const next = { ...state }
        delete next[courseId]
        return next
      })
      setExpandedCourses((state) => {
        const next = { ...state }
        delete next[courseId]
        return next
      })
      setExpandedChapters((state) =>
        Object.fromEntries(
          Object.entries(state).filter(([key]) => !key.startsWith(`${courseId}:`))
        )
      )
      if (activeCourseId === courseId) {
        navigate('/')
      }
    } catch (err) {
      const ipcError = err as IPCError
      window.alert(ipcError.message)
    } finally {
      setRemovingCourseId(null)
    }
  }

  function courseMonogram(title: string): string {
    const initials = title
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? '')
      .join('')

    return initials || title.slice(0, 2).toUpperCase()
  }

  return (
    <>
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col overflow-hidden border-r border-border bg-surface transition-[width] duration-200',
          collapsed ? 'w-14' : 'w-[280px]'
        )}
      >
        <div className={cn('border-b border-border', collapsed ? 'px-2 py-2' : 'px-3 py-3')}>
          {collapsed ? (
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-surface-2 text-sm text-text-primary transition hover:border-border-hover hover:bg-surface-3"
              title="Add course"
            >
              <Plus size={14} />
            </button>
          ) : (
            <>
              <div className="mb-3">
                <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                  Workspace
                </div>
                <div className="mt-1 text-sm font-medium text-text-primary">Courses</div>
              </div>
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-md border border-border bg-surface-2 px-3 py-2 text-xs font-medium text-text-primary transition hover:border-border-hover hover:bg-surface-3"
              >
                <Plus size={13} />
                Add Course
              </button>
            </>
          )}
        </div>

        <div className={cn('min-h-0 flex-1 overflow-y-auto', collapsed ? 'px-2 py-2' : 'px-2 py-2')}>
          {!collapsed ? (
            <div className="px-2 pb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Library
            </div>
          ) : null}

          <div className="grid gap-1">
            {courses.map((course) => {
              const tree = trees[course.id]
              const isActiveCourse = course.id === activeCourseId
              return (
                <div key={course.id} className="overflow-hidden">
                  <div
                    onContextMenu={(event) => {
                      event.preventDefault()
                      openCourseContextMenuAt(course.id, event.clientX, event.clientY)
                    }}
                    className={cn(
                      'group flex items-center gap-1 rounded-md border border-transparent transition',
                      isActiveCourse
                        ? 'border-border bg-surface-2 text-text-primary'
                        : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                    )}
                  >
                    <button
                      onClick={() => openCourse(course.id, course.name, course.localPath)}
                      title={collapsed ? course.title : undefined}
                      className={cn(
                        'min-w-0 flex-1 text-left',
                        collapsed
                          ? 'flex h-10 items-center justify-center px-2'
                          : 'flex items-center gap-2 px-2.5 py-2'
                      )}
                    >
                      {collapsed ? (
                        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-[11px] font-semibold text-text-primary">
                          {courseMonogram(course.title)}
                        </span>
                      ) : (
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-current">{course.title}</div>
                          <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-text-muted">
                            {course.activeMode}
                          </div>
                        </div>
                      )}
                    </button>

                    {!collapsed ? (
                      <>
                        <button
                          onClick={() => void toggleCourse(course.id, course.localPath)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition hover:bg-surface-3 hover:text-text-primary"
                          title={expandedCourses[course.id] ? 'Collapse course' : 'Expand course'}
                        >
                          {expandedCourses[course.id] ? (
                            <ChevronDown size={12} />
                          ) : (
                            <ChevronRight size={12} />
                          )}
                        </button>
                        <button
                          onClick={(event) => openCourseContextMenu(event, course.id)}
                          className="mr-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted opacity-0 transition hover:bg-surface-3 hover:text-text-primary group-hover:opacity-100"
                          title="Course actions"
                        >
                          <MoreHorizontal size={12} />
                        </button>
                      </>
                    ) : null}
                  </div>

                  {!collapsed && expandedCourses[course.id] ? (
                    <div className="ml-3 mt-1.5 border-l border-border pl-2">
                      {loadingCourseId === course.id ? (
                        <div className="px-2 py-2 text-xs text-text-secondary">Loading...</div>
                      ) : null}

                      {tree?.chapters.map((chapter) => {
                        const chapterKey = `${course.id}:${chapter.id}`
                        const chapterProgress = course.learnerProgress[chapter.id]
                        const isActiveChapter = isActiveCourse && chapter.id === activeChapterId
                        return (
                          <div key={chapter.id} className="mb-1 last:mb-0">
                            <button
                              onClick={() =>
                                setExpandedChapters((state) => ({
                                  ...state,
                                  [chapterKey]: !state[chapterKey],
                                }))
                              }
                              className={cn(
                                'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-xs transition',
                                isActiveChapter
                                  ? 'bg-surface-2 text-text-primary'
                                  : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                              )}
                            >
                              <span className="truncate">{chapter.title}</span>
                              {expandedChapters[chapterKey] ? (
                                <ChevronDown size={12} className="shrink-0 text-text-muted" />
                              ) : (
                                <ChevronRight size={12} className="shrink-0 text-text-muted" />
                              )}
                            </button>

                            {expandedChapters[chapterKey] ? (
                              <div className="mt-1 grid gap-0.5 pl-2">
                                {chapter.sections.map((section) => {
                                  const completed =
                                    chapterProgress?.sections[section.path]?.completed ?? false
                                  const isActiveSection =
                                    isActiveCourse &&
                                    chapter.id === activeChapterId &&
                                    section.path === activeSectionFile
                                  return (
                                    <button
                                      key={section.path}
                                      onClick={() =>
                                        void openSection(
                                          course.id,
                                          course.name,
                                          course.activeMode,
                                          chapter.id,
                                          section.path
                                        )
                                      }
                                      className={cn(
                                        'flex items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition',
                                        isActiveSection
                                          ? 'bg-accent/12 text-text-primary'
                                          : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'shrink-0 text-[10px]',
                                          completed ? 'text-emerald-400' : 'text-text-muted'
                                        )}
                                      >
                                        {completed ? <Check size={12} /> : <Circle size={10} />}
                                      </span>
                                      <span className="truncate">{section.title}</span>
                                    </button>
                                  )
                                })}
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        </div>
      </aside>

      {contextMenu ? (
        <div
          className="fixed z-[400] min-w-[190px] rounded-lg border border-border bg-surface p-1 shadow-2xl"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onMouseDown={(event) => event.stopPropagation()}
        >
          <button
            onClick={() => void handleRemoveCourse(contextMenu.courseId)}
            disabled={removingCourseId === contextMenu.courseId}
            className={cn(
              'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-xs transition',
              removingCourseId === contextMenu.courseId
                ? 'cursor-not-allowed text-text-muted'
                : 'text-red-300 hover:bg-red-500/10 hover:text-red-200'
            )}
          >
            <Trash2 size={12} />
            {removingCourseId === contextMenu.courseId ? 'Removing course...' : 'Remove course'}
          </button>
        </div>
      ) : null}

      <AddCourseModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
