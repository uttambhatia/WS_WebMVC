# Enterprise Theme Catalog

This catalog tracks enterprise-grade visual themes for framework consumers.

## Planning Objectives
- Maintain one consistent token contract across all themes.
- Keep semantic tokens stable while allowing visual differentiation by vertical.
- Prioritize readability, status clarity, and dense-data usability.
- Stage implementation in waves so each theme can be validated by lint/test/build.

## Theme Portfolio

| Theme | ID | Visual Direction | Primary Use Cases | Palette | Status |
|------|------|------|------|------|------|
| Steel Ledger | `steel-ledger` | Cool grays with restrained cyan and high-contrast data tables | Finance, audit, compliance dashboards | `#0F172A #334155 #E2E8F0 #06B6D4 #F8FAFC` | Implemented |
| Executive Ivory | `executive-ivory` | Premium paper-like surfaces, deep navy actions, subtle gold accents | Executive reporting and policy workflows | `#FAF8F3 #E7E2D9 #1E293B #0B3C5D #C8A96B` | Implemented |
| Ops Command Green | `ops-command-green` | Operations-oriented dark neutral base with status-forward olive/green accents | ITSM and incident operations | `#111827 #1F2937 #A3B18A #3A5A40 #D1FAE5` | Implemented |
| Regulatory Slate | `regulatory-slate` | Neutral, no-nonsense baseline optimized for long-form and dense records | Legal, healthcare, public sector | `#101828 #344054 #98A2B3 #D0D5DD #F9FAFB` | Implemented |
| Carbon Commerce | `carbon-commerce` | Carbon dark mode with warm amber KPI highlights | Retail operations and revenue analytics | `#0B0F14 #1F2937 #F59E0B #FCD34D #E5E7EB` | Implemented |
| Azure Governance | `azure-governance` | Cloud-native enterprise language with trust-forward blue hierarchy | Cloud management and IAM portals | `#0A2540 #1D4ED8 #60A5FA #DBEAFE #F8FAFC` | Implemented |
| Boardroom Monochrome | `boardroom-monochrome` | Black-and-white base with a single controlled accent color | Strategy and executive briefing UIs | `#0A0A0A #262626 #737373 #F5F5F5 #B91C1C` | Implemented |
| Industrial Teal | `industrial-teal` | Graphite modules with teal instrumentation and strong segmentation | Manufacturing and field service | `#0F172A #1E293B #0F766E #14B8A6 #E2E8F0` | Implemented |
| Sovereign Burgundy | `sovereign-burgundy` | Formal institutional tone with burgundy and restrained gold accents | Government and legal operations | `#2B0B1A #6B213F #D4AF37 #F3E8FF #FAF5FF` | Implemented |
| Data Lab Cobalt | `data-lab-cobalt` | Analytical, crisp cobalt hierarchy with clean surfaces | BI and forecasting workbenches | `#0B1020 #1E40AF #3B82F6 #BFDBFE #F1F5F9` | Implemented |

## Implemented Theme Packs

The following themes are production-ready and registered by `corePlugin`:
- `steel-ledger`
- `executive-ivory`
- `ops-command-green`
- `azure-governance`
- `regulatory-slate`
- `industrial-teal`
- `carbon-commerce`
- `boardroom-monochrome`
- `sovereign-burgundy`
- `data-lab-cobalt`

Each implemented pack includes:
- Required framework theme tokens (semantic colors, spacing, typography, radius, elevation).
- Optional typography enhancements (font family and line-height tokens).
- Optional component-state tokens (focus, hover, active, selected, disabled, info).
- Optional button-state tokens for easy component-level adoption.

Source of truth:
- `src/framework/enterpriseThemes.ts`
- `src/framework/core.tsx`

## Recommended Rollout Plan

### Wave 1 (completed)
- Implement and register `azure-governance`, `regulatory-slate`, `industrial-teal`.
- Expose presets through package exports for consumers.

### Wave 2 (completed)
- Implemented `steel-ledger`, `ops-command-green`, and `data-lab-cobalt` for analytics-heavy apps.
- Added full token presets with required + optional state tokens.

### Wave 3 (completed)
- Implemented `executive-ivory`, `carbon-commerce`, `boardroom-monochrome`, and `sovereign-burgundy`.
- Registered all theme IDs through `corePlugin` via the enterprise preset collection.

### Next Enhancements
- Add accessibility contrast checks for all semantic-state combinations.
- Add visual snapshot tests for top-level shell and key component states.

## Consumer Usage

```ts
import {
  corePlugin,
  enterpriseThemePresets,
  initializeFramework,
  framework,
  type FrameworkConfig,
} from 'reactjs-framework'

const config: FrameworkConfig = {
  appTitle: 'My App',
  defaultLayoutId: 'topnav',
  defaultThemeId: 'azure-governance',
  plugins: [corePlugin],
  routes: [],
  themes: [
    // optional consumer themes
    // themes from corePlugin are available automatically
    enterpriseThemePresets[0],
  ],
}

initializeFramework(framework, config)
```

Note: when using `corePlugin`, avoid re-registering the same enterprise theme IDs in `config.themes` unless you intentionally want to override token values.
