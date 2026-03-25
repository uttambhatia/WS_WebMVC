# Look and Feel vs Theme vs Component Styles Matrix

This matrix aligns framework styling governance across three layers:
- Look and Feel: experiential intent and brand tone.
- Theme: tokenized system variables applied globally.
- Component Styles: concrete selector-level usage of tokens.

## Layer Definitions

| Layer | Question It Answers | Owner | Change Frequency | Artifacts |
|------|------|------|------|------|
| Look and Feel | What should the product feel like? | Product + UX + Brand | Low | Theme catalogs and design direction |
| Theme | Which token values implement that feeling? | Design system + frontend platform | Medium | `enterpriseThemePresets`, `bankingThemePresets` |
| Component Styles | How do components consume tokens consistently? | Frontend engineering | Medium to high | `framework.css`, component CSS and TSX selectors |

## Family Mapping

| Family | Look and Feel Profile | Typical Theme IDs | Primary Risk if Misapplied |
|------|------|------|------|
| Core | Neutral baseline and broad compatibility | `ubs`, `classic`, `high-contrast` | Brand dilution or accessibility regressions |
| Enterprise | Institutional, domain-specific operational tone | `steel-ledger`, `regulatory-slate`, `industrial-teal`, others | Inconsistent interaction affordance across enterprise apps |
| Banking | Regulated, trust-first and data-dense workflows | `core-banking-blue`, `compliance-ledger`, `trade-finance-sepia`, others | Reduced readability in dense forms and tables |
| UBS Banking | UBS signature identity with red accent discipline | `ubs-signature-red`, `ubs-wealth-ivory`, `ubs-midnight-markets`, `ubs-alpine-trust` | Overuse of accent color and visual noise |

## Token Responsibility Matrix

| Token Group | Theme Layer Responsibility | Component Style Expectations |
|------|------|------|
| Surface and text (`--surface`, `--bg`, `--text`, `--muted`, `--border`) | Set readability baseline and density perception | Cards, tables, forms, and shells must avoid hard-coded colors |
| Semantic status (`--color-primary`, `--color-secondary`, `--color-success`, `--color-warning`, `--color-error`) | Define semantic hierarchy and state meaning | Alerts, badges, chips, and status panels must map directly |
| Spacing and type (`--spacing-*`, `--font-size-*`, `--font-weight-*`) | Encode rhythm and information density | Layout and form controls should only use tokenized scales |
| Shape and depth (`--radius-*`, `--elevation-*`) | Define tactile character and hierarchy | Menus, overlays, panels, and popovers should avoid ad hoc shadow/radius values |
| Interaction states (`--state-*`, `--button-*`) | Preserve consistency for focus/hover/active/disabled semantics | Buttons, links, inputs, and selectable rows must use state tokens |

## Component Style Checklist

Use this checklist before accepting component changes:
1. No raw color values where equivalent tokens exist.
2. Focus-visible styles consume `--state-focus-ring` tokens.
3. Disabled states use `--state-disabled-*` tokens.
4. Hover and active states use `--state-hover-surface` and `--state-active-surface`.
5. Primary and secondary button states map to `--button-*` tokens when present.
6. Table and form density follows spacing and typography token scales.
7. Status visuals map only to semantic status tokens.

## Governance Workflow

1. Select or define Look and Feel direction in catalog docs.
2. Implement or update theme token values in theme preset files.
3. Verify component styles consume tokens without hard-coded drift.
4. Run framework tests and builds to validate token contract integrity.
5. Record catalog and tracker updates for traceability.

## References
- `docs/governance/DESIGN_RULES.md`
- `docs/governance/ENTERPRISE_THEME_CATALOG.md`
- `docs/governance/BANKING_THEME_CATALOG.md`
- `src/framework/enterpriseThemes.ts`
- `src/framework/bankingThemes.ts`
- `src/framework/core.tsx`
- `src/framework/framework.css`
