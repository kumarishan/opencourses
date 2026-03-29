import { useEffect, useState } from 'react'
import mermaid from 'mermaid'

interface MermaidNodeProps {
  code: string
}

export function MermaidNode({ code }: MermaidNodeProps): JSX.Element {
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    const id = `mermaid-${Math.random().toString(36).slice(2)}`

    mermaid.initialize({ startOnLoad: false, theme: 'dark' })

    void mermaid
      .render(id, code)
      .then((result) => {
        if (!cancelled) {
          setSvg(result.svg)
          setError(null)
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message)
        }
      })

    return () => {
      cancelled = true
    }
  }, [code])

  if (error) {
    return (
      <pre className="whitespace-pre-wrap rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
        Mermaid render failed: {error}
      </pre>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-lg border border-border bg-surface-2 p-4"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}
