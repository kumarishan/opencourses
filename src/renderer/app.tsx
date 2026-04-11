import { useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, RouterProvider, createHashRouter } from 'react-router-dom'
import { getPrerequisites } from './ipc/client'
import { courseQueryKeys, useGetCourses } from './hooks/useCourses'
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
      {
        path: 'learn/course/:name/ch/:chapterId/sec/:section',
        element: <CourseView mode="learn" />,
      },
      {
        path: 'create/course/:name/ch/:chapterId/sec/:section',
        element: <CourseView mode="create" />,
      },
      { path: 'courses', element: <Navigate to="/" replace /> },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

function App(): JSX.Element {
  const setCourses = useCourseStore((state) => state.setCourses)
  const queryClient = useQueryClient()

  const prerequisitesQuery = useQuery({
    queryKey: ['prerequisites'],
    queryFn: getPrerequisites,
    retry: false,
  })

  const missingTools = prerequisitesQuery.data?.missing ?? []
  const shouldLoadCourses =
    prerequisitesQuery.status === 'success' && missingTools.length === 0

  const coursesQuery = useGetCourses(shouldLoadCourses)

  useEffect(() => {
    if (!shouldLoadCourses) return
    if (coursesQuery.data) {
      setCourses(coursesQuery.data)
    }
  }, [shouldLoadCourses, coursesQuery.data, setCourses])

  if (prerequisitesQuery.isLoading || (shouldLoadCourses && coursesQuery.isLoading)) {
    return (
      <div className="grid min-h-screen place-items-center px-8">
        <div className="rounded-md border border-border bg-surface px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-text-secondary">
          Loading workspace
        </div>
      </div>
    )
  }

  if (missingTools.length > 0) {
    return (
      <SetupScreen
        missing={missingTools}
        onReady={() => {
          void queryClient.invalidateQueries({ queryKey: ['prerequisites'] })
          void queryClient.invalidateQueries({ queryKey: courseQueryKeys.all })
        }}
      />
    )
  }

  if (prerequisitesQuery.isError || coursesQuery.isError) {
    return (
      <div className="grid min-h-screen place-items-center px-8">
        <div className="max-w-lg rounded-lg border border-red-400/30 bg-red-500/10 px-5 py-4 text-sm text-red-200">
          {(prerequisitesQuery.error as Error | null)?.message ??
            (coursesQuery.error as Error | null)?.message ??
            'Failed to load workspace.'}
        </div>
      </div>
    )
  }

  return <RouterProvider router={router} />
}

export default App
