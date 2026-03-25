# Architecture

## Purpose and Scope
This framework provides a pluggable shell for layout, routing, and theme composition in React apps.

This document covers:
- Runtime architecture and data flow.
- Core module responsibilities.
- Extension points for plugins, routes, themes, and layouts.
- Public API boundaries.

Out of scope:
- Product-specific page logic.
- Build pipeline internals.
- Non-public implementation details marked internal.

## Design Principles
- Declarative startup over scattered runtime mutation.
- Extensibility through typed contracts, not ad-hoc conventions.
- Safe failure with diagnostics instead of hard crashes where possible.

## Layered Architecture
### Presentation Layer
- Built-in components: `MainNav`, `PreferencesMenu`, `ThemeSwitcher`.
- Built-in layouts: `SidebarLayout`, `TopNavLayout`.
- Consumer pages are rendered as route elements.

### Framework Core Layer
- Registry (`src/framework/registry.ts`): source of truth for layouts, themes, routes.
- Bootstrap (`src/framework/bootstrap.ts`): ordered initialization and validation.
- Provider (`src/framework/provider.tsx`): runtime state, persistence, and theme application.
- Hooks (`src/framework/hooks.ts`): consumer access to layout/theme state.

### Form Engine Layer
- Schema (`src/forms/schema.ts`): type contracts, condition evaluator.
- Registry (`src/forms/registry.ts`): pluggable registries for validators, widgets, and lookup providers.
- Defaults (`src/forms/defaults.tsx`): default widget adapters for all built-in field types.
- Bootstrap (`src/forms/bootstrap.ts`): `initializeFormEngine()` schema validation and diagnostics.
- Context (`src/forms/context.tsx`): runtime state — rule evaluation, staged validation, async lookups, dependency invalidation.
- Renderer (`src/forms/renderer.tsx`): `SchemaForm` component, iterates schema fields and delegates to widgets.

### Extension Layer
- Plugins implement `FrameworkPlugin = (registry) => void`.
- Consumers register routes/themes via `FrameworkConfig` and optionally plugins.
- Core defaults come from `corePlugin`.
- Form Engine consumers extend via `initializeFormEngine({ register })` — registering custom validators, widgets, and lookup providers.

## Key Modules and Responsibilities
### Registry Model
Source: `src/framework/registry.ts`

Key contracts:
- `LayoutDefinition`: `id`, `label`, optional `description`, `Component`.
- `RouteDefinition`: `path`, `element`, optional `label`.
- `ThemeDefinition`: `id`, `label`, optional `description`, `variables` map.
- `FrameworkRegistry`: register/get methods for layouts, themes, routes.

Behavior notes:
- Duplicate layout/theme IDs overwrite with warning.
- Duplicate route paths overwrite with warning.

Why this exists:
- Decouples framework consumption from storage internals.
- Gives plugins and bootstrapping one shared contract.

### Bootstrap Lifecycle
Source: `src/framework/bootstrap.ts`

`initializeFramework(registry, config)` runs:
1. Plugins.
2. Routes.
3. Themes.
4. Validation.

Output: `InitializationResult` with `success`, `errors`, `warnings`.

Why pre-render initialization:
- Startup is deterministic and testable.
- Consumers get diagnostics before rendering.

### Provider and Runtime State
Source: `src/framework/provider.tsx`

Responsibilities:
- Resolve startup layout/theme from localStorage, then defaults.
- Expose context value with current selection, available definitions, and routes.
- Persist `framework.layoutId` and `framework.themeId` to localStorage.
- Apply theme variables to `document.documentElement`.

### Layout and Routing Composition
Sources: `src/framework/layouts.tsx`, `src/components/MainNav.tsx`

- `LayoutRenderer` wraps `<Routes>` in current layout component.
- Unknown routes redirect to first registered route.
- `MainNav` renders only routes with `label`.

### Theme System
Sources: `src/framework/core.tsx`, `src/framework/framework.css`

- Core plugin provides `ubs` and `classic` themes.
- Theme variables map onto CSS custom properties (for example `--text`, `--surface`, `--brand`).
- Theme switching updates CSS variables at runtime.

