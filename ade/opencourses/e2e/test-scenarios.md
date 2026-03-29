# Test Scenarios: opencourses

**Project:** opencourses
**Date:** 2026-03-29
**Coverage:** Integration (IT) + End-to-End (E2E) test scenarios

---

## Integration Test Scenarios

### Prerequisites Check

---

**IT-001 — Prerequisites check: all tools present**

- **Type:** integration
- **Title:** Prerequisites check returns all-clear when git, gh, and claude are installed
- **Preconditions:**
  - `git`, `gh`, and `claude` are all on PATH
  - `codex` may or may not be present
- **Steps:**
  1. Invoke `prerequisites/get` IPC channel with `{}`
- **Expected outcome:**
  - Response: `{ missing: [], agentCLI: "claude" }`
  - `agentCLI` is `"claude"` when both `claude` and `codex` are present (claude preferred)

---

**IT-002 — Prerequisites check: only codex present (no claude)**

- **Type:** integration
- **Title:** Prerequisites check selects codex when claude is absent but codex is available
- **Preconditions:**
  - `git` and `gh` are on PATH
  - `claude` is NOT on PATH
  - `codex` is on PATH
- **Steps:**
  1. Invoke `prerequisites/get` IPC channel with `{}`
- **Expected outcome:**
  - Response: `{ missing: [], agentCLI: "codex" }`

---

**IT-003 — Prerequisites check: multiple tools missing**

- **Type:** integration
- **Title:** Prerequisites check reports all missing tools and sets agentCLI to null
- **Preconditions:**
  - `git` is on PATH
  - `gh`, `claude`, and `codex` are NOT on PATH
- **Steps:**
  1. Invoke `prerequisites/get` IPC channel with `{}`
- **Expected outcome:**
  - Response: `{ missing: ["gh", "claude", "codex"], agentCLI: null }`
  - The `missing` array lists every absent tool by name

---

**IT-004 — Prerequisites check: result is not cached across calls**

- **Type:** integration
- **Title:** Prerequisites check re-runs detection on each invocation (no caching)
- **Preconditions:**
  - First call: `claude` is on PATH
  - PATH is modified to remove `claude` between calls
- **Steps:**
  1. Invoke `prerequisites/get` — note `agentCLI: "claude"`
  2. Modify PATH to remove `claude`
  3. Invoke `prerequisites/get` again
- **Expected outcome:**
  - Second response: `{ missing: ["claude", "codex"], agentCLI: null }`

---

### Registry Service

---

**IT-005 — Registry list: happy path**

- **Type:** integration
- **Title:** `registry/list` fetches and parses registry.json into RegistryCourse array
- **Preconditions:**
  - `gh` is authenticated and can reach the registry repo
  - Registry repo contains a valid `registry.json` with at least one course entry
- **Steps:**
  1. Invoke `registry/list` IPC channel with `{}`
- **Expected outcome:**
  - Returns `RegistryCourse[]` with at least one entry
  - Each entry contains: `id`, `title`, `description`, `tags`, `objective`, `courseRepo`, `authorGitHub`, `latestVersion`, `publishedAt`, `updatedAt`

---

**IT-006 — Registry list: result is cached in-session**

- **Type:** integration
- **Title:** Subsequent `registry/list` calls within the same session return the cached result without re-fetching
- **Preconditions:**
  - Registry was already fetched successfully this session
- **Steps:**
  1. Invoke `registry/list` — captures result and timestamp
  2. Immediately invoke `registry/list` again
- **Expected outcome:**
  - Second call returns identical data without spawning a new `gh` subprocess

---

**IT-007 — Registry refresh: forces re-fetch**

- **Type:** integration
- **Title:** `registry/refresh` clears cache and re-fetches from GitHub
- **Preconditions:**
  - Registry was already fetched and cached
- **Steps:**
  1. Invoke `registry/refresh` IPC channel with `{}`
- **Expected outcome:**
  - Returns a fresh `RegistryCourse[]`
  - A new `gh api` subprocess is spawned

---

**IT-008 — Registry list: gh CLI unavailable**

- **Type:** integration
- **Title:** `registry/list` returns a structured error when gh CLI fails
- **Preconditions:**
  - `gh` CLI returns a non-zero exit code (e.g., not authenticated or network unavailable)
- **Steps:**
  1. Invoke `registry/list` IPC channel with `{}`
- **Expected outcome:**
  - IPC call rejects with a structured error (not a raw unhandled exception)
  - Error includes a human-readable message indicating the `gh` failure

