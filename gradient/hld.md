**# High-Level Design

## Scope
This HLD summarizes the current OpenCourses architecture from [spec.md](./spec.md) and the implemented codebase, limited to:
- high-level app and system interactions
- where data is stored
- agent flows

## High-Level App and System Interactions

### Primary Runtime Boundaries
- **Renderer (React + Zustand):** User-facing workspace UI (setup, sidebar, learn mode, create mode, agent chat, editor, terminal panels).
- **Main Process (Electron IPC + services):** System orchestration layer for Git/GitHub, agent CLI execution, filesystem access, terminal sessions, registry fetch, and state persistence.
- **Local CLIs and OS tools:** `git`, `gh`, and one agent CLI (`claude` or `codex`) are invoked by the main process.
- **GitHub:** Source of course repos, PRs/releases, and registry metadata.

### Interaction Model
- Renderer never accesses OS/network tools directly; it calls typed IPC channels.
- Main process validates context (course existence, path constraints), executes operations via services, and returns structured results/errors.
- Long-running operations (agent generation/evaluation, terminal output, file watch events) are streamed back as IPC events.

### Core User Journeys (System View)
- **Startup + prerequisites:** Renderer asks main process for tool availability; app gates into Setup screen until required CLIs are present.
- **Course discovery/add:** Renderer loads registry entries (via `gh api`) or accepts repo URL; main process clones/attaches local course checkout and registers it in app state.
- **Mode switching:** Learn/Create mode changes are routed through main process, including create-branch requirements and PR-state checks.
- **Authoring/publishing:** Creator uses agent chat + local edits; push/PR operations run through Git/GitHub services.
- **Learning/evaluation:** Learner edits scratch files, runs terminal commands, submits tasks; evaluation agent returns pass/fail + feedback; progress is persisted.

## Storage Boundaries (Where What Is Stored)

### Local App Home (`~/.opencourses/`)
- `state.json`: single persisted app state (agent preference, courses, active mode/branch, creation PR metadata, active section, learner progress).
- `courses/`: local cloned course repositories.
- `repositories/`: reserved local workspace directory created at boot.
- `logs/main.log`: bootstrap and filesystem debug logs.

### Per-Course Local Storage
- **Course checkout (`course.localPath`):** canonical editable course repo used in both Learn and Create workflows.
- **Scratch workspace (`course.scratchPath`):** learner working files (default under course folder or custom path). Used by editor, terminal, and evaluation input collection.

### Remote Storage (GitHub)
- **Course repositories:** source for clone/pull/push, PRs, and releases.
- **Registry repository:** catalog consumed for discovery; registry updates are submitted via PR flow.

## Agent Flows

### 1) Course Creation Agent Flow (Create Mode)
1. Renderer starts generation with `courseId`, `phase`, and instructions.
2. Main process resolves agent CLI preference (`claude` first, else `codex`) and loads bundled `course-creation` skill (+ references).
3. Agent process is launched in the course repo working directory.
4. Streaming output is forwarded to renderer chat panel.
5. Outline phase output is captured for review/edit in UI.
6. Content phase runs after outline acceptance; final output is applied to course files by agent/local edits.
7. Creator can iterate with targeted section update prompts.

### 2) Learning Evaluation Agent Flow (Learn Mode)
1. Learner submits a task from a section.
2. Renderer collects current scratch files and task criteria.
3. Main process loads `course-evaluation` skill and runs selected agent CLI in scratch working directory.
4. Streamed feedback appears in UI while running.
5. Completion event returns `pass` + `feedback`.
6. On pass, section/chapter progress is marked complete and persisted to `state.json`.

### 3) Agent Job Control and Lifecycle
- Each run gets a unique `jobId`.
- Job events: `streamChunk`, `complete`, `error`, plus explicit evaluation result event.
- Active jobs can be canceled (SIGINT).
- Renderer store tracks per-job status (`running`, `complete`, `error`) and transcript/feedback.
