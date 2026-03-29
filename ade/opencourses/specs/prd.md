# PRD: opencourses

**Version**: 1.1
**Date**: 2026-03-29
**Status**: Finalized

---

## 1. Overview

opencourses is an open-source Electron desktop application that lets anyone create, publish, and consume hands-on, interactive courses built from GitHub repositories. A course creator selects a source repo, specifies a learning objective, and the app orchestrates an AI agent (Claude Code or Codex, running locally) that analyzes the repo and automatically generates the full course — chapters, sections, hands-on tasks, code examples, and diagrams. The creator reviews, iterates, and publishes the course to their own GitHub repo. Learners discover courses through a public registry repo, open them in the app, step through sections, write and run code in the built-in Monaco editor and terminal, and have their progress validated by an embedded learning agent that checks their work and marks sections and chapters complete.

---

## 2. Problem Statement

Developers and educators want to turn GitHub repositories into structured, hands-on learning experiences — whether to teach the concepts behind a codebase, show how to build something similar, or explain how to use a tool. No dedicated platform exists that ties repo-native content authoring, interactive code execution, and AI-powered progress validation together in a single, Git-native workflow. Existing solutions (Jupyter, READMEs, video tutorials) are either too general, not interactive enough, or locked into proprietary platforms.

---

## 3. Goals

1. Give course creators a first-class AI-assisted authoring environment: select a source repo, specify a learning objective, and let a local AI agent automatically generate the full course structure and content (chapters, sections, task blocks, diagrams, code examples). The creator reviews, refines, and publishes to GitHub with version tagging.
2. Give learners a first-class consumption environment: discover courses from the public registry, step through sections, edit and run code in-app, and receive AI feedback that validates their work and tracks completion.
3. Keep everything Git-native and open: courses live in regular GitHub repos, the registry is a public repo anyone can contribute to, and the app itself is open-source.

---

## 4. User Personas

### 4.1 Course Creator
A developer, educator, or open-source maintainer who wants to build a structured tutorial around a GitHub repository. They are comfortable with Git, GitHub CLI (`gh`), and basic terminal usage. They want to define a learning objective, have an AI agent generate a complete course from the repo, review and refine the result, and distribute the course via GitHub releases without managing a separate hosting platform.

### 4.2 Learner
A developer who wants hands-on guided learning tied to a real codebase. They are comfortable with a terminal and code editor. They expect clear objectives, step-by-step tasks, the ability to write and run code without switching apps, and meaningful feedback on whether they have completed each step correctly.

---

## 5. Core Features

### 5.1 Course Storage and Format

- A course lives in a **dedicated GitHub repository** (new or existing) chosen by the creator.
- The repository follows a **structured directory layout**:
  ```
  course.json          # course metadata: title, description, objective, version, registry entry
  chapters/
    01-<slug>/
      chapter.json     # chapter metadata: title, order
      sections/
        01-<slug>.md   # section content
        02-<slug>.md
        ...
  assets/              # images, diagrams, animation sources
  ```
