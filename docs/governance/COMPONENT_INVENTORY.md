# Component Inventory

## Purpose and Scope
This inventory documents the current reusable UI components in the framework package, their behavior, and extension/customization boundaries.

## Stability Legend
- Stable: safe for consumer usage through public API.
- Alpha: exported but may change without major bump.
- Internal: not supported for direct consumer dependency.

## MainNav
### Summary
Primary navigation component that renders labeled routes from framework context.

### Source
`src/components/MainNav.tsx`

### Props and Inputs
- `vertical?: boolean`

### Behavior
- Reads `routes` from context.
- Filters to routes with `label`.
- Uses `NavLink` and active-state class.

### Customization Points
- Route labels/paths are configured by registry data.
- Orientation controlled by `vertical` prop.

### Stability Level
Stable behavior; component itself is currently consumed internally by layouts.

### Known Limitations
- Unlabeled routes are intentionally hidden.

## PreferencesMenu
### Summary
Unified menu for selecting layout and theme with keyboard support.

### Source
`src/components/PreferencesMenu.tsx`

### Props and Inputs
- No external props.
- Reads from `useLayout()` and `useTheme()`.

### Behavior
- Builds option model for layouts and themes.
- Supports keyboard navigation (arrows, home/end, escape).
- Dynamically aligns menu left/right by viewport fit.

### Customization Points
- Option content comes from registered layout/theme definitions.
- Visual styling is class-based in `framework.css`.

### Stability Level
Stable for built-in usage; API surface is implicit (no exported props contract).

### Known Limitations
- Some positioning values are hard-coded.

## LayoutSwitcher
### Summary
Lightweight select control for switching current layout.

### Source
`src/components/LayoutSwitcher.tsx`

### Props and Inputs
- `compact?: boolean`

### Behavior
- Reads `layouts`, `currentLayoutId`, `setLayoutId`.
- Renders a `label` + `select` UI.

### Customization Points
- Compact mode adjusts orientation and sizing.

### Stability Level
Stable export behavior pattern, but currently not exported from root API.

### Known Limitations
- Inline hard-coded spacing/typography values.

## ThemeSwitcher
### Summary
Lightweight select control for switching current theme.

### Source
`src/components/ThemeSwitcher.tsx`

### Props and Inputs
- `compact?: boolean`

### Behavior
- Reads `themes`, `currentThemeId`, `setThemeId`.
- Renders a `label` + `select` UI.

### Customization Points
- Compact mode adjusts orientation and sizing.

### Stability Level
Stable and publicly exported from `src/index.ts`.

### Known Limitations
- Inline hard-coded spacing/typography values.

## Cross-Component Patterns
- Layout/theme state is consumed through hooks rather than direct context in most components.
- Focus-visible styling is centralized in framework CSS.
- Theme changes propagate via CSS custom properties on `:root`.

## Component Usage Matrix
| Component | SidebarLayout | TopNavLayout | Consumer direct use |
|---|---|---|---|
| MainNav | Yes (vertical) | Yes (horizontal) | Optional |
| PreferencesMenu | Yes | Yes | Optional |
| LayoutSwitcher | No (indirect via PreferencesMenu) | No | Optional |
| ThemeSwitcher | No (indirect via PreferencesMenu) | No | Yes (exported) |

## Lightweight Layout Options (D1 Analysis, 2026-03-15)

### Option Catalog
| Option | Structure | Responsive Behavior | UX Value | Status |
|---|---|---|---|---|
| Focused Workspace | Single primary content column + optional inspector | Desktop split pane; mobile inspector bottom sheet | Reduces distraction for authoring/review | Implemented |
| Adaptive Two-Pane | Navigation rail + content pane | Rail shrinks to icon rail on tablet, then stacks on mobile | Keeps wayfinding compact | Implemented |
| Card Grid Flow | Density-aware fluid card grid | 4 -> 3 -> 2 -> 1 columns by breakpoint | Fast visual scan and comparison | Implemented |
| Step Journey Layout | Stepper header + stage content + sticky actions | Horizontal to vertical progress model on mobile | Strong progress clarity for workflows | Implemented |
| List-Detail Responsive | Master list + detail pane | Desktop side-by-side, mobile drill-in stack | Preserves context while navigating detail | Implemented |
| Command Surface | Sticky command bar + compact result/content zones | Sticky command area with collapsible sections | Keyboard-first throughput | Implemented |

### Focused Workspace Layout
#### Source
`src/framework/layouts.tsx` (`FocusedWorkspaceLayout`)

#### Slots
- `contentBeforeSlot`
- `headerActionsSlot`
- `inspectorSlot`

#### Behavior
- Keeps main content as the primary reading/editing surface.
- Supports optional inspector slot with explicit show/hide toggle.
- Uses bottom-sheet treatment for inspector at narrow widths.

### List-Detail Responsive Layout
#### Source
`src/framework/layouts.tsx` (`ListDetailResponsiveLayout`)

#### Slots
- `listSlot`
- `headerActionsSlot`

#### Behavior
- Uses split list/detail surface on desktop.
- Provides mobile tab-like pane switch controls (List/Detail).
- Preserves selected mobile pane state until explicitly changed.

### Adaptive Two-Pane Layout
#### Source
`src/framework/layouts.tsx` (`AdaptiveTwoPaneLayout`)

#### Slots
- `railTopSlot`
- `headerActionsSlot`
- `contentBeforeSlot`

#### Behavior
- Uses navigation rail + content pane as the primary shell.
- Supports compact rail mode to reduce wayfinding footprint.
- Reflows to stacked content/rail model at narrow widths.

### Card Grid Flow Layout
#### Source
`src/framework/layouts.tsx` (`CardGridFlowLayout`)

#### Slots
- `headerActionsSlot`
- `contentBeforeSlot`

