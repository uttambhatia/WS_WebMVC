# Form Engine

## Purpose and Scope

The Form Engine is a generic, schema-driven rendering and validation system built into the framework. It converts a declarative `FormSchema` object into a fully-functional form UI at runtime — with dynamic visibility rules, computed values, staged validation pipelines, async lookups, and dependency-driven invalidation — without any per-field hand-written state.

This document covers:
- Architecture and module responsibilities.
- `FormSchema` and `FormFieldSchema` contract.
- Field types and the default widget map.
- `Condition` operators reference.
- Rule types: `show`, `hide`, `require`, `compute`.
- `RuleEvaluationPolicy` conflict resolution.
- `ValidatorSpec` — stages and async policies.
- `LookupSpec` — dependency-driven async lookups.
- `AsyncPolicy` and `RetryPolicy`.
- Built-in validators.
- `initializeFormEngine` lifecycle.
- `SchemaForm` component API.
- Registering custom validators, widgets, and lookup providers.

Out of scope:
- Framework shell routing, themes, layouts — see `ARCHITECTURE.md`.
- Plugin authoring for the framework registry — see `PLUGIN_GUIDE.md`.

---

## Architecture Overview

The Form Engine lives in `src/forms/` and is composed of six modules:

| Module | Responsibility |
|---|---|
| `schema.ts` | Type contracts, `evaluateCondition` pure function |
| `registry.ts` | Pluggable registries for validators, widgets, lookup providers |
| `defaults.tsx` | Default widget adapters for each built-in field type |
| `bootstrap.ts` | `initializeFormEngine()` — schema validation and diagnostics |
| `context.tsx` | Runtime state — rule evaluation, staged validation, async lookups |
| `renderer.tsx` | `SchemaForm` component — iterates schema fields, renders widgets |

### Data Flow

```
FormSchema (JSON / TypeScript)
        │
initializeFormEngine({ schema, register })
        │  validates structure, builds registry, registers widgets + validators
        ▼
<SchemaForm engine={...} onSubmit={...}>
        │  wraps SchemaFormProvider (runtime state via context)
        ▼
schema.fields.map → <FieldRenderer per field>
        │  evaluates visibility/required rules, picks widget
        ▼
engine.registry.getWidget(field.type)
        │  maps type name → React component
        ▼
<Input> / <Select> / <Toggle> / <AsyncAutocomplete> / etc.
        │  user interacts → setValue → staged validation → onBlur
        ▼
<form onSubmit> → validateForm() → all stages pass → onSubmit(values)
```

---

## FormSchema

The top-level schema object.

```ts
type FormSchema = {
  id: string                        // required; unique identifier used for HTML id prefixes
  title?: string                    // display title rendered by SchemaFormBody
  description?: string              // optional descriptive text
  fields: FormFieldSchema[]         // at least one field required
  rulePolicy?: RuleEvaluationPolicy // conflict resolution policy for rules
}
```

---

## FormFieldSchema

Per-field definition inside `fields[]`.

```ts
type FormFieldSchema = {
  key: string                   // required; unique field identifier; used as values key
  label: string                 // required; rendered as <label>
  type: FormFieldType           // required; see field types table below
  helpText?: string             // rendered below the field
  placeholder?: string          // passed to widget
  required?: boolean            // static required flag (also set dynamically via require rules)
  defaultValue?: unknown        // initial value if not provided in initialValues
  disabled?: boolean            // disables the widget input
  options?: FormOption[]        // static option list for select / checkbox groups
  widget?: string               // override widget name (defaults to field.type)
  validators?: ValidatorSpec[]  // validation rules; see Validators section
  rules?: FieldRule[]           // dynamic visibility / compute rules; see Rules section
  lookup?: LookupSpec           // async option loading; see Lookups section
}
```

### Field Types

| `type` | Default widget | Notes |
|---|---|---|
| `text` | `<Input type="text">` | |
| `email` | `<Input type="email">` | |
| `password` | `<Input type="password">` | |
| `number` | `<Input type="number">` | Parsed to number on change |
| `textarea` | `<Textarea>` | |
| `select` | `<Select>` | Uses `options[]` |
| `checkbox` | `<Checkbox>` | Boolean value |
| `toggle` | `<Toggle>` | Boolean value |
| `async-select` | `<AsyncAutocomplete>` | Requires `lookup` spec |

---

## Conditions

Conditions are used inside rules (show/hide/require/compute) and validator `dependsOn`-triggered evaluations.

