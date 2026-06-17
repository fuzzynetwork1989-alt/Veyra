# ADR 001: Monorepo Structure

## Status

Accepted

## Context

Veyra needs to manage multiple applications and shared packages. We need to decide between a monorepo or multi-repo approach.

## Decision

Use a monorepo structure with Turborepo for build orchestration.

## Rationale

- **Shared code**: Packages can share code easily without versioning complexity
- **Atomic commits**: Changes across packages and apps can be committed together
- **Simplified CI/CD**: Single pipeline for all services
- **Code sharing**: Easy to share types, utilities, and components
- **Consistent tooling**: Same linting, formatting, and testing across all packages
- **Local development**: Run all services locally with a single command

## Consequences

### Positive

- Faster development with shared code
- Easier refactoring across packages
- Single source of truth for dependencies
- Simplified onboarding

### Negative

- Larger repository size
- Longer CI/CD times for all packages
- Need to manage build orchestration
- Potential for tighter coupling

## Alternatives Considered

- **Multi-repo**: More complex dependency management, harder to coordinate changes
- **Nx**: More complex than needed for our use case
- **Lerna**: Deprecated in favor of Turborepo

## Implementation

- Use Turborepo for build orchestration
- Separate `apps/` and `packages/` directories
- Shared TypeScript configuration
- Shared ESLint and Prettier configuration
- Workspaces in root package.json