#### Behavior
- Uses fluid card grid with progressive responsive columns.
- Includes density toggle to support comfortable vs compact scanning.
- Maintains tokenized spacing and surface styles across breakpoints.

### Step Journey Layout
#### Source
`src/framework/layouts.tsx` (`StepJourneyLayout`)

#### Slots
- `progressSlot`
- `actionsSlot`
- `contentBeforeSlot`

#### Behavior
- Provides progress-first workflow shell with dedicated stage content.
- Supports sticky actions footer for desktop flow continuity.
- Downgrades sticky actions to static footer on small viewports.

### Command Surface Layout
#### Source
`src/framework/layouts.tsx` (`CommandSurfaceLayout`)

#### Slots
- `commandBarSlot`
- `resultsSlot`
- `sidePanelSlot`

#### Behavior
- Keeps command/search region sticky for high-frequency workflows.
- Splits results, detail content, and optional side panel on desktop.
- Supports side panel collapse and single-column stacking on narrow screens.

## Core Components (Public Alpha)

### Alert
#### Summary
Dismissible semantic message block for inline feedback.

#### Source
`src/components/core/Alert.tsx`

#### Props and Inputs
- `variant?: 'info' | 'success' | 'warning' | 'error'`
- `title?: string`
- `children: React.ReactNode`
- `dismissible?: boolean`
- `onDismiss?: () => void`
- `icon?: React.ReactNode`

#### Behavior
- Renders semantic role by variant (`status` for info/success, `alert` for warning/error).
- Supports controlled (`onDismiss`) and uncontrolled (self-hide) dismiss flows.
- Uses semantic token color mapping and shared alert CSS classes.

#### Example
`<Alert variant="warning" title="Unsaved changes" dismissible>Save your draft before leaving.</Alert>`

#### Stability Level
Alpha

### Spinner
#### Summary
Indeterminate loading indicator for async states.

#### Source
`src/components/core/Spinner.tsx`

#### Props and Inputs
- `size?: 'sm' | 'md' | 'lg'`
- `label?: string`
- `inline?: boolean`

#### Behavior
- Displays animated glyph with accessible status label.
- Honors reduced-motion preference via CSS media query.

#### Example
`<Spinner size="md" label="Loading dashboard" />`

#### Stability Level
Alpha

### EmptyState
#### Summary
No-data placeholder with icon, text, and optional action slot.

#### Source
`src/components/core/EmptyState.tsx`

#### Props and Inputs
- `title: string`
- `description?: string`
- `icon?: React.ReactNode`
- `action?: React.ReactNode`
- `align?: 'left' | 'center'`

#### Behavior
- Shows default icon when custom icon is not provided.
- Optional action renders as a dedicated action region.

#### Example
`<EmptyState title="No reports" description="Create your first report." action={<Button>New report</Button>} />`

#### Stability Level
Alpha

### ErrorState
#### Summary
Recoverable error UI with retry action.

#### Source
`src/components/core/ErrorState.tsx`

#### Props and Inputs
- `title?: string`
- `message: string`
- `retryLabel?: string`
- `onRetry: () => void`

#### Behavior
- Uses `role="alert"` and semantic error visuals.
- Renders retry button using core Button component.

#### Example
`<ErrorState message="Unable to load data." onRetry={reload} />`

#### Stability Level
Alpha

### Badge
#### Summary
Compact semantic label for state and status tagging.

#### Source
`src/components/core/Badge.tsx`

#### Props and Inputs
- `variant?: 'primary' | 'success' | 'warning' | 'error'`
- `size?: 'sm' | 'md'`
- `children: React.ReactNode`

#### Behavior
- Applies token-aligned semantic colors for each variant.
- Supports small and medium sizes for dense or standard layouts.

#### Example
`<Badge variant="success" size="sm">Complete</Badge>`

#### Stability Level
Alpha

## Roadmap: Candidate Future Components
- `StatePanel`: standardized info/warning/error/success messaging card.
- `AppHeader`: reusable shell header with title/logo/actions slots.
- `NavGroup`: grouped navigation with section metadata.

## Sprint C4 Additions (Public Alpha, 2026-03-14)

### Form and Input
- `Textarea` (`src/components/core/Textarea.tsx`)
- `Toggle` (`src/components/core/Toggle.tsx`)
- `MultiSelect` (`src/components/core/MultiSelect.tsx`)
- `FileUpload` (`src/components/core/FileUpload.tsx`)
- `DatePicker` (`src/components/core/DatePicker.tsx`)

### Navigation and Structure
- `Breadcrumb` (`src/components/core/Breadcrumb.tsx`)
- `Tabs` (`src/components/core/Tabs.tsx`)
- `Pagination` (`src/components/core/Pagination.tsx`)
- `Accordion` (`src/components/core/Accordion.tsx`)
- `Stepper` (`src/components/core/Stepper.tsx`)
- `TreeView` (`src/components/core/TreeView.tsx`)

### Overlay and Discovery
- `Modal` (`src/components/core/Modal.tsx`)
- `Tooltip` (`src/components/core/Tooltip.tsx`)
- `Popover` (`src/components/core/Popover.tsx`)
- `DropdownMenu` (`src/components/core/DropdownMenu.tsx`)
- `CommandPalette` (`src/components/core/CommandPalette.tsx`)

### Data and Feedback
- `Table` (`src/components/core/Table.tsx`)
- `DataGrid` (`src/components/core/DataGrid.tsx`)
- `ProgressBar` (`src/components/core/ProgressBar.tsx`)
- `SkeletonLoader` (`src/components/core/SkeletonLoader.tsx`)
- `Toast` (`src/components/core/Toast.tsx`)
- `NotificationCenter` (`src/components/core/NotificationCenter.tsx`)

### Notes
- All C4 components are exported from `src/index.ts` as alpha APIs.
- C4 styling is token-aligned through `src/components/core/core.css`.
- Additional component-specific unit tests are planned to complement existing suite coverage.