```ts
type Condition = {
  field?: string         // field key to read from current values
  ref?: string           // alias for field
  value?: unknown        // exact match (uses Object.is)
  eq?: unknown           // same as value — eq alias for readability
  neq?: unknown          // not-equal
  in?: unknown[]         // value is one of the list
  notIn?: unknown[]      // value is none of the list
  gt?: number            // greater than
  gte?: number           // greater than or equal
  lt?: number            // less than
  lte?: number           // less than or equal
  truthy?: boolean       // Boolean(field) === truthy
  falsy?: boolean        // !Boolean(field) === falsy
  exists?: boolean       // field !== null && field !== undefined
  empty?: boolean        // null, undefined, '', [], trim('')
  notEmpty?: boolean     // inverse of empty
  contains?: string      // string includes substring (case-sensitive)
  startsWith?: string    // string starts with prefix
  endsWith?: string      // string ends with suffix
  matches?: string       // string matches regex pattern
  includesAll?: unknown[]  // array contains all listed values
  includesAny?: unknown[]  // array contains at least one listed value
  includesNone?: unknown[] // array contains none of the listed values
  lengthEq?: number      // string or array length === n
  lengthGte?: number     // string or array length >= n
  lengthLte?: number     // string or array length <= n
  and?: Condition[]      // all sub-conditions must pass
  or?: Condition[]       // at least one sub-condition must pass
  xor?: Condition[]      // exactly one sub-condition must pass
  not?: Condition        // inverts the sub-condition
}
```

### Condition Examples

```ts
// Field equals a value
{ field: 'environment', eq: 'prod' }

// Field is one of several values
{ field: 'tier', in: ['gold', 'platinum'] }

// String contains a substring
{ field: 'name', contains: 'PROD-' }

// Composite: all required
{ and: [
    { field: 'env', eq: 'prod' },
    { field: 'approvalRequired', truthy: true }
  ]
}

// Exactly one of two flags set
{ xor: [
    { field: 'flagA', truthy: true },
    { field: 'flagB', truthy: true }
  ]
}
```

---

## Rules

Rules are declared on `FormFieldSchema.rules[]`. They evaluate conditions against current form values and alter field state dynamically.

### show

```ts
type ShowRule = { kind: 'show'; when: Condition }
```

Makes the field visible when `when` evaluates to `true`. Field is hidden by default if any `show` rules are registered.

### hide

```ts
type HideRule = { kind: 'hide'; when: Condition }
```

Hides the field when `when` evaluates to `true`.

### require

```ts
type RequireRule = { kind: 'require'; when: Condition }
```

Marks the field required when `when` evaluates to `true`. The `required` built-in validator is run automatically.

### compute

```ts
type ComputeRule = {
  kind: 'compute'
  when?: Condition        // only applies when condition passes (omit for unconditional)
  value?: unknown         // static value to assign
  fromField?: string      // copy value from another field
}
```

Sets the field's value automatically. The computed value is re-evaluated on every render cycle up to 10 fixpoint passes.

**Example:**

```ts
{
  key: 'maxTokens',
  type: 'number',
  rules: [
    {
      kind: 'compute',
      when: { field: 'model', eq: 'gpt-5.3-mini' },
      value: 256,
    },
  ],
}
```

---

## RuleEvaluationPolicy

When multiple rules of the same kind apply to a field simultaneously, `rulePolicy` controls which one wins.

```ts
type RuleEvaluationPolicy = {
  visibility?: 'last-wins' | 'hide-wins' | 'show-wins'
  required?:   'last-wins' | 'require-wins' | 'optional-wins'
  compute?:    'last-wins' | 'first-wins'
}
```

| Policy key | Default | Options |
|---|---|---|
| `visibility` | `last-wins` | `last-wins` — last matching rule wins; `hide-wins` — any hide rule overrides show; `show-wins` — any show rule overrides hide |
| `required` | `last-wins` | `last-wins` — last matching rule wins; `require-wins` — any require rule forces required; `optional-wins` — any optional rule forces optional |
| `compute` | `last-wins` | `last-wins` — last matching compute rule value used; `first-wins` — first matching compute rule value used |

**Example:**

```ts
const schema: FormSchema = {
  id: 'my-form',
  rulePolicy: {
    visibility: 'hide-wins',
    required: 'require-wins',
    compute: 'last-wins',
  },
  fields: [...],
}
```

---

## Validators

Validators are declared in `FormFieldSchema.validators[]` and run in three sequential stages.

```ts
type ValidatorSpec = {
  name: string                      // registered validator name
  args?: Record<string, unknown>    // arguments passed to validator function
  message?: string                  // override default error message
  stage?: 'field' | 'cross-field' | 'async'  // default: 'field'
  dependsOn?: string[]              // re-trigger when named fields change
  asyncPolicy?: AsyncPolicy         // timeout/retry for async stage
}
```

### Validation Stages

| Stage | When it runs | Use case |
|---|---|---|
| `field` | Immediately on blur and on submit | Simple sync checks: required, length, range |
| `cross-field` | When field or any `dependsOn` field changes | Checks that read values from other fields |
| `async` | After cross-field passes; aborted and re-run if dependsOn fields change | Remote validation, dataset checks |

