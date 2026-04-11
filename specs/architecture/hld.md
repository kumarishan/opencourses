# High-Level Design

> Design status: includes planned frontend state-model migration (route identity + React Query cache + ephemeral Zustand).

## System Context

OpenCourses is a local-first desktop app built with Electron + React.

- Renderer process provides UI, route state, query cache, and ephemeral workflow state
- Main process owns privileged operations (filesystem, git, GitHub CLI, agent CLI, PTY)
- Preload bridge exposes a narrow `invoke/on/off` API to renderer

No separate backend service is used.

## Component Model

- App bootstrap and window lifecycle
- IPC registration layer (channel handlers)
- Service layer wrapping external CLIs and OS APIs
- Renderer views/components + route model + React Query cache + Zustand ephemeral stores
- Shared type/channel contracts

## APIs, Events, And Public Interfaces

Primary interface is Electron IPC channels declared in `src/shared/ipc.ts`.

- Request/response groups: `prerequisites`, `registry`, `courses`, `git`, `github`, `agent`, `terminal`, `fs`
- Event channels: `agent:stream-chunk`, `agent:complete`, `agent:error`, `agent:evaluation-result`, `terminal:data`, `fs:changed`

Renderer uses `src/renderer/ipc/client.ts` as a typed client facade.

Frontend state contract:

- URL params own active learning context (`course/ch/sec`)
- React Query owns fetch/cache/invalidation for IPC-backed reads
- Zustand owns transient workflow/session state only
- Course query/mutation entrypoint is centralized in `src/renderer/hooks/useCourses.ts`

## Data Ownership

- Persistent app state: `~/.opencourses/state.json` via `StateManager`
- Local course checkouts: `~/.opencourses/courses/*`
- Runtime logs: `~/.opencourses/logs/main.log`
- Scratch workspace: per-course `scratchPath` inside course checkout by default
- Renderer route state owns course/chapter/section identity.
- Renderer query cache owns course registry/tree/section/progress payloads.
- Renderer ephemeral store owns job streams, terminal sessions, dialogs, and temporary UI flags.

## Key Sequences

- Startup and prerequisites: [Bootstrap And Workspace Entry](../product/flows/bootstrap-and-workspace-entry.md)
- Course import/navigation: [Add And Open Course](../product/flows/add-and-open-course.md)
- Authoring and PR: [Create Mode Generation And PR](../product/flows/create-mode-generation-and-pr.md)
- Learner evaluation loop: [Learn Mode Task Evaluation](../product/flows/learn-mode-task-evaluation.md)

## External Dependencies

- `git` CLI for clone/branch/commit/push/status
- `gh` CLI for registry API and PR/release operations
- `claude` or `codex` CLI for generation/evaluation subprocesses
- `node-pty` for embedded terminal sessions
- Renderer libraries: Monaco, xterm, Mermaid, Lottie

## Operational Concerns

- Main-process services convert thrown errors into structured IPC error payloads.
- FileSystemService enforces path safety by rejecting paths outside `~/.opencourses`.
- State persistence is debounced and atomically written through a temp file rename.
- Agent and terminal sessions are in-memory maps; process lifecycle cleanup is critical.

## Cross-Module Links

- [Renderer Workspace LLD](../modules/renderer-workspace/lld.md)
- [Main Process LLD](../modules/main-process/lld.md)
- [Shared Contracts LLD](../modules/shared-contracts/lld.md)
