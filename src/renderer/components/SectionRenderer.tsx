import { useEffect, useMemo, useRef, useState } from 'react'
import type { TaskBlock } from '@shared/types/course'
import { IPC, type FSChangedEvent } from '@shared/ipc'
import { fsRead, fsUnwatch, fsWatch, fsWrite, subscribe } from '../ipc/client'
import { cn } from '../lib/utils'
import { ExcalidrawNode } from './lexical/ExcalidrawNode'
import { LottieNode } from './lexical/LottieNode'
import { MermaidNode } from './lexical/MermaidNode'
import { TaskBlockNode } from './lexical/TaskBlockNode'

interface TaskResult {
  status: 'idle' | 'running' | 'complete' | 'error'
  feedback?: string
  pass?: boolean
}

interface SectionRendererProps {
  courseId: string
  sectionFile: string
  readOnly: boolean
  onTaskSubmit?: (taskBlock: TaskBlock) => void
  taskResults?: Record<string, TaskResult>
}

type MarkdownBlock =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[] }
  | { kind: 'code'; language: string; code: string }
  | { kind: 'mermaid'; code: string }
  | { kind: 'lottie'; path: string }
  | { kind: 'excalidraw'; path: string }
  | { kind: 'task'; taskBlock: TaskBlock }

function dirName(filePath: string): string {
  const segments = filePath.split('/')
  segments.pop()
  return segments.join('/') || '/'
}

function joinPath(basePath: string, relativePath: string): string {
  if (relativePath.startsWith('/')) return relativePath
  return `${basePath.replace(/\/$/, '')}/${relativePath.replace(/^\//, '')}`
}

function resolveAssetPath(sectionFile: string, assetPath: string): string {
  if (assetPath.startsWith('/')) return assetPath

  if (assetPath.startsWith('assets/')) {
    const courseRoot = sectionFile.includes('/chapters/')
      ? sectionFile.slice(0, sectionFile.indexOf('/chapters/'))
      : dirName(sectionFile)
    return joinPath(courseRoot, assetPath)
  }

  return joinPath(dirName(sectionFile), assetPath)
}

function parseDirectiveBody(body: string): Record<string, string | string[]> {
  const lines = body.split('\n')
  const fields: Record<string, string | string[]> = {}
  let currentList: string | null = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('- ') && currentList) {
      const list = (fields[currentList] as string[] | undefined) ?? []
      fields[currentList] = [...list, line.slice(2).trim()]
      continue
    }

    const separator = line.indexOf(':')
    if (separator === -1) continue

    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim()
    if (!value) {
      currentList = key
      fields[key] = []
    } else {
      currentList = null
      fields[key] = value
    }
  }

  return fields
}

function stripFrontmatter(markdown: string): string {
  return markdown.replace(/^---\n[\s\S]*?\n---\n?/, '')
}

function parseMarkdown(markdown: string): MarkdownBlock[] {
  const body = stripFrontmatter(markdown)
  const lines = body.split('\n')
  const blocks: MarkdownBlock[] = []

  for (let index = 0; index < lines.length; ) {
    const line = lines[index] ?? ''
    const trimmed = line.trim()

    if (!trimmed) {
      index += 1
      continue
    }

    if (trimmed.startsWith('```')) {
      const language = trimmed.slice(3).trim()
      const codeLines: string[] = []
      index += 1
      while (index < lines.length && !lines[index]?.trim().startsWith('```')) {
        codeLines.push(lines[index] ?? '')
        index += 1
      }
      index += 1
      if (language === 'mermaid') {
        blocks.push({ kind: 'mermaid', code: codeLines.join('\n') })
      } else {
        blocks.push({ kind: 'code', language, code: codeLines.join('\n') })
      }
      continue
    }

    if (trimmed.startsWith(':::')) {
      const directive = trimmed.slice(3).trim()
      const directiveLines: string[] = []
      index += 1
      while (index < lines.length && lines[index]?.trim() !== ':::') {
        directiveLines.push(lines[index] ?? '')
        index += 1
      }
      index += 1
      const fields = parseDirectiveBody(directiveLines.join('\n'))
      if (directive === 'lottie' && typeof fields.path === 'string') {
        blocks.push({ kind: 'lottie', path: fields.path })
      } else if (directive === 'excalidraw' && typeof fields.path === 'string') {
        blocks.push({ kind: 'excalidraw', path: fields.path })
      } else if (directive === 'task') {
        blocks.push({
          kind: 'task',
          taskBlock: {
            id:
              typeof fields.id === 'string'
                ? fields.id
                : `task-${Math.random().toString(36).slice(2)}`,
            title: typeof fields.title === 'string' ? fields.title : 'Task',
            objective: typeof fields.objective === 'string' ? fields.objective : '',
            hints: Array.isArray(fields.hints) ? fields.hints : [],
            criteria: Array.isArray(fields.criteria) ? fields.criteria : [],
          },
        })
      }
      continue
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({
        kind: 'heading',
        level: heading[1].length,
        text: heading[2],
      })
      index += 1
      continue
    }

    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const items: string[] = []
      while (index < lines.length) {
        const listLine = lines[index]?.trim() ?? ''
        if (!listLine.startsWith('- ') && !listLine.startsWith('* ')) break
        items.push(listLine.slice(2).trim())
        index += 1
      }
      blocks.push({ kind: 'list', items })
      continue
    }

    const paragraphLines: string[] = []
    while (index < lines.length) {
      const current = lines[index] ?? ''
      const currentTrimmed = current.trim()
      if (
        !currentTrimmed ||
        currentTrimmed.startsWith('```') ||
        currentTrimmed.startsWith(':::') ||
        currentTrimmed.startsWith('- ') ||
        currentTrimmed.startsWith('* ') ||
        /^(#{1,6})\s+/.test(currentTrimmed)
      ) {
        break
      }
      paragraphLines.push(currentTrimmed)
      index += 1
    }
    blocks.push({ kind: 'paragraph', text: paragraphLines.join(' ') })
  }

  return blocks
}

