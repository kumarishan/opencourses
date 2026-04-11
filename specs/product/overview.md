# Product Overview

## Product Goal

OpenCourses helps a learner or course author pull a course repository into a local desktop workspace and work in two modes:

- Learn mode: complete task blocks and get automated evaluation feedback
- Create mode: generate/update course material and publish changes through Git branches and pull requests

## Primary Personas

- Learner working through section tasks in local scratch files
- Course author iterating course structure/content and pushing PRs

## Core User Surfaces

- Setup gate for missing local tooling
- Workspace shell with sidebar, top nav, course section rendering
- Learn workspace: file tree, Monaco editor, terminal, section/task pane
- Create workspace: agent chat + editable section view

## Product Capabilities (Observed)

- Prerequisite checks for `git`, `gh`, and at least one agent CLI (`claude` or `codex`)
- Import courses from registry or direct GitHub URL
- Maintain per-course mode, branch, active section, and learner progress
- Use agent CLI for outline/content generation and task evaluation
- Commit/push changes and open GitHub PRs from UI

## Out Of Scope In Current Code (Observed)

- Multi-user sync or server-side account/session model
- In-app authentication flow (relies on local CLI auth state)
- Dedicated backend service; everything runs locally via Electron main process

## Product Flows

- [Bootstrap And Workspace Entry](./flows/bootstrap-and-workspace-entry.md)
- [Add And Open Course](./flows/add-and-open-course.md)
- [Create Mode Generation And PR](./flows/create-mode-generation-and-pr.md)
- [Learn Mode Task Evaluation](./flows/learn-mode-task-evaluation.md)

## Inference Notes

- Registry and source repositories appear intended to follow a chapter/section filesystem convention because sidebar and section rendering assume `chapters/*/sections/*.md`.
