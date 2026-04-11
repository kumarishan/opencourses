# High-Level Design

## System Context

OpenCourses is a local-first desktop app built with Electron + React.

- Renderer process provides UI and in-memory stores
- Main process owns privileged operations (filesystem, git, GitHub CLI, agent CLI, PTY)
- Preload bridge exposes a narrow `invoke/on/off` API to renderer

No separate backend service is used.

## Component Model

- App bootstrap and window lifecycle
- IPC registration layer (channel handlers)
- Service layer wrapping external CLIs and OS APIs
- Renderer views/components and Zustand stores
- Shared type/channel contracts

## APIs, Events, And Public Interfaces

Primary interface is Electron IPC channels declared in `src/shared/ipc.ts`.

- Request/response groups: `prerequisites`, `registry`, `courses`, `git`, `github`, `agent`, `terminal`, `fs`
- Event channels: `agent:stream-chunk`, `agent:complete`, `agent:error`, `agent:evaluation-result`, `terminal:data`, `fs:changed`

Renderer uses `src/renderer/ipc/client.ts` as a typed client facade.

## Data Ownership

- Persistent app state: `~/.opencourses/state.json` via `StateManager`
- Local course checkouts: `~/.opencourses/courses/*`
- Runtime logs: `~/.opencourses/logs/main.log`
- Scratch workspace: per-course `scratchPath` inside course checkout by default

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