## Sprint C5 Additions (Public Alpha, 2026-03-14)

### Workflow and Query Components
- `Combobox` (`src/components/core/Combobox.tsx`)
- `DateRangePicker` (`src/components/core/DateRangePicker.tsx`)
- `FilterBuilder` (`src/components/core/FilterBuilder.tsx`)

### Overlay and Interaction Components
- `Drawer` (`src/components/core/Drawer.tsx`)
- `ContextMenu` (`src/components/core/ContextMenu.tsx`)

### Wave 2 Extensions
- `DateTimePicker` (`src/components/core/DateTimePicker.tsx`)
- `DataGrid` advanced capabilities (`src/components/core/DataGrid.tsx`): global filter, column filters, empty-state message, pinned column keys, and visible-row callback.
- `Drawer` composable primitives (`src/components/core/Drawer.tsx`): `DrawerHeader`, `DrawerBody`, and `DrawerFooter`.
- `Table` pinned cell/header support (`src/components/core/Table.tsx`) used by DataGrid advanced pinning.

### Notes
- C5 components follow token-first classes in `src/components/core/core.css`.
- C5 wave-1 and wave-2 behavior tests are implemented in `src/__tests__/c5-components.test.tsx`.
- All C5 APIs are exported from `src/index.ts` as Public Alpha.

## Sprint C6 Additions (Public Alpha, 2026-03-14)

### Must-have Batch (C6.1-C6.5)
- `AsyncAutocomplete` (`src/components/core/AsyncAutocomplete.tsx`)
- `DataGrid` pro controls extension (`src/components/core/DataGrid.tsx`)
- `FormWizard` (`src/components/core/FormWizard.tsx`)
- `InlineEditable` (`src/components/core/InlineEditable.tsx`)
- `SplitLayout` (`src/components/core/SplitLayout.tsx`)

### C6.2 and C6.5 Structural Dependencies
- `Table` column style extension for DataGrid pro widths (`src/components/core/Table.tsx`)
- Shared C6 styling in `src/components/core/core.css`

### C6.6 Kickoff (Nice-to-have Batch)
- `CalendarScheduler` (`src/components/core/CalendarScheduler.tsx`) — day/week/month views, range callbacks, create/select event hooks, timezone-aware formatting.

### Tests and Validation
- C6 behavior tests are implemented in `src/__tests__/c6-components.test.tsx`.
- C6 must-have batch validation passed with framework lint/tests/build.

### Consumer Integration Evidence
- Consumer route: `/c6-demo` (`../ReactConsumer/src/App.tsx`).
- Consumer page: `../ReactConsumer/src/pages/C6DemoPage.tsx` showcases C6 must-have integrations.

## Form Engine (Public Alpha)

The Form Engine is a schema-driven rendering and validation subsystem. It renders a complete form UI at runtime from a declarative `FormSchema` object — no per-field JSX required.

### SchemaForm

#### Summary
Top-level form renderer. Accepts an initialized `FormEngine` and renders all schema fields using registered widgets, applying dynamic rules, validation, and async lookups.

#### Source
`src/forms/renderer.tsx`

#### Props and Inputs
- `engine: FormEngine` — required; from `initializeFormEngine()`
- `initialValues?: FormValues` — pre-populate field values
- `className?: string` — additional class on `<form>`
- `submitLabel?: string` — submit button text; default `'Submit'`
- `disabled?: boolean` — disables all inputs and submit
- `onSubmit?: (values: FormValues) => void | Promise<void>` — called after all validation stages pass

#### Behavior
- Wraps `SchemaFormProvider` (runtime state context) internally.
- Iterates `schema.fields` and renders a `FieldRenderer` per field.
- Evaluates visibility and required rules before rendering each field.
- Runs three-stage validation on submit: field → cross-field → async.
- Calls `onSubmit(values)` only when all stages return no errors.

#### Example
```tsx
<SchemaForm
  engine={formInit.engine}
  submitLabel="Save"
  onSubmit={(values) => saveConfig(values)}
/>
```

#### Stability Level
Alpha

### SchemaFormProvider / useSchemaForm

#### Summary
Context provider and matching hook giving access to internal form state from child components.

#### Source
`src/forms/context.tsx`

#### Behavior
- `SchemaFormProvider` holds all runtime state: values, errors, async status, visibility, required flags.
- `useSchemaForm()` exposes `values`, `errors`, `asyncStatusByField`, `visibleByField`, `requiredByField`, `touched`, `setValue`, `markTouched`, `validateField`, `validateForm`, `resolveLookupOptions`.
- Use when building a custom form shell that wraps individual `FieldRenderer` instances.

#### Stability Level
Alpha

### initializeFormEngine

#### Summary
Bootstrap function that validates a `FormSchema`, registers built-in widgets and validators, runs the consumer `register` callback, and returns a result object with diagnostics.

#### Source
`src/forms/bootstrap.ts`

#### Usage
```ts
const formInit = useMemo(
  () => initializeFormEngine({
    schema: MY_SCHEMA,
    register: (registry) => {
      registry.registerValidator('myRule', myFn)
      registry.registerLookupProvider('items.search', myLookupFn)
    },
  }),
  []
)
```

#### Diagnostics
Returns `{ success, errors, warnings, engine? }`. `engine` is present only when `success === true`.

#### Stability Level
Alpha

### Notes
- Full schema reference, condition operators, rule types, validator stages, lookup spec, and async policy are documented in `FORM_ENGINE.md`.
- Consumer integration example: `../ReactConsumer/src/pages/FormEngineDemoPage.tsx`, route `/form-engine-demo`.

---

## Sprint C7 Additions (Public Alpha, 2026-03-15)

### SliderInput

#### Summary
Single and dual-thumb range slider for numeric and range value selection.