---

### Course Management (Courses IPC)

---

**IT-009 — courses/add via GitHub URL: happy path**

- **Type:** integration
- **Title:** Adding a course via GitHub URL clones the repo and creates a state.json entry
- **Preconditions:**
  - `git` is authenticated and the course repo URL is publicly accessible
  - `~/.opencourses/courses/` directory exists
- **Steps:**
  1. Invoke `courses/add` with `AddCourseRequest`: `{ type: "url", courseRepo: "https://github.com/example/my-course", scratchPath: null }`
- **Expected outcome:**
  - Repo is cloned to `~/.opencourses/courses/my-course/`
  - A `scratch/` subdirectory is created at the default location
  - `state.json` is updated with a new `CourseState` entry: `activeMode: "learn"`, `creationBranch: null`, `creationPR: { number: null, url: null, state: null }`, `scratchPath: "~/.opencourses/courses/my-course/scratch/"`
  - Returns the new `CourseState` object

---

**IT-010 — courses/add via GitHub URL: custom scratch directory**

- **Type:** integration
- **Title:** Custom scratch path is stored in state.json when specified during add
- **Preconditions:**
  - Course repo URL is valid
  - Custom scratch path `/tmp/my-scratch` exists
- **Steps:**
  1. Invoke `courses/add` with `{ type: "url", courseRepo: "https://github.com/example/my-course", scratchPath: "/tmp/my-scratch" }`
- **Expected outcome:**
  - `state.json` entry has `scratchPath: "/tmp/my-scratch"`
  - Default `scratch/` directory is NOT created inside the course local directory

---

**IT-011 — courses/add: repo already exists locally**

- **Type:** integration
- **Title:** Adding a course that is already cloned locally does not re-clone
- **Preconditions:**
  - `~/.opencourses/courses/my-course/` already exists from a previous add
- **Steps:**
  1. Invoke `courses/add` with the same course repo URL
- **Expected outcome:**
  - Returns a structured error or idempotently returns the existing `CourseState`
  - Does not run `git clone` again (no duplicate directory created)

---

**IT-012 — courses/list: returns all registered courses**

- **Type:** integration
- **Title:** `courses/list` returns all courses from state.json
- **Preconditions:**
  - `state.json` has two courses registered
- **Steps:**
  1. Invoke `courses/list` IPC channel with `{}`
- **Expected outcome:**
  - Returns array of 2 `CourseState` objects with correct `id`, `name`, `activeMode`, `activeBranch` fields

---

**IT-013 — courses/remove: removes course from state.json**

- **Type:** integration
- **Title:** `courses/remove` deletes the course entry from state.json
- **Preconditions:**
  - A course with `courseId: "abc-123"` exists in `state.json`
- **Steps:**
  1. Invoke `courses/remove` with `{ courseId: "abc-123" }`
- **Expected outcome:**
  - `state.json` no longer contains the course entry
  - Local course directory is NOT deleted (removal is metadata-only)

---

### Branch Management (courses/setMode + git IPC)

---

**IT-014 — setMode to create: no existing branch prompts for branch name**

- **Type:** integration
- **Title:** Switching to Create mode for the first time returns `needsBranchName` signal
- **Preconditions:**
  - Course exists in state.json with `activeMode: "learn"`, `creationBranch: null`
- **Steps:**
  1. Invoke `courses/setMode` with `{ courseId: "abc-123", mode: "create" }`
- **Expected outcome:**
  - Response: `ModeSetResult` with `{ outcome: "needsBranchName" }`
  - `state.json` is NOT yet updated to create mode

---

**IT-015 — git/createBranch: creates branch and updates state.json**

- **Type:** integration
- **Title:** `git/createBranch` creates a new git branch and stores it as creationBranch in state.json
- **Preconditions:**
  - Course is checked out at `~/.opencourses/courses/my-course/`
  - Branch name `feature/update-ch1` does not already exist
- **Steps:**
  1. Invoke `git/createBranch` with `{ courseId: "abc-123", name: "feature/update-ch1" }`
- **Expected outcome:**
  - `git checkout -b feature/update-ch1` is executed in the course directory
  - `state.json` updated: `creationBranch: "feature/update-ch1"`, `activeBranch: "feature/update-ch1"`

---

**IT-016 — setMode to create: open PR resumes on existing branch**

