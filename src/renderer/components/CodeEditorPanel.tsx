import { useEffect, useState } from 'react'
import Editor from '@monaco-editor/react'
import { fsRead, fsWrite } from '../ipc/client'

interface CodeEditorPanelProps {
  filePath: string | null
}

function inferLanguage(filePath: string): string {
  const extension = filePath.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'json':
      return 'json'
    case 'md':
      return 'markdown'
    case 'py':
      return 'python'
    case 'go':
      return 'go'
    case 'rs':
      return 'rust'
    case 'sh':
      return 'shell'
    default:
      return 'plaintext'
  }
}

export function CodeEditorPanel({ filePath }: CodeEditorPanelProps): JSX.Element {
  const [value, setValue] = useState('')

  useEffect(() => {
    if (!filePath) {
      setValue('')
      return
    }

    let cancelled = false

    void (async () => {
      const file = await fsRead(filePath)
      if (!cancelled) {
        setValue(file.content)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [filePath])

  useEffect(() => {
    if (!filePath) return

    const timer = window.setTimeout(() => {
      void fsWrite(filePath, value)
    }, 300)

    return () => {
      window.clearTimeout(timer)
    }
  }, [filePath, value])

  if (!filePath) {
    return (
      <div className="grid h-full min-h-[220px] place-items-center bg-background text-sm text-text-secondary">
        Pick a file to start editing.
      </div>
    )
  }

  return (
    <div className="h-full min-h-[220px] overflow-hidden bg-background">
      <Editor
        path={filePath}
        value={value}
        onChange={(nextValue) => setValue(nextValue ?? '')}
        height="100%"
        language={inferLanguage(filePath)}
        theme="vs-dark"
        options={{
          minimap: { enabled: false },
          fontSize: 14,
          scrollBeyondLastLine: false,
        }}
      />
    </div>
  )
}