#### Source
`src/components/core/SliderInput.tsx`

#### Props and Inputs
- `value?: number | [number, number]`
- `defaultValue?: number | [number, number]`
- `min?: number` (default: 0)
- `max?: number` (default: 100)
- `step?: number` (default: 1)
- `dual?: boolean` — enables two-thumb range mode
- `showValue?: boolean` — displays current value
- `showTicks?: boolean` — renders tick marks (≤20 steps)
- `disabled?: boolean`
- `onChange?: (value: number | [number, number]) => void`
- `error?: boolean | string`

#### Behavior
- Single mode: one native `<input type="range">`.
- Dual mode: two overlapping range inputs; lower-value thumb always accessible.
- Dual mode enforces `start ≤ end` ordering.
- Keyboard: Arrow, Home, End, Page Up/Down via native range semantics.
- `aria-invalid` applied when `error` is truthy.

#### Stability Level
Alpha

---

### TagsInput

#### Summary
Free-form chip/token input for collecting multiple string values.

#### Source
`src/components/core/TagsInput.tsx`

#### Props and Inputs
- `value: string[]`
- `onChange: (tags: string[]) => void`
- `placeholder?: string`
- `maxTags?: number`
- `allowDuplicates?: boolean` (default: false)
- `disabled?: boolean`
- `error?: boolean | string`
- `separator?: string[]` (default: `['Enter', ',']`)

#### Behavior
- Enter or comma commits current input as a new tag.
- Backspace on empty input removes the last tag.
- Chip × button removes individual tags.
- `maxTags` hides the input when reached.
- Duplicate prevention opt-out via `allowDuplicates`.
- `role="group"` on wrapper with `aria-label` support.

#### Stability Level
Alpha

---

### Sparkline

#### Summary
Minimal inline SVG trend line for tables, cards, and KPI displays.

#### Source
`src/components/core/Sparkline.tsx`

#### Props and Inputs
- `data: number[]`
- `width?: number` (default: 80)
- `height?: number` (default: 32)
- `color?: string` (default: `var(--color-primary)`)
- `fillColor?: string` — optional area fill
- `strokeWidth?: number` (default: 1.5)

#### Behavior
- Pure SVG polyline from normalized data values.
- No axes, labels, or tooltips — intentionally minimal.
- Optional filled area polygon below the line.
- `aria-hidden="true"` by default; consumer adds `aria-label` for meaningful contexts.
- No external chart library dependency.

#### Stability Level
Alpha

---

### KPICard

#### Summary
Pre-composed metric card for dashboard displays.

#### Source
`src/components/core/KPICard.tsx`

#### Props and Inputs
- `title: string`
- `value: React.ReactNode`
- `delta?: number`
- `deltaLabel?: string`
- `trend?: 'up' | 'down' | 'neutral'`
- `sparkline?: React.ReactNode`
- `footer?: React.ReactNode`
- `loading?: boolean`

#### Behavior
- Renders metric value with prominent typography.
- Delta colored: `--color-success` (up), `--color-error` (down), `--muted` (neutral).
- Trend arrows are `aria-hidden`; screen readers read the numeric value directly.
- `loading=true` replaces value and delta with `SkeletonLoader` placeholders.
- Sparkline and footer are optional composition slots.

#### Stability Level
Alpha

---

### VirtualList

#### Summary
Windowed/virtualized list renderer for large datasets without external dependencies.

#### Source
`src/components/core/VirtualList.tsx`

#### Props and Inputs
- `items: T[]`
- `itemHeight: number` — fixed row height in pixels (required for scroll math)
- `renderItem: (item: T, index: number) => React.ReactNode`
- `height: number` — container viewport height in pixels
- `overscan?: number` (default: 3)
- `getItemKey?: (item: T, index: number) => string | number`

#### Behavior
- Only mounts the visible window + overscan items.
- Uses `onScroll` to recalculate visible range.
- Full-height spacer `div` maintains correct scrollbar height.
- `role="list"` on container, `role="listitem"` on each row wrapper.
- No IntersectionObserver or virtualization library required.

#### Stability Level
Alpha

---

### ConfirmationDialog

#### Summary
Pre-composed confirm/cancel modal for destructive and important actions.

#### Source
`src/components/core/ConfirmationDialog.tsx`

#### Props and Inputs
- `open: boolean`
- `title?: string` (default: `'Are you sure?'`)
- `message: React.ReactNode`
- `confirmLabel?: string` (default: `'Confirm'`)
- `cancelLabel?: string` (default: `'Cancel'`)
- `variant?: 'default' | 'danger'` (default: `'default'`)
- `loading?: boolean`
- `onConfirm: () => void`
- `onCancel: () => void`

#### Behavior
- Built on the `Modal` component — inherits focus trap and escape behavior.
- `variant="danger"` renders confirm button with `.rf-btn--danger` styling.
- `loading=true` shows `Spinner` inside confirm button and disables both buttons.
- Focus lands on cancel button by default — safer default for destructive dialogs.
- Backdrop/escape close is disabled during `loading`.

#### Stability Level
Alpha

---

### KanbanBoard

#### Summary
Drag-and-drop columnar workflow board with keyboard fallback and WIP limit support.

#### Source
`src/components/core/KanbanBoard.tsx`

#### Props and Inputs
- `columns: KanbanColumn[]` — each with `id`, `title`, `cards[]`, optional `wipLimit`, `addCardLabel`
- `onCardMove?: (cardId, fromColumnId, toColumnId, newIndex) => void`
- `onAddCard?: (columnId) => void`
- `onCardClick?: (card, columnId) => void`
- `renderCard?: (card, columnId) => React.ReactNode` — full custom card renderer