## Data Flow Diagram (Mermaid)
```mermaid
flowchart TD
	A[main.tsx / app entry] --> B[create FrameworkConfig]
	B --> C[initializeFramework(registry, config)]
	C --> C1[Run plugins]
	C --> C2[Register routes]
	C --> C3[Register themes]
	C --> C4[Validate registry]
	C4 --> D{success?}
	D -->|yes| E[Render App]
	D -->|no| E
	E --> F[LayoutProvider]
	F --> F1[resolve layout/theme]
	F --> F2[persist localStorage]
	F --> F3[apply CSS vars]
	F --> G[LayoutRenderer]
	G --> H[current Layout Component]
	H --> I[React Router Routes]
	I --> J[Page Elements]
```

## Extension Points
### Plugin Extension
- Contract: `FrameworkPlugin` in `src/framework/registry.ts`.
- Plugins run first and can register layouts/themes/routes.
- Plugin exceptions are captured in initialization errors.

### Route Extension
- Register through `FrameworkConfig.routes` or plugin registry calls.
- `path` must be non-empty; `element` is required.

### Theme Extension
- Register through `FrameworkConfig.themes` or plugin registry calls.
- `id`, `label`, `variables` expected; empty `variables` yields warning.

### Layout Extension
- Register via `registry.registerLayout`.
- `Component` must be a valid React component.

### Form Engine Extension
- Register custom validators via `registry.registerValidator(name, fn)`.
- Register custom widget components via `registry.registerWidget(name, Component)`.
- Register async lookup providers via `registry.registerLookupProvider(name, fn)`.
- All registration is done inside the `register` callback of `initializeFormEngine`.
- See `FORM_ENGINE.md` for full reference.

## Public API Surface and Stability
Source: `src/index.ts`

Stable exports include:
- `framework`, registry types, bootstrap APIs, provider/renderer, hooks, `corePlugin`, `ThemeSwitcher`.

Alpha exports:
- `LayoutContextValue`.
- `SchemaForm`, `SchemaFormProvider`, `useSchemaForm` — Form Engine rendering.
- `initializeFormEngine`, `FormEngine`, `FormEngineRegistry` — Form Engine bootstrap and registry.
- All Form Engine schema types: `FormSchema`, `FormFieldSchema`, `Condition`, `FieldRule`, `ValidatorSpec`, `LookupSpec`, `RuleEvaluationPolicy`, `AsyncPolicy`, `RetryPolicy`.

Versioning policy:
- See `VERSIONING.md`.

## Architectural Rationale
### Why Registry + Provider + Bootstrap
- Registry keeps extension data model centralized.
- Bootstrap enforces ordered, predictable initialization.
- Provider handles runtime concerns (state, persistence, DOM variables) close to React tree.

### Why Diagnostics Instead of Hard Throw
- Supports progressive startup and better debugging in integration scenarios.
- Allows warnings for non-blocking issues while preserving render capability.

## Known Limitations
- Duplicate registrations are warning-based overwrites, not hard failures.
- Some built-in layout/component styles still use inline hard-coded values.
- Only one alpha type is exported; consumers should prefer hooks.

## Future Evolution (Non-Binding)
- Add stricter validation modes (warn vs strict).
- Expand component inventory and stable component APIs.
- Improve design-token normalization.

## Glossary
- Registry: framework state container for layouts, themes, routes.
- Plugin: function that receives a registry and registers artifacts.
- Bootstrap: pre-render initialization process.
- Layout: top-level shell that wraps route rendering.
- Theme: named CSS variable bundle.
- Form Engine: schema-driven form rendering and validation subsystem.
- FormSchema: declarative JSON/TypeScript object describing form fields, rules, and validators.
- Condition: declarative predicate evaluated against current form values.

## References
- `src/framework/registry.ts`
- `src/framework/bootstrap.ts`
- `src/framework/provider.tsx`
- `src/framework/layouts.tsx`
- `src/framework/core.tsx`
- `src/framework/framework.css`
- `src/forms/schema.ts`
- `src/forms/registry.ts`
- `src/forms/bootstrap.ts`
- `src/forms/context.tsx`
- `src/forms/renderer.tsx`
- `src/index.ts`
- `VERSIONING.md`
- `FORM_ENGINE.md`
