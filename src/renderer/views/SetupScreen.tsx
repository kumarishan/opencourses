import { startTransition, useState } from 'react'
import { getPrerequisites, type IPCError } from '../ipc/client'

type MissingTool = 'git' | 'gh' | 'claude' | 'codex'

const instructions: Record<MissingTool, string> = {
  git: 'Install Git from https://git-scm.com/',
  gh: 'Install GitHub CLI with `brew install gh`, then run `gh auth login`.',
  claude: 'Install Claude Code CLI from https://claude.ai/cli',
  codex:
    'Install Codex CLI with `npm install -g @openai/codex`, then sign in with `codex login --device-auth` (or `printenv OPENAI_API_KEY | codex login --with-api-key`).',
}

interface SetupScreenProps {
  missing?: MissingTool[]
  onReady?: () => void
}

export function SetupScreen({
  missing: initialMissing = [],
  onReady,
}: SetupScreenProps): JSX.Element {
  const [missing, setMissing] = useState<MissingTool[]>(initialMissing)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  async function handleRecheck(): Promise<void> {
    setChecking(true)
    setError(null)

    try {
      const result = await getPrerequisites()
      if (result.missing.length === 0) {
        startTransition(() => {
          setMissing([])
          onReady?.()
        })
      } else {
        setMissing(result.missing)
      }
    } catch (err) {
      const ipcError = err as IPCError
      setError(ipcError.message)
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-8">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-surface">
        <div className="flex items-baseline justify-between gap-6 border-b border-border px-8 py-6">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Setup Required
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
              Finish the CLI prerequisites
            </h1>
          </div>
          <button
            onClick={() => void handleRecheck()}
            disabled={checking}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/30 disabled:text-white/50"
          >
            {checking ? 'Checking...' : 'Re-check'}
          </button>
        </div>

        <div className="px-8 pb-8 pt-6">
          <p className="text-base leading-7 text-text-secondary">
            opencourses depends on local developer tooling. Install each missing tool, then re-run
            the check.
          </p>

          <div className="mt-6 grid gap-3.5">
            {missing.map((tool) => (
              <div
                key={tool}
                className="rounded-lg border border-border bg-background p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <strong className="text-lg lowercase text-text-primary">{tool}</strong>
                  <span className="rounded-md border border-border bg-surface px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-text-secondary">
                    missing
                  </span>
                </div>
                <p className="mt-3 text-sm leading-6 text-text-secondary">
                  {instructions[tool]}
                </p>
              </div>
            ))}
          </div>

          {error ? (
            <div className="mt-4 rounded-lg border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
