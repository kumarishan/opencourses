import { createPortal } from 'react-dom'
import { useEffect, useRef, useState } from 'react'
import { GitBranch, X } from 'lucide-react'

interface BranchNameRequest {
  title: string
  description?: string
  confirmLabel?: string
  initialValue?: string
}

interface PendingBranchNameRequest extends BranchNameRequest {
  confirmLabel: string
}

interface BranchNameDialogProps {
  request: PendingBranchNameRequest
  value: string
  onChange: (value: string) => void
  onCancel: () => void
  onSubmit: () => void
}

function BranchNameDialog({
  request,
  value,
  onChange,
  onCancel,
  onSubmit,
}: BranchNameDialogProps): JSX.Element {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        onCancel()
        return
      }

      if (event.key === 'Enter' && value.trim()) {
        event.preventDefault()
        onSubmit()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [onCancel, onSubmit, value])

  return createPortal(
    <div
      className="fixed inset-0 z-[350] flex items-center justify-center bg-black/70 p-4"
      onMouseDown={(event) => {
        event.stopPropagation()
        if (event.target === event.currentTarget) {
          onCancel()
        }
      }}
    >
      <div
        className="w-full max-w-md rounded-xl border border-border bg-surface text-text-primary shadow-2xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-6 px-6 pt-6">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
              Branch
            </p>
            <h2 className="mt-2 text-xl font-semibold tracking-tight text-text-primary">
              {request.title}
            </h2>
            {request.description ? (
              <p className="mt-2 text-sm leading-6 text-text-secondary">{request.description}</p>
            ) : null}
          </div>
          <button
            onClick={onCancel}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface-2 text-text-secondary transition hover:border-border-hover hover:bg-surface-3 hover:text-text-primary"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="px-6 pb-6 pt-5">
          <label className="grid gap-2">
            <span className="text-sm font-medium text-text-secondary">Branch name</span>
            <div className="relative">
              <GitBranch
                size={14}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted"
              />
              <input
                autoFocus
                value={value}
                onChange={(event) => onChange(event.target.value)}
                placeholder="feature/my-update"
                className="w-full rounded-md border border-border bg-background py-2.5 pl-9 pr-3 text-sm text-text-primary outline-none transition placeholder:text-text-muted focus:border-accent"
              />
            </div>
          </label>

          <div className="mt-5 flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="rounded-md border border-border bg-transparent px-3.5 py-2 text-sm text-text-secondary transition hover:border-border-hover hover:bg-surface-2 hover:text-text-primary"
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={!value.trim()}
              className="rounded-md bg-accent px-3.5 py-2 text-sm font-medium text-white transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:bg-accent/30 disabled:text-white/50"
            >
              {request.confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

export function useBranchNameDialog(): {
  dialog: JSX.Element
  requestBranchName: (request: BranchNameRequest) => Promise<string | null>
} {
  const [request, setRequest] = useState<PendingBranchNameRequest | null>(null)
  const [value, setValue] = useState('')
  const resolverRef = useRef<((branchName: string | null) => void) | null>(null)

  useEffect(() => {
    return () => {
      resolverRef.current?.(null)
      resolverRef.current = null
    }
  }, [])

  function closeWith(branchName: string | null): void {
    resolverRef.current?.(branchName)
    resolverRef.current = null
    setRequest(null)
    setValue('')
  }

  function requestBranchName(nextRequest: BranchNameRequest): Promise<string | null> {
    resolverRef.current?.(null)
    setRequest({
      ...nextRequest,
      confirmLabel: nextRequest.confirmLabel ?? 'Continue',
    })
    setValue(nextRequest.initialValue ?? '')

    return new Promise((resolve) => {
      resolverRef.current = resolve
    })
  }

  return {
    requestBranchName,
    dialog: request ? (
      <BranchNameDialog
        request={request}
        value={value}
        onChange={setValue}
        onCancel={() => closeWith(null)}
        onSubmit={() => closeWith(value.trim())}
      />
    ) : (
      <></>
    ),
  }
}
