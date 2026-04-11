# Modules Index

## Module Set

- [Renderer Workspace LLD](./renderer-workspace/lld.md)
- [Main Process LLD](./main-process/lld.md)
- [Shared Contracts LLD](./shared-contracts/lld.md)

## Ownership Boundaries

- Renderer workspace: React views/components, client IPC facade, Zustand stores
- Main process: IPC handler registration, OS/CLI integrations, persisted workspace state
- Shared contracts: channel constants, request/response/event payload types

## Related Specs

- [High-Level Design](../architecture/hld.md)
- [Product Overview](../product/overview.md)
