# Design Rules

## Purpose
This document governs token-first styling decisions for framework components.

## Layering Model

Use this layered model during design and code reviews:
- Look and Feel: experiential intent and product tone.
- Theme: tokenized values that encode that intent.
- Component Styles: selector-level implementation that consumes tokens.

For the full matrix and governance workflow, see `docs/governance/THEME_STYLE_MATRIX.md`.
Token enforcement rollout and CI guardrails are tracked in `docs/governance/TOKEN_ENFORCEMENT_PLAN.md`.

## Token Contract
The full token catalog and required theme token list are documented in `Reactjs/DESIGN_TOKENS.md`.

Framework work must use the active token contract:
- Spacing: `--spacing-xs|sm|md|lg|xl`
- Typography: `--font-size-*`, `--font-weight-*`
- Semantic colors: `--color-primary|secondary|success|warning|error`
- Core surface colors: `--surface`, `--bg`, `--text`, `--muted`, `--border`, `--link`, `--link-hover`
- Shape/elevation: `--radius-*`, `--elevation-*`

## Spacing Rules
- Use spacing tokens for layout and component gaps/padding.
- Avoid one-off rem/px values when an equivalent spacing token exists.
- Prefer at most three spacing steps inside a single component for visual rhythm.

Good:
```css
.rf-preferences__group {
	gap: var(--spacing-sm);
}
```

Bad:
```tsx
style={{ gap: '0.45rem' }}
```

## Typography Rules
- Use tokenized font sizes for labels/body/headings.
- Use tokenized font weights for consistency (`regular|medium|semibold|bold`).
- Avoid arbitrary font sizes in framework selectors.

## Color Rules
- Use semantic status tokens for state panels and alerts.
- Use link/brand tokens for interactive text.
- Maintain explicit focus-visible indicators with tokenized color references.

## Radius and Elevation Rules
- Use `--radius-sm|md|lg|pill` for corners.
- Use `--elevation-sm|md` for menus, panels, and overlays.
- Avoid raw box-shadow literals in framework selectors.

## Inline Style Policy
- Framework source should avoid inline style literals for design-token values.
- If inline style is necessary, it should be layout-only and temporary.

## Accessibility
- High contrast remains mandatory for focus indicators and state communication.
- Theme variants must preserve readability and interaction affordances.

## References
- `Reactjs/DESIGN_TOKENS.md`
- `src/framework/framework.css`
- `src/framework/core.tsx`
- `src/framework/registry.ts`
