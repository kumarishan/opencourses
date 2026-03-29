import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as fs from 'fs'
import type { CourseState } from '@shared/types/state'

// Mock electron before importing handler
vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn(),
  },
}))

// Mock services and state
vi.mock('@main/services/git', () => ({
  gitService: {
    clone: vi.fn(),
    checkout: vi.fn(),
    currentBranch: vi.fn(),
    getRemoteUrl: vi.fn(),
  },
}))

vi.mock('@main/services/github', () => ({
  githubService: {
    getPRState: vi.fn(),
  },
}))

vi.mock('@main/state/stateManager', () => ({
  stateManager: {
    getState: vi.fn(),
    getCourse: vi.fn(),
    setCourse: vi.fn(),
    removeCourse: vi.fn(),
    setMode: vi.fn(),
    setBranch: vi.fn(),
  },
}))

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>()
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: vi.fn(),
      readFile: vi.fn(),
      rm: vi.fn(),
      stat: vi.fn(),
      readdir: vi.fn(),
    },
  }
})

vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>()
  return {
    ...actual,
    randomUUID: vi.fn(() => 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'),
  }
})

import { ipcMain } from 'electron'
import { gitService } from '@main/services/git'
import { githubService } from '@main/services/github'
import { stateManager } from '@main/state/stateManager'
import * as cryptoMod from 'crypto'
import { registerCoursesHandlers } from '../courses'

type IpcHandler = (_event: unknown, ...args: unknown[]) => Promise<unknown>

function getHandler(channel: string): IpcHandler {
  const calls = vi.mocked(ipcMain.handle).mock.calls
  const call = calls.find(([ch]) => ch === channel)
  if (!call) throw new Error(`No handler registered for channel: ${channel}`)
  return call[1] as IpcHandler
}

