import { useEffect, useRef, useState } from 'react'
import lottie from 'lottie-web'
import { fsRead } from '../../ipc/client'

interface LottieNodeProps {
  assetPath: string
}

export function LottieNode({ assetPath }: LottieNodeProps): JSX.Element {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let animation: ReturnType<typeof lottie.loadAnimation> | null = null

    void (async () => {
      try {
        const file = await fsRead(assetPath)
        if (cancelled) return

        animation = lottie.loadAnimation({
          container,
          renderer: 'svg',
          loop: true,
          autoplay: true,
          animationData: JSON.parse(file.content),
        })
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
        }
      }
    })()

    return () => {
      cancelled = true
      animation?.destroy()
    }
  }, [assetPath])

  if (error) {
    return (
      <div className="rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
        Lottie asset could not be loaded: {error}
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="min-h-[220px] rounded-lg border border-border bg-surface-2"
    />
  )
}
