# ADR-0001: Monorepo Structure

**Status**: Accepted  
**Date**: 2026-10-30  
**Deciders**: Development Team  
**Tags**: architecture, repository-structure

---

## Context

Phantom consists of multiple interconnected components:
- A Python backend engine (capture, gate, understand, memory)
- A React frontend dashboard
- A Python SDK for API access
- A CLI tool
- Shared documentation and configuration

We needed to decide between:
1. Multiple repositories (one per component)
2. A single monorepo containing all components

---

## Decision

We will use a **monorepo structure** with the following organization:

```
phantom/
├── apps/           # User-facing applications
│   ├── engine/     # Backend daemon
│   ├── dashboard/  # Frontend
│   └── cli/        # Terminal client
├── packages/       # Reusable libraries
│   ├── core/       # Core logic
│   └── sdk/        # API client
├── docs/           # Documentation
├── tests/          # Test suite
└── scripts/        # Helper scripts
```

---

## Consequences

### Positive
- **Atomic changes**: A single PR can update backend, frontend, and docs together
- **Shared tooling**: One set of CI/CD, linting, and testing configuration
- **Easier onboarding**: New team members clone one repo and have everything
- **Coordinated versioning**: All components stay in sync
- **Code sharing**: Easier to share utilities and types between components
- **Simplified dependency management**: Single lockfile for Node, single venv for Python

### Negative
- **Larger repo size**: More to clone initially
- **Potential for coupling**: Need discipline to maintain proper boundaries
- **Build complexity**: Need to orchestrate builds across multiple apps
- **CI/CD time**: All tests run on every change (mitigated by selective testing)

### Neutral
- **Git history**: All changes in one history (can be viewed as pro or con)
- **Requires clear structure**: Need strong conventions to prevent chaos

---

## Alternatives Considered

### Alternative 1: Multi-repo (Separate repositories)
- **Pros**: 
  - Smaller clone size per repo
  - Independent versioning
  - Clear ownership boundaries
- **Cons**: 
  - Complex cross-repo changes
  - Harder to keep in sync
  - More overhead for setup and CI/CD
  - Difficult to share code
- **Why not chosen**: For a hackathon project with a small team, the coordination overhead outweighs the benefits

### Alternative 2: Monolith (Everything in one package)
- **Pros**: 
  - Simplest possible structure
  - No inter-package dependencies
- **Cons**: 
  - No separation of concerns
  - Can't import just the SDK
  - Hard to test components independently
- **Why not chosen**: Violates architectural principles; makes testing and reuse difficult

---

## References

- [Monorepo.tools](https://monorepo.tools/) - Monorepo patterns and tools
- Google's monorepo approach (Bazel)
- [Trunk Based Development](https://trunkbaseddevelopment.com/)

---

## Notes

### Package Boundaries
Important rule: **Apps import only from `packages/sdk`, never from `packages/core` directly.**

This ensures:
- Core logic stays independent
- APIs are well-defined
- Testing is easier
- Future extraction to microservices is possible

### Workspace Management
- Python: Uses `pyproject.toml` with setuptools
- Node: Uses npm workspaces defined in root `package.json`
- Make: Root `Makefile` orchestrates commands across apps

### Future Considerations
If the project grows significantly (10+ apps, 100+ developers), consider:
- Bazel or Nx for build optimization
- Separate repos for layers (home, inventory, etc.)
- Extracting SDK to its own package registry