function makeCourse(overrides: Partial<CourseState> = {}): CourseState {
  return {
    id: 'course-1',
    name: 'test-course',
    title: 'Test Course',
    localPath: '/home/user/.opencourses/courses/test-course/',
    scratchPath: '',
    sourceRepo: '',
    courseRepo: 'https://github.com/foo/test-course',
    activeMode: 'learn',
    activeBranch: 'main',
    creationBranch: null,
    creationPR: { number: null, url: null, state: null },
    activeSection: null,
    learnerProgress: {},
    addedAt: '2024-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('registerCoursesHandlers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(fs.promises.mkdir).mockResolvedValue(undefined)
    vi.mocked(fs.promises.rm).mockResolvedValue(undefined)
    vi.mocked(fs.promises.stat).mockRejectedValue(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
    vi.mocked(fs.promises.readdir).mockResolvedValue([])
    vi.mocked(gitService.currentBranch).mockResolvedValue('main')
    vi.mocked(gitService.getRemoteUrl).mockResolvedValue(null)
    vi.mocked(stateManager.getState).mockReturnValue({
      version: 1,
      agentPreference: null,
      courses: {},
    })
    registerCoursesHandlers()
  })

  describe('courses/remove', () => {
    it('removes the course from state and deletes the local checkout', async () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(
        makeCourse({ id: 'course-to-remove', localPath: '/tmp/opencourses/course-to-remove' })
      )

      const handler = getHandler('courses/remove')
      const result = await handler(null, 'course-to-remove')

      expect(fs.promises.rm).toHaveBeenCalledWith('/tmp/opencourses/course-to-remove', {
        recursive: true,
        force: true,
      })
      expect(stateManager.removeCourse).toHaveBeenCalledWith('course-to-remove')
      expect(result).toEqual({ ok: true })
    })

    it('returns COURSE_NOT_FOUND when removing an unknown course', async () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(undefined)

      const handler = getHandler('courses/remove')
      const result = await handler(null, 'missing-course')

      expect(fs.promises.rm).not.toHaveBeenCalled()
      expect(stateManager.removeCourse).not.toHaveBeenCalled()
      expect(result).toMatchObject({ error: { code: 'COURSE_NOT_FOUND' } })
    })
  })

  describe('courses/add', () => {
    it('creates correct CourseState and calls setCourse', async () => {
      const fixedUUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
      vi.mocked(cryptoMod.randomUUID).mockReturnValue(fixedUUID as ReturnType<typeof cryptoMod.randomUUID>)
      vi.mocked(gitService.clone).mockResolvedValue(undefined)
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ title: 'My Course Title' }) as unknown as Buffer
      )

      const handler = getHandler('courses/add')
      const result = await handler(null, {
        courseRepo: 'https://github.com/org/my-course',
        sourceRepo: 'https://github.com/org/source',
        scratchPath: '/tmp/scratch',
      })

      expect(gitService.clone).toHaveBeenCalledWith(
        'https://github.com/org/my-course',
        expect.stringContaining('my-course')
      )
      expect(stateManager.setCourse).toHaveBeenCalledWith(
        fixedUUID,
        expect.objectContaining({
          id: fixedUUID,
          name: 'my-course',
          title: 'My Course Title',
          courseRepo: 'https://github.com/org/my-course',
          sourceRepo: 'https://github.com/org/source',
          scratchPath: '/tmp/scratch',
          activeMode: 'learn',
          activeBranch: 'main',
          creationBranch: null,
          creationPR: { number: null, url: null, state: null },
          activeSection: null,
          learnerProgress: {},
        })
      )
      expect(result).toMatchObject({
        id: fixedUUID,
        name: 'my-course',
        title: 'My Course Title',
        activeMode: 'learn',
        activeBranch: 'main',
      })
    })

    it('returns the existing course when the repo was already added', async () => {
      const existingCourse = makeCourse({
        id: 'existing-course',
        name: 'my-course',
        courseRepo: 'git@github.com:org/my-course.git',
      })
      vi.mocked(stateManager.getState).mockReturnValue({
        version: 1,
        agentPreference: null,
        courses: { [existingCourse.id]: existingCourse },
      })
      vi.mocked(gitService.getRemoteUrl).mockResolvedValue('git@github.com:org/my-course.git')

      const handler = getHandler('courses/add')
      const result = await handler(null, {
        courseRepo: 'https://github.com/org/my-course',
      })

      expect(gitService.clone).not.toHaveBeenCalled()
      expect(stateManager.setCourse).not.toHaveBeenCalled()
      expect(result).toEqual(existingCourse)
    })

    it('reuses an existing checkout when the destination already contains the same repo', async () => {
      vi.mocked(fs.promises.stat).mockResolvedValue({
        isDirectory: () => true,
      } as fs.Stats)
      vi.mocked(fs.promises.readdir).mockResolvedValue(['.git'])
      vi.mocked(gitService.getRemoteUrl).mockResolvedValue('git@github.com:org/my-course.git')
      vi.mocked(fs.promises.readFile).mockResolvedValue(
        JSON.stringify({ title: 'Existing Checkout Course' }) as unknown as Buffer
      )
      vi.mocked(gitService.currentBranch).mockResolvedValue('master')

      const handler = getHandler('courses/add')
      const result = await handler(null, {
        courseRepo: 'https://github.com/org/my-course',
      })

      expect(gitService.clone).not.toHaveBeenCalled()
      expect(stateManager.setCourse).toHaveBeenCalledWith(
        'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        expect.objectContaining({
          name: 'my-course',
          title: 'Existing Checkout Course',
          activeBranch: 'master',
        })
      )
      expect(result).toMatchObject({
        name: 'my-course',
        title: 'Existing Checkout Course',
        activeBranch: 'master',
      })
    })

    it('falls back to a suffixed directory when the default destination is occupied by a different repo', async () => {
      vi.mocked(fs.promises.stat)
        .mockResolvedValueOnce({
          isDirectory: () => true,
        } as fs.Stats)
        .mockRejectedValueOnce(Object.assign(new Error('ENOENT'), { code: 'ENOENT' }))
      vi.mocked(fs.promises.readdir).mockResolvedValue(['README.md'])
      vi.mocked(gitService.getRemoteUrl).mockResolvedValue('https://github.com/other/repo.git')
      vi.mocked(gitService.clone).mockResolvedValue(undefined)
      vi.mocked(fs.promises.readFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      )

      const handler = getHandler('courses/add')
      const result = await handler(null, {
        courseRepo: 'https://github.com/org/my-course',
      })

      expect(gitService.clone).toHaveBeenCalledWith(
        'https://github.com/org/my-course',
        expect.stringContaining('my-course-2')
      )
      expect(result).toMatchObject({
        name: 'my-course-2',
        title: 'my-course-2',
      })
    })

    it('uses name as title when course.json is missing', async () => {
      const fixedUUID = 'aaaaaaaa-bbbb-cccc-dddd-ffffffffffff'
      vi.mocked(cryptoMod.randomUUID).mockReturnValue(fixedUUID as ReturnType<typeof cryptoMod.randomUUID>)
      vi.mocked(gitService.clone).mockResolvedValue(undefined)
      vi.mocked(fs.promises.readFile).mockRejectedValue(
        Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
      )

      const handler = getHandler('courses/add')
      const result = await handler(null, {
        courseRepo: 'https://github.com/org/no-json-course.git',
      })

      expect(result).toMatchObject({
        name: 'no-json-course',
        title: 'no-json-course',
      })
    })

    it('returns error object when clone fails', async () => {
      const err = Object.assign(new Error('clone failed'), { code: 'GIT_CLONE_FAILED' })
      vi.mocked(gitService.clone).mockRejectedValue(err)

      const handler = getHandler('courses/add')
      const result = await handler(null, { courseRepo: 'https://github.com/foo/bar' })

      expect(result).toMatchObject({ error: { code: 'GIT_CLONE_FAILED' } })
    })
  })

  describe('courses/setMode', () => {
    it('returns needs-branch-name when setting create mode with no creationBranch', async () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(makeCourse({ creationBranch: null }))

      const handler = getHandler('courses/setMode')
      const result = await handler(null, 'course-1', 'create')

      expect(result).toEqual({ status: 'needs-branch-name' })
      expect(stateManager.setMode).not.toHaveBeenCalled()
    })

    it('returns pr-merged with prUrl when PR is merged', async () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(
        makeCourse({
          creationBranch: 'feature/my-branch',
          creationPR: { number: 42, url: 'https://github.com/foo/bar/pull/42', state: 'open' },
        })
      )
      vi.mocked(githubService.getPRState).mockResolvedValue({
        number: 42,
        url: 'https://github.com/foo/bar/pull/42',
        state: 'merged',
      })

      const handler = getHandler('courses/setMode')
      const result = await handler(null, 'course-1', 'create')

      expect(result).toEqual({
        status: 'pr-merged',
        prUrl: 'https://github.com/foo/bar/pull/42',
      })
    })

    it('checks out branch and updates state when PR is open', async () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(
        makeCourse({
          creationBranch: 'feature/my-branch',
          creationPR: { number: 7, url: 'https://github.com/foo/bar/pull/7', state: 'open' },
        })
      )
      vi.mocked(githubService.getPRState).mockResolvedValue({
        number: 7,
        url: 'https://github.com/foo/bar/pull/7',
        state: 'open',
      })
      vi.mocked(gitService.checkout).mockResolvedValue(undefined)

      const handler = getHandler('courses/setMode')
      const result = await handler(null, 'course-1', 'create')

      expect(gitService.checkout).toHaveBeenCalledWith(
        expect.any(String),
        'feature/my-branch'
      )
      expect(stateManager.setMode).toHaveBeenCalledWith('course-1', 'create')
      expect(stateManager.setBranch).toHaveBeenCalledWith('course-1', 'feature/my-branch')
      expect(result).toMatchObject({ status: 'ok', mode: 'create', branch: 'feature/my-branch' })
    })

    it('checks out branch and updates state when creationBranch exists but no PR', async () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(
        makeCourse({
          creationBranch: 'feature/no-pr',
          creationPR: { number: null, url: null, state: null },
        })
      )
      vi.mocked(gitService.checkout).mockResolvedValue(undefined)

      const handler = getHandler('courses/setMode')
      const result = await handler(null, 'course-1', 'create')

      expect(gitService.checkout).toHaveBeenCalledWith(
        expect.any(String),
        'feature/no-pr'
      )
      expect(stateManager.setMode).toHaveBeenCalledWith('course-1', 'create')
      expect(result).toMatchObject({ status: 'ok', mode: 'create', branch: 'feature/no-pr' })
    })

    it('sets mode to learn and returns ok with current branch', async () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(makeCourse({ activeBranch: 'main' }))

      const handler = getHandler('courses/setMode')
      const result = await handler(null, 'course-1', 'learn')

      expect(stateManager.setMode).toHaveBeenCalledWith('course-1', 'learn')
      expect(result).toEqual({ status: 'ok', mode: 'learn', branch: 'main' })
    })

    it('returns COURSE_NOT_FOUND error when course does not exist', async () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(undefined)

      const handler = getHandler('courses/setMode')
      const result = await handler(null, 'missing-id', 'learn')

      expect(result).toMatchObject({ error: { code: 'COURSE_NOT_FOUND' } })
    })
  })

  describe('courses/list', () => {
    it('returns array of CourseState values', () => {
      const courses = { 'course-1': makeCourse() }
      vi.mocked(stateManager.getState).mockReturnValue({
        version: 1,
        agentPreference: null,
        courses,
      })

      const handler = getHandler('courses/list')
      const result = handler(null)

      expect(result).toEqual([makeCourse()])
    })
  })

  describe('courses/remove', () => {
    it('calls removeCourse and returns ok', () => {
      const handler = getHandler('courses/remove')
      const result = handler(null, 'course-1')

      expect(stateManager.removeCourse).toHaveBeenCalledWith('course-1')
      expect(result).toEqual({ ok: true })
    })
  })

  describe('courses/getProgress', () => {
    it('returns learnerProgress for existing course', () => {
      const progress = { ch1: { completed: true, sections: {} } }
      vi.mocked(stateManager.getCourse).mockReturnValue(makeCourse({ learnerProgress: progress }))

      const handler = getHandler('courses/getProgress')
      const result = handler(null, 'course-1')

      expect(result).toEqual(progress)
    })

    it('returns empty object when course not found', () => {
      vi.mocked(stateManager.getCourse).mockReturnValue(undefined)

      const handler = getHandler('courses/getProgress')
      const result = handler(null, 'missing-id')

      expect(result).toEqual({})
    })
  })
})
