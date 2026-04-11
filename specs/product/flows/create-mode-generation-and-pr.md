# Create Mode Generation And PR

## Goal

Switch into create mode, generate/update course content through local agent CLI, and push a PR.

## Trigger

User switches to Create mode and sends instructions in the Agent Chat panel.

## Preconditions

- Course is loaded.
- A creation branch exists (or can be created).
- Agent CLI (`claude` or `codex`) is available locally.

## Happy Path

1. Top navbar requests mode change via `courses/setMode`.
2. If branch is missing, renderer prompts for branch name and calls `git/createBranch`, then retries mode switch.
3. Renderer loads create layout with `AgentChatPanel` and editable `SectionRenderer`.
4. User sends instructions; renderer calls `agent/startGeneration` with phase (`outline`, `content`, or `section-update`).
5. Main process loads bundled skill prompt (`resources/skills/course-creation/*`) and spawns CLI process.
6. Agent stream chunks are delivered over `agent:stream-chunk`; completion over `agent:complete`.
7. Section editor autosaves markdown via `fs/write`.
8. User clicks Push PR; renderer calls `git/commitAndPush` then `github/createPR`.

## Alternate And Failure Paths

- If previous creation PR is already merged, mode switch returns `pr-merged`; user must create a new branch.
- Agent process errors are surfaced via `agent:error` and shown in chat.
- PR creation failures surface as IPC errors.

## Interfaces And Data

- IPC: `courses/setMode`, `git/createBranch`, `git/checkout`, `agent/startGeneration`, `agent:stream-chunk`, `agent:complete`, `git/commitAndPush`, `github/createPR`
- State fields: `creationBranch`, `creationPR`, `activeMode`, `activeBranch`

## Code Evidence

- `src/renderer/components/TopNavbar.tsx`
- `src/renderer/components/AgentChatPanel.tsx`
- `src/renderer/components/SectionRenderer.tsx`
- `src/main/ipc/courses.ts`
- `src/main/ipc/agent.ts`
- `src/main/services/agent.ts`
- `src/main/services/git.ts`
- `src/main/services/github.ts`

## Related Specs

- [High-Level Design](../../architecture/hld.md)
- [Renderer Workspace LLD](../../modules/renderer-workspace/lld.md)
- [Main Process LLD](../../modules/main-process/lld.md)
- [Shared Contracts LLD](../../modules/shared-contracts/lld.md)
