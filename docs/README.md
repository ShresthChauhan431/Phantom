# Phantom Documentation

Welcome to the Phantom documentation hub. This directory contains all design docs, architecture decisions, and technical specifications.

## 📚 Documentation Index

### Core Documents

| Document | Description | Audience |
|----------|-------------|----------|
| **[vision.md](vision.md)** | Project vision, ambition, and use cases | Everyone |
| **[hello-phantom.md](hello-phantom.md)** | Repository structure and build order | Developers |
| **[architecture.md](architecture.md)** | Technical architecture and stack decisions | Engineers |

### Design & UI

| Document | Description | Audience |
|----------|-------------|----------|
| **[design-system.md](design-system.md)** | Mastercard-inspired UI design system | Frontend developers |
| **[ui-design-system.md](ui-design-system.md)** | Complete visual design specification | Designers, Frontend |
| **[frontend-assets.md](frontend-assets.md)** | 3D assets, Spline integration, web experience | Frontend developers |

### Architecture Decision Records (ADR)

| ADR | Title | Status |
|-----|-------|--------|
| [0001](adr/0001-monorepo-structure.md) | Monorepo Structure | ✅ Accepted |
| [0002](adr/0002-local-vlm-first.md) | Local VLM First, Cloud Escalation | ✅ Accepted |

📝 Use [_template.md](adr/_template.md) to create new ADRs.

---

## 📖 Quick Navigation

### For New Team Members
1. Start with **[vision.md](vision.md)** to understand the "why"
2. Read **[hello-phantom.md](hello-phantom.md)** for technical overview
3. Review **[architecture.md](architecture.md)** for implementation details
4. Check **[ADRs](adr/)** to understand key decisions

### For Developers
- **Backend**: See [architecture.md](architecture.md) → Engine section
- **Frontend**: See [design-system.md](design-system.md) and [frontend-assets.md](frontend-assets.md)
- **API**: See [hello-phantom.md](hello-phantom.md) → API section

### For Designers
- **Design System**: [ui-design-system.md](ui-design-system.md)
- **Color Palette**: [ui-design-system.md](ui-design-system.md#2-color-palette--roles)
- **Typography**: [ui-design-system.md](ui-design-system.md#3-typography-rules)
- **Components**: [ui-design-system.md](ui-design-system.md#4-component-stylings)

---

## 📋 Document Summaries

### vision.md
**The "why" and "what" of Phantom**

Covers:
- Project ambition (hackathon → production)
- Description of the engine
- Workflow (Capture → Gate → Understand → Commit → Query → Reveal)
- Use cases across 6 verticals (Healthcare, Logistics, Retail, Consumer, Safety, Accessibility)
- Interface concepts

**Read if**: You're new to the project or need to explain Phantom to others.

---

### hello-phantom.md
**Repository structure and implementation guide**

Covers:
- Stack choices (Python, FastAPI, Ollama, React, Vite, Tailwind)
- Complete repository layout
- Git workflow and branching strategy
- Bootstrap instructions
- Build order (first 10 commits)
- Package boundaries and rules

**Read if**: You're setting up the repo or planning implementation work.

---

### architecture.md
**Technical architecture and build specifications**

Covers:
- Detailed component breakdown
- Python package structure
- Data flow diagrams
- Database schema
- API endpoints
- Camera capture strategies

**Read if**: You're implementing backend components or need deep technical detail.

---

### design-system.md
**Mastercard-inspired design system (lightweight)**

Covers:
- Color palette (Canvas Cream, Ink Black, Signal Orange)
- Typography (MarkForMC substitutes)
- Component patterns (cards, buttons, navigation)
- Border radius scale
- Spacing and grid system

**Read if**: You need a quick reference while building UI components.

---

### ui-design-system.md
**Complete visual design specification**

Covers:
- Visual theme and atmosphere (warm, editorial, pill shapes)
- Comprehensive color system (21 named colors with hex codes)
- Typography rules (hierarchy, weights, letter-spacing)
- Component stylings (buttons, cards, forms, navigation)
- Layout principles (spacing, grid, whitespace)
- Depth and elevation system
- Responsive behavior and breakpoints
- Do's and Don'ts

**Read if**: You're designing new UI or need detailed styling specifications.

---

### frontend-assets.md
**3D assets, Spline integration, web experience**

Covers:
- Repository structure for frontend assets
- Running the web experience locally
- Spline 3D scene integration
- Asset organization (models, textures, animations)
- Pushing updates to GitHub

**Read if**: You're working with 3D models, Spline scenes, or web integration.

---

## 🏗️ Architecture Decision Records (ADR)

ADRs document important architectural decisions. Each ADR includes:
- **Context**: Why the decision was needed
- **Decision**: What we decided to do
- **Consequences**: Positive, negative, and neutral effects
- **Alternatives**: What we considered but didn't choose

### ADR-0001: Monorepo Structure
**Why**: Need to organize multiple components (backend, frontend, SDK, CLI)  
**Decision**: Single monorepo with `apps/` and `packages/` separation  
**Impact**: Easier coordination, atomic changes, but larger repo size

### ADR-0002: Local VLM First, Cloud Escalation
**Why**: Need Vision Language Model for understanding frames  
**Decision**: Ollama local-first, escalate to cloud only on ambiguity  
**Impact**: Privacy-first, cost-efficient, but requires setup

---

## 🔄 Workflow Documentation

### Adding a New ADR

1. Copy `adr/_template.md` to `adr/XXXX-title.md` (increment number)
2. Fill in all sections
3. Update the ADR table in this README
4. Commit with message: `docs(adr): add ADR-XXXX for [topic]`

### Updating Documentation

- **Small fixes**: Edit directly and commit
- **Major changes**: Create a PR for review
- **New docs**: Add to appropriate section and update this index
- **Deprecated docs**: Move to `adr/deprecated/` with explanation

---

## 📐 Design Principles

These principles guide all documentation:

1. **Clarity over cleverness**: Write for understanding, not to impress
2. **Examples over abstraction**: Show concrete code/mockups when possible
3. **Decisions with context**: Always explain the "why", not just the "what"
4. **Living documents**: Update docs when implementation changes
5. **Accessible to all**: Write for diverse audiences (junior devs, designers, PMs)

---

## 🎯 Documentation Goals

- ✅ **Onboarding**: New team members productive in < 2 hours
- ✅ **Context**: Anyone can understand decisions made months ago
- ✅ **Implementation**: Specs detailed enough to guide coding
- ✅ **Design**: UI specs clear enough to implement without mockups
- ✅ **History**: ADRs capture the evolution of the system

---

## 🤝 Contributing to Docs

### Style Guide

- Use Markdown with GitHub flavor
- Wrap lines at 100 characters for readability
- Use `code` for inline references, ` ```blocks``` ` for code
- Include diagrams with ASCII art or Mermaid
- Use emojis sparingly (headings only)
- Link liberally to other docs

### Review Process

- **Typos/grammar**: Fix directly
- **Technical corrections**: Create PR with explanation
- **New content**: PR with at least one reviewer
- **Major changes**: Discuss in issues first

---

## 📞 Questions?

- **Architecture**: Review ADRs, then check `architecture.md`
- **Setup**: See `hello-phantom.md` → Bootstrap section
- **Design**: See `design-system.md` or `ui-design-system.md`
- **Vision**: See `vision.md`

If you can't find an answer, consider writing it down here!

---

**Last Updated**: 2026-10-30  
**Maintainer**: Development Team  
**License**: MIT
