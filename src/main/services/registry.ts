import { execFile } from 'child_process'
import { promisify } from 'util'
import { RegistryCourse } from '@shared/ipc'
import { formatRegistryFetchError, getRegistryContentsApiPath } from './registryConfig'

const execFileAsync = promisify(execFile)

class RegistryService {
  private cache: RegistryCourse[] | null = null

  async list(): Promise<RegistryCourse[]> {
    if (this.cache !== null) {
      return this.cache
    }
    return this.fetch()
  }

  async refresh(): Promise<RegistryCourse[]> {
    return this.fetch()
  }

  private async fetch(): Promise<RegistryCourse[]> {
    let b64: string
    try {
      const { stdout } = await execFileAsync('gh', [
        'api',
        getRegistryContentsApiPath(),
        '--jq',
        '.content',
      ])
      b64 = stdout.trim()
    } catch (err: unknown) {
      const error = err as { stderr?: string; message?: string }
      const message = formatRegistryFetchError(
        error.stderr?.trim() || error.message || 'Unknown error'
      )
      const fetchError = new Error(message) as Error & { code: string }
      fetchError.code = 'REGISTRY_FETCH_FAILED'
      throw fetchError
    }

    const json = Buffer.from(b64, 'base64').toString('utf8')
    const parsed = JSON.parse(json)
    const courses: RegistryCourse[] = parsed.courses

    this.cache = courses
    return courses
  }
}

export const registryService = new RegistryService()
