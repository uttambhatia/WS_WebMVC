# Migration Guide: Guard-Check to Bootstrap

## Who Should Use This Guide
- Existing consumers with guard-check registration blocks.
- Teams standardizing on `FrameworkConfig` and `initializeFramework`.

## Migration Summary
What changed:
- Registration moved from scattered `if` checks to one declarative config object.
- Startup now runs through `initializeFramework` before render.

Why:
- Better predictability, clearer ownership, and startup diagnostics.

Impact:
- Moderate code reorganization in app entry file.

## Before vs After at a Glance
### Old Pattern
- Repeated checks like `if (!framework.getTheme(...)) registerTheme(...)`.
- Implicit ordering.
- No centralized diagnostics.

### New Pattern
- One `frameworkConfig` object.
- Ordered init flow: plugins -> routes -> themes -> validation.
- Structured `InitializationResult` with `errors` and `warnings`.

## Prerequisites
- Framework version that exports `initializeFramework` and `FrameworkConfig`.
- App startup file where module-level initialization is possible.
- Ability to test route/theme/layout switching after migration.

## Before and After Example
### Before (guard-check style)
```tsx
if (!framework.getLayout('sidebar')) {
	corePlugin(framework)
}

if (!framework.getRoutes().some((r) => r.path === '/')) {
	framework.registerRoute({ path: '/', element: <HomePage />, label: 'Home' })
}

if (!framework.getTheme('consumer-ocean')) {
	framework.registerTheme({ id: 'consumer-ocean', label: 'Ocean', variables: { '--text': '#0f3554' } })
}
```

### After (bootstrap style)
```tsx
const frameworkConfig: FrameworkConfig = {
	appTitle: 'AI Agent Evals',
	defaultLayoutId: 'sidebar',
	defaultThemeId: 'consumer-ocean',
	plugins: [corePlugin],
	routes: [
		{ path: '/', element: <HomePage />, label: 'Home' },
		{ path: '/about', element: <AboutPage />, label: 'About' },
	],
	themes: [
		{
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
		},
	],
}

const initResult = initializeFramework(framework, frameworkConfig)
```

## Migration Path A: ReactConsumer
1. Open `ReactConsumer/src/App.tsx`.
2. Replace scattered guard checks with `frameworkConfig`.
3. Add `initializeFramework(framework, frameworkConfig)` at module level.
4. Keep `LayoutProvider` and wire defaults from config fields.
5. Add logging for `errors` and `warnings`.
6. Validate route/theme/layout behavior in UI.

## Migration Path B: External Consumer (Generic)
1. Add imports: `framework`, `corePlugin`, `initializeFramework`, `type FrameworkConfig`.
2. Define `frameworkConfig` with `plugins`, `routes`, and `themes`.
3. Call `initializeFramework` before rendering app root.
4. Pass defaults and branding into `LayoutProvider`.
5. Validate diagnostics and smoke-test navigation and theming.

## Code Mapping Table
| Old pattern | New pattern |
|---|---|
| `if (!getLayout('x')) plugin(registry)` | `plugins: [plugin]` |
| `registerRoute(...)` repeated inline | `routes: [...]` |
| `registerTheme(...)` repeated inline | `themes: [...]` |
| No structured validation | `const result = initializeFramework(...)` |

## Common Breakages and Fixes
- Missing default layout/theme IDs: use IDs that exist after initialization.
- Duplicate route paths: keep one canonical path per route.
- Empty theme variables: provide the full variable map.
- Plugin order assumptions: reorder `plugins` deterministically.

## Migration Checksum Checklist
- [ ] Added `FrameworkConfig` object.
- [ ] Added one `initializeFramework` call before render.
- [ ] Removed guard-check registration blocks.
- [ ] Moved routes into `config.routes`.
- [ ] Moved themes into `config.themes`.
- [ ] Moved plugin registrations into `config.plugins`.
- [ ] Bound `LayoutProvider` defaults from config.
- [ ] Logged and reviewed initialization diagnostics.

## Validation Steps
- Route smoke test: all expected routes render.
- Theme smoke test: changing theme updates variables/UI.
- Layout smoke test: switching layout updates shell and retains content.
- Startup diagnostic check: no blocking init errors.

## FAQ
### Can I migrate incrementally?
Yes. You can first introduce `FrameworkConfig` while preserving behavior, then remove old guard checks.

### What if I still need dynamic registration?
Keep dynamic logic in plugins and execute those plugins through `config.plugins`.

### Are warnings acceptable?
Temporarily yes, but track and resolve before release hardening.

## References
- `src/framework/bootstrap.ts`
- `src/framework/registry.ts`
- `src/index.ts`
- `../ReactConsumer/src/App.tsx`
