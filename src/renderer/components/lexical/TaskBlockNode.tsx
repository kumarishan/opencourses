import type { TaskBlock } from '@shared/types/course'
import { cn } from '../../lib/utils'

interface TaskResult {
  status: 'idle' | 'running' | 'complete' | 'error'
  feedback?: string
  pass?: boolean
}

interface TaskBlockNodeProps {
  taskBlock: TaskBlock
  result?: TaskResult
  onSubmit?: (taskBlock: TaskBlock) => void
}

export function TaskBlockNode({
  taskBlock,
  result,
  onSubmit,
}: TaskBlockNodeProps): JSX.Element {
  return (
    <section className="grid gap-4 rounded-xl border border-border bg-surface p-5">
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          Task Block
        </div>
        <h3 className="mt-2 text-2xl font-semibold tracking-tight text-text-primary">
          {taskBlock.title}
        </h3>
      </div>

      <p className="m-0 text-[15px] leading-7 text-text-secondary">{taskBlock.objective}</p>

      <div>
        <strong className="mb-2 block text-sm text-text-primary">Hints</strong>
        <ul className="m-0 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-text-secondary">
          {taskBlock.hints.map((hint) => (
            <li key={hint}>
              {hint}
            </li>
          ))}
        </ul>
      </div>

      <div>
        <strong className="mb-2 block text-sm text-text-primary">Success criteria</strong>
        <ul className="m-0 list-disc space-y-1.5 pl-5 text-[15px] leading-7 text-text-secondary">
          {taskBlock.criteria.map((criterion) => (
            <li key={criterion}>
              {criterion}
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => onSubmit?.(taskBlock)}
          className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90"
        >
          Submit for Evaluation
        </button>

        {result ? (
          <span
            className={cn(
              'rounded-md px-3 py-1.5 text-xs font-medium',
              result.status === 'complete'
                ? result.pass
                  ? 'bg-emerald-400/12 text-emerald-200'
                  : 'bg-red-500/10 text-red-200'
                : 'bg-surface-2 text-text-secondary'
            )}
          >
            {result.status === 'running'
              ? 'Evaluating...'
              : result.status === 'error'
                ? 'Evaluation failed'
                : result.pass
                  ? 'Passed'
                  : 'Needs work'}
          </span>
        ) : null}
      </div>

      {result?.feedback ? (
        <div className="rounded-lg border border-border bg-surface-2 px-4 py-3 text-[15px] leading-7 text-text-secondary">
          {result.feedback}
        </div>
      ) : null}
    </section>
  )
}