#### Behavior
- HTML5 `draggable` API for pointer drag-and-drop.
- Keyboard fallback: "Move card" button opens in-page dialog with column/position selects.
- `onCardMove` fires with sorted parameters after drop or keyboard move.
- `wipLimit` shows a WIP warning indicator when card count exceeds the limit.
- `onAddCard` renders an "Add card" button at column bottom.
- Each column is `role="list"`; each card is `role="listitem"` with `aria-grabbed`.
- Columns scroll horizontally; stacks vertically on narrow viewports.

#### Stability Level
Alpha

---

## Sprint C8 Additions (Batch 1, Public Alpha, 2026-03-15)

### BarChart

#### Summary
Lightweight token-driven SVG bar chart for dashboards and summaries.

#### Source
`src/components/core/BarChart.tsx`

#### Props and Inputs
- `data: { label: string; value: number }[]`
- `width?: number`
- `height?: number`
- `barColor?: string`
- `showValues?: boolean`
- `ariaLabel?: string`

#### Behavior
- Renders one bar per datum with label and optional value text.
- Uses pure SVG with no charting dependency.
- Exposes `role="img"` and label for accessibility.

#### Stability Level
Alpha

---

### LineChart

#### Summary
Minimal SVG line chart for trends and time-series snapshots.

#### Source
`src/components/core/LineChart.tsx`

#### Props and Inputs
- `data: { label: string; value: number }[]`
- `width?: number`
- `height?: number`
- `lineColor?: string`
- `strokeWidth?: number`
- `showPoints?: boolean`
- `ariaLabel?: string`

#### Behavior
- Normalizes values and renders a deterministic polyline.
- Optional point markers and bottom labels.
- Uses pure SVG and tokenized styling.

#### Stability Level
Alpha

---

### RatingInput

#### Summary
Star-style rating input with pointer and keyboard support.

#### Source
`src/components/core/RatingInput.tsx`

#### Props and Inputs
- `value?: number`
- `defaultValue?: number`
- `max?: number`
- `allowClear?: boolean`
- `disabled?: boolean`
- `readOnly?: boolean`
- `label?: string`
- `onChange?: (value: number) => void`

#### Behavior
- Supports controlled and uncontrolled usage.
- Arrow/Home/End keys adjust rating.
- Clicking selected star can clear when `allowClear=true`.

#### Stability Level
Alpha

---

### PinInput

#### Summary
Segmented OTP/PIN input with auto-advance and completion callback.

#### Source
`src/components/core/PinInput.tsx`

#### Props and Inputs
- `length?: number`
- `value?: string`
- `defaultValue?: string`
- `numericOnly?: boolean`
- `mask?: boolean`
- `autoFocus?: boolean`
- `disabled?: boolean`
- `onChange?: (value: string) => void`
- `onComplete?: (value: string) => void`

#### Behavior
- One-character segmented cells.
- Auto-focuses next cell on entry.
- Supports paste normalization and `onComplete` when full.

#### Stability Level
Alpha

---

### MaskedInput

#### Summary
Safe mask-driven text input for phone/card/date style formats.

#### Source
`src/components/core/MaskedInput.tsx`

#### Props and Inputs
- `mask: string`
- `value?: string`
- `defaultValue?: string`
- `placeholderChar?: string`
- `onChange?: (value: string) => void`

#### Behavior
- Supports tokenized masks: `#` digit, `A` letter, `*` alphanumeric.
- Static mask characters are preserved automatically.
- Avoids arbitrary regex execution from user input.

#### Stability Level
Alpha

---

### Sticky

#### Summary
Declarative sticky wrapper for scroll-attached content.

#### Source
`src/components/core/Sticky.tsx`

#### Props and Inputs
- `as?: keyof JSX.IntrinsicElements`
- `top?: string` (default: `var(--header-height, 0px)`)
- `zIndex?: number`

#### Behavior
- Applies sticky positioning via props while preserving native semantics.
- Respects token-driven header offset through default `top`.

#### Stability Level
Alpha

---

### DataExporter

#### Summary
CSV/JSON export utility with column selection controls.

#### Source
`src/components/core/DataExporter.tsx`

#### Props and Inputs
- `rows: Record<string, unknown>[]`
- `columns?: { key: string; label: string }[]`
- `defaultFormat?: 'csv' | 'json'`
- `filename?: string`
- `onExport?: ({ format, content, filename }) => void`

#### Behavior
- Auto-derives columns when none are provided.
- Allows toggling selected columns before export.
- Emits export payload and triggers browser download.

#### Stability Level
Alpha

---

### CodeBlock

#### Summary
Accessible code viewer with copy action and optional line numbers.

#### Source
`src/components/core/CodeBlock.tsx`

#### Props and Inputs
- `code: string`
- `language?: string`
- `showLineNumbers?: boolean`
- `onCopy?: (code: string) => void`

#### Behavior
- Renders stable preformatted lines.
- Copy button uses clipboard API when available.
- Designed without external syntax-highlighting dependency.

#### Stability Level
Alpha

---

### JsonViewer

#### Summary
Collapsible JSON inspector with expandable object/array nodes.

#### Source
`src/components/core/JsonViewer.tsx`

#### Props and Inputs
- `value: unknown`
- `expandedDepth?: number`
- `searchQuery?: string`

#### Behavior
- Tree rendering for nested arrays/objects.
- Per-node expand/collapse toggles.
- Optional path-based search filtering.

#### Stability Level
Alpha

---

### PermissionGate

#### Summary
Declarative role/permission guard for conditional rendering.

#### Source
`src/components/core/PermissionGate.tsx`

#### Props and Inputs
- `permissions?: string[]`
- `roles?: string[]`
- `userPermissions?: string[]`
- `userRoles?: string[]`
- `mode?: 'all' | 'any'`
- `fallback?: React.ReactNode`

#### Behavior
- Renders children only when policy checks pass.
- Supports all-match and any-match evaluation modes.
- Gracefully renders fallback when access is denied.

#### Stability Level
Alpha

---