- Section content is stored in **Markdown**. Markdown is extended to support:
  - **Mermaid** diagrams (fenced code blocks: ` ```mermaid `)
  - **Excalidraw** diagrams (embedded via a custom directive or JSON asset reference)
  - **Lottie / CSS animations** referenced from the `assets/` directory
  - **Task blocks** — a structured frontmatter or fenced block that defines a required hands-on task the learner must complete before advancing (e.g., write a function, run a command, produce an output)
- Courses are versioned via **GitHub Releases** (semantic version tags). Learners always fetch a specific released version.

### 5.2 Course Discovery and Registry

- A single **public registry repo** (owned by the opencourses project) acts as the course index.
- To publish a course, a creator submits a PR (or direct push if maintainer) adding an entry to the registry (course repo URL, title, description, tags).
- The app reads the registry repo at startup (via GitHub API or `gh` CLI) and displays all listed courses in a **Discover** view.
- Search and filter by title, tag, and objective type are supported within the Discover view.
- No community features (ratings, comments, follows) in v1.

### 5.3 Prerequisites Check

On startup, the app checks for the presence of the following tools on the user's system:

| Tool | Purpose | Required by |
|---|---|---|
| `git` | Clone repos, commit, push, tag | Creator + Learner |
| `gh` | GitHub API operations (registry, releases) | Creator + Learner |
| `claude` (Claude Code CLI) or `codex` (Codex CLI) | Course generation + learning evaluation agent | Creator + Learner |

- If any required tool is missing, the app displays a **setup screen** listing what is missing with installation instructions for each. The app does not proceed past this screen until all prerequisites are satisfied.
- The app re-checks on each startup; no in-app installation is performed.
- No GitHub OAuth flow is managed by the app. The `gh` and `git` CLIs are expected to already be authenticated on the user's machine (e.g., via `gh auth login` run outside the app).

### 5.4 Course Creation Flow

Course creation is fully AI-agent-driven. The creator provides high-level inputs; the agent performs all analysis and content generation.

#### Agent Setup
- The app **clones the source repo** into `~/.opencourses/repositories/<repo-name>/` before invoking the agent.
- The agent (Claude Code or Codex CLI) is invoked as a CLI subprocess with the cloned repo as its working directory.
- The agent is loaded with a **course creation skill** — a skill definition shipped with the app that instructs the agent how to analyze a repo, structure a course, and write content in the expected format. This skill is passed to the agent on every invocation (both initial generation and any subsequent updates or re-generation).
- The agent uses its own native file read/write tools and CLI access to explore the repo and write course content. No specialized app-provided tools are required.

#### Creation Steps
1. Creator opens the app in **Create mode** and clicks **New Course**.
2. Creator selects or enters a GitHub repository URL (the source repo the course is about).
3. Creator selects or creates the **course repo** — either a new repo or an existing one — where generated content will be written.
4. Creator specifies the **learning objective** as free text — a plain description of what learners should get out of the course (e.g., "understand how the query planner works", "build a similar CLI tool from scratch", "learn to use the plugin API").
5. The app invokes the agent (loaded with the course creation skill). The agent first performs the **outline phase**:
   - Analyzes the source repo's structure and content.
   - Produces a **course outline** — a list of chapters with titles, brief descriptions, and planned sections.
   - The outline is presented to the creator in the app UI before any content is written.
6. The creator **reviews and accepts the outline**:
   - Can rename, reorder, add, or remove chapters and sections.
   - Clicks **Accept Outline** to proceed, or provides revised instructions to regenerate.
7. After acceptance the agent enters the **content generation phase**:
   - Writes each section's Markdown content — explanations, code examples, Mermaid diagrams.
   - Defines task blocks (expected actions, hints, evaluation criteria) for hands-on sections.
   - Writes all content directly into the course directory under `~/.opencourses/courses/<course-name>/`.
8. The app displays **real-time progress** as the agent streams its work.
9. Once generation completes, the creator reviews the course in the **Course Reviewer**:
   - Navigates the chapter/section tree in the left sidebar.
   - Previews rendered content in the main panel.
   - Edits individual sections in Monaco if refinements are needed.
   - Re-invokes the agent (with the course creation skill) on specific chapters or sections with revised instructions.
10. Creator **publishes** by:
    - Committing and pushing final content to the course repo via `git`.
    - Creating a GitHub Release tag via `gh release create`.
    - Optionally submitting a PR to the registry repo.
11. Creator can iterate — re-invoke the agent, edit, and release new versions — at any time.

### 5.6 App Layout and Modes

#### Overall Layout

The app is divided into two vertical regions:

```
┌──────────────────────────────────────────────────────────────────┐
│  TOP NAVBAR                                                       │
│  [Course > Chapter]             [Actions] [Branch ▾] [Mode ▾]   │
├──────────┬────────────────────────────┬──────────────────────────┤
│          │  LEFT COLUMN               │  RIGHT COLUMN            │
│  LEFT    │  Learn: File tree +        │  Section content         │
│ SIDEBAR  │          Monaco + Terminal │  (Lexical renderer)      │
│  (course │  Create: Agent chat        │                          │
│   tree)  │                            │                          │
└──────────┴────────────────────────────┴──────────────────────────┘
                    MAIN CONTENT              WORKSPACE
```

**Top Navbar**
- **Left**: Breadcrumb showing the currently open course and chapter (e.g., `My Course > Chapter 2`). Updates as the user navigates sections.
- **Right** (left-to-right order):
  - **Mode-dependent actions**: buttons relevant to the current mode (e.g., "Push & Create PR" in Create mode; "Mark Complete" / "Submit for Evaluation" in Learn mode).
  - **Branch selector**: dropdown showing the current Git branch for the open course. Allows switching branches. Always visible.
  - **Mode selector**: dropdown to switch between Learn and Create mode for the current course. Rightmost element in the navbar.

**Workspace** (below the navbar)
- **Left sidebar**: Single CTA at the top — **+ Add Course** — opens a modal with three options: (1) **Registry browser** — search and pick a course from the public registry; (2) **Create new** — start building a new course from a source repo using the agent; (3) **GitHub URL** — paste a course repo URL to add it directly. Below the CTA: persistent course list where each course expands into a tree of chapters and sections. Clicking a section navigates to it and updates the breadcrumb.
- **Main content**: Two-column area whose content depends on the active mode (see below).

#### Per-Course Modes

Each course independently tracks its own mode. Opening a course defaults to **Learn mode**. The last active mode per course is remembered across app restarts.

**Learn mode** (default):
- **Left column**: File tree (top) + Monaco editor (middle) + terminal (bottom) — the hands-on coding environment. The learner reads the section on the right, writes code in Monaco, and runs commands in the terminal as directed by the course tasks. File tree and terminal are rooted in the scratch directory (see §5.6 Scratch Directory).
- **Right column**: Rendered section content (Markdown, diagrams, animations, task blocks).

**Create mode**:
- **Left column**: Agent chat — interact with the AI agent to generate, update, or refine course content.
- **Right column**: Rendered section content — the creator sees the live output of what the agent is writing.

The user can switch freely between modes for the same course — e.g., edit in Create mode, then switch to Learn mode to preview and interact with the learning agent.

#### Scratch Directory

Each course has a **scratch directory** — a local working folder where all files created during learning or hands-on tasks are stored.

- **Default location**: `scratch/` inside the course's local directory (`~/.opencourses/courses/<course-name>/scratch/`).
- **Custom location**: The user can choose any directory on their filesystem. This is configured when **adding a course to the app** and cannot be changed without re-adding the course.
- The scratch directory is listed in the course repo's `.gitignore` — its contents are never committed or published.
- The **file tree** in Create mode and the **terminal** both default to this directory.
- The scratch directory persists across sessions; its contents represent the learner's local work-in-progress for that course.

#### Branch Management for Creation

All course content changes must happen on a **dedicated Git branch** per course. This is enforced as follows:

- When a course is switched to **Create mode** for the first time:
  - The app checks if an active creation branch exists for that course.
  - If not, the app prompts the creator to choose a branch name and creates it.
- On subsequent switches to Create mode:
  - If the previously active branch has an **open PR**: the app resumes on that branch.
  - If the PR has been **merged** (branch closed): the app detects this and prompts the creator to start a new branch.
- A course can only have **one active creation branch** at a time.
- When in **Learn mode**, the user remains on the current branch (can read course content on that branch). A **branch selector** in the top nav bar lets the user switch branches at any time.
- In **Create mode**, the creator can:
  - **Push changes** — commits and pushes the branch; the app automatically creates a GitHub PR.
  - **Discard changes** — reverts all uncommitted changes and removes the branch as the active creation branch.
- PR review and merge happen outside the app (on GitHub). The app only detects the PR state on mode switch.

#### Local Storage
- All app data and state are stored locally in **`~/.opencourses/`**. There is no server or cloud sync.
- Directory layout:
  ```
  ~/.opencourses/
    repositories/       # cloned source repos (for agent analysis during creation)
    courses/            # all course repos checked out locally (learn + create)
      <course-name>/    # course content (committed files)
        scratch/        # learner working files — gitignored, never committed
    state.json          # per-course state: active mode, active branch, scratch path, learner progress, last open section
  ```

### 5.7 Course Consumption Flow

1. Learner opens the app and navigates to **Discover** or opens a course repo URL directly.
2. Learner selects a course and the app clones/fetches the latest release into a local working directory.
3. The course opens in **Learn mode** — agent chat on the left, rendered section content on the right (see §5.6).
4. Learner reads the section and, when a **task block** is present, writes code in the Monaco editor or runs commands in the terminal.
5. When the learner indicates they are done, the **learning agent** evaluates their work:
   - The agent inspects files, terminal output, or test results as defined by the task block criteria.
   - The agent provides **textual feedback**: what is correct, what needs improvement, specific suggestions.
   - If the work meets criteria, the agent **marks the section complete** and unlocks the next section.
   - If not, the learner can revise and resubmit.
6. A chapter is marked complete when all its sections are complete.
7. Progress is persisted locally (in app storage) tied to the course version.

### 5.8 Learning Agent (Evaluation)

- The learning agent requires either **Codex** or **Claude Code** to be installed and accessible on the learner's local machine.
- The app detects which agent is available at startup (as part of the prerequisites check, §5.3) and uses it.
- The agent operates via CLI invocation (subprocess calls from the Electron main process).
- The agent receives:
  - The task block definition from the section (expected outcome, evaluation criteria, hints).
  - Relevant file contents and/or terminal output produced by the learner.
  - Context about the course and chapter.
- The agent returns:
  - A pass/fail determination.
  - A natural-language feedback message shown to the learner.
- The learning agent does not have direct write access to the learner's course working directory; it reads only.

> **Note**: The same underlying agent runtime (Claude Code or Codex) serves both roles — course generation for creators (§5.5) and work evaluation for learners (§5.7) — but with different tool suites and system prompts.

### 5.9 Monaco Editor

- Embedded in the Course Reader for **learner code editing**.
- Supports syntax highlighting for all major languages.
- Files opened in Monaco correspond to files in the learner's local working directory for the course.
- Learners run code by switching to the terminal panel; there is no in-editor run button.
- Monaco is also available in the **Course Reviewer** so creators can make targeted edits to AI-generated section content.

### 5.10 Built-in Terminal

- A terminal panel is embedded in the Electron app.
- Connects to the **learner's local machine** (spawns a shell process via node-pty or equivalent).
- Working directory defaults to the learner's course working directory when a course is open.
- Used by learners to run code, execute commands, and produce outputs that the learning agent can evaluate.

### 5.11 Rich Content (Diagrams and Animations)

Section content is rendered using **Lexical** as the editor/renderer framework:
- **Read-only in Learn mode** — content is displayed but not editable.
- **Editable in Create mode** — user can directly edit section content in-place.
- **Mermaid**: rendered as a custom Lexical node via `mermaid.js`.
- **Excalidraw**: embedded as a custom Lexical node (viewer for `.excalidraw` scene files).
- **Lottie animations**: custom Lexical node referencing JSON files in `assets/`, played via `lottie-web`.
- **Images and GIFs**: standard inline content within Lexical.

---

## 6. Out of Scope (v1)

- **Web or mobile app**: v1 is Electron desktop only.
- **Community features**: no ratings, reviews, comments, follows, or social feeds.
- **In-app repo browsing for authoring**: the creator specifies the source repo URL; the agent reads the repo via CLI tools rather than an in-app file browser.
- **Paid or private courses**: all courses in the registry are publicly accessible.
- **Course analytics**: no learner progress reporting to creators.
- **Offline-first**: the app requires internet access to fetch courses and interact with GitHub.
- **Windows/Linux first-class support**: the primary target is macOS; Windows and Linux are best-effort.
- **Hosted agent execution**: the generation agent runs locally on the creator's machine via Claude Code CLI or Codex CLI; no server-side agent execution in v1.

---

## 7. Technical Constraints

| Constraint | Detail |
|---|---|
| App delivery | Electron desktop application |
| Content format | Markdown with extensions (Mermaid, Excalidraw, Lottie, task blocks) |
| Version control | Git + GitHub (courses versioned as GitHub Releases) |
| Auth | No in-app OAuth; `gh` and `git` must be pre-authenticated on the user's machine |
| Git operations | `git` CLI (subprocess) |
| GitHub API operations | `gh` CLI (subprocess) |
| Code editor | Monaco Editor (embedded) |
| Terminal | node-pty or equivalent; connects to local machine shell |
| Course generation agent | Claude Code CLI or Codex CLI (must be pre-installed by creator); invoked as subprocess |
| Learning evaluation agent | Claude Code CLI or Codex CLI (must be pre-installed by learner); invoked as subprocess |
| Agent working directory | Source repo cloned to `~/.opencourses/repositories/<repo-name>/`; agent runs there with full filesystem and CLI access |
| Registry | Single public GitHub repo (managed by opencourses project) |
| Local storage | All data stored in `~/.opencourses/`; no server or cloud sync |
| Diagrams | Mermaid (inline render), Excalidraw (file-based), Lottie (JSON animations) |

---

## 8. Success Criteria (v1)

v1 is successful when **both** of the following end-to-end flows work without errors:

### 8.1 Creator Flow
- [ ] The app starts and confirms all prerequisites (`git`, `gh`, `claude`/`codex`) are present; if any are missing, the setup screen is shown with correct instructions.
- [ ] A creator selects a source GitHub repo and a course repo, specifies a learning objective, and starts course generation.
- [ ] The course generation agent produces a course outline (chapters + sections) which the creator can review, edit, and accept.
- [ ] After outline acceptance, the agent successfully generates full content — at least one chapter with at least two sections, including one section with a Mermaid diagram and one section with a task block.
- [ ] Real-time generation progress is displayed in the app UI as the agent works.
- [ ] The creator reviews the generated course in the Course Reviewer and previews it in the learner view.
- [ ] The creator publishes the course (commits, pushes, creates a GitHub Release, submits registry PR).
- [ ] The published course appears in the app's Discover view after the registry PR is merged.

### 8.2 Learner Flow
- [ ] A learner discovers and opens the published course in the Discover view.
- [ ] The app fetches and renders the course correctly (Markdown, Mermaid diagram, task block).
- [ ] The learner completes the task in the section using the Monaco editor and built-in terminal.
- [ ] The learning agent evaluates the learner's work, provides feedback, and marks the section complete.
- [ ] Chapter completion is correctly tracked after all sections are done.
- [ ] Progress persists across app restarts.