export function SectionRenderer({
  courseId,
  sectionFile,
  readOnly,
  onTaskSubmit,
  taskResults = {},
}: SectionRendererProps): JSX.Element {
  const [content, setContent] = useState('')
  const [draftContent, setDraftContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const skipSaveRef = useRef(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    void (async () => {
      try {
        const file = await fsRead(sectionFile)
        if (!cancelled) {
          setContent(file.content)
          setDraftContent(file.content)
          skipSaveRef.current = true
        }
      } catch (err) {
        if (!cancelled) {
          setError((err as Error).message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [courseId, sectionFile])

  useEffect(() => {
    if (!readOnly) return

    let watchId: string | null = null
    const cleanup = subscribe<FSChangedEvent>(IPC.fs.changed, (event) => {
      if (event.path !== sectionFile) return
      void fsRead(sectionFile).then((file) => {
        setContent(file.content)
        setDraftContent(file.content)
      })
    })

    void fsWatch(sectionFile).then((result) => {
      watchId = result.watchId
    })

    return () => {
      cleanup()
      if (watchId) {
        void fsUnwatch(watchId)
      }
    }
  }, [readOnly, sectionFile])

  useEffect(() => {
    if (readOnly) return
    if (skipSaveRef.current) {
      skipSaveRef.current = false
      return
    }

    const timer = window.setTimeout(() => {
      void fsWrite(sectionFile, draftContent)
      setContent(draftContent)
    }, 500)

    return () => {
      window.clearTimeout(timer)
    }
  }, [draftContent, readOnly, sectionFile])

  const blocks = useMemo(() => parseMarkdown(readOnly ? content : draftContent), [content, draftContent, readOnly])

  function renderBlock(block: MarkdownBlock, index: number): JSX.Element {
    if (block.kind === 'heading') {
      const Tag = `h${Math.min(block.level + 1, 6)}` as keyof JSX.IntrinsicElements
      const headingClass = {
        1: 'mt-6 text-4xl',
        2: 'mt-6 text-3xl',
        3: 'mt-5 text-2xl',
        4: 'mt-5 text-xl',
        5: 'mt-4 text-lg',
        6: 'mt-4 text-base',
      }[block.level] ?? 'mt-4 text-lg'
      return (
        <Tag
          key={index}
          className={cn(headingClass, 'mb-3 leading-tight font-semibold tracking-tight text-text-primary')}
        >
          {block.text}
        </Tag>
      )
    }

    if (block.kind === 'paragraph') {
      return (
        <p key={index} className="mb-4 text-[15px] leading-7 text-text-secondary">
          {block.text}
        </p>
      )
    }

    if (block.kind === 'list') {
      return (
        <ul key={index} className="mb-[18px] list-disc space-y-2 pl-6 text-[15px] leading-7 text-text-secondary">
          {block.items.map((item) => (
            <li key={item}>
              {item}
            </li>
          ))}
        </ul>
      )
    }

    if (block.kind === 'code') {
      return (
        <pre
          key={index}
          className="mb-[18px] overflow-x-auto rounded-lg border border-border bg-surface-3 p-4 text-[13px] leading-6 text-text-primary"
        >
          <code>{block.code}</code>
        </pre>
      )
    }

    if (block.kind === 'mermaid') {
      return <MermaidNode key={index} code={block.code} />
    }

    if (block.kind === 'lottie') {
      return <LottieNode key={index} assetPath={resolveAssetPath(sectionFile, block.path)} />
    }

    if (block.kind === 'excalidraw') {
      return <ExcalidrawNode key={index} assetPath={resolveAssetPath(sectionFile, block.path)} />
    }

    return (
      <TaskBlockNode
        key={index}
        taskBlock={block.taskBlock}
        result={taskResults[block.taskBlock.id]}
        onSubmit={onTaskSubmit}
      />
    )
  }

  if (loading) {
    return <div className="p-6 text-sm text-text-secondary">Loading section...</div>
  }

  if (error) {
    return (
      <div className="m-4 rounded-lg border border-red-400/30 bg-red-500/10 p-4 text-sm text-red-200">
        {error}
      </div>
    )
  }

  return (
    <div className="grid h-full grid-rows-[auto_minmax(0,1fr)]">
      <div className="border-b border-border bg-surface px-4 py-3">
        <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
          {readOnly ? 'Learn View' : 'Editable Section'}
        </div>
        <div className="mt-1 text-sm font-medium text-text-primary">{sectionFile.split('/').pop()}</div>
      </div>

      {readOnly ? (
        <div className="overflow-auto">
          <div className="mx-auto grid max-w-4xl gap-[18px] px-8 py-6">
            {blocks.map(renderBlock)}
          </div>
        </div>
      ) : (
        <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <textarea
            value={draftContent}
            onChange={(event) => setDraftContent(event.target.value)}
            spellCheck={false}
            className="min-h-0 resize-none border-0 border-r border-border bg-background px-5 py-5 font-mono text-sm leading-6 text-text-primary outline-none"
          />
          <div className="overflow-auto">
            <div className="grid gap-[18px] px-6 py-5">
              {blocks.map(renderBlock)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
