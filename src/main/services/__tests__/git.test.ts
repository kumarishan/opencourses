import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { gitService } from '../git'

const execFileAsync = promisify(execFile)

async function initRepo(dir: string): Promise<void> {
  await execFileAsync('git', ['init'], { cwd: dir })
  await execFileAsync('git', ['config', 'user.email', 'test@test.com'], { cwd: dir })
  await execFileAsync('git', ['config', 'user.name', 'Test User'], { cwd: dir })
}

async function makeInitialCommit(dir: string): Promise<void> {
  const readmePath = path.join(dir, 'README.md')
  await fs.promises.writeFile(readmePath, '# Test\n')
  await execFileAsync('git', ['add', '-A'], { cwd: dir })
  await execFileAsync('git', ['commit', '-m', 'initial commit'], { cwd: dir })
}

describe('GitService (real temp repo)', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'opencourses-git-test-'))
    await initRepo(tmpDir)
  })

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true })
  })

  it('listBranches on fresh repo (no commits) returns empty array', async () => {
    // Fresh repo with no commits has no branches yet
    const branches = await gitService.listBranches(tmpDir)
    expect(Array.isArray(branches)).toBe(true)
    expect(branches).toHaveLength(0)
  })

  it('listBranches after initial commit returns default branch', async () => {
    await makeInitialCommit(tmpDir)
    const branches = await gitService.listBranches(tmpDir)
    expect(branches.length).toBeGreaterThanOrEqual(1)
    // Should have main or master
    const hasDefault = branches.some((b) => b === 'main' || b === 'master')
    expect(hasDefault).toBe(true)
  })

  it('createBranch creates a new branch and it appears in listBranches', async () => {
    await makeInitialCommit(tmpDir)
    await gitService.createBranch(tmpDir, 'feature/test-branch')
    const branches = await gitService.listBranches(tmpDir)
    expect(branches).toContain('feature/test-branch')
  })

  it('currentBranch returns the correct branch name after createBranch', async () => {
    await makeInitialCommit(tmpDir)
    await gitService.createBranch(tmpDir, 'my-new-branch')
    const current = await gitService.currentBranch(tmpDir)
    expect(current).toBe('my-new-branch')
  })

  it('status on clean repo returns clean=true with empty arrays', async () => {
    await makeInitialCommit(tmpDir)
    const status = await gitService.status(tmpDir)
    expect(status.clean).toBe(true)
    expect(status.modified).toEqual([])
    expect(status.untracked).toEqual([])
    expect(status.staged).toEqual([])
  })

  it('status after creating an untracked file reflects in untracked', async () => {
    await makeInitialCommit(tmpDir)
    const newFile = path.join(tmpDir, 'newfile.txt')
    await fs.promises.writeFile(newFile, 'hello\n')
    const status = await gitService.status(tmpDir)
    expect(status.clean).toBe(false)
    expect(status.untracked).toContain('newfile.txt')
  })

  it('status after staging a file reflects in staged', async () => {
    await makeInitialCommit(tmpDir)
    const newFile = path.join(tmpDir, 'staged.txt')
    await fs.promises.writeFile(newFile, 'staged content\n')
    await execFileAsync('git', ['add', 'staged.txt'], { cwd: tmpDir })
    const status = await gitService.status(tmpDir)
    expect(status.clean).toBe(false)
    expect(status.staged).toContain('staged.txt')
  })

  it('status after modifying a tracked file reflects in modified', async () => {
    await makeInitialCommit(tmpDir)
    const readmePath = path.join(tmpDir, 'README.md')
    await fs.promises.writeFile(readmePath, '# Modified\n')
    const status = await gitService.status(tmpDir)
    expect(status.clean).toBe(false)
    expect(status.modified).toContain('README.md')
  })

  it('checkout switches back to default branch', async () => {
    await makeInitialCommit(tmpDir)
    const defaultBranch = await gitService.currentBranch(tmpDir)
    await gitService.createBranch(tmpDir, 'other-branch')
    expect(await gitService.currentBranch(tmpDir)).toBe('other-branch')
    await gitService.checkout(tmpDir, defaultBranch)
    expect(await gitService.currentBranch(tmpDir)).toBe(defaultBranch)
  })

  it('log returns entries after commits', async () => {
    await makeInitialCommit(tmpDir)
    const entries = await gitService.log(tmpDir)
    expect(entries.length).toBeGreaterThanOrEqual(1)
    const first = entries[0]
    expect(first.hash).toMatch(/^[0-9a-f]{40}$/)
    expect(first.message).toBe('initial commit')
    expect(first.date).toBeTruthy()
  })

  it('discard removes untracked files and reverts modifications', async () => {
    await makeInitialCommit(tmpDir)
    // Create untracked file
    const untrackedFile = path.join(tmpDir, 'untracked.txt')
    await fs.promises.writeFile(untrackedFile, 'untracked\n')
    // Modify tracked file
    const readmePath = path.join(tmpDir, 'README.md')
    await fs.promises.writeFile(readmePath, '# Modified\n')

    await gitService.discard(tmpDir)

    const statusAfter = await gitService.status(tmpDir)
    expect(statusAfter.clean).toBe(true)
    expect(statusAfter.untracked).toEqual([])
    expect(statusAfter.modified).toEqual([])
  })
})