- **Type:** integration
- **Title:** Switching to Create mode when an open PR exists resumes the creation branch
- **Preconditions:**
  - Course state: `creationBranch: "feature/ch1"`, `creationPR: { number: 42, state: "open" }`
- **Steps:**
  1. Invoke `courses/setMode` with `{ courseId: "abc-123", mode: "create" }`
- **Expected outcome:**
  - `gh pr view 42 --json state` is called and returns `"open"`
  - `git checkout feature/ch1` is executed
  - Response: `{ outcome: "resumed", branch: "feature/ch1", mode: "create" }`

---

**IT-017 — setMode to create: merged PR prompts for new branch**

- **Type:** integration
- **Title:** Switching to Create mode when PR is merged returns `prMerged` signal
- **Preconditions:**
  - Course state: `creationBranch: "feature/ch1"`, `creationPR: { number: 42, state: "open" }`
  - PR 42 is now merged on GitHub
- **Steps:**
  1. Invoke `courses/setMode` with `{ courseId: "abc-123", mode: "create" }`
- **Expected outcome:**
  - `gh pr view 42 --json state` returns `"merged"`
  - Response: `{ outcome: "prMerged" }`
  - `state.json` `creationBranch` is cleared to `null`

---

**IT-018 — git/commitAndPush: commits, pushes, and auto-creates PR**

- **Type:** integration
- **Title:** `git/commitAndPush` commits staged changes, pushes the branch, and calls gh to create a PR
- **Preconditions:**
  - Course is in Create mode on branch `feature/update-ch1`
  - There are uncommitted changes in the course directory
- **Steps:**
  1. Invoke `git/commitAndPush` with `{ courseId: "abc-123", message: "Add chapter 2 content" }`
- **Expected outcome:**
  - `git add .` + `git commit -m "Add chapter 2 content"` + `git push origin feature/update-ch1` are executed
  - `github/createPR` logic fires (or is called internally): `gh pr create` is invoked
  - `state.json` `creationPR` is updated with `{ number: <pr-number>, url: <pr-url>, state: "open" }`
  - Returns `void` (or the PR info)

---

**IT-019 — git/discard: reverts changes and clears creationBranch**

- **Type:** integration
- **Title:** `git/discard` reverts all uncommitted changes and clears the creation branch from state.json
- **Preconditions:**
  - Course is on `feature/update-ch1` with uncommitted changes
  - `state.json` has `creationBranch: "feature/update-ch1"`
- **Steps:**
  1. Invoke `git/discard` with `{ courseId: "abc-123" }`
- **Expected outcome:**
  - `git checkout -- .` or `git restore .` is executed to revert changes
  - `state.json` `creationBranch` is set to `null`
  - Branch itself is not deleted from git (only disassociated as the active creation branch)

---

**IT-020 — git/checkout: switches branch and updates activeBranch in state.json**

- **Type:** integration
- **Title:** `git/checkout` switches to the target branch and updates state.json
- **Preconditions:**
  - Branch `main` exists in the course repo
  - No uncommitted changes on current branch
- **Steps:**
  1. Invoke `git/checkout` with `{ courseId: "abc-123", branch: "main" }`
- **Expected outcome:**
  - `git checkout main` is executed in the course directory
  - `state.json` `activeBranch` is updated to `"main"`

---

### Agent Service

---

**IT-021 — agent/startGeneration outline phase: happy path**

- **Type:** integration
- **Title:** `agent/startGeneration` for outline phase spawns the agent and streams chunks to renderer
- **Preconditions:**
  - Source repo is cloned at `~/.opencourses/repositories/my-repo/`
  - `claude` CLI is on PATH
  - `agent/startGeneration` invoked with `{ courseId, phase: "outline", instructions: "Teach how the query planner works" }`
- **Steps:**
  1. Invoke `agent/startGeneration` IPC channel
  2. Listen for `agent:stream-chunk` push events
  3. Wait for `agent:complete` push event
- **Expected outcome:**
  - `agent/startGeneration` returns `{ jobId: "<uuid>" }` immediately
  - Multiple `agent:stream-chunk` events arrive with `{ jobId, chunk: "<text>" }`
  - `agent:complete` event arrives with `{ jobId, outline: ChapterOutline[] }` containing at least one chapter
  - `claude` subprocess was spawned with the course-creation skill prompt

---

**IT-022 — agent/startGeneration: cancellation via agent/cancel**

