import { useEffect, useMemo } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { fsList, setActiveSection as persistActiveSection } from '../ipc/client'
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

export function CourseView(): JSX.Element {
  const navigate = useNavigate()
  const { name } = useParams<{ name: string }>()
  const { courses, activeCourseId, activeChapterId, activeSectionFile, setActiveCourse, setActiveSection } =
    useCourseStore()

  const course = useMemo(() => courses.find((item) => item.name === name), [courses, name])

  useEffect(() => {
    if (!course) return

    let cancelled = false

    void (async () => {
      setActiveCourse(course.id)

      if (course.activeSection) {
        setActiveSection(course.activeSection.chapterId, course.activeSection.sectionFile)
        return
      }

      const firstSection = await findFirstSection(course.localPath)
      if (!cancelled && firstSection) {
        setActiveSection(firstSection.chapterId, firstSection.sectionFile)
        await persistActiveSection(course.id, firstSection.chapterId, firstSection.sectionFile)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [course, setActiveCourse, setActiveSection])

  useEffect(() => {
    if (!course || activeCourseId !== course.id || !activeChapterId || !activeSectionFile) {
      return
    }

    void persistActiveSection(course.id, activeChapterId, activeSectionFile)
  }, [course, activeCourseId, activeChapterId, activeSectionFile])

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

  return course.activeMode === 'learn' ? (
    <LearnMode courseId={course.id} />
  ) : (
    <CreateMode courseId={course.id} />
  )
}
