# OpenCourses Wiki

## What This Repo Does

`opencourses` is a desktop Electron app for importing course repositories, switching between learn/create modes, editing content, running CLI-assisted generation/evaluation, and opening GitHub pull requests.

## Major Modules Or Services

- Renderer workspace UI, routing, and local client stores
- Main-process IPC handlers and services (courses, git, GitHub, agent, file system, terminal)
- Shared IPC channel and type contracts used by both processes

## Primary Entry Points

- Main process startup: `src/main/index.ts`, `src/main/bootstrap.ts`
- Preload bridge: `src/main/preload.ts`
- Renderer bootstrap/router: `src/renderer/main.tsx`, `src/renderer/app.tsx`

## Recommended Reading Order

1. [Product Overview](./product/overview.md)
2. [Bootstrap And Workspace Entry Flow](./product/flows/bootstrap-and-workspace-entry.md)
3. [Add And Open Course Flow](./product/flows/add-and-open-course.md)
4. [Create Mode Generation And PR Flow](./product/flows/create-mode-generation-and-pr.md)
5. [Learn Mode Task Evaluation Flow](./product/flows/learn-mode-task-evaluation.md)
6. [High-Level Design](./architecture/hld.md)
7. [Modules Index](./modules/index.md)

## Spec Map

- Product
- [Overview](./product/overview.md)
- [Bootstrap And Workspace Entry](./product/flows/bootstrap-and-workspace-entry.md)
- [Add And Open Course](./product/flows/add-and-open-course.md)
- [Create Mode Generation And PR](./product/flows/create-mode-generation-and-pr.md)
- [Learn Mode Task Evaluation](./product/flows/learn-mode-task-evaluation.md)
- Architecture
- [High-Level Design](./architecture/hld.md)
- Modules
- [Modules Index](./modules/index.md)
- [Renderer Workspace LLD](./modules/renderer-workspace/lld.md)
- [Main Process LLD](./modules/main-process/lld.md)
- [Shared Contracts LLD](./modules/shared-contracts/lld.md)
