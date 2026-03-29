import { useCourseStore } from '../store/courseStore'
import { AgentChatPanel } from '../components/AgentChatPanel'
import { SectionRenderer } from '../components/SectionRenderer'

export function CreateMode({ courseId }: { courseId: string }): JSX.Element {
  const activeSectionFile = useCourseStore((state) => state.activeSectionFile)

  return (
    <div className="grid h-full min-h-0 grid-cols-[minmax(360px,420px)_minmax(0,1fr)]">
      <div className="min-h-0 border-r border-border bg-surface">
        <AgentChatPanel courseId={courseId} />
      </div>
      {activeSectionFile ? (
        <SectionRenderer courseId={courseId} sectionFile={activeSectionFile} readOnly={false} />
      ) : (
        <div className="p-6 text-sm text-text-secondary">
          Choose a section from the sidebar to start editing content.
        </div>
      )}
    </div>
  )
}
