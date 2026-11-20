# 0003. One design system: the Grid UI kit

- Status: Proposed
- Date: 20 Nov 2026
- Repos: frontend
- PRD: Overview (one platform, many brands)
- Regulation: WCAG 2.2 AA for patient-facing screens
- Sign-off: product owner (brief of 20 Nov 2026)

## Context

Medora has a staff console, a patient app and brand sites. Each will be built by different agents at different times. Without one design system, each screen drifts in spacing, colour and component behaviour, and reviews spend their time on looks instead of behaviour.

## Decision

- **The staff console and the patient app use the Grid UI kit**: design tokens in `src/styles/grid-tokens.css`, the kit's CSS in `src/styles/grid-kit.css`, and the rules in `DESIGN.md`.
- **The kit's CSS is never edited.** Changes go into tokens or a new component, and `DESIGN.md` says when.
- **Primitives in `src/components/ui` own their look.** They are never restyled with `className` at the call site; a lint rule enforces it.
- **The shell (sidebar, header, page types) is shared** by every staff screen, and every screen picks one of the page types in `DESIGN.md`.
- **Brands change tokens, not components.** A tenant's brand sets logo, colours and copy through configuration.
- **Every screen runs in preview mode** on fixture data, so it can be checked and captured without a backend.

## Consequences

- New screens look right without design review, and reviews can focus on behaviour.
- A screen that genuinely needs something new waits for a kit component rather than inventing one inline.

## Where it lives

- Frontend `DESIGN.md`, `src/styles/`, `src/components/ui/`, `src/components/shell/`, `eslint.config.mjs`.
