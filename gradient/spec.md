# Spec

## Overview

OpenCourses is an open-source Electron desktop application that lets anyone create, publish, and consume hands-on, interactive courses built from GitHub repositories. Course creators point an AI agent at a source repo, and the agent generates structured course content — chapters, sections, tasks, diagrams, and code examples. Learners discover courses from a public registry, step through them with a built-in code editor and terminal, and have their work validated by an embedded AI learning agent.

## App Features

### Course Format and Storage
- Courses live in dedicated GitHub repos with a structured directory layout (`course.json`, `chapters/`, `assets/`).
- Section content is Markdown extended with Mermaid diagrams, Excalidraw scenes, Lottie animations, and task blocks.
- Courses are versioned via GitHub Releases (semantic version tags).

### Course Discovery and Registry
- A public GitHub registry repo serves as the course index.
- Creators publish courses by submitting a PR to the registry with course metadata (repo URL, title, description, tags).
- The app displays all listed courses in a Discover view with search and filter by title, tag, and objective.
- asdfasf

### Prerequisites Check
- On startup, the app checks for `git`, `gh` (GitHub CLI), and `claude`/`codex` (AI agent CLI).
- If any tool is missing, a setup screen is shown with installation instructions. The app does not proceed until all prerequisites are satisfied.
- No in-app OAuth — `gh` and `git` must already be authenticated on the user's machine.

### AI-Powered Course Creation
- Creator selects a source GitHub repo, a course repo, and specifies a learning objective.
- The app invokes a local AI agent (Claude Code or Codex CLI) loaded with a course creation skill.
- The agent analyzes the source repo and produces a course outline (chapters + sections) for creator review.
- After outline acceptance, the agent generates full content — explanations, code examples, Mermaid diagrams, and task blocks.
- Real-time progress is streamed to the UI during generation.
- Creator reviews and refines content in a Course Reviewer with Monaco editor, then publishes via Git + GitHub Releases.

### Course Consumption (Learn Mode)
- Learner discovers a course from the registry or opens a course repo URL directly.
- The app clones/fetches the latest release and opens it in Learn mode.
- Learner reads rendered section content (right column), writes code in Monaco editor, and runs commands in the built-in terminal (left column).
- Task blocks define hands-on tasks the learner must complete before advancing.

### Learning Agent (Evaluation)
- When a learner submits work, the embedded AI agent evaluates it against the task block criteria.
- The agent provides textual feedback (what's correct, what needs improvement) and a pass/fail determination.
- On pass, the section is marked complete and the next section is unlocked.
- Chapter completion is tracked when all sections are done. Progress persists locally across sessions.

### App Layout and Modes
- Top navbar with breadcrumb navigation, mode-dependent actions, branch selector, and mode selector.
- Left sidebar with course list (expandable chapter/section tree) and an "Add Course" CTA (registry browser, create new, or paste URL).
- Each course independently tracks its own mode (Learn or Create), remembered across restarts.
- **Learn mode**: file tree + Monaco editor + terminal (left), rendered section content (right).
- **Create mode**: agent chat (left), live rendered content preview (right).

### Branch Management for Creation
- All course content changes happen on a dedicated Git branch per course.
- The app manages branch lifecycle: creates on first Create mode entry, resumes on open PRs, prompts for new branch after merge.
- Creator can push changes (auto-creates a GitHub PR) or discard changes from within the app.

### Monaco Editor
- Embedded code editor with syntax highlighting for all major languages.
- Used by learners for hands-on coding and by creators for editing AI-generated content.

### Built-in Terminal
- Embedded terminal panel (node-pty) connected to the local machine shell.
- Working directory defaults to the course's scratch directory.
- Used by learners to run code and produce outputs for evaluation.

### Rich Content Rendering
- Section content rendered via Lexical (read-only in Learn mode, editable in Create mode).
- Mermaid diagrams rendered inline via `mermaid.js`.
- Excalidraw scenes displayed as custom Lexical nodes.
- Lottie animations played via `lottie-web`.

### Scratch Directory
- Each course has a local scratch directory (`~/.opencourses/courses/<course-name>/scratch/`) for learner working files.
- Gitignored — never committed or published. Persists across sessions.
- Custom location can be configured when adding a course.

### Local Storage
- All app data stored in `~/.opencourses/` — repositories, courses, and app state (`state.json`).
- No server or cloud sync.
