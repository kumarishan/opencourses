# Add And Open Course

## Goal

Bring a course repo into local workspace state and open its chapter/section tree for navigation.

## Trigger

User opens Add Course modal and submits one of: registry selection, GitHub URL, or create-new source repo URL.

## Preconditions

- App prerequisites pass.
- `gh` and `git` are available for registry lookup and clone operations.

## Happy Path

1. Renderer opens `AddCourseModal` and optionally fetches registry list (`registry/list`).
2. Renderer submits `courses/add` with repo URL.
3. Main process resolves target folder under `~/.opencourses/courses/<slug>` and clones if needed.
4. Main process builds `CourseState` (title from `course.json` when present) and persists it.
5. Renderer upserts course into Zustand store, sets active course, and navigates to `/courses/:name`.
6. Sidebar loads `chapters` and section markdown metadata using `fs/list` and `fs/read`.

## Alternate And Failure Paths

- If repo already exists in state or on disk with same remote, existing checkout is reused.
- If target directory is occupied by another repo, service allocates suffixed folder (`<slug>-2`, etc.).
- If `course.json` is missing/invalid, course title falls back to slug.
- If remove course is confirmed, main process deletes local checkout recursively and removes state entry.

## Interfaces And Data

- IPC: `registry/list`, `courses/add`, `courses/remove`, `fs/list`, `fs/read`, `courses/setActiveSection`
- State fields: `courses[courseId]`, `activeSection`, `learnerProgress`
- Filesystem assumptions: `chapters/<chapter>/chapter.json`, `chapters/<chapter>/sections/*.md`

## Code Evidence

- `src/renderer/components/AddCourseModal.tsx`
- `src/renderer/components/Sidebar.tsx`
- `src/main/ipc/courses.ts`
- `src/main/services/git.ts`
- `src/main/services/registry.ts`
- `src/main/state/stateManager.ts`
- `src/main/ipc/__tests__/courses.test.ts`

## Related Specs

- [Product Overview](../overview.md)
- [High-Level Design](../../architecture/hld.md)
- [Renderer Workspace LLD](../../modules/renderer-workspace/lld.md)
- [Main Process LLD](../../modules/main-process/lld.md)
