# Token Enforcement Plan

This plan defines how the framework will enforce token-first styling from governance through CI.

## Why
- Keep Look and Feel, Theme, and Component Styles aligned over time.
- Prevent drift from ad hoc color literals and non-token styles.
- Enable gradual cleanup without blocking delivery.

## Current State (2026-03-15)
- Token contract exists and is validated for themes.
- Governance matrix is documented in `docs/governance/THEME_STYLE_MATRIX.md`.
- Component CSS still contains legacy hard-coded color literals.

## Enforcement Roadmap

### Phase 1: Baseline Guardrails (implemented)
- Add `scripts/style-token-audit.mjs`.
- Track raw color literal counts in key framework CSS files.
- Fail CI if counts regress above baseline.
- Exclude fallback literals inside `var(--token, literal)` so tokenized call sites are not treated as regressions.

Scope:
- `src/framework/framework.css`: limit `0` non-token color literals outside CSS variable declarations.
- `src/components/core/core.css`: limit `0` raw color literals (current baseline cap).
- `src/plugins/example/example.css`: limit `0` raw color literals.
- `src/App.css`: limit `0` raw color literals.
  - `src/index.css`: limit `4` raw color literals (staged baseline, after root color and background migration; most color literals are now CSS variables; excluding CSS variable declaration lines).

### Phase 2: Guided Cleanup (next)
- Prioritize replacing literals in `core.css` with semantic tokens and optional state/button tokens.
- Reduce `core.css` cap incrementally per sprint.
- Document each reduction in this plan and release notes.

Current progress:
  - Initial migration started for button and overlay selectors.
  - Baseline reduced from `45` to `0` under fallback-aware audit rules.
  - Phase 3 strict cap is now active for the current audit scope.
  - Strict zero-cap scope expanded to additional framework-owned CSS files (`App.css`, example plugin CSS).
  - `index.css` is now enrolled in staged enforcement with a measured baseline cap before full token migration. Most color literals have been replaced with CSS variables, and the audit baseline reflects the current state.

### Phase 3: Strict Enforcement
- Move `core.css` cap to `0`.
- Add stricter linting for token usage in framework-owned CSS and TSX style blocks.
- Add style snapshots for representative components under multiple themes.

## CI Integration

Recommended script hook:
```json
{
  "scripts": {
    "style:audit": "node scripts/style-token-audit.mjs"
  }
}
```

Run in CI before build/test:
1. `npm run lint`
2. `npm run style:audit`
3. `npm run test`
4. `npm run build`

## Ownership
- Platform engineering owns audit thresholds and script maintenance.
- Component owners own token migration for their selectors.
- Governance docs must be updated whenever thresholds change intentionally.

## References
- `docs/governance/THEME_STYLE_MATRIX.md`
- `docs/governance/DESIGN_RULES.md`
- `DESIGN_TOKENS.md`
- `scripts/style-token-audit.mjs`
