import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

type ToolName = 'git' | 'gh' | 'claude' | 'codex'

interface PrerequisitesResult {
  missing: ToolName[]
  agentCLI: 'claude' | 'codex' | null
}

class PrerequisitesService {
  async check(): Promise<PrerequisitesResult> {
    const tools: ToolName[] = ['git', 'gh', 'claude', 'codex']
    const presence: Record<ToolName, boolean> = {
      git: false,
      gh: false,
      claude: false,
      codex: false,
    }

    await Promise.all(
      tools.map(async (tool) => {
        try {
          await execFileAsync('which', [tool])
          presence[tool] = true
        } catch {
          presence[tool] = false
        }
      })
    )

    // Determine agentCLI preference
    let agentCLI: 'claude' | 'codex' | null = null
    if (presence.claude) {
      agentCLI = 'claude'
    } else if (presence.codex) {
      agentCLI = 'codex'
    }

    // Determine missing required tools
    const missing: ToolName[] = []
    if (!presence.git) missing.push('git')
    if (!presence.gh) missing.push('gh')
    if (!presence.claude && !presence.codex) missing.push('claude')

    return { missing, agentCLI }
  }
}

export const prerequisitesService = new PrerequisitesService()
