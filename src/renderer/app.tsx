import { startTransition, useEffect, useState } from 'react'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { getPrerequisites, listCourses } from './ipc/client'
import { useCourseStore } from './store/courseStore'
import { SetupScreen } from './views/SetupScreen'
import { CourseView } from './views/CourseView'
import { WorkspaceView } from './views/WorkspaceView'

const router = createHashRouter([
  {
    path: '/',
    element: <WorkspaceView />,
    children: [
      {
        index: true,
        element: (
          <div className="grid min-h-full place-items-center p-10">
            <div className="w-full max-w-xl rounded-xl border border-border bg-surface p-8">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
                Workspace
              </p>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-text-primary">
                Choose a course to begin
              </h1>
              <p className="mt-3 text-base leading-7 text-text-secondary">
                Add a course from the registry, paste a GitHub URL, or open an existing course from
                the sidebar.
              </p>
            </div>
          </div>
        ),
      },
      { path: 'courses/:name', element: <CourseView /> },
      { path: 'courses', element: <Navigate to="/" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

function App(): JSX.Element {
  const setCourses = useCourseStore((state) => state.setCourses)
  const [ready, setReady] = useState(false)
  const [missingTools, setMissingTools] = useState<Array<'git' | 'gh' | 'claude' | 'codex'>>([])

  useEffect(() => {
    void hydrate()
  }, [])

  async function hydrate(): Promise<void> {
    setReady(false)
    const prerequisites = await getPrerequisites()

    if (prerequisites.missing.length > 0) {
      startTransition(() => {
        setMissingTools(prerequisites.missing)
        setReady(true)
      })
      return
    }

    const courses = await listCourses()

    startTransition(() => {
      setCourses(courses)
      setMissingTools([])
      setReady(true)
    })
  }

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center px-8">
        <div className="rounded-md border border-border bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Loading workspace
        </div>
      </div>
    )
  }

  if (missingTools.length > 0) {
    return <SetupScreen missing={missingTools} onReady={() => void hydrate()} />
  }

  return <RouterProvider router={router} />
}

export default App
