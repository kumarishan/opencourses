import { create } from 'zustand'
import type { ModeType } from '@shared/types/course'
import type { ChapterProgress, CourseState } from '@shared/types/state'

export interface CourseStoreState {
  courses: CourseState[]
  activeCourseId: string | null
  activeChapterId: string | null
  activeSectionFile: string | null
  setCourses: (courses: CourseState[]) => void
  setActiveCourse: (courseId: string | null) => void
  setActiveSection: (chapterId: string, sectionFile: string) => void
  updateCourseMode: (courseId: string, mode: ModeType) => void
  updateCourseBranch: (courseId: string, branch: string) => void
  updateCourseProgress: (
    courseId: string,
    progress: Record<string, ChapterProgress>
  ) => void
  removeCourse: (courseId: string) => void
  upsertCourse: (course: CourseState) => void
}

export const useCourseStore = create<CourseStoreState>((set) => ({
  courses: [],
  activeCourseId: null,
  activeChapterId: null,
  activeSectionFile: null,
  setCourses: (courses) => set({ courses }),
  setActiveCourse: (courseId) => set({ activeCourseId: courseId }),
  setActiveSection: (chapterId, sectionFile) =>
    set({ activeChapterId: chapterId, activeSectionFile: sectionFile }),
  updateCourseMode: (courseId, mode) =>
    set((state) => ({
      courses: state.courses.map((course) =>
        course.id === courseId ? { ...course, activeMode: mode } : course
      ),
    })),
  updateCourseBranch: (courseId, branch) =>
    set((state) => ({
      courses: state.courses.map((course) =>
        course.id === courseId ? { ...course, activeBranch: branch } : course
      ),
    })),
  updateCourseProgress: (courseId, progress) =>
    set((state) => ({
      courses: state.courses.map((course) =>
        course.id === courseId ? { ...course, learnerProgress: progress } : course
      ),
    })),
  removeCourse: (courseId) =>
    set((state) => ({
      courses: state.courses.filter((course) => course.id !== courseId),
      activeCourseId: state.activeCourseId === courseId ? null : state.activeCourseId,
      activeChapterId: state.activeCourseId === courseId ? null : state.activeChapterId,
      activeSectionFile: state.activeCourseId === courseId ? null : state.activeSectionFile,
    })),
  upsertCourse: (course) =>
    set((state) => {
      const existing = state.courses.findIndex((item) => item.id === course.id)
      if (existing === -1) {
        return { courses: [...state.courses, course] }
      }

      return {
        courses: state.courses.map((item) => (item.id === course.id ? course : item)),
      }
    }),
}))

export function getActiveCourse(state: CourseStoreState): CourseState | undefined {
  return state.courses.find((course) => course.id === state.activeCourseId)
}

export function getActiveMode(state: CourseStoreState): ModeType {
  return getActiveCourse(state)?.activeMode ?? 'learn'
}
