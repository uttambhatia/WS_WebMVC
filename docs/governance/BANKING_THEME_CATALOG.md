# Banking Theme Catalog

This catalog defines banking-domain visual themes implemented in the framework.

## Scope
- All entries below are implemented and registered through `corePlugin`.
- Every theme includes required token contract coverage plus optional state and button tokens.
- Themes are intended for domain-specific apps across retail, treasury, compliance, and trade operations.

## Theme Portfolio

| Theme | ID | Visual Direction | Primary Use Cases | Palette | Status |
|------|------|------|------|------|------|
| Core Banking Blue | `core-banking-blue` | Trusted navy + steel neutrals with low visual noise | Retail banking, account management, payments | `#0B1F3A #1E3A5F #DCE6F2 #2F6FED #F7FAFC` | Implemented |
| Treasury Midnight | `treasury-midnight` | Dark dealing-desk language with bright signal highlights | Treasury operations, liquidity, intraday risk | `#0A0F1C #1F2937 #22D3EE #F59E0B #E5E7EB` | Implemented |
| Compliance Ledger | `compliance-ledger` | Calm neutral surfaces with high legibility | KYC, AML, audit trails, regulatory workflows | `#111827 #374151 #D1D5DB #2563EB #F9FAFB` | Implemented |
| Wealth Advisory Ivory | `wealth-advisory-ivory` | Premium light surfaces with restrained gold accents | Private banking, relationship manager dashboards | `#FAF7F0 #E8DFCF #1E293B #B08968 #0F4C81` | Implemented |
| Payments Velocity | `payments-velocity` | Energetic cobalt + cyan hierarchy | Payments hubs, settlements, fraud triage | `#0B1020 #1D4ED8 #06B6D4 #F59E0B #EFF6FF` | Implemented |
| Credit Risk Slate | `credit-risk-slate` | Analytical grayscale with bold severity cues | Underwriting, scorecards, exposure analytics | `#0F172A #334155 #94A3B8 #DC2626 #F8FAFC` | Implemented |
| Islamic Finance Emerald | `islamic-finance-emerald` | Elegant green-forward institutional language | Sharia-compliant product and advisory flows | `#0F2E24 #1F6F5D #A7D7C5 #EAF7F1 #C49A3A` | Implemented |
| Corporate Cashflow Graphite | `corporate-cashflow-graphite` | Graphite workspace with strong data-table contrast | Corporate banking cash management and approvals | `#111827 #1F2937 #6B7280 #3B82F6 #F3F4F6` | Implemented |
| Trade Finance Sepia | `trade-finance-sepia` | Document-centric warm neutrals with deep ink contrast | Letters of credit, guarantees, trade operations | `#2B2A28 #5C5348 #DDD6C8 #0B3C5D #FAF8F3` | Implemented |
| Digital Onboarding Sky | `digital-onboarding-sky` | Friendly modern onboarding style with clear states | Onboarding, eKYC journeys, self-service origination | `#0F172A #2563EB #7DD3FC #22C55E #F8FAFC` | Implemented |

## UBS-Specific Banking Themes

| Theme | ID | Visual Direction | Primary Use Cases | Palette | Status |
|------|------|------|------|------|------|
| UBS Signature Red | `ubs-signature-red` | Classic UBS white canvas with disciplined red emphasis | Retail banking shell, executive dashboard, self-service | `#E60028 #1B1B1B #FFFFFF #D7D7D7 #F7E5E8` | Implemented |
| UBS Wealth Ivory | `ubs-wealth-ivory` | Premium advisory surfaces with warm ivory layers and restrained red accents | Wealth advisory and portfolio workbench | `#FAF7F0 #E8DFCF #1E293B #E60028 #FFFDF8` | Implemented |
| UBS Midnight Markets | `ubs-midnight-markets` | Dark market-monitoring language with UBS red action accent | Treasury operations and intraday risk | `#0A0F1C #1F2937 #E5E7EB #E60028 #22D3EE` | Implemented |
| UBS Alpine Trust | `ubs-alpine-trust` | Cool trust-forward blue-gray language with UBS red action color | Compliance, onboarding, and policy workflows | `#F4F8FC #DCE6F2 #1E3A5F #E60028 #2F6FED` | Implemented |

## Source
- `src/framework/bankingThemes.ts`
- `src/framework/core.tsx`

## Consumer Usage

```ts
import {
  corePlugin,
  bankingThemePresets,
  initializeFramework,
  framework,
  type FrameworkConfig,
} from 'reactjs-framework'

const config: FrameworkConfig = {
  appTitle: 'Banking Portal',
  defaultLayoutId: 'topnav',
  defaultThemeId: 'core-banking-blue',
  plugins: [corePlugin],
  routes: [],
  themes: [
    // Only include if intentionally overriding a banking theme
    // bankingThemePresets[0],
  ],
}

initializeFramework(framework, config)
```
