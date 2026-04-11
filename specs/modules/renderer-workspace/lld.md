# Renderer Workspace Low-Level Design

> Design status: describes the target renderer state architecture.

## Responsibility

Implements end-user UI workflows with a hybrid state model:

- route params for navigation identity
- React Query for IPC-backed fetch/cache/invalidation
- Zustand for transient workflow/session state

## Owned Code

- App and routing: `src/renderer/app.tsx`, `src/renderer/views/*`
- Course management UI: `src/renderer/components/Sidebar.tsx`, `AddCourseModal.tsx`, `TopNavbar.tsx`
- Learn/Create surfaces: `AgentChatPanel.tsx`, `SectionRenderer.tsx`, `FileTreePanel.tsx`, `CodeEditorPanel.tsx`, `TerminalPanel.tsx`
- Course query/mutation hooks: `src/renderer/hooks/useCourses.ts`
- Stores: `src/renderer/store/courseStore.ts`, `agentStore.ts`, `terminalStore.ts`
- IPC facade: `src/renderer/ipc/client.ts`

## Public Interfaces

- `window.electron.invoke/on/off` (via preload bridge)
- Router params for active context (`course`, `ch`, `sec`)
- Course hooks (`useGetCourses`, `useGetCourseByName`, `useAddCourse`, `useRemoveCourse`, `useSetCourseMode`, `useUpdateCourse`)
- `useAgentStore`: job lifecycle, chunk aggregation, event subscription
- `useTerminalStore`: session tracking

## Core Entities And Types

- `CourseState`, `ModeType`, `TaskBlock`, `ChapterOutline`
- Local UI types: `TaskResult`, loaded chapter/section tree metadata

## Logic Flows

- Hydration flow: prerequisites check then initial query prefetch
- Course tree flow: parse chapter metadata and section frontmatter for sidebar ordering
- Create flow: branch/mode guardrails + agent generation jobs + query invalidation after mutations
- Learn flow: route-selected section + query-backed reads + task submission + evaluation result handling
- Section parsing flow: markdown + custom directives (`:::task`, `:::lottie`, `:::excalidraw`, mermaid blocks)

## Dependencies

- React Router (`createHashRouter`)
- React Query
- Zustand stores (ephemeral only)
- Monaco editor (`@monaco-editor/react`)
- Xterm + fit addon
- Mermaid and Lottie rendering

## State And Persistence

- URL state is canonical for active learn context.
- Query cache is canonical for IPC-backed read models.
- Zustand stores are in-memory and limited to workflow/session state.
- Durable mutations still go through IPC (`courses/*`, `fs/*`, `git/*`, etc.) and trigger query invalidation.

## Failure Modes

- IPC errors surface through `IPCError` and inline/toast-style UI messages.
- Async race conditions are guarded with local cancellation flags in effects.
- Section/file watchers may lag or fail; components degrade to error/empty states.

## Related Specs

- [Add And Open Course](../../product/flows/add-and-open-course.md)
- [Create Mode Generation And PR](../../product/flows/create-mode-generation-and-pr.md)
- [Learn Mode Task Evaluation](../../product/flows/learn-mode-task-evaluation.md)
- [High-Level Design](../../architecture/hld.md)
