# Shared Contracts Low-Level Design

## Responsibility

Defines stable cross-process contract surface: IPC channel names plus shared request/response/event/type shapes consumed by main and renderer.

## Owned Code

- IPC channel map and shared exported types: `src/shared/ipc.ts`
- Domain types: `src/shared/types/course.ts`, `state.ts`, `agent.ts`, `registry.ts`
- Type tests: `src/shared/__tests__/types.test.ts`

## Public Interfaces

- `IPC` constant with grouped channel identifiers
- Type exports used in both main and renderer packages

## Core Entities And Types

- Course and app state (`CourseState`, `AppState`, learner progress)
- Mode transitions (`ModeSetResult`)
- Git/GitHub payloads (`GitStatus`, `CreatePRRequest`, `ReleaseInfo`)
- Agent payloads/events (`AgentGenerationRequest`, `EvaluationResult`, stream/error/complete events)
- Filesystem and terminal event payloads (`FSEntry`, `FSChangedEvent`, `TerminalDataEvent`)

## Logic Flows

- Renderer imports channel constants and invokes typed client wrappers.
- Main handlers must honor request argument order/shape from renderer client.
- Stream events are multiplexed by `jobId` or `sessionId` in renderer stores/components.

## Dependencies

- No runtime side effects; pure TypeScript definitions and constants.
- Imported by both main and renderer bundles via TS path aliases.

## State And Persistence

- None directly; this module defines schema used by persistence and transport layers.

## Failure Modes

- Contract drift risk if channels/types change without updating both sides.
- Type coverage is compile-time only; runtime payload validation is limited.

## Related Specs

- [High-Level Design](../../architecture/hld.md)
- [Renderer Workspace LLD](../renderer-workspace/lld.md)
- [Main Process LLD](../main-process/lld.md)
