import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { StateManager } from '../stateManager'
import type { CourseState } from '@shared/types/state'

function makeTempDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'opencourses-test-'))
}

function mockCourse(id = 'course-1'): CourseState {
  return {
    id,
    name: 'test-course',
    title: 'Test Course',
    localPath: '/tmp/test-course',
    scratchPath: '/tmp/test-course/scratch',
    sourceRepo: 'https://github.com/foo/bar',
    courseRepo: 'https://github.com/foo/course',
    activeMode: 'learn',
    activeBranch: 'main',
    creationBranch: null,
    creationPR: { number: null, url: null, state: null },
    activeSection: null,
    learnerProgress: {},
    addedAt: new Date().toISOString(),
  }
}

describe('StateManager', () => {
  let tmpDir: string
  let sm: StateManager

  beforeEach(() => {
    tmpDir = makeTempDir()
    sm = new StateManager(tmpDir)
  })

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  it('load() on missing directory: creates directory and default state', async () => {
    const newDir = path.join(tmpDir, 'new-nested', 'dir')
    const smNew = new StateManager(newDir)
    await smNew.load()

    expect(fs.existsSync(newDir)).toBe(true)
    expect(fs.existsSync(path.join(newDir, 'state.json'))).toBe(true)

    const raw = fs.readFileSync(path.join(newDir, 'state.json'), 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed.version).toBe(1)
    expect(parsed.agentPreference).toBeNull()
    expect(parsed.courses).toEqual({})
  })

  it('load() on existing valid state.json: reads state correctly', async () => {
    const existing = {
      version: 1,
      agentPreference: 'claude' as const,
      courses: { 'course-1': mockCourse('course-1') },
    }
    await fs.promises.mkdir(tmpDir, { recursive: true })
    await fs.promises.writeFile(
      path.join(tmpDir, 'state.json'),
      JSON.stringify(existing),
      'utf8'
    )

    await sm.load()
    const state = sm.getState()
    expect(state.agentPreference).toBe('claude')
    expect(state.courses['course-1']).toBeDefined()
    expect(state.courses['course-1'].name).toBe('test-course')
  })

  it('setCourse() + getState(): in-memory state updated immediately', async () => {
    await sm.load()
    const course = mockCourse('c1')
    sm.setCourse('c1', course)
    const state = sm.getState()
    expect(state.courses['c1']).toBeDefined()
    expect(state.courses['c1'].title).toBe('Test Course')
  })

  it('markSectionComplete(): section and chapter marked complete', async () => {
    await sm.load()
    const course = mockCourse('c1')
    course.learnerProgress['ch1'] = {
      completed: false,
      sections: {
        'section-1.md': { completed: false, completedAt: null },
      },
    }
    sm.setCourse('c1', course)

    sm.markSectionComplete('c1', 'ch1', 'section-1.md')

    const updated = sm.getCourse('c1')!
    expect(updated.learnerProgress['ch1'].sections['section-1.md'].completed).toBe(true)
    expect(updated.learnerProgress['ch1'].sections['section-1.md'].completedAt).toBeTruthy()
    // All sections complete → chapter complete
    expect(updated.learnerProgress['ch1'].completed).toBe(true)
  })

  it('markSectionComplete(): chapter NOT marked complete when some sections remain incomplete', async () => {
    await sm.load()
    const course = mockCourse('c1')
    course.learnerProgress['ch1'] = {
      completed: false,
      sections: {
        'section-1.md': { completed: false, completedAt: null },
        'section-2.md': { completed: false, completedAt: null },
      },
    }
    sm.setCourse('c1', course)

    sm.markSectionComplete('c1', 'ch1', 'section-1.md')

    const updated = sm.getCourse('c1')!
    expect(updated.learnerProgress['ch1'].completed).toBe(false)
  })

  it('flush(): state written to disk immediately', async () => {
    await sm.load()
    sm.setCourse('c1', mockCourse('c1'))
    await sm.flush()

    const raw = fs.readFileSync(path.join(tmpDir, 'state.json'), 'utf8')
    const parsed = JSON.parse(raw)
    expect(parsed.courses['c1']).toBeDefined()
  })
})