## Sprint C8 Additions (Batch 2, Public Alpha, 2026-03-15)

### HeatMap

#### Summary
Color-intensity grid component for activity and density visualization.

#### Source
`src/components/core/HeatMap.tsx`

#### Props and Inputs
- `data: number[][]`
- `cellSize?: number`
- `gap?: number`
- `ariaLabel?: string`

#### Behavior
- Renders matrix values as intensity-scaled cells.
- Uses semantic `role="grid"` and per-cell labels.

#### Stability Level
Alpha

---

### ColorPicker

#### Summary
Token-friendly color picker with swatches, native color input, and hex field.

#### Source
`src/components/core/ColorPicker.tsx`

#### Props and Inputs
- `value?: string`
- `defaultValue?: string`
- `swatches?: string[]`
- `disabled?: boolean`
- `onChange?: (value: string) => void`

#### Behavior
- Swatch selection and native color input update the same hex value.
- Hex input accepts normalized 6-digit hex colors.

#### Stability Level
Alpha

---

### SignaturePad

#### Summary
Canvas-based draw/clear signature capture with data URL output.

#### Source
`src/components/core/SignaturePad.tsx`

#### Props and Inputs
- `width?: number`
- `height?: number`
- `disabled?: boolean`
- `onChange?: (dataUrl: string) => void`
- `clearLabel?: string`

#### Behavior
- Pointer drawing updates canvas strokes.
- Clear action resets canvas and emits updated signature payload.

#### Stability Level
Alpha

---

### AppShell

#### Summary
Composed layout shell with typed slot components for page structure.

#### Source
`src/components/core/AppShell.tsx`

#### Props and Inputs
- `AppShell`
- `AppShell.Header`
- `AppShell.Sidebar`
- `AppShell.Content`
- `AppShell.Footer`

#### Behavior
- Grid-based shell composition for app-level layout.
- Responsive fallback stacks sidebar/content on narrow widths.

#### Stability Level
Alpha

---

### DragAndDropList

#### Summary
Reorderable list with pointer drag/drop and keyboard-friendly controls.

#### Source
`src/components/core/DragAndDropList.tsx`

#### Props and Inputs
- `items: T[]`
- `renderItem: (item: T, index: number) => React.ReactNode`
- `getItemId: (item: T, index: number) => string`
- `onReorder?: (items: T[]) => void`

#### Behavior
- Supports drag/drop reordering via HTML5 draggable API.
- Includes Up/Down button controls for deterministic reorder.

#### Stability Level
Alpha

---

### MfaChallenge

#### Summary
MFA OTP challenge primitive with countdown and resend actions.

#### Source
`src/components/core/MfaChallenge.tsx`

#### Props and Inputs
- `length?: number`
- `expiresInSeconds?: number`
- `resendLabel?: string`
- `verifyLabel?: string`
- `onSubmit: (code: string) => void`
- `onResend?: () => void`

#### Behavior
- Uses `PinInput` for segmented code entry.
- Verify enabled only when code length is complete.
- Resend action is gated by cooldown timer.

#### Stability Level
Alpha

---

## Sprint C8 Additions (Batch 3, Public Alpha, 2026-03-15)

### TourSpotlight

#### Summary
Step-by-step onboarding overlay with optional target spotlight highlighting.

#### Source
`src/components/core/TourSpotlight.tsx`

#### Props and Inputs
- `open: boolean`
- `steps: TourStep[]`
- `currentStep?: number`
- `onStepChange?: (index: number) => void`
- `onClose: () => void`

#### Behavior
- Portal-based overlay with skip/back/next controls.
- Supports optional spotlight rectangle from `targetSelector`.
- Escape closes tour.

#### Stability Level
Alpha

---

### LightBox

#### Summary
Full-screen media viewer with keyboard and button navigation.

#### Source
`src/components/core/LightBox.tsx`

#### Props and Inputs
- `open: boolean`
- `items: LightBoxItem[]`
- `initialIndex?: number`
- `onClose: () => void`
- `onIndexChange?: (index: number) => void`

#### Behavior
- Renders image and caption in portal dialog.
- Arrow keys and navigation controls switch items.
- Escape closes the viewer.

#### Stability Level
Alpha

---

### BottomSheet

#### Summary
Mobile-style bottom sheet overlay with backdrop dismissal.

#### Source
`src/components/core/BottomSheet.tsx`

#### Props and Inputs
- `open: boolean`
- `title?: React.ReactNode`
- `children: React.ReactNode`
- `onClose: () => void`
- `closeOnBackdropClick?: boolean`

#### Behavior
- Anchors to viewport bottom via portal.
- Supports escape and optional backdrop-close behavior.

#### Stability Level
Alpha

---

### Carousel

#### Summary
Swipe-style content carousel with arrows and pagination dots.

#### Source
`src/components/core/Carousel.tsx`

#### Props and Inputs
- `children: React.ReactNode[]`
- `initialIndex?: number`
- `onIndexChange?: (index: number) => void`

#### Behavior
- Slide track uses translateX transform.
- Prev/next and dot controls manage active slide.

#### Stability Level
Alpha

---

### ChatThread

#### Summary
Conversation thread component with avatar, metadata, and receipts.

#### Source
`src/components/core/ChatThread.tsx`

#### Props and Inputs
- `messages: ChatMessage[]`
- `currentUser?: string`

#### Behavior
- Own messages can be visually aligned separately.
- Message meta includes author and timestamp.
- Optional read/sent receipt text.

#### Stability Level
Alpha

---

### CommentBox

#### Summary
Comment input box with mention suggestions and submit action.

#### Source
`src/components/core/CommentBox.tsx`

#### Props and Inputs
- `value?: string`
- `defaultValue?: string`
- `placeholder?: string`
- `mentionSuggestions?: string[]`
- `onSubmit?: (value: string) => void`