Async validators are abort-aware. When a newer validation is triggered (e.g. by a dependent field change), the previous run is cancelled via `AbortSignal`.

### Built-in Validators

| Name | Args | Description |
|---|---|---|
| `required` | — | Field must have a non-empty value |
| `minLength` | `{ value: number }` | String length ≥ value |
| `maxLength` | `{ value: number }` | String length ≤ value |
| `pattern` | `{ value: string }` | String must match regex pattern |
| `min` | `{ value: number }` | Numeric value ≥ value |
| `max` | `{ value: number }` | Numeric value ≤ value |
| `oneOf` | `{ values: unknown[] }` | Value must be one of the listed values |

### Writing a Custom Validator

```ts
type ValidatorFn = (
  value: unknown,
  args: Record<string, unknown>,
  context: ValidatorContext
) => string | undefined | Promise<string | undefined>

type ValidatorContext = {
  schema: FormSchema
  field: FormFieldSchema
  values: FormValues
  stage: 'field' | 'cross-field' | 'async'
  signal: AbortSignal   // abort when superseded — check before async work
}
```

Return a string error message, or `undefined` for no error.

**Example — cross-field validator:**

```ts
registry.registerValidator('prodPrefix', (value, _args, context) => {
  const name = typeof value === 'string' ? value.trim() : ''
  if (context.values.environment === 'prod' && !name.startsWith('PROD-')) {
    return 'Production scenarios must start with "PROD-".'
  }
  return undefined
})
```

**Example — async abort-aware validator:**

```ts
registry.registerValidator('uniqueName', async (value, _args, context) => {
  await new Promise<void>((resolve, reject) => {
    const id = setTimeout(resolve, 200)
    context.signal.addEventListener('abort', () => {
      clearTimeout(id)
      reject(new DOMException('Aborted', 'AbortError'))
    }, { once: true })
  })

  const taken = await fetch(`/api/check-name?value=${value}`, { signal: context.signal })
    .then((r) => r.json())
  return taken ? 'Name is already taken.' : undefined
})
```

---

## Lookups

Lookup specs drive `async-select` fields. The engine calls the registered provider, passes the current query and dependent field values, and returns `FormOption[]`.

```ts
type LookupSpec = {
  provider: string                    // registered lookup provider name
  dependsOn?: string[]                // re-invalidate when these fields change
  minQueryLength?: number             // minimum chars before first lookup fires
  invalidateOnDependencyChange?: boolean  // clear selected value when dependsOn changes
  asyncPolicy?: AsyncPolicy           // timeout/retry for each lookup call
}
```

When `invalidateOnDependencyChange: true`, changing a `dependsOn` field:
1. Clears the field's current value.
2. Clears any existing validation errors.
3. Aborts any in-flight lookup.
4. Increments the widget reset version (forces `AsyncAutocomplete` to remount).

### Writing a Custom Lookup Provider

```ts
type LookupProvider = (
  query: string,
  context: { field: FormFieldSchema; values: FormValues; signal: AbortSignal }
) => Promise<FormOption[]>
```

**Example:**

```ts
registry.registerLookupProvider('products.search', async (query, context) => {
  const response = await fetch(
    `/api/products?q=${encodeURIComponent(query)}&category=${context.values.category}`,
    { signal: context.signal }
  )
  const data = await response.json()
  return data.map((item) => ({ label: item.name, value: item.id }))
})
```

---

## AsyncPolicy and RetryPolicy

Async validators and lookup providers accept an `asyncPolicy` for timeout and retry control.

```ts
type AsyncPolicy = {
  timeoutMs?: number   // abort after this many ms; 0 means no timeout
  retry?: RetryPolicy
}

type RetryPolicy = {
  maxAttempts?: number  // total attempts including first; default 1 (no retry)
  backoffMs?: number    // delay between attempts in ms; default 0
}
```

**Example — 3 attempts with 100ms backoff, 2s timeout:**

```ts
asyncPolicy: {
  timeoutMs: 2000,
  retry: {
    maxAttempts: 3,
    backoffMs: 100,
  },
}
```

The retry mechanism:
- Catches non-abort errors and retries up to `maxAttempts` total.
- Does NOT retry on `AbortError` (abort signals propagate immediately).
- Waits `backoffMs` between attempts, abort-aware (abort cancels the backoff wait).

---

## initializeFormEngine

`initializeFormEngine` must be called before rendering. It validates the schema, registers defaults, runs the consumer `register` callback, and returns a result object.

```ts
function initializeFormEngine(config: FormEngineConfig): FormEngineInitializationResult

type FormEngineConfig = {
  schema: FormSchema
  register?: (registry: FormEngineRegistry) => void
}

type FormEngineInitializationResult = {
  success: boolean
  errors: string[]
  warnings: string[]
  engine?: FormEngine   // present when success === true
}
```

