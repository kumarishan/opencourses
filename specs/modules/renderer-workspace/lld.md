# Renderer Workspace Low-Level Design

## Responsibility

Implements all end-user UI workflows, invokes typed IPC client methods, and maintains transient UI/session state in Zustand stores.

## Owned Code

- App and routing: `src/renderer/app.tsx`, `src/renderer/views/*`
- Course management UI: `src/renderer/components/Sidebar.tsx`, `AddCourseModal.tsx`, `TopNavbar.tsx`
- Learn/Create surfaces: `AgentChatPanel.tsx`, `SectionRenderer.tsx`, `FileTreePanel.tsx`, `CodeEditorPanel.tsx`, `TerminalPanel.tsx`
- Stores: `src/renderer/store/courseStore.ts`, `agentStore.ts`, `terminalStore.ts`
- IPC facade: `src/renderer/ipc/client.ts`

## Public Interfaces

- `window.electron.invoke/on/off` (via preload bridge)
- Store actions:
- `useCourseStore`: course list/selection/mode/branch/progress updates
- `useAgentStore`: job lifecycle, chunk aggregation, event subscription
- `useTerminalStore`: session tracking

## Core Entities And Types

- `CourseState`, `ModeType`, `TaskBlock`, `ChapterOutline`
- Local UI types: `TaskResult`, loaded chapter/section tree metadata

## Logic Flows

- Hydration flow: prerequisites check then course list bootstrap
- Course tree flow: parse chapter metadata and section frontmatter for sidebar ordering
- Create flow: branch/mode guardrails + agent generation jobs
- Learn flow: scratch editing + task submission + evaluation result handling
- Section parsing flow: markdown + custom directives (`:::task`, `:::lottie`, `:::excalidraw`, mermaid blocks)

## Dependencies

- React Router (`createHashRouter`)
- Zustand stores
- Monaco editor (`@monaco-editor/react`)
- Xterm + fit addon
- Mermaid and Lottie rendering

## State And Persistence

- Renderer stores are in-memory only.
- Durable state changes must go through IPC (`courses/*`, `fs/*`, `git/*`, etc.).

## Failure Modes

- IPC errors surface through `IPCError` and inline/toast-style UI messages.
- Async race conditions are guarded with local cancellation flags in effects.
- Section/file watchers may lag or fail; components degrade to error/empty states.

## Related Specs

- [Add And Open Course](../../product/flows/add-and-open-course.md)
- [Create Mode Generation And PR](../../product/flows/create-mode-generation-and-pr.md)
- [Learn Mode Task Evaluation](../../product/flows/learn-mode-task-evaluation.md)
- [High-Level Design](../../architecture/hld.md)
