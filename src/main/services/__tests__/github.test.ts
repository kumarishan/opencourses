import { describe, it, expect, vi, beforeEach } from 'vitest'

// vi.mock is hoisted — use vi.hoisted to declare mock variables accessible in the factory
const { mockExecFile } = vi.hoisted(() => {
  return { mockExecFile: vi.fn() }
})

vi.mock('child_process', () => ({
  execFile: mockExecFile,
}))

import { githubService } from '../github'

type ExecFileCallback = (err: Error | null, stdout: string, stderr: string) => void

// The last argument to the mock is always the callback
function makeSuccessImpl(stdout: string) {
  return (...args: unknown[]) => {
    const cb = args[args.length - 1] as ExecFileCallback
    cb(null, stdout, '')
  }
}

function makeErrorImpl(stderr: string) {
  return (...args: unknown[]) => {
    const cb = args[args.length - 1] as ExecFileCallback
    const err = new Error(stderr) as Error & { stderr: string }
    err.stderr = stderr
    cb(err, '', stderr)
  }
}

describe('GitHubService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createPR', () => {
    it('parses JSON response and returns PRInfo', async () => {
      const prJson = JSON.stringify({ number: 42, url: 'https://github.com/org/repo/pull/42', state: 'OPEN' })
      mockExecFile.mockImplementation(makeSuccessImpl(prJson))

      const result = await githubService.createPR({
        cwd: '/some/repo',
        title: 'My PR',
        body: 'Description',
        base: 'main',
      })

      expect(result.number).toBe(42)
      expect(result.url).toBe('https://github.com/org/repo/pull/42')
      expect(result.state).toBe('open')
    })

    it('normalizes MERGED state to merged', async () => {
      const prJson = JSON.stringify({ number: 7, url: 'https://github.com/org/repo/pull/7', state: 'MERGED' })
      mockExecFile.mockImplementation(makeSuccessImpl(prJson))

      const result = await githubService.createPR({
        cwd: '/some/repo',
        title: 'Merged PR',
      })

      expect(result.state).toBe('merged')
    })

    it('throws structured error with GH_CREATE_PR_FAILED code on non-zero exit', async () => {
      mockExecFile.mockImplementation(makeErrorImpl('gh: authentication required'))

      await expect(
        githubService.createPR({ cwd: '/some/repo', title: 'Bad PR' })
      ).rejects.toMatchObject({
        code: 'GH_CREATE_PR_FAILED',
        message: expect.stringContaining('authentication required'),
      })
    })
  })

  describe('getPRState', () => {
    it('returns PRInfo for an open PR', async () => {
      const prJson = JSON.stringify({ number: 10, url: 'https://github.com/org/repo/pull/10', state: 'OPEN' })
      mockExecFile.mockImplementation(makeSuccessImpl(prJson))

      const result = await githubService.getPRState('/some/repo', 10)

      expect(result.number).toBe(10)
      expect(result.state).toBe('open')
    })

    it('handles merged state correctly', async () => {
      const prJson = JSON.stringify({ number: 5, url: 'https://github.com/org/repo/pull/5', state: 'MERGED' })
      mockExecFile.mockImplementation(makeSuccessImpl(prJson))

      const result = await githubService.getPRState('/some/repo', 5)

      expect(result.state).toBe('merged')
      expect(result.number).toBe(5)
    })

    it('handles closed state correctly', async () => {
      const prJson = JSON.stringify({ number: 3, url: 'https://github.com/org/repo/pull/3', state: 'CLOSED' })
      mockExecFile.mockImplementation(makeSuccessImpl(prJson))

      const result = await githubService.getPRState('/some/repo', 3)

      expect(result.state).toBe('closed')
    })

    it('throws structured error with GH_GET_PR_STATE_FAILED code on non-zero exit', async () => {
      mockExecFile.mockImplementation(makeErrorImpl('could not find pull request'))

      await expect(githubService.getPRState('/some/repo', 99)).rejects.toMatchObject({
        code: 'GH_GET_PR_STATE_FAILED',
        message: expect.stringContaining('could not find pull request'),
      })
    })
  })

  describe('createRelease', () => {
    it('returns ReleaseInfo on success', async () => {
      mockExecFile.mockImplementation(makeSuccessImpl(''))

      const result = await githubService.createRelease({
        cwd: '/some/repo',
        tag: 'v1.0.0',
        title: 'Release v1.0.0',
        notes: 'First stable release',
      })

      expect(result.tag).toBe('v1.0.0')
      expect(result.title).toBe('Release v1.0.0')
    })

    it('throws structured error with GH_CREATE_RELEASE_FAILED code on non-zero exit', async () => {
      mockExecFile.mockImplementation(makeErrorImpl('release already exists'))

      await expect(
        githubService.createRelease({ cwd: '/some/repo', tag: 'v1.0.0', title: 'Duplicate' })
      ).rejects.toMatchObject({
        code: 'GH_CREATE_RELEASE_FAILED',
      })
    })
  })

  describe('repoExists', () => {
    it('returns true when repo exists', async () => {
      mockExecFile.mockImplementation(makeSuccessImpl('repo info'))

      const result = await githubService.repoExists('org/repo')
      expect(result).toBe(true)
    })

    it('returns false when repo does not exist', async () => {
      mockExecFile.mockImplementation(makeErrorImpl('repo not found'))

      const result = await githubService.repoExists('org/nonexistent')
      expect(result).toBe(false)
    })
  })

  describe('createRepo', () => {
    it('returns repo URL on success', async () => {
      const repoJson = JSON.stringify({ url: 'https://github.com/org/new-repo' })
      mockExecFile.mockImplementation(makeSuccessImpl(repoJson))

      const url = await githubService.createRepo('new-repo', 'A new repo', false)
      expect(url).toBe('https://github.com/org/new-repo')
    })

    it('throws structured error with GH_CREATE_REPO_FAILED code on non-zero exit', async () => {
      mockExecFile.mockImplementation(makeErrorImpl('repo name already taken'))

      await expect(
        githubService.createRepo('taken-repo', 'desc', true)
      ).rejects.toMatchObject({
        code: 'GH_CREATE_REPO_FAILED',
      })
    })
  })
})