#### Behavior
- `@` mention query displays filtered suggestions.
- Submit emits trimmed comment payload.

#### Stability Level
Alpha

---

### LogViewer

#### Summary
Streaming-style log panel with level filter and ANSI cleanup.

#### Source
`src/components/core/LogViewer.tsx`

#### Props and Inputs
- `entries: LogEntry[]`
- `levelFilter?: 'all' | LogLevel`
- `autoScroll?: boolean`

#### Behavior
- Renders log lines in fixed-height scroll region.
- Optional level filtering and per-level color accents.
- Strips ANSI color escape sequences from message text.

#### Stability Level
Alpha

---

## Sprint C8 Additions (Batch 4, Public Alpha, 2026-03-15)

### DockLayout

#### Summary
Multi-panel workspace layout with dock regions and collapsible panels.

#### Source
`src/components/core/DockLayout.tsx`

#### Props and Inputs
- `panels: DockPanel[]`
- `className?: string`

#### Behavior
- Supports left, right, center, and bottom dock regions.
- Per-panel collapse/expand action when `collapsible` is enabled.

#### Stability Level
Alpha

---

### GanttChart

#### Summary
Timeline chart for task spans and progress visualization.

#### Source
`src/components/core/GanttChart.tsx`

#### Props and Inputs
- `tasks: GanttTask[]`
- `min?: number`
- `max?: number`
- `zoom?: number`

#### Behavior
- Maps task start/end values to relative timeline bars.
- Optional progress fill per task.

#### Stability Level
Alpha

---

### PivotTable

#### Summary
Cross-tabulation table with row groups, column groups, and aggregated cells.

#### Source
`src/components/core/PivotTable.tsx`

#### Props and Inputs
- `data: PivotRow[]`
- `rowField: string`
- `columnField: string`
- `valueField: string`
- `aggregator?: 'sum' | 'count'`

#### Behavior
- Builds row/column groups from raw records.
- Aggregates values by `sum` or `count` policy.

#### Stability Level
Alpha

## Sprint C9 Additions (Public Alpha, 2026-03-15)

### Data and Workflow Core
- `DataGridPro` (`src/components/core/DataGridPro.tsx`): pinned columns, resize, reorder, virtual row windowing, inline edit, CSV copy.
- `QueryBuilder` (`src/components/core/QueryBuilder.tsx`): nested filter groups with operator-aware editors.
- `RuleBuilder` (`src/components/core/RuleBuilder.tsx`): business rule authoring with if/then structure and validation hints.
- `WorkflowStepper` (`src/components/core/WorkflowStepper.tsx`): resumable multi-step workflow with guarded transitions.
- `SchedulerTimeline` (`src/components/core/SchedulerTimeline.tsx`): resource timeline with pointer drag and keyboard nudge support.

### Authoring and Collaboration
- `RichTextEditor` (`src/components/core/RichTextEditor.tsx`): constrained formatting wrapper around rich text foundations with sanitization path.
- `InlineCommentThreads` (`src/components/core/InlineCommentThreads.tsx`): anchor-based threaded comments for forms/content surfaces.
- `PresenceAvatars` (`src/components/core/PresenceAvatars.tsx`): active user avatar stack with overflow summary.
- `ActivityFeed` (`src/components/core/ActivityFeed.tsx`): normalized activity cards with actor/type filtering.
- `DiffViewer` (`src/components/core/DiffViewer.tsx`): side-by-side line comparison for before/after content.

### Power User Shell
- `GlobalSearchPanel` (`src/components/core/GlobalSearchPanel.tsx`): grouped cross-entity search results panel.
- `SplitViewWorkbench` (`src/components/core/SplitViewWorkbench.tsx`): persistent adjustable split-pane work surface.
- `InspectorPanel` (`src/components/core/InspectorPanel.tsx`): contextual side panel with section slots.
- `KeyboardShortcutManager` (`src/components/core/KeyboardShortcutManager.tsx`): shortcut registration with optional cheat-sheet view.
- `CommandPalette` remains available from earlier waves and is reused in C9 shell composition.

### Governance and Security UX
- `AuditTrailViewer` (`src/components/core/AuditTrailViewer.tsx`): immutable-first audit event timeline and filter surface.
- `PolicyEditor` (`src/components/core/PolicyEditor.tsx`): role/permission policy composition table.
- `FieldLevelPermissionMatrix` (`src/components/core/FieldLevelPermissionMatrix.tsx`): role x field permission matrix with optional inheritance metadata.
- `DataClassificationBadgeSet` (`src/components/core/DataClassificationBadgeSet.tsx`): sensitivity labeling badges (`public`, `internal`, `confidential`, `pii`).
- `ApprovalGate` (`src/components/core/ApprovalGate.tsx`): staged approval checkpoints with notes.

## Sprint C10-C11 Implemented Chart Capabilities

Status: C10 baseline and C11 variant contracts implemented

### PieChart (C10-C11 Implemented)
- Implemented source: `src/components/core/PieChart.tsx`
- Implemented variants: basic, labeled, grouped-small-slices, drilldown, comparison.
- Implemented API: `variant`, `groupSmallSlicesThreshold`, `comparisonData`, `onSliceSelect`, `showPercentages`.
- Governance coverage: deterministic total-to-angle mapping, token-first legend/label styling, keyboard/aria support for drilldown selection.

### DonutChart (C10-C11 Implemented)
- Implemented source: `src/components/core/DonutChart.tsx`
- Implemented variants: basic, KPI center, multi-ring, threshold, interactive focus.
- Implemented API: `variant`, `centerValue`, `rings`, `thresholds`, `activeSliceId`, `onSliceFocus`.
- Governance coverage: deterministic ring geometry, stable center content, keyboard/screen-reader focus semantics.