- **Type:** integration
- **Title:** `agent/cancel` sends SIGINT to the agent subprocess and emits agent:error
- **Preconditions:**
  - A generation job is in progress with a known `jobId`
- **Steps:**
  1. Invoke `agent/cancel` with `{ jobId: "<uuid>" }`
- **Expected outcome:**
  - `SIGINT` is sent to the `claude`/`codex` subprocess
  - `agent:error` push event is emitted with `{ jobId, error: "cancelled" }` or similar
  - No further `agent:stream-chunk` events arrive

---

**IT-023 — agent/evaluate: pass result marks section complete**

- **Type:** integration
- **Title:** `agent/evaluate` that returns pass=true updates learner progress in state.json
- **Preconditions:**
  - Course is in Learn mode
  - Section `01-intro.md` has a task block
  - Scratch directory contains `config.ts` satisfying the task criteria
- **Steps:**
  1. Invoke `agent/evaluate` with `{ courseId: "abc-123", sectionFile: "01-intro.md", taskBlock: { id: "task-01", criteria: [...] } }`
  2. Listen for `agent:evaluation-result` push event
- **Expected outcome:**
  - Agent CLI is spawned with course-evaluation skill
  - `agent:evaluation-result` arrives with `{ pass: true, feedback: "<encouragement text>" }`
  - `state.json` updated: `learnerProgress[chapterId].sections["01-intro.md"] = { completed: true, completedAt: "<ISO 8601>" }`
  - `progress/updated` push event fires with `{ sectionFile: "01-intro.md", completed: true }`

---

**IT-024 — agent/evaluate: fail result does not mark section complete**

- **Type:** integration
- **Title:** `agent/evaluate` that returns pass=false leaves section incomplete and provides feedback
- **Preconditions:**
  - Scratch directory does NOT satisfy the task criteria
- **Steps:**
  1. Invoke `agent/evaluate` with task block and relevant file context
  2. Listen for `agent:evaluation-result` push event
- **Expected outcome:**
  - `agent:evaluation-result` arrives with `{ pass: false, feedback: "<actionable feedback>" }`
  - `state.json` section remains `{ completed: false }`
  - No `progress/updated` event fires

---

### State Manager

---

**IT-025 — state.json: created on first startup if absent**

- **Type:** integration
- **Title:** State Manager creates a valid state.json on first run when the file does not exist
- **Preconditions:**
  - `~/.opencourses/state.json` does not exist
- **Steps:**
  1. Initialize the State Manager (app bootstrap)
- **Expected outcome:**
  - `~/.opencourses/state.json` is created with `{ version: 1, agentPreference: null, courses: {} }`

---

**IT-026 — state.json: writes are debounced**

- **Type:** integration
- **Title:** Rapid successive state mutations result in a single disk write (debounced)
- **Preconditions:**
  - State Manager is initialized
- **Steps:**
  1. Call `setState` (or equivalent) 5 times in quick succession (< 50ms apart)
  2. Wait for debounce window to pass
- **Expected outcome:**
  - `fs.writeFile` for `state.json` is called exactly once (not 5 times)
  - Final written content reflects all 5 mutations

---

### File System Service

---

