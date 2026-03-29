import { execFile } from 'child_process'
import * as fs from 'fs'
import * as os from 'os'
import * as path from 'path'
import type { PRInfo } from '@shared/types/state'
import type { CreatePRRequest, CreateReleaseRequest, ReleaseInfo } from '@shared/ipc'
import { getRegistryRepo } from './registryConfig'

function execFilePromise(
  cmd: string,
  args: string[],
  opts?: { cwd?: string }
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const cb = (err: Error | null, stdout: string, stderr: string) => {
      if (err) {
        reject(err)
      } else {
        resolve({ stdout, stderr })
      }
    }
    if (opts !== undefined) {
      execFile(cmd, args, opts, cb)
    } else {
      execFile(cmd, args, cb)
    }
  })
}

async function runGh(
  args: string[],
  cwd?: string,
  operation?: string
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await execFilePromise('gh', args, cwd !== undefined ? { cwd } : undefined)
  } catch (err: unknown) {
    const execErr = err as { stderr?: string; message?: string }
    const stderr = execErr.stderr ?? execErr.message ?? 'Unknown error'
    const code = operation ? `GH_${operation}_FAILED` : 'GH_FAILED'
    const error = new Error(stderr) as Error & { code: string }
    error.code = code
    throw error
  }
}

class GitHubService {
  async createPR(req: CreatePRRequest): Promise<PRInfo> {
    const args = [
      'pr',
      'create',
      '--title',
      req.title,
      '--body',
      req.body ?? '',
      '--base',
      req.base ?? 'main',
      '--json',
      'number,url,state',
    ]
    const { stdout } = await runGh(args, req.cwd, 'CREATE_PR')
    const parsed = JSON.parse(stdout) as { number: number; url: string; state: string }
    return {
      number: parsed.number,
      url: parsed.url,
      state: normalizeState(parsed.state),
    }
  }

  async getPRState(cwd: string, prNumber: number): Promise<PRInfo> {
    const args = ['pr', 'view', String(prNumber), '--json', 'number,url,state']
    const { stdout } = await runGh(args, cwd, 'GET_PR_STATE')
    const parsed = JSON.parse(stdout) as { number: number; url: string; state: string }
    return {
      number: parsed.number,
      url: parsed.url,
      state: normalizeState(parsed.state),
    }
  }

  async createRelease(req: CreateReleaseRequest): Promise<ReleaseInfo> {
    const args = [
      'release',
      'create',
      req.tag,
      '--title',
      req.title,
      '--notes',
      req.notes ?? '',
    ]
    await runGh(args, req.cwd, 'CREATE_RELEASE')
    return {
      tag: req.tag,
      url: '',
      title: req.title,
    }
  }

  async repoExists(repoUrl: string): Promise<boolean> {
    try {
      await execFilePromise('gh', ['repo', 'view', repoUrl])
      return true
    } catch {
      return false
    }
  }

  async createRepo(name: string, description: string, isPrivate: boolean): Promise<string> {
    const visibilityFlag = isPrivate ? '--private' : '--public'
    const args = [
      'repo',
      'create',
      name,
      '--description',
      description,
      visibilityFlag,
      '--json',
      'url',
    ]
    const { stdout } = await runGh(args, undefined, 'CREATE_REPO')
    const parsed = JSON.parse(stdout) as { url: string }
    return parsed.url
  }

  async submitRegistryPR(courseId: string, registryRepoOwner: string): Promise<PRInfo> {
    const tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'opencourses-registry-'))
    try {
      // Clone registry repo
      await execFilePromise('gh', ['repo', 'clone', getRegistryRepo(), tmpDir, '--', '--depth=1'])

      // Read registry.json
      const registryPath = path.join(tmpDir, 'registry.json')
      let registry: unknown[] = []
      try {
        const raw = await fs.promises.readFile(registryPath, 'utf8')
        registry = JSON.parse(raw) as unknown[]
      } catch {
        registry = []
      }

      // Add course entry
      const entry = { id: courseId, owner: registryRepoOwner, addedAt: new Date().toISOString() }
      registry.push(entry)
      await fs.promises.writeFile(registryPath, JSON.stringify(registry, null, 2), 'utf8')

      // Create branch, commit, push
      const branch = `add-course-${courseId}-${Date.now()}`
      await execFilePromise('git', ['checkout', '-b', branch], { cwd: tmpDir })
      await execFilePromise('git', ['add', 'registry.json'], { cwd: tmpDir })
      await execFilePromise(
        'git',
        ['commit', '-m', `feat: add course ${courseId} to registry`],
        { cwd: tmpDir }
      )
      await execFilePromise('git', ['push', 'origin', branch], { cwd: tmpDir })

      // Open PR
      const pr = await this.createPR({
        cwd: tmpDir,
        title: `Add course: ${courseId}`,
        body: `Adds course \`${courseId}\` to the opencourses registry.\n\nOwner: ${registryRepoOwner}`,
        base: 'main',
      })

      return pr
    } finally {
      await fs.promises.rm(tmpDir, { recursive: true, force: true })
    }
  }
}

function normalizeState(state: string): PRInfo['state'] {
  const s = state.toLowerCase()
  if (s === 'open') return 'open'
  if (s === 'merged') return 'merged'
  if (s === 'closed') return 'closed'
  return null
}

export const githubService = new GitHubService()
