import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest'

// Mock child_process before importing the module under test
vi.mock('child_process', () => ({
  execFile: vi.fn(),
}))

import { execFile } from 'child_process'

const mockExecFile = execFile as unknown as Mock

// Sample registry data
const sampleCourses = [
  {
    id: 'course-01',
    title: 'Introduction to TypeScript',
    description: 'Learn TypeScript from scratch',
    tags: ['typescript', 'programming'],
    objective: 'Understand TypeScript fundamentals',
    courseRepo: 'org/course-typescript',
    sourceRepo: 'org/source-typescript',
    authorGitHub: 'author1',
    latestVersion: '1.0.0',
    addedAt: '2024-01-01T00:00:00Z',
  },
  {
    id: 'course-02',
    title: 'React Fundamentals',
    description: 'Build UIs with React',
    tags: ['react', 'frontend'],
    objective: 'Build React applications',
    courseRepo: 'org/course-react',
    sourceRepo: 'org/source-react',
    authorGitHub: 'author2',
    latestVersion: '2.0.0',
    addedAt: '2024-02-01T00:00:00Z',
  },
]

const sampleRegistry = { courses: sampleCourses }

function makeBase64Registry(data: object): string {
  return Buffer.from(JSON.stringify(data)).toString('base64')
}

function makeSuccessImpl(b64: string) {
  return (
    _cmd: string,
    _args: string[],
    callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
  ) => {
    callback(null, { stdout: b64 + '\n', stderr: '' })
  }
}

function makeFailureImpl(stderr: string) {
  return (
    _cmd: string,
    _args: string[],
    callback: (err: Error | null, result: { stdout: string; stderr: string }) => void
  ) => {
    const err = new Error('gh command failed') as Error & { stderr: string }
    err.stderr = stderr
    callback(err, { stdout: '', stderr })
  }
}

describe('RegistryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    delete process.env.OPENCOURSES_REGISTRY_REPO
  })

  it('successful fetch returns correct RegistryCourse[]', async () => {
    const b64 = makeBase64Registry(sampleRegistry)
    mockExecFile.mockImplementation(makeSuccessImpl(b64))

    // Re-import to get a fresh instance without cached state
    const { registryService } = await import('../registry')
    const courses = await registryService.list()

    expect(courses).toHaveLength(2)
    expect(courses[0].id).toBe('course-01')
    expect(courses[0].title).toBe('Introduction to TypeScript')
    expect(courses[1].id).toBe('course-02')
    expect(mockExecFile).toHaveBeenCalledTimes(1)
    expect(mockExecFile.mock.calls[0][0]).toBe('gh')
    expect(mockExecFile.mock.calls[0][1]).toContain(
      'repos/opencourses-project/opencourses-registry/contents/registry.json'
    )
  })

  it('uses OPENCOURSES_REGISTRY_REPO override when provided', async () => {
    process.env.OPENCOURSES_REGISTRY_REPO = 'custom-owner/custom-registry'
    const b64 = makeBase64Registry(sampleRegistry)
    mockExecFile.mockImplementation(makeSuccessImpl(b64))

    const { registryService } = await import('../registry')
    await registryService.list()

    expect(mockExecFile.mock.calls[0][1]).toContain(
      'repos/custom-owner/custom-registry/contents/registry.json'
    )
  })

  it('second list() call uses cache and does not re-fetch', async () => {
    const b64 = makeBase64Registry(sampleRegistry)
    mockExecFile.mockImplementation(makeSuccessImpl(b64))

    const { registryService } = await import('../registry')

    const first = await registryService.list()
    const second = await registryService.list()

    expect(first).toBe(second)
    expect(mockExecFile).toHaveBeenCalledTimes(1)
  })

  it('refresh() always re-fetches regardless of cache', async () => {
    const b64 = makeBase64Registry(sampleRegistry)
    mockExecFile.mockImplementation(makeSuccessImpl(b64))

    const { registryService } = await import('../registry')

    await registryService.list()
    await registryService.refresh()

    expect(mockExecFile).toHaveBeenCalledTimes(2)
  })

  it('gh failure throws error with code REGISTRY_FETCH_FAILED', async () => {
    mockExecFile.mockImplementation(makeFailureImpl('authentication required'))

    const { registryService } = await import('../registry')

    await expect(registryService.list()).rejects.toMatchObject({
      code: 'REGISTRY_FETCH_FAILED',
      message: 'authentication required',
    })
  })

  it('404 failure explains that gh worked but registry target was not found', async () => {
    mockExecFile.mockImplementation(makeFailureImpl('gh: Not Found (HTTP 404)'))

    const { registryService } = await import('../registry')

    await expect(registryService.list()).rejects.toMatchObject({
      code: 'REGISTRY_FETCH_FAILED',
      message: expect.stringContaining('configured registry target returned 404'),
    })
  })
})
