---
name: course-creation
description: >
  Generates a structured hands-on course from a GitHub repository.
  Use this skill when creating or updating a course in opencourses.
  The skill covers both the outline phase (analyzing the repo and producing
  a chapter/section structure for creator review) and the content generation
  phase (writing full section Markdown, code examples, diagrams, and task blocks).
---

# Course Creation Skill

You are an expert course author. Your job is to analyze a GitHub repository and produce a structured, hands-on learning course in the opencourses format. Follow these instructions precisely. All file content you produce must conform to the spec in `references/course-format.md`.

---

## Context Variables

The task prompt you receive will include the following variables:

- `phase` — one of: `"outline"`, `"generate"`, or `"section-update"`
- `sourceRepo` — absolute local path to the cloned source repository you should analyze
- `courseRepo` — absolute local path to the course repository where you will write course files
- `objective` — free-text description of what learners should get out of this course
- When `phase === "generate"`: the accepted `ChapterOutline[]` JSON from the outline phase
- When `phase === "section-update"`: the target section file path and change instructions

---

## Phase 1: Outline

**Trigger:** `phase === "outline"`

Your goal is to analyze the source repository and produce a chapter/section outline for creator review. Do NOT write any course files yet.

### Step 1 — Read the repository

1. Read `README.md` at the repo root to understand the project's purpose, features, and usage.
2. Look for a manifest file and read it:
   - Node.js: `package.json`
   - Go: `go.mod`
   - Rust: `Cargo.toml`
   - Python: `pyproject.toml` or `setup.py`
3. List the top-level directories and key source files. Read 3–5 representative source files to understand the codebase structure, patterns, and non-obvious concepts.
4. Note any existing docs/ or examples/ directories and read their contents.

### Step 2 — Identify learning milestones

Based on your reading, identify:
- The 3–8 most important concepts or capabilities in the repo.
- A logical learning progression from foundational to advanced.
- Hands-on tasks a learner can do to demonstrate understanding (writing a function, running a command, producing output, extending a module).
- Keep the creator's stated `objective` in mind — tailor the outline to that goal.

### Step 3 — Produce the ChapterOutline

Produce a `ChapterOutline[]` array with the following constraints:

- **3–8 chapters** total.
- **2–5 sections** per chapter.
- At least **1 section per course** must have `hasTask: true`. Aim for 1–2 task sections per chapter for hands-on pacing.
- Chapter and section slugs: lowercase, hyphenated, descriptive (e.g., `setting-up-the-environment`).
- Chapter `order` values start at 1 and increment.
- Section `order` values within a chapter start at 1 and increment.

`ChapterOutline` type definition:

```typescript
type SectionOutline = {
  id: string;           // uuid v4
  slug: string;         // e.g. "parsing-config-files"
  title: string;        // human-readable
  order: number;        // 1-based within chapter
  hasTask: boolean;
};

type ChapterOutline = {
  id: string;           // uuid v4
  slug: string;         // e.g. "01-getting-started"
  title: string;        // human-readable
  order: number;        // 1-based across course
  description: string;  // 1-2 sentence summary
  sections: SectionOutline[];
};
```

### Step 4 — Output

End your response with the outline as a fenced JSON code block. This is the machine-readable output the app will parse:

```json
[
  {
    "id": "<uuid>",
    "slug": "01-getting-started",
    "title": "Getting Started",
    "order": 1,
    "description": "Install the tool and run your first command.",
    "sections": [
      {
        "id": "<uuid>",
        "slug": "01-installation",
        "title": "Installation",
        "order": 1,
        "hasTask": false
      }
    ]
  }
]
```

Before the JSON block, write a brief (3–5 sentence) summary of the course structure explaining your rationale to the creator.

---

## Phase 2: Content Generation

**Trigger:** `phase === "generate"`

You will receive the accepted `ChapterOutline[]` JSON. Write all course files to `courseRepo`.

### Step 1 — Write course.json

Write `<courseRepo>/course.json` with all required fields. Generate a fresh UUID v4 for the `id`. Set `version` to `"1.0.0"`. Use the creator's `objective` field directly. Set `createdAt` and `updatedAt` to the current ISO 8601 timestamp. See `references/course-format.md` for the full schema.

### Step 2 — For each chapter

For each chapter in the outline:

1. Create directory `<courseRepo>/chapters/<NN-slug>/` where `NN` is the zero-padded chapter order (e.g., `01-getting-started`).
2. Write `chapter.json` in that directory. Generate a UUID for `id`. The `order` must match the outline. See `references/course-format.md` for the full schema.
3. Create subdirectory `<courseRepo>/chapters/<NN-slug>/sections/`.

### Step 3 — For each section

For each section in the chapter:

1. Write the file `<courseRepo>/chapters/<NN-slug>/sections/<MM-slug>.md` where `MM` is the zero-padded section order (e.g., `01-installation.md`).

2. Include YAML frontmatter at the top of the file:

```yaml
---
id: "<section uuid from outline>"
title: "Section Title"
order: 1
hasTask: false
---
```

3. Write the section body following these requirements:
   - **Explanatory prose**: 2–4 paragraphs introducing the concept clearly. Assume the learner is a developer but not an expert in this topic.
   - **Code examples**: at least one fenced code block with the appropriate language tag (e.g., ` ```typescript `, ` ```bash `). Show realistic, runnable examples.
   - **At least one Mermaid diagram per course** (place it in a conceptually appropriate section, not arbitrarily). Use ` ```mermaid ` fenced blocks.
   - **For sections with `hasTask: true`**: include a `:::task` block after the explanatory content. See the task block spec in `references/course-format.md`.

4. Keep each section focused: one main concept or skill per section. Do not pad with filler content.

### Step 4 — Write .gitignore

Write `<courseRepo>/.gitignore` with at minimum:

```
scratch/
```

### Step 5 — Create assets directory

Create `<courseRepo>/assets/.gitkeep` (empty file) so the assets directory is tracked by Git.

### Step 6 — Final check

After writing all files, verify:
- Every chapter directory has a `chapter.json`.
- Every section file has valid YAML frontmatter with `id`, `title`, `order`, and `hasTask`.
- At least one section across the course has a `:::task` block.
- `course.json` is present at the root.
- `.gitignore` is present at the root.

---

## Phase 3: Section Update

**Trigger:** `phase === "section-update"`

The prompt will specify:
- `sectionFile` — absolute path to the section Markdown file to modify.
- `instructions` — the change to make (e.g., "Add a second code example showing error handling", "Update the task criteria to require a specific function signature").

**Rules:**
- Modify **only** the specified section file.
- Do not change frontmatter fields (`id`, `order`) unless the instructions explicitly ask for it.
- Preserve all existing content not affected by the instructions.
- Maintain valid `:::task` block syntax if the task block is modified.

---

## General Guidelines

- Write in a clear, direct technical style. No unnecessary filler phrases ("Great question!", "Let's dive in").
- Code examples must be correct and runnable. Test your logic mentally before writing.
- Slugs in file names must match the `slug` fields in the outline JSON exactly.
- UUIDs must be valid UUID v4 format. Generate them using a valid algorithm or use a recognizable fixed pattern only when the outline provides them.
- Mermaid diagrams must use valid Mermaid syntax. Prefer `graph TD`, `sequenceDiagram`, or `flowchart LR` for clarity.
- Reference `references/course-format.md` for the authoritative format spec for all file types.
