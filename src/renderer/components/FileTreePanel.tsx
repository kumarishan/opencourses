import { useEffect, useState } from 'react'
import { IPC, type FSChangedEvent, type FSEntry } from '@shared/ipc'
import { fsList, fsUnwatch, fsWatch, subscribe } from '../ipc/client'
import { cn } from '../lib/utils'

interface FileTreePanelProps {
  rootPath: string
  selectedFile: string | null
  onSelectFile: (filePath: string) => void
}

interface FileTreeEntry {
  entry: FSEntry
  children: FSEntry[]
}

async function loadTree(rootPath: string): Promise<FileTreeEntry[]> {
  const entries = await fsList(rootPath)
  return Promise.all(
    entries
      .sort((left, right) => left.name.localeCompare(right.name))
      .map(async (entry) => ({
        entry,
        children: entry.isDirectory
          ? (await fsList(entry.path)).sort((left, right) => left.name.localeCompare(right.name))
          : [],
      }))
  )
}

export function FileTreePanel({
  rootPath,
  selectedFile,
  onSelectFile,
}: FileTreePanelProps): JSX.Element {
  const [tree, setTree] = useState<FileTreeEntry[]>([])

  useEffect(() => {
    if (!rootPath) return

    let cancelled = false
    let watchId: string | null = null

    const refresh = async (): Promise<void> => {
      const nextTree = await loadTree(rootPath)
      if (!cancelled) {
        setTree(nextTree)
        if (!selectedFile) {
          const firstFile =
            nextTree.find((item) => !item.entry.isDirectory)?.entry.path ??
            nextTree.find((item) => item.children[0])?.children[0]?.path
          if (firstFile) {
            onSelectFile(firstFile)
          }
        }
      }
    }

    void refresh()

    const cleanup = subscribe<FSChangedEvent>(IPC.fs.changed, (event) => {
      if (event.path.startsWith(rootPath)) {
        void refresh()
      }
    })

    void fsWatch(rootPath).then((result) => {
      watchId = result.watchId
    })

    return () => {
      cancelled = true
      cleanup()
      if (watchId) {
        void fsUnwatch(watchId)
      }
    }
  }, [rootPath, selectedFile, onSelectFile])

  return (
    <div className="grid gap-2">
      <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-text-muted">
        Scratch Files
      </div>
      {tree.map((item) =>
        item.entry.isDirectory ? (
          <div key={item.entry.path}>
            <div className="px-2 py-1.5 text-xs font-medium text-text-primary">
              {item.entry.name}
            </div>
            <div className="grid gap-0.5 pl-2">
              {item.children.map((child) => (
                <button
                  key={child.path}
                  onClick={() => onSelectFile(child.path)}
                  className={cn(
                    'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition',
                    selectedFile === child.path
                      ? 'bg-accent/12 text-text-primary'
                      : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
                  )}
                >
                  {child.name}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <button
            key={item.entry.path}
            onClick={() => onSelectFile(item.entry.path)}
            className={cn(
              'w-full rounded-md px-2.5 py-1.5 text-left text-xs transition',
              selectedFile === item.entry.path
                ? 'bg-accent/12 text-text-primary'
                : 'text-text-secondary hover:bg-surface-2 hover:text-text-primary'
            )}
          >
            {item.entry.name}
          </button>
        )
      )}
    </div>
  )
}
