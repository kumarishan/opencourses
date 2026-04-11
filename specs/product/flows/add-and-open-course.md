# Add And Open Course

> Design status: happy-path state handling below reflects the target route/query model.

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
5. Renderer invalidates/refetches course queries, then navigates to route-owned context (`/courses/:name` or `/learn/course/:name/ch/:ch/sec/:sec`).
6. Sidebar and section views hydrate from React Query caches backed by `fs/list` and `fs/read`.

## Alternate And Failure Paths
- If repo already exists in state or on disk with same remote, existing checkout is reused.
- If target directory is occupied by another repo, service allocates suffixed folder (`<slug>-2`, etc.).
- If `course.json` is missing/invalid, course title falls back to slug.
- If remove course is confirmed, main process deletes local checkout recursively and removes state entry.

## Interfaces And Data
- IPC: `registry/list`, `courses/add`, `courses/remove`, `fs/list`, `fs/read`, `courses/setActiveSection`
- Route state: selected course/chapter/section from URL params
- Query state: course list, chapter tree metadata, section content, learner progress
- Ephemeral state: modal visibility and submit-in-progress flags
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
