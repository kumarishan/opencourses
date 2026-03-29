import { useEffect, useState } from 'react'
import { fsRead } from '../../ipc/client'

interface ExcalidrawNodeProps {
  assetPath: string
}

export function ExcalidrawNode({ assetPath }: ExcalidrawNodeProps): JSX.Element {
  const [content, setContent] = useState<string>('')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const file = await fsRead(assetPath)
        if (!cancelled) {
          setContent(file.content.slice(0, 2000))
        }
      } catch {
        if (!cancelled) {
          setContent('Excalidraw scene preview is unavailable.')
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [assetPath])

  return (
    <div className="rounded-lg border border-border bg-surface-2 p-4">
      <div className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Excalidraw
      </div>
      <pre className="m-0 whitespace-pre-wrap font-mono text-[13px] leading-6 text-text-secondary">
        {content}
      </pre>
    </div>
  )
}
