import { execFile, spawn } from 'child_process'
import { promisify } from 'util'
import type { GitStatus, GitLogEntry } from '@shared/ipc'

const execFileAsync = promisify(execFile)

class GitService {
  private async exec(args: string[], cwd?: string): Promise<string> {
    const options: Parameters<typeof execFileAsync>[2] = cwd ? { cwd } : {}
    const { stdout } = await execFileAsync('git', args, options)
    return String(stdout).trim()
  }

  private spawnAsync(args: string[], cwd?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const child = spawn('git', args, {
        cwd,
        stdio: ['ignore', 'pipe', 'pipe'],
      })

      let stderr = ''
      child.stderr?.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('close', (code) => {
        if (code !== 0) {
          const op = args[0].toUpperCase().replace(/-/g, '_')
          const err = new Error(stderr || `git ${args[0]} failed with exit code ${code}`)
          ;(err as NodeJS.ErrnoException).code = `GIT_${op}_FAILED`
          reject(err)
        } else {
          resolve()
        }
      })

      child.on('error', reject)
    })
  }

  private wrapError(op: string, err: unknown): never {
    const original = err as Error
    const wrapped = new Error(original.message || `git ${op} failed`)
    ;(wrapped as NodeJS.ErrnoException).code = `GIT_${op.toUpperCase().replace(/-/g, '_')}_FAILED`
    throw wrapped
  }

  async clone(url: string, dest: string): Promise<void> {
    try {
      await this.spawnAsync(['clone', url, dest])
    } catch (err) {
      this.wrapError('clone', err)
    }
  }

  async listBranches(cwd: string): Promise<string[]> {
    try {
      const output = await this.exec(['branch', '--format=%(refname:short)'], cwd)
      if (!output) return []
      return output.split('\n').map((b) => b.trim()).filter(Boolean)
    } catch (err) {
      this.wrapError('listBranches', err)
    }
  }

  async currentBranch(cwd: string): Promise<string> {
    try {
      return await this.exec(['rev-parse', '--abbrev-ref', 'HEAD'], cwd)
    } catch (err) {
      this.wrapError('currentBranch', err)
    }
  }

  async getRemoteUrl(cwd: string, remote = 'origin'): Promise<string | null> {
    try {
      const url = await this.exec(['remote', 'get-url', remote], cwd)
      return url || null
    } catch {
      return null
    }
  }

  async createBranch(cwd: string, name: string): Promise<void> {
    try {
      await this.exec(['checkout', '-b', name], cwd)
    } catch (err) {
      this.wrapError('createBranch', err)
    }
  }

  async checkout(cwd: string, branch: string): Promise<void> {
    try {
      await this.exec(['checkout', branch], cwd)
    } catch (err) {
      this.wrapError('checkout', err)
    }
  }

  async commitAndPush(cwd: string, message: string): Promise<void> {
    try {
      await this.spawnAsync(['add', '-A'], cwd)
      await this.spawnAsync(['commit', '-m', message], cwd)
      await this.spawnAsync(['push'], cwd)
    } catch (err) {
      this.wrapError('commitAndPush', err)
    }
  }

  async discard(cwd: string): Promise<void> {
    try {
      await this.exec(['checkout', '--', '.'], cwd)
      await this.exec(['clean', '-fd'], cwd)
    } catch (err) {
      this.wrapError('discard', err)
    }
  }

  async status(cwd: string): Promise<GitStatus> {
    try {
      const { stdout } = await execFileAsync('git', ['status', '--porcelain'], { cwd })
      const modified: string[] = []
      const untracked: string[] = []
      const staged: string[] = []

      if (!stdout.trim()) {
        return { clean: true, modified, untracked, staged }
      }

      for (const line of stdout.split('\n')) {
        if (line.length < 3) continue
        // Porcelain format: XY FILENAME (X = index, Y = worktree)
        const indexStatus = line[0]
        const worktreeStatus = line[1]
        const file = line.substring(3).trim()

        if (!file) continue

        // Staged changes: index column is modified (not space or ?)
        if (indexStatus !== ' ' && indexStatus !== '?') {
          staged.push(file)
        }

        // Untracked
        if (indexStatus === '?' && worktreeStatus === '?') {
          untracked.push(file)
        } else if (worktreeStatus === 'M' || worktreeStatus === 'D') {
          // Worktree modified (unstaged changes)
          modified.push(file)
        }
      }

      const clean = staged.length === 0 && modified.length === 0 && untracked.length === 0

      return { clean, modified, untracked, staged }
    } catch (err) {
      this.wrapError('status', err)
    }
  }

  async log(cwd: string, maxCount = 20): Promise<GitLogEntry[]> {
    try {
      const output = await this.exec(
        ['log', `--max-count=${maxCount}`, '--format=%H%n%s%n%ai'],
        cwd
      )
      if (!output) return []

      const lines = output.split('\n')
      const entries: GitLogEntry[] = []

      for (let i = 0; i + 2 < lines.length; i += 3) {
        const hash = lines[i].trim()
        const message = lines[i + 1].trim()
        const date = lines[i + 2].trim()
        if (hash) {
          entries.push({ hash, message, date })
        }
      }

      return entries
    } catch (err) {
      this.wrapError('log', err)
    }
  }
}

export const gitService = new GitService()
