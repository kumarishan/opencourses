import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AddCourseRequest, CourseState, ModeSetResult, ModeType } from '@shared/ipc'
import { addCourse, listCourses, removeCourse as removeCourseFromWorkspace, setMode } from '../ipc/client'

export const courseQueryKeys = {
  all: ['courses'] as const,
}

export function useGetCourses(enabled = true) {
  return useQuery({
    queryKey: courseQueryKeys.all,
    queryFn: listCourses,
    enabled,
  })
}

export function useGetCourseByName(name: string | undefined, enabled = true) {
  return useQuery({
    queryKey: courseQueryKeys.all,
    queryFn: listCourses,
    select: (courses) => courses.find((course) => course.name === name),
    enabled: Boolean(name) && enabled,
  })
}

export function useAddCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (request: AddCourseRequest) => addCourse(request),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.all })
    },
  })
}

export function useRemoveCourse() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (courseId: string) => removeCourseFromWorkspace(courseId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.all })
    },
  })
}

export function useSetCourseMode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ courseId, mode }: { courseId: string; mode: ModeType }) =>
      setMode(courseId, mode) as Promise<ModeSetResult>,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: courseQueryKeys.all })
    },
  })
}

export function useUpdateCourse() {
  const queryClient = useQueryClient()

  return (courseId: string, updater: (course: CourseState) => CourseState): void => {
    queryClient.setQueryData<CourseState[] | undefined>(courseQueryKeys.all, (current) => {
      if (!current) return current
      return current.map((course) => (course.id === courseId ? updater(course) : course))
    })
  }
}

export function useInvalidateCourses() {
  const queryClient = useQueryClient()

  return (): void => {
    void queryClient.invalidateQueries({ queryKey: courseQueryKeys.all })
  }
}
