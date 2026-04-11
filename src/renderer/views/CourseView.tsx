import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useGetCourseByName } from '../hooks/useCourses'
import { fsList, setActiveSection as persistActiveSection } from '../ipc/client'
import { buildCourseRoute, decodeSectionParam, type CourseModeRoute } from '../lib/courseRoute'
import { CreateMode } from './CreateMode'
import { LearnMode } from './LearnMode'
import { useCourseStore } from '../store/courseStore'

async function findFirstSection(coursePath: string): Promise<{ chapterId: string; sectionFile: string } | null> {
  try {
    const chapterEntries = (await fsList(`${coursePath}/chapters`)).filter((entry) => entry.isDirectory)
    const sortedChapters = chapterEntries.sort((left, right) => left.name.localeCompare(right.name))

    for (const chapter of sortedChapters) {
      const sectionEntries = (await fsList(`${chapter.path}/sections`))
        .filter((entry) => !entry.isDirectory && entry.name.endsWith('.md'))
        .sort((left, right) => left.name.localeCompare(right.name))

      const firstSection = sectionEntries[0]
      if (firstSection) {
        return {
          chapterId: chapter.name,
          sectionFile: firstSection.path,
        }
      }
    }
  } catch {
    return null
  }

  return null
}

interface CourseViewProps {
  mode?: CourseModeRoute
}

export function CourseView({ mode }: CourseViewProps): JSX.Element {
  const navigate = useNavigate()
  const { name, chapterId, section } = useParams<{
    name: string
    chapterId: string
    section: string
  }>()
  const { activeCourseId, activeChapterId, activeSectionFile, setActiveCourse, setActiveSection } =
    useCourseStore()
  const courseQuery = useGetCourseByName(name, true)

  const course = courseQuery.data
  const routeSectionFile = section ? decodeSectionParam(section) : null

  useEffect(() => {
    if (!course) return

    let cancelled = false

    void (async () => {
      setActiveCourse(course.id)

      if (mode && chapterId && routeSectionFile) {
        setActiveSection(chapterId, routeSectionFile)
        await persistActiveSection(course.id, chapterId, routeSectionFile)
        return
      }

      if (course.activeSection) {
        navigate(
          buildCourseRoute(
            course.activeMode,
            course.name,
            course.activeSection.chapterId,
            course.activeSection.sectionFile
          ),
          { replace: true }
        )
        return
      }

      const firstSection = await findFirstSection(course.localPath)
      if (!cancelled && firstSection) {
        setActiveSection(firstSection.chapterId, firstSection.sectionFile)
        await persistActiveSection(course.id, firstSection.chapterId, firstSection.sectionFile)
        navigate(
          buildCourseRoute(course.activeMode, course.name, firstSection.chapterId, firstSection.sectionFile),
          { replace: true }
        )
      }
    })()

    return () => {
      cancelled = true
    }
  }, [course, mode, chapterId, routeSectionFile, navigate, setActiveCourse, setActiveSection])

  useEffect(() => {
    if (!course || activeCourseId !== course.id || !activeChapterId || !activeSectionFile) {
      return
    }

    void persistActiveSection(course.id, activeChapterId, activeSectionFile)
  }, [course, activeCourseId, activeChapterId, activeSectionFile])

  if (courseQuery.isLoading) {
    return <div className="p-6 text-sm text-text-secondary">Loading course...</div>
  }

  if (!course) {
    return (
      <div className="grid min-h-full place-items-center p-12">
        <div className="w-full max-w-xl rounded-xl border border-border bg-surface p-6">
          <h2 className="mb-2 text-2xl font-semibold text-text-primary">Course not found</h2>
          <p className="text-base leading-7 text-text-secondary">
            No course named <strong>{name}</strong> is loaded in the local workspace.
          </p>
          <button
            onClick={() => navigate('/')}
            className="mt-5 rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
          >
            Back to workspace
          </button>
        </div>
      </div>
    )
  }

  const resolvedMode = mode ?? course.activeMode

  return resolvedMode === 'learn' ? (
    <LearnMode courseId={course.id} />
  ) : (
    <CreateMode courseId={course.id} />
  )
}
