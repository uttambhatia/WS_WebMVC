# Plugin Guide

## Who This Guide Is For
- Consumers extending the framework with routes/themes/layouts.
- Framework contributors designing reusable plugin packages.

## What Is a Plugin
A plugin is a function that receives the framework registry and registers one or more artifacts.

```ts
type FrameworkPlugin = (registry: FrameworkRegistry) => void
```

Plugins can:
- Register routes.
- Register themes.
- Register layouts.

Plugins should not:
- Depend on internal classes from the framework package.
- Perform app-specific side effects at import time.

## Plugin Contract
Source: `src/framework/registry.ts`

Important registry methods:
- `registerRoute(route)`
- `registerTheme(theme)`
- `registerLayout(layout)`

## Registration Mechanics
### When Plugins Run
Plugins run during `initializeFramework(registry, config)` before routes and themes from config arrays.

### Why Order Matters
`FrameworkConfig.plugins` is executed in array order. If plugin B assumes plugin A already registered a layout/theme, A must come first.

## Error Handling and Diagnostics
Source: `src/framework/bootstrap.ts`

- Plugin exceptions are caught and added to `InitializationResult.errors`.
- Duplicate IDs/paths emit warnings at registry layer and overwrite last write.
- Validation adds additional errors/warnings after all registration is complete.

Recommended pattern:
```ts
const result = initializeFramework(framework, config)
if (!result.success) console.error(result.errors)
if (result.warnings.length) console.warn(result.warnings)
```

## Step-by-Step: Build Your First Plugin
1. Create a file such as `src/plugins/my-plugin.tsx`.
2. Import `type FrameworkPlugin` from the framework package.
3. Export a plugin function.
4. Register one or more artifacts with the registry.
5. Add your plugin to `FrameworkConfig.plugins`.
6. Run and inspect initialization diagnostics.

## Example 1: Route-Only Plugin
### Goal
Add a new navigation route.

### Implementation
```tsx
import { type FrameworkPlugin } from 'reactjs-framework'
import { ReportsPage } from './pages/ReportsPage'

export const reportsRoutePlugin: FrameworkPlugin = (registry) => {
	registry.registerRoute({
		path: '/reports',
		element: <ReportsPage />,
		label: 'Reports',
	})
}
```

### Expected Result
- `/reports` route is available.
- `MainNav` shows the route because `label` is set.

## Example 2: Theme-Only Plugin
### Goal
Add a consumer brand theme.

### Implementation
```ts
import { type FrameworkPlugin } from 'reactjs-framework'

export const oceanThemePlugin: FrameworkPlugin = (registry) => {
	registry.registerTheme({
		id: 'consumer-ocean',
		label: 'Ocean',
		variables: {
			'--surface': '#f0f8ff',
			'--border': '#c4dff6',
			'--text': '#0f3554',
			'--muted': '#436a88',
			'--primary-hover': '#d8ecfb',
			'--bg': '#eaf4fb',
			'--brand': '#0b5fa5',
			'--link': '#0b5fa5',
			'--link-hover': '#084a80',
		},
	})
}
```

### Expected Result
- Theme appears in preference controls.
- CSS variables are applied to `:root` on selection.

## Example 3: Layout-Only Plugin
### Goal
Add a custom layout shell.

### Implementation
```tsx
import { type FrameworkPlugin } from 'reactjs-framework'

function SplitLayout({ children }: { children: React.ReactNode }) {
	return <div className="my-split-layout">{children}</div>
}

export const splitLayoutPlugin: FrameworkPlugin = (registry) => {
	registry.registerLayout({
		id: 'split',
		label: 'Split',
		description: 'Split-pane layout',
		Component: SplitLayout,
	})
}
```

### Expected Result
- Layout appears in preferences and can be activated.

## Example 4: Combined Plugin (Routes + Themes + Layouts)
### Goal
Ship one domain module that contributes all extension types.

### Implementation
```tsx
import { type FrameworkPlugin } from 'reactjs-framework'
import { OpsPage } from './pages/OpsPage'

function OpsLayout({ children }: { children: React.ReactNode }) {
	return <section className="ops-layout">{children}</section>
}

export const opsPlugin: FrameworkPlugin = (registry) => {
	registry.registerLayout({ id: 'ops', label: 'Ops', Component: OpsLayout })
	registry.registerTheme({
		id: 'ops-dark',
		label: 'Ops Dark',
		variables: {
			'--surface': '#0d1117',
			'--border': '#2f3942',
			'--text': '#e6edf3',
			'--muted': '#9ea7b0',
			'--primary-hover': '#1f2937',
			'--bg': '#0b1015',
			'--brand': '#2f81f7',
			'--link': '#58a6ff',
			'--link-hover': '#79c0ff',
		},
	})
	registry.registerRoute({ path: '/ops', element: <OpsPage />, label: 'Ops' })
}
```

### Expected Result
- Layout, theme, and route all become available after startup.

## Consumer Integration Walkthrough
```tsx
import { corePlugin, framework, initializeFramework, type FrameworkConfig } from 'reactjs-framework'
import { reportsRoutePlugin } from './plugins/reportsRoutePlugin'

const frameworkConfig: FrameworkConfig = {
	appTitle: 'AI Agent Evals',
	plugins: [corePlugin, reportsRoutePlugin],
	routes: [{ path: '/', element: <HomePage />, label: 'Home' }],
	themes: [],
}

const initResult = initializeFramework(framework, frameworkConfig)
```

