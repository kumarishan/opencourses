import { beforeEach, describe, expect, it } from 'vitest'
import type { CourseState } from '@shared/types/state'
import { useAgentStore } from '../agentStore'
import { useCourseStore } from '../courseStore'

const baseCourse = (overrides: Partial<CourseState> = {}): CourseState => ({
  id: 'course-1',
  name: 'course-one',
  title: 'Course One',
  localPath: '/tmp/course-one',
  scratchPath: '/tmp/course-one/scratch',
  sourceRepo: 'https://github.com/example/source',
  courseRepo: 'https://github.com/example/course',
  activeMode: 'learn',
  activeBranch: 'main',
  creationBranch: null,
  creationPR: { number: null, url: null, state: null },
  activeSection: null,
  learnerProgress: {},
  addedAt: new Date().toISOString(),
  ...overrides,
})

describe('renderer stores', () => {
  beforeEach(() => {
    useCourseStore.setState({
      courses: [],
      activeCourseId: null,
      activeChapterId: null,
      activeSectionFile: null,
    })
    useAgentStore.setState({ jobs: {} })
  })

  it('setCourses populates courses', () => {
    useCourseStore.getState().setCourses([baseCourse()])
    expect(useCourseStore.getState().courses).toHaveLength(1)
    expect(useCourseStore.getState().courses[0]?.title).toBe('Course One')
  })

  it('updateCourseMode only updates the targeted course', () => {
    useCourseStore
      .getState()
      .setCourses([baseCourse(), baseCourse({ id: 'course-2', name: 'course-two' })])

    useCourseStore.getState().updateCourseMode('course-2', 'create')

    expect(useCourseStore.getState().courses[0]?.activeMode).toBe('learn')
    expect(useCourseStore.getState().courses[1]?.activeMode).toBe('create')
  })

  it('removeCourse clears the active selection when removing the active course', () => {
    useCourseStore.getState().setCourses([baseCourse()])
    useCourseStore.getState().setActiveCourse('course-1')
    useCourseStore.getState().setActiveSection('chapter-1', '/tmp/course-one/section.md')

    useCourseStore.getState().removeCourse('course-1')

    expect(useCourseStore.getState().courses).toHaveLength(0)
    expect(useCourseStore.getState().activeCourseId).toBeNull()
    expect(useCourseStore.getState().activeChapterId).toBeNull()
    expect(useCourseStore.getState().activeSectionFile).toBeNull()
  })

  it('setActiveCourse clears the previous chapter and section when switching courses', () => {
    useCourseStore
      .getState()
      .setCourses([baseCourse(), baseCourse({ id: 'course-2', name: 'course-two' })])
    useCourseStore.getState().setActiveCourse('course-1')
    useCourseStore.getState().setActiveSection('chapter-1', '/tmp/course-one/section.md')

    useCourseStore.getState().setActiveCourse('course-2')

    expect(useCourseStore.getState().activeCourseId).toBe('course-2')
    expect(useCourseStore.getState().activeChapterId).toBeNull()
    expect(useCourseStore.getState().activeSectionFile).toBeNull()
  })

  it('appendChunk appends streamed output to the correct job', () => {
    const store = useAgentStore.getState()
    store.startJob('job-1', 'outline')
    store.appendChunk('job-1', 'first line')
    store.appendChunk('job-1', 'second line')

    expect(useAgentStore.getState().jobs['job-1']?.chunks).toEqual([
      'first line',
      'second line',
    ])
  })

  it('completeJob marks the job complete', () => {
    const store = useAgentStore.getState()
    store.startJob('job-2', 'content')
    store.completeJob('job-2', { feedback: 'Looks good', pass: true })

    expect(useAgentStore.getState().jobs['job-2']?.status).toBe('complete')
    expect(useAgentStore.getState().jobs['job-2']?.feedback).toBe('Looks good')
    expect(useAgentStore.getState().jobs['job-2']?.pass).toBe(true)
  })
})
