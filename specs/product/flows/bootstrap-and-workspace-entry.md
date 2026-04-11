# Bootstrap And Workspace Entry

## Goal
Start the app, load persisted workspace state, verify required local tools, and route user into setup or main workspace.

## Trigger
Desktop app launch.

## Preconditions
- Electron process starts successfully.
- Local filesystem is writable for `~/.opencourses`.

## Happy Path
1. Main process calls `bootstrap()` from `app.whenReady()`.
2. State manager creates/loads `~/.opencourses/state.json` and support folders.
3. Prerequisite service checks availability of `git`, `gh`, `claude`, `codex`.
4. Main process registers IPC handlers and app lifecycle hooks.
5. Renderer calls `getPrerequisites()` during `hydrate()`.
6. If no missing tools, renderer calls `listCourses()` and mounts workspace router.

## Alternate And Failure Paths
- If prerequisites are missing, renderer shows setup screen with install instructions and retry button.
- If prerequisite check throws, renderer shows IPC error text on setup screen.
- If no course is selected, root workspace page prompts user to choose/add a course.

## Interfaces And Data

- IPC request: `prerequisites/get`, `courses/list`
- Persisted state: `AppState` in `~/.opencourses/state.json`
- Boot log side effect: append to `~/.opencourses/logs/main.log`

## Code Evidence

- `src/main/index.ts`
- `src/main/bootstrap.ts`
- `src/main/services/prerequisites.ts`
- `src/main/state/stateManager.ts`
- `src/renderer/app.tsx`
- `src/renderer/views/SetupScreen.tsx`

## Related Specs

- [Product Overview](../overview.md)
- [High-Level Design](../../architecture/hld.md)
- [Main Process LLD](../../modules/main-process/lld.md)
- [Shared Contracts LLD](../../modules/shared-contracts/lld.md)
