# Repository Spec Guide

## Purpose

This wiki documents the implemented behavior of the `opencourses` Electron app so product, architecture, and module decisions can be reviewed alongside code changes.

The docs are evidence-first:

- direct behavior is grounded in code references
- assumptions are labeled as inference
- drift between docs and code should be treated as a defect

## Reading Order

1. [Wiki Index](./index.md)
2. [Product Overview](./product/overview.md)
3. Product flows under [`product/flows/`](./product/flows/bootstrap-and-workspace-entry.md)
4. [High-Level Design](./architecture/hld.md)
5. Module LLDs under [`modules/`](./modules/index.md)

## Document Types

- Product docs: user-facing workflows and expected outcomes
- Architecture docs: system boundaries, interfaces, data ownership
- Module docs: low-level design tied to owned files

## Naming And Placement Rules

- Keep canonical repo docs under `specs/`.
- Use `specs/product/flows/<flow>.md` for one stable workflow per file.
- Use `specs/modules/<module>/lld.md` for one bounded module.

## Canonical Docs Versus Scoped Docs

Canonical docs in this repo are:

- `specs/index.md`
- `specs/product/overview.md`
- `specs/architecture/hld.md`
- `specs/modules/*/lld.md`

Scoped docs may be added for a specific feature or migration when the change does not fit existing canonical docs.

## Edit Versus Create Rules

- Edit existing canonical docs when behavior changes inside current boundaries.
- Create a new flow doc when a workflow is independently testable/reviewable.
- Create a new module LLD only when introducing a new bounded subsystem.

## Writing Conventions

- Prefer exact file paths, function names, IPC channels, and type names.
- Distinguish observed behavior from inference.
- Keep flow steps short and executable.
- Cross-link related product, architecture, and module docs.