**IT-027 — fs/read: reads file content within ~/.opencourses/**

- **Type:** integration
- **Title:** `fs/read` returns file content for a valid path inside the allowed directory
- **Preconditions:**
  - File `~/.opencourses/courses/my-course/chapters/01-intro/sections/01-overview.md` exists
- **Steps:**
  1. Invoke `fs/read` with `{ path: "~/.opencourses/courses/my-course/chapters/01-intro/sections/01-overview.md" }`
- **Expected outcome:**
  - Returns `{ content: "<markdown string>" }`

---

**IT-028 — fs/read: rejects paths outside ~/.opencourses/**

- **Type:** integration
- **Title:** `fs/read` rejects path traversal attempts outside the allowed root
- **Preconditions:**
  - `fs/read` handler has a path-scoping guard
- **Steps:**
  1. Invoke `fs/read` with `{ path: "/etc/passwd" }`
- **Expected outcome:**
  - IPC call rejects with a structured error (e.g., `{ error: "path_not_allowed" }`)
  - `/etc/passwd` is never read

---

**IT-029 — fs/watch + fs:changed: fires change event on file update**

- **Type:** integration
- **Title:** `fs/watch` on a Markdown section file emits `fs:changed` when the file is modified
- **Preconditions:**
  - Section file `01-overview.md` exists and is being watched
- **Steps:**
  1. Invoke `fs/watch` with `{ path: "~/.opencourses/courses/my-course/chapters/01-intro/sections/01-overview.md" }` → receives `{ watchId: "w1" }`
  2. Externally modify the file contents
- **Expected outcome:**
  - `fs:changed` push event fires with `{ watchId: "w1", path: "01-overview.md" }`

---

### Terminal Service

---

**IT-030 — terminal/create: spawns node-pty session rooted at scratch directory**

- **Type:** integration
- **Title:** `terminal/create` spawns a pty session with cwd set to the course scratch directory
- **Preconditions:**
  - Course exists with `scratchPath: "~/.opencourses/courses/my-course/scratch/"`
- **Steps:**
  1. Invoke `terminal/create` with `{ courseId: "abc-123" }`
- **Expected outcome:**
  - Returns `{ sessionId: "<uuid>" }`
  - `node-pty` spawns a shell with `cwd = "~/.opencourses/courses/my-course/scratch/"`

---

**IT-031 — terminal/input → terminal:data: round trip**

- **Type:** integration
- **Title:** Input sent via `terminal/input` produces output via `terminal:data` push event
- **Preconditions:**
  - Terminal session `s1` is open
- **Steps:**
  1. Invoke `terminal/input` with `{ sessionId: "s1", data: "echo hello\n" }`
  2. Listen for `terminal:data` push events
- **Expected outcome:**
  - One or more `terminal:data` events arrive with `{ sessionId: "s1", data: "..." }` containing `hello`

---

**IT-032 — terminal/destroy: closes pty session**

- **Type:** integration
- **Title:** `terminal/destroy` terminates the pty process and cleans up session state
- **Preconditions:**
  - Terminal session `s1` is open
- **Steps:**
  1. Invoke `terminal/destroy` with `{ sessionId: "s1" }`
- **Expected outcome:**
  - The underlying `node-pty` process is killed
  - Further `terminal:data` events for `s1` are NOT emitted
  - Subsequent `terminal/input` for `s1` returns an error

---

## End-to-End Test Scenarios

---

**E2E-001 — Prerequisites gate: missing tools show setup screen**

- **Type:** e2e
- **Title:** App startup with missing prerequisites shows setup screen with install instructions
- **Repos involved:** opencourses
- **Preconditions:**
  - `gh` is NOT on PATH
  - `claude` and `codex` are NOT on PATH
  - `git` IS on PATH
- **Steps:**
  1. Launch the Electron app
  2. Main process runs prerequisites check — detects `gh`, `claude`, `codex` missing
  3. Main process sends result to renderer via `prerequisites/get` IPC response
  4. Renderer receives `{ missing: ["gh", "claude", "codex"], agentCLI: null }`
  5. Renderer routes to `/setup` — SetupScreen is displayed
  6. SetupScreen lists `gh` and `claude`/`codex` with per-tool installation instructions
  7. User installs missing tools and clicks "Re-check"
  8. `prerequisites/get` is invoked again — now returns `{ missing: [], agentCLI: "claude" }`
  9. Renderer routes to workspace view
- **Expected outcome:** User sees the setup screen listing every missing tool with install instructions. After tools are installed and re-check passes, the workspace loads without requiring an app restart.

---

**E2E-002 — Add course via registry browser**

- **Type:** e2e
- **Title:** Learner discovers and adds a course from the public registry browser
- **Repos involved:** opencourses
- **Preconditions:**
  - All prerequisites are met
  - Registry contains at least one course with title "Intro to Query Planning"
  - User has a valid GitHub authentication via `gh`
- **Steps:**
  1. App starts; main process fetches registry via `gh api` → `RegistryCourse[]` cached in memory
  2. User clicks **+ Add Course** in sidebar → AddCourseModal opens
  3. User clicks **Registry** tab → searchable list of courses appears
  4. User types "query" in the search field → list filters to show "Intro to Query Planning"
  5. User selects the course and clicks **Add**
  6. `courses/add` IPC invoked: main process runs `git clone <courseRepo>` into `~/.opencourses/courses/intro-to-query-planning/`
  7. Scratch directory `scratch/` created inside the course directory
  8. `state.json` updated with new `CourseState` entry (`activeMode: "learn"`)
  9. Modal closes; sidebar shows "Intro to Query Planning" in the course list
  10. User clicks a section → course opens in Learn mode; section content rendered by SectionRenderer (Lexical read-only)
- **Expected outcome:** Course appears in the sidebar, opens in Learn mode with rendered Markdown content, and the scratch directory exists at the default location.

---

**E2E-003 — Add course via GitHub URL**

- **Type:** e2e
- **Title:** Learner adds a course by pasting a GitHub URL directly
- **Repos involved:** opencourses
- **Preconditions:**
  - All prerequisites are met
  - `https://github.com/alice/rust-async-course` is a valid public course repo
- **Steps:**
  1. User clicks **+ Add Course** → AddCourseModal opens
  2. User clicks **GitHub URL** tab
  3. User pastes `https://github.com/alice/rust-async-course` and clicks **Add**
  4. `courses/add` IPC invoked with `{ type: "url", courseRepo: "https://github.com/alice/rust-async-course", scratchPath: null }`
  5. Main process clones repo to `~/.opencourses/courses/rust-async-course/`
  6. Default scratch directory created; `state.json` updated
  7. Course appears in sidebar; user navigates to the first section
  8. Section content renders correctly including any Mermaid diagrams (MermaidNode in Lexical)
- **Expected outcome:** Course added without going through the registry. Mermaid diagrams render inline. Learner can navigate chapters and sections.

---

**E2E-004 — Course creation: outline phase → user accepts → content generation**

- **Type:** e2e
- **Title:** Creator completes the full course generation flow from source repo to generated content
- **Repos involved:** opencourses
- **Preconditions:**
  - All prerequisites met; `claude` is on PATH
  - `https://github.com/example/pg-query-planner` is a valid source repo
  - `https://github.com/creator/my-pg-course` is the destination course repo (empty or existing)
- **Steps:**
  1. User clicks **+ Add Course** → **Create New** tab
  2. User enters source repo URL and learning objective: "Understand how PostgreSQL's query planner selects execution strategies"
  3. User clicks **Start** → `courses/create` IPC fires; main clones source repo to `~/.opencourses/repositories/pg-query-planner/`; clones course repo to `~/.opencourses/courses/my-pg-course/`
  4. `agent/startGeneration` invoked with `{ phase: "outline" }`; claude CLI spawns with course-creation skill
  5. `agent:stream-chunk` events flow to renderer — creator sees agent thinking in real time in AgentChatPanel
  6. `agent:complete` fires with `outline: [{ title: "Chapter 1: ...", sections: [...] }, ...]`
  7. UI presents the outline; creator renames "Chapter 2" to "Planner Internals" and clicks **Accept Outline**
  8. `agent/acceptOutline` IPC called; `agent/startGeneration` invoked with `{ phase: "content" }`
  9. Agent streams content generation progress; files are written to `~/.opencourses/courses/my-pg-course/chapters/`
  10. `agent:complete` fires; creator switches to Learn mode via mode selector to preview the course
  11. SectionRenderer (Lexical read-only) renders a section containing a Mermaid diagram
  12. Creator switches back to Create mode; edits a section directly in Lexical editable mode
  13. Edit is persisted via `fs/write` IPC to the section Markdown file
- **Expected outcome:** Full course directory created with `course.json`, at least two chapters each with at least two sections. One section contains a rendered Mermaid diagram. Creator can preview in Learn mode and edit in Create mode. Real-time streaming is visible throughout.

---

**E2E-005 — Branch management: create branch, push + auto PR, detect merged PR → new branch**

- **Type:** e2e
- **Title:** Full branch lifecycle: create branch, push changes with auto PR, detect merge, prompt new branch
- **Repos involved:** opencourses
- **Preconditions:**
  - Course `my-pg-course` exists in state.json with `creationBranch: null`
  - `gh` is authenticated; `my-pg-course` has a GitHub remote
- **Steps:**
  1. User switches to Create mode → `courses/setMode` returns `{ outcome: "needsBranchName" }`
  2. User enters branch name `feature/add-chapter-3` → `git/createBranch` IPC called
  3. Git creates branch; `state.json` updated: `creationBranch: "feature/add-chapter-3"`, `activeBranch: "feature/add-chapter-3"`
  4. User makes content changes in Create mode
  5. User clicks **Push & Create PR** → `git/commitAndPush` IPC called
  6. Main process: `git add . && git commit -m "..." && git push origin feature/add-chapter-3`; then `gh pr create` → PR #7 created
  7. `state.json` updated: `creationPR: { number: 7, url: "https://...", state: "open" }`
  8. User switches to Learn mode, then back to Create mode → `courses/setMode` called again
  9. Main checks PR state: `gh pr view 7 --json state` → returns `"merged"`
  10. Response: `{ outcome: "prMerged" }`; `state.json` `creationBranch` cleared to `null`
  11. UI prompts user to start a new branch
  12. User enters `feature/add-chapter-4` → new branch created, flow repeats from step 3
- **Expected outcome:** Branch is created, pushed, PR auto-created. On next mode switch after PR merge, app detects merge and prompts for a new branch. User can begin a fresh creation cycle without manual git operations.

---

**E2E-006 — Branch management: discard changes**

- **Type:** e2e
- **Title:** Creator discards uncommitted changes and creation branch is cleared from state
- **Repos involved:** opencourses
- **Preconditions:**
  - Course is in Create mode on `feature/draft-ch2`
  - Uncommitted Markdown edits exist
- **Steps:**
  1. User clicks **Discard Changes** action button in navbar
  2. `git/discard` IPC called with `{ courseId: "abc-123" }`
  3. Main process runs `git restore .` in course directory
  4. `state.json` `creationBranch` set to `null`
  5. UI reflects cleared branch state; mode remains Create but user is prompted to create a new branch if they want to continue
- **Expected outcome:** All uncommitted changes are reverted. `state.json` no longer tracks `feature/draft-ch2` as the creation branch. No data is lost from previously committed content.

---

**E2E-007 — Learn mode: full hands-on session with learning agent evaluation**

- **Type:** e2e
- **Title:** Learner completes a task section: writes code in Monaco, runs in terminal, submits for AI evaluation, receives pass + section marked complete
- **Repos involved:** opencourses
- **Preconditions:**
  - Course `intro-to-query-planning` is added and open in Learn mode
  - Section `01-write-parser.md` contains a task block requiring `config.ts` to exist in scratch with a `parseConfig` function
  - `claude` CLI is on PATH
- **Steps:**
  1. User navigates to section `01-write-parser.md` in sidebar → SectionRenderer displays content in Lexical read-only mode including the TaskBlockNode (instructions + hints + submit button)
  2. User reads the task: create `config.ts` in scratch with a `parseConfig` function
  3. User creates `config.ts` via the Monaco editor (CodeEditorPanel); `fs/write` IPC saves to scratch directory
  4. User opens terminal (TerminalPanel); `terminal/create` IPC spawns pty with cwd = scratch directory
  5. User runs `npx ts-node config.ts` in terminal; output appears via `terminal:data` events
  6. User clicks **Submit for Evaluation** in the TaskBlockNode
  7. `agent/evaluate` IPC invoked with `{ courseId, sectionFile: "01-write-parser.md", taskBlock: {...} }`
  8. Main reads `config.ts` from scratch; spawns claude with course-evaluation skill and task context
  9. `agent:evaluation-result` arrives: `{ pass: true, feedback: "Great work! parseConfig correctly reads and parses the JSON file." }`
  10. `state.json` updated: section marked `completed: true`; `progress/updated` push event fires
  11. Next section unlocks in the sidebar; current section shows a completion indicator
- **Expected outcome:** Section is marked complete with a timestamp. Learner sees positive feedback. Next section becomes navigable. Progress persists after app restart.

---

**E2E-008 — Learning agent evaluation: fail → revise → pass**

- **Type:** e2e
- **Title:** Learner submits incomplete work, receives feedback, revises, and passes on second attempt
- **Repos involved:** opencourses
- **Preconditions:**
  - Same setup as E2E-007 but `config.ts` initially missing the `parseConfig` export
- **Steps:**
  1. User clicks **Submit for Evaluation** with incomplete `config.ts`
  2. `agent/evaluate` runs; agent returns `{ pass: false, feedback: "parseConfig is not exported. Make sure to export the function." }`
  3. Section remains incomplete; feedback displayed in TaskBlockNode UI
  4. User edits `config.ts` in Monaco to add the export; `fs/write` saves the update
  5. User clicks **Submit for Evaluation** again
  6. `agent/evaluate` runs again; agent returns `{ pass: true, feedback: "Looks good!" }`
  7. Section marked complete
- **Expected outcome:** Fail feedback is specific and actionable. Re-submission after fix succeeds. Section completion reflects the final passing state.

---

**E2E-009 — Mode switching per course: Zustand store persisted across restarts**

- **Type:** e2e
- **Title:** Active mode per course is remembered across app restarts via state.json
- **Repos involved:** opencourses
- **Preconditions:**
  - Two courses: `course-a` (last opened in Create mode) and `course-b` (last opened in Learn mode)
- **Steps:**
  1. With app running: `course-a` is in Create mode, `course-b` is in Learn mode
  2. `state.json` has `course-a.activeMode: "create"` and `course-b.activeMode: "learn"`
  3. App is closed and relaunched
  4. Renderer loads; `CourseStore` is hydrated from `state.json` via `courses/list` IPC
  5. User navigates to `course-a` → CreateMode layout renders (AgentChatPanel + SectionRenderer editable)
  6. User navigates to `course-b` → LearnMode layout renders (FileTree + Monaco + Terminal + SectionRenderer read-only)
- **Expected outcome:** Each course opens in its last-used mode after restart. Mode selector in navbar reflects the persisted mode. Switching mode via the dropdown updates `state.json` immediately.

---

**E2E-010 — Scratch directory setup on course add**

- **Type:** e2e
- **Title:** Scratch directory is created at correct location on course add and used as terminal cwd and file tree root
- **Repos involved:** opencourses
- **Preconditions:**
  - Course is being added for the first time
  - User specifies a custom scratch path `/Users/alice/workspaces/my-course-scratch`
- **Steps:**
  1. User adds a course via GitHub URL and enters custom scratch path `/Users/alice/workspaces/my-course-scratch`
  2. `courses/add` IPC: scratch directory is created at the custom path (if not already existing)
  3. `state.json` `scratchPath` set to `/Users/alice/workspaces/my-course-scratch`
  4. User opens course in Learn mode
  5. `terminal/create` IPC: pty spawned with `cwd = /Users/alice/workspaces/my-course-scratch`
  6. FileTreePanel root is `/Users/alice/workspaces/my-course-scratch`
  7. User creates a file `hello.py` via Monaco; `fs/write` saves to `/Users/alice/workspaces/my-course-scratch/hello.py`
  8. FileTreePanel shows `hello.py` in the tree
  9. User runs `python3 hello.py` in terminal — executes from the correct directory
- **Expected outcome:** All file and terminal operations are rooted at the custom scratch path. The scratch directory is not tracked in the course git repo (`.gitignore` contains `/scratch/` or the custom path is outside the repo entirely).

---

**E2E-011 — Section renderer: Lexical read-only in Learn mode, editable in Create mode**

- **Type:** e2e
- **Title:** SectionRenderer correctly toggles between read-only and editable Lexical modes when switching course modes
- **Repos involved:** opencourses
- **Preconditions:**
  - Course has section `02-mermaid-example.md` containing a Mermaid diagram block and a Lottie animation reference
- **Steps:**
  1. Course open in Learn mode → SectionRenderer mounts Lexical in read-only mode
  2. Mermaid block renders as a visual diagram via MermaidNode (not raw code)
  3. Lottie animation plays via LottieNode
  4. User attempts to edit text → input is blocked (read-only)
  5. User switches to Create mode via mode selector
  6. SectionRenderer remounts Lexical in editable mode
  7. User clicks on text and edits it → change is accepted
  8. On blur or save trigger: `fs/write` IPC persists changes to the section Markdown file
  9. User switches back to Learn mode → updated content renders correctly in read-only mode
- **Expected outcome:** Lexical is strictly read-only in Learn mode (no accidental edits). In Create mode it is fully editable. Custom nodes (Mermaid, Lottie) render in both modes. Edits in Create mode are persisted to disk.

---

**E2E-012 — Chapter completion tracking after all sections complete**

- **Type:** e2e
- **Title:** Chapter is automatically marked complete when all its sections are marked complete
- **Repos involved:** opencourses
- **Preconditions:**
  - Chapter `01-intro` has two sections: `01-overview.md` (no task, always completable) and `02-write-parser.md` (has task)
  - `01-overview.md` is already marked complete
- **Steps:**
  1. User submits evaluation for `02-write-parser.md` → passes → section marked complete
  2. `progress/updated` event fires
  3. Main process checks all sections in chapter `01-intro` — both complete
  4. `state.json` updated: `learnerProgress["ch-01"].completed: true`
  5. `progress/updated` (or equivalent chapter event) fires with chapter completion
  6. Sidebar renders chapter `01-intro` with a completion indicator
  7. User closes and reopens the app → chapter still shows as complete
- **Expected outcome:** Chapter completion is automatically derived from section completion without manual user action. Progress persists across restarts.
