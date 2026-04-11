# Learn Mode Task Evaluation

> Design status: route/query ownership below reflects the target frontend state model.

## Goal

Let learners work in scratch files, run tasks, and record completion when evaluation passes.

## Trigger

User opens a course in learn mode and submits a task block from section content.

## Preconditions

- Course has `scratchPath` and section markdown with optional `:::task` directives.
- Agent CLI is available for evaluation.

## Happy Path

1. Learn mode mounts file tree, code editor, terminal, and read-only section renderer.
2. Route params (`course`, `ch`, `sec`) select the active learn context.
3. React Query fetches section/scratch/progress data and caches IPC responses.
4. File tree lists scratch files and subscribes to filesystem watch events.
5. Section renderer parses markdown into blocks (heading/paragraph/list/code/mermaid/lottie/excalidraw/task).
6. User submits task; renderer reads current scratch files and calls `agent/evaluate`.
7. Main process runs evaluation skill (`resources/skills/course-evaluation/*`) and streams output.
8. On `agent:evaluation-result` pass, renderer marks section complete and invalidates/refetches progress queries.

## Alternate And Failure Paths

- If evaluation fails or agent errors, task status becomes `error`/`needs work` with feedback text.
- If scratch directory read fails, selected file falls back to `null`.
- If section file watch/read fails, section renderer shows inline error state.

## Interfaces And Data

- IPC: `fs/list`, `fs/read`, `fs/watch`, `terminal/*`, `agent/evaluate`, `agent:evaluation-result`, `courses/markSectionComplete`, `courses/getProgress`
- Route state: `course/ch/sec` identity
- Query state: section markdown, scratch listings/file contents, progress
- Ephemeral Zustand state: `taskResults`, `AgentStore.jobs`, terminal session metadata

## Code Evidence

- `src/renderer/views/LearnMode.tsx`
- `src/renderer/components/FileTreePanel.tsx`
- `src/renderer/components/CodeEditorPanel.tsx`
- `src/renderer/components/TerminalPanel.tsx`
- `src/renderer/components/SectionRenderer.tsx`
- `src/renderer/components/lexical/TaskBlockNode.tsx`
- `src/main/ipc/agent.ts`
- `src/main/services/agent.ts`
- `src/main/state/stateManager.ts`

## Related Specs

- [Product Overview](../overview.md)
- [High-Level Design](../../architecture/hld.md)
- [Renderer Workspace LLD](../../modules/renderer-workspace/lld.md)
- [Main Process LLD](../../modules/main-process/lld.md)