### Diagnostics Performed

| Check | Level |
|---|---|
| Schema `id` missing or empty | Error |
| `fields` array empty | Error |
| Duplicate field `key` values | Error |
| Lookup `dependsOn` references a non-existent field | Error |
| Lookup dependency cycle detected (DFS) | Error |
| Validator `dependsOn` references a non-existent field | Warning |
| `asyncPolicy.retry.maxAttempts < 1` | Warning |
| `asyncPolicy.timeoutMs < 0` | Warning |

### Usage Pattern

```tsx
// Compute once — never recreate engine on re-render
const formInit = useMemo(
  () => initializeFormEngine({
    schema: MY_SCHEMA,
    register: (registry) => {
      registry.registerValidator('myValidator', myValidatorFn)
      registry.registerLookupProvider('my.provider', myLookupFn)
    },
  }),
  []
)

if (!formInit.success) {
  return <Alert variant="error">{formInit.errors.join(', ')}</Alert>
}
```

> Always wrap `initializeFormEngine` in `useMemo` with an empty dependency array. Re-creating the engine on every render discards widget and validator registration state.

---

## SchemaForm Component

```tsx
type SchemaFormProps = {
  engine: FormEngine             // from initializeFormEngine result
  initialValues?: FormValues     // pre-populate field values
  className?: string             // additional CSS class on <form>
  submitLabel?: string           // submit button text; default 'Submit'
  disabled?: boolean             // disables all fields and submit button
  onSubmit?: (values: FormValues) => void | Promise<void>
}
```

`onSubmit` is called only after all three validation stages pass. `values` is a `Record<string, unknown>` keyed by field `key`.

**Example:**

```tsx
<SchemaForm
  engine={formInit.engine}
  submitLabel="Save Configuration"
  onSubmit={async (values) => {
    await saveToApi(values)
  }}
/>
```

### useSchemaForm Hook

Access internal form state from within a child component rendered inside `SchemaFormProvider`:

```ts
const {
  values,               // Record<string, unknown> — current field values
  errors,               // Record<string, string> — sync validation errors
  asyncStatusByField,   // Record<string, AsyncFieldStatus> — async validation/lookup state
  visibleByField,       // Record<string, boolean> — rule-evaluated visibility
  requiredByField,      // Record<string, boolean> — rule-evaluated required state
  touched,              // Set<string> — fields that have been blurred
  setValue,             // (key, value) => void
  markTouched,          // (key) => void
  validateField,        // (field) => Promise<boolean>
  validateForm,         // () => Promise<boolean>
  resolveLookupOptions, // (field, query, signal) => Promise<FormOption[]>
} = useSchemaForm()
```

---

## Custom Widgets

Register a custom React component as a widget for a field type or a named `widget` override.

```ts
type FormWidgetProps = {
  id: string
  field: FormFieldSchema
  value: unknown
  error?: string
  required?: boolean
  disabled?: boolean
  describedBy?: string
  values: FormValues
  options: FormOption[]
  loadOptions?: (query: string, context: { signal: AbortSignal }) => Promise<FormOption[]>
  onValueChange: (value: unknown) => void
  onBlur: () => void
}
```

**Example — custom rating widget:**

```tsx
function StarRatingWidget({ id, value, onValueChange, onBlur }: FormWidgetProps) {
  return (
    <div id={id} onBlur={onBlur}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} onClick={() => onValueChange(n)}>
          {n <= (value as number) ? '★' : '☆'}
        </button>
      ))}
    </div>
  )
}

// Register as a named type or widget override
registry.registerWidget('star-rating', StarRatingWidget)
```

Then in schema:

```ts
{ key: 'satisfaction', label: 'Satisfaction', type: 'number', widget: 'star-rating' }
```

---

## Stability

| Export | Level |
|---|---|
| `SchemaForm` | Alpha |
| `SchemaFormProvider`, `useSchemaForm` | Alpha |
| `initializeFormEngine` | Alpha |
| `FormEngineRegistry` | Alpha |
| All `schema.ts` types | Alpha |

Alpha exports are available in production but may have breaking changes before a stable release bump. See `VERSIONING.md`.

---

## File Reference

| File | Purpose |
|---|---|
| `src/forms/schema.ts` | Type contracts, `evaluateCondition`, `isValueEmpty` |
| `src/forms/registry.ts` | `FormEngineRegistry`, `registerDefaultValidators` |
| `src/forms/defaults.tsx` | Default widget adapters, `registerDefaultWidgets` |
| `src/forms/bootstrap.ts` | `initializeFormEngine`, `FormEngine`, diagnostics |
| `src/forms/context.tsx` | `SchemaFormProvider`, `useSchemaForm`, runtime state |
| `src/forms/renderer.tsx` | `SchemaForm`, `SchemaFormBody`, `FieldRenderer` |