### AreaChart (C10-C11 Implemented)
- Implemented source: `src/components/core/AreaChart.tsx`
- Implemented variants: single-series, multi-series, stacked, percent-stacked, range-band.
- Implemented API: `variant`, `series`, `stackMode`, `rangeSeries`, `showMedianLine`.
- Governance coverage: deterministic x-domain mapping, stack normalization, and range-band rendering.

### ScatterChart (C10-C11 Implemented)
- Implemented source: `src/components/core/ScatterChart.tsx`
- Implemented variants: basic, categorized, regression, quadrant, density.
- Implemented API: `variant`, `groups`, `trendline`, `quadrants`, `densityMode`, `opacityScale`.
- Governance coverage: deterministic point mapping, stable trendline/quadrant overlays, and density readability strategy.

### StackedBarChart (C10-C11 Implemented)
- Implemented source: `src/components/core/StackedBarChart.tsx`
- Implemented variants: vertical stacked, horizontal stacked, 100% stacked, grouped+stacked, diverging.
- Implemented API: `orientation`, `variant`, `groupField`, `divergingBaseline`, `stackMode`.
- Governance coverage: deterministic segment sizing across orientations and stack modes with consistent legend mapping.

### RadarChart (C10-C11 Implemented)
- Implemented source: `src/components/core/RadarChart.tsx`
- Implemented variants: single-series, multi-series, filled, threshold, delta.
- Implemented API: `variant`, `benchmarkSeries`, `deltaBaseline`, `fillMode`, `seriesOpacity`.
- Governance coverage: deterministic axis normalization plus threshold and delta overlays.

### BubbleChart (C10-C11 Implemented)
- Implemented source: `src/components/core/BubbleChart.tsx`
- Implemented variants: basic, categorized, timeline, packed, annotated.
- Implemented API: `variant`, `groups`, `timeStep`, `packingMode`, `annotations`, `labelStrategy`.
- Governance coverage: deterministic radius/position mapping and annotation-friendly labeling.

### Stability Level
Public Alpha (implemented)

### Planned Validation Gates
- Variant implementations must satisfy token-first styling and pass style audit.
- Variant behaviors must include deterministic rendering assertions.
- Interactive modes must include keyboard/focus and `ariaLabel` coverage.
- C11 exports and docs must be updated together (`src/index.ts`, sprint tracker, and traceability docs).

## References
- `src/components/MainNav.tsx`
- `src/components/PreferencesMenu.tsx`
- `src/components/LayoutSwitcher.tsx`
- `src/components/ThemeSwitcher.tsx`
- `src/components/core/Alert.tsx`
- `src/components/core/Spinner.tsx`
- `src/components/core/EmptyState.tsx`
- `src/components/core/ErrorState.tsx`
- `src/components/core/Badge.tsx`
- `src/components/core/AsyncAutocomplete.tsx`
- `src/components/core/FormWizard.tsx`
- `src/components/core/InlineEditable.tsx`
- `src/components/core/SplitLayout.tsx`
- `src/components/core/CalendarScheduler.tsx`
- `src/components/core/SliderInput.tsx`
- `src/components/core/TagsInput.tsx`
- `src/components/core/Sparkline.tsx`
- `src/components/core/KPICard.tsx`
- `src/components/core/VirtualList.tsx`
- `src/components/core/ConfirmationDialog.tsx`
- `src/components/core/KanbanBoard.tsx`
- `src/components/core/BarChart.tsx`
- `src/components/core/LineChart.tsx`
- `src/components/core/RatingInput.tsx`
- `src/components/core/PinInput.tsx`
- `src/components/core/MaskedInput.tsx`
- `src/components/core/Sticky.tsx`
- `src/components/core/DataExporter.tsx`
- `src/components/core/CodeBlock.tsx`
- `src/components/core/JsonViewer.tsx`
- `src/components/core/PermissionGate.tsx`
- `src/components/core/HeatMap.tsx`
- `src/components/core/ColorPicker.tsx`
- `src/components/core/SignaturePad.tsx`
- `src/components/core/AppShell.tsx`
- `src/components/core/DragAndDropList.tsx`
- `src/components/core/MfaChallenge.tsx`
- `src/components/core/TourSpotlight.tsx`
- `src/components/core/LightBox.tsx`
- `src/components/core/BottomSheet.tsx`
- `src/components/core/Carousel.tsx`
- `src/components/core/ChatThread.tsx`
- `src/components/core/CommentBox.tsx`
- `src/components/core/LogViewer.tsx`
- `src/components/core/DockLayout.tsx`
- `src/components/core/GanttChart.tsx`
- `src/components/core/PivotTable.tsx`
- `src/components/core/DataGridPro.tsx`
- `src/components/core/QueryBuilder.tsx`
- `src/components/core/RuleBuilder.tsx`
- `src/components/core/WorkflowStepper.tsx`
- `src/components/core/SchedulerTimeline.tsx`
- `src/components/core/RichTextEditor.tsx`
- `src/components/core/InlineCommentThreads.tsx`
- `src/components/core/PresenceAvatars.tsx`
- `src/components/core/ActivityFeed.tsx`
- `src/components/core/DiffViewer.tsx`
- `src/components/core/GlobalSearchPanel.tsx`
- `src/components/core/SplitViewWorkbench.tsx`
- `src/components/core/InspectorPanel.tsx`
- `src/components/core/KeyboardShortcutManager.tsx`
- `src/components/core/AuditTrailViewer.tsx`
- `src/components/core/PolicyEditor.tsx`
- `src/components/core/FieldLevelPermissionMatrix.tsx`
- `src/components/core/DataClassificationBadgeSet.tsx`
- `src/components/core/ApprovalGate.tsx`
- `src/forms/renderer.tsx`
- `src/forms/context.tsx`
- `src/forms/bootstrap.ts`
- `src/framework/layouts.tsx`
- `src/index.ts`
- `FORM_ENGINE.md`
