# Learn Mode Task Evaluation

## Goal

Let learners work in scratch files, run tasks, and record completion when evaluation passes.

## Trigger

User opens a course in learn mode and submits a task block from section content.

## Preconditions

- Course has `scratchPath` and section markdown with optional `:::task` directives.
- Agent CLI is available for evaluation.

## Happy Path

1. Learn mode mounts file tree, code editor, terminal, and read-only section renderer.
2. File tree lists scratch files and subscribes to filesystem watch events.
3. Section renderer parses markdown into blocks (heading/paragraph/list/code/mermaid/lottie/excalidraw/task).
4. User submits task; renderer reads current scratch files and calls `agent/evaluate`.
5. Main process runs evaluation skill (`resources/skills/course-evaluation/*`) and streams output.
6. On `agent:evaluation-result` pass, renderer marks section complete and refreshes course progress.

## Alternate And Failure Paths

- If evaluation fails or agent errors, task status becomes `error`/`needs work` with feedback text.
- If scratch directory read fails, selected file falls back to `null`.
- If section file watch/read fails, section renderer shows inline error state.

## Interfaces And Data

- IPC: `fs/list`, `fs/read`, `fs/watch`, `terminal/*`, `agent/evaluate`, `agent:evaluation-result`, `courses/markSectionComplete`, `courses/getProgress`
- State: `taskResults`, `AgentStore.jobs`, `CourseState.learnerProgress`

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