## Pitfalls and Anti-Patterns
- Duplicate IDs or paths causing silent overwrite expectations.
- Missing `label` on user-facing routes (won't appear in nav).
- Themes with incomplete variable sets.
- Assuming plugin order does not matter.
- Importing internal APIs not exported via `src/index.ts`.

## Best Practices Checklist
- Use unique prefixes for plugin IDs.
- Keep plugins focused by concern.
- Prefer deterministic registration (no random/runtime-generated IDs).
- Validate startup diagnostics in CI smoke tests.
- Depend only on stable exports where possible.

## FAQ
### Can plugin B depend on plugin A?
Yes, but encode that dependency through ordering and document it explicitly.

### How many plugins are too many?
No hard limit; group by bounded context and avoid highly coupled monolith plugins.

### Can I deprecate a plugin gradually?
Yes. Keep old IDs temporarily, emit warnings, and provide migration notes.

---

## Form Engine Extensions

The Form Engine has its own extension model, separate from `FrameworkPlugin`. Extensions are registered inside the `register` callback of `initializeFormEngine`, not through `FrameworkPlugin`.

### What Can Be Extended

| Extension type | Registry method | Purpose |
|---|---|---|
| Custom validator | `registry.registerValidator(name, fn)` | Named validation rule for any field |
| Custom widget | `registry.registerWidget(name, Component)` | React component for a field type or widget override |
| Lookup provider | `registry.registerLookupProvider(name, fn)` | Async option loader for `async-select` fields |

### Example 1: Custom Validator Plugin

A reusable module that registers domain-specific validators into a Form Engine registry:

```ts
import {
  type FormEngineRegistry,
  type ValidatorContext,
} from 'reactjs-framework'

export function registerDomainValidators(registry: FormEngineRegistry) {
  registry.registerValidator('ibanFormat', (value) => {
    if (typeof value !== 'string' || value.trim().length === 0) return undefined
    const clean = value.replace(/\s/g, '').toUpperCase()
    if (!/^[A-Z]{2}\d{2}[A-Z0-9]+$/.test(clean)) {
      return 'Invalid IBAN format.'
    }
    return undefined
  })

  registry.registerValidator('swiftCode', (value) => {
    if (typeof value !== 'string' || value.trim().length === 0) return undefined
    if (!/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(value.trim())) {
      return 'Invalid SWIFT/BIC code.'
    }
    return undefined
  })
}
```

Usage in a consumer:

```ts
initializeFormEngine({
  schema: PAYMENT_SCHEMA,
  register: (registry) => {
    registerDomainValidators(registry)
  },
})
```

### Example 2: Custom Widget

Register a star-rating widget component mapped to a named type override:

```tsx
import { type FormWidgetProps } from 'reactjs-framework'

function StarRatingWidget({ id, value, onValueChange, onBlur }: FormWidgetProps) {
  return (
    <div id={id} className="star-rating" onBlur={onBlur}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          onClick={() => onValueChange(n)}
        >
          {n <= (value as number) ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

// Register during initializeFormEngine
registry.registerWidget('star-rating', StarRatingWidget)
```

Then reference it in the schema:

```ts
{ key: 'satisfaction', label: 'Satisfaction', type: 'number', widget: 'star-rating' }
```

### Example 3: Lookup Provider

Register an async option provider that loads from an API:

```ts
registry.registerLookupProvider('customers.search', async (query, context) => {
  const response = await fetch(
    `/api/customers?q=${encodeURIComponent(query)}&region=${context.values.region ?? ''}`,
    { signal: context.signal }
  )
  const data = await response.json()
  return data.map((item: { id: string; name: string }) => ({
    label: item.name,
    value: item.id,
  }))
})
```

Schema field using this provider:

```ts
{
  key: 'customerId',
  label: 'Customer',
  type: 'async-select',
  lookup: {
    provider: 'customers.search',
    dependsOn: ['region'],
    invalidateOnDependencyChange: true,
    asyncPolicy: { timeoutMs: 3000, retry: { maxAttempts: 2, backoffMs: 200 } },
  },
}
```

### Key Differences from FrameworkPlugin

| Concern | FrameworkPlugin | Form Engine `register` |
|---|---|---|
| Called via | `FrameworkConfig.plugins[]` | `initializeFormEngine({ register })` |
| Receives | `FrameworkRegistry` | `FormEngineRegistry` |
| Registers | Routes, themes, layouts | Validators, widgets, lookup providers |
| Runs | Once at app startup | Once per `initializeFormEngine` call |
| Scope | Global framework shell | Single form schema |

For full Form Engine type contracts, condition operators, and schema reference see `FORM_ENGINE.md`.

## References
- `src/framework/registry.ts`
- `src/framework/bootstrap.ts`
- `src/forms/registry.ts`
- `src/forms/bootstrap.ts`
- `src/plugins/example/index.tsx`
- `src/index.ts`
- `FORM_ENGINE.md`
