# Main Process Low-Level Design

## Responsibility

Owns privileged capabilities: app bootstrap, state persistence, filesystem access, git/GitHub operations, agent subprocess orchestration, and PTY terminal sessions.

## Owned Code

- Boot/lifecycle: `src/main/index.ts`, `src/main/bootstrap.ts`
- IPC handlers: `src/main/ipc/*.ts`
- Services: `src/main/services/*.ts`
- State: `src/main/state/stateManager.ts`

## Public Interfaces

- IPC handlers registered through `ipcMain.handle(...)` for channels in `IPC` constant.
- Event publishing through `win.webContents.send(...)` for async streams.

## Core Entities And Types

- `AppState`, `CourseState`, `PRInfo`
- `ModeSetResult`, `GitStatus`, `PrerequisitesResult`
- Agent job/session IDs (`crypto.randomUUID()`)

## Logic Flows

- `bootstrap()` sequence: load state, write startup log, detect agent preference, register handlers, create browser window
- Course import flow: normalize repo URL, detect reusable checkout, clone/create scratch dir, persist `CourseState`
- Mode-switch flow: enforce creation branch + merged-PR checks before entering create mode
- Agent flow: load skill assets, spawn CLI process, stream stdout lines, parse completion payload
- Filesystem flow: safe-path guard against baseDir escape, optional watch streams

## Dependencies

- Electron main APIs (`app`, `BrowserWindow`, `ipcMain`)
- OS and Node APIs (`fs`, `child_process`, `path`, `os`)
- External CLIs (`git`, `gh`, `claude`, `codex`)
- `node-pty` for interactive terminal subprocesses

## State And Persistence

- State persisted at `~/.opencourses/state.json` with debounce and atomic temp-file rename.
- Course checkouts stored under `~/.opencourses/courses`.
- Service caches:
- `RegistryService` in-memory course list cache
- `AgentService` and `TerminalService` in-memory process/session maps

## Failure Modes

- CLI errors are wrapped with operation-specific codes (for example `GIT_CHECKOUT_FAILED`, `GH_CREATE_PR_FAILED`).
- Missing course IDs return `COURSE_NOT_FOUND` from handlers.
- Agent subprocess non-zero exits emit `agent:error` with stderr fallback.
- Path traversal attempts in filesystem service throw explicit error before IO.

## Related Specs

- [Bootstrap And Workspace Entry](../../product/flows/bootstrap-and-workspace-entry.md)
- [Add And Open Course](../../product/flows/add-and-open-course.md)
- [Create Mode Generation And PR](../../product/flows/create-mode-generation-and-pr.md)
- [Learn Mode Task Evaluation](../../product/flows/learn-mode-task-evaluation.md)
- [High-Level Design](../../architecture/hld.md)
