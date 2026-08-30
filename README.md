# ts-lib-core

A small, fast, **end-to-end type-safe** data-query and Cartesian test-matrix library for TypeScript.

- 🔍 Query nested data fluently — `resolve(data).filter(...).get(...)`
- 🧠 Fully inferred types — return types derived from your paths
- 🧪 Test matrices built in — `combinations()` + `concat()` with Playwright-style tags
- 📦 Dual ESM + CJS, zero dependencies, Node ≥ 18

## Installation

```bash
npm install ts-lib-core
```

Works out of the box with **ESM** (`import`) and **CommonJS** (`require`). Ships TypeScript declarations.

```ts
import { resolve, combinations, concat } from "ts-lib-core";
// or: const { resolve } = require("ts-lib-core");
```

## Quick Start

All examples in this README use this data:

```ts
import { resolve } from "ts-lib-core";

const users = [
  { name: "John",  role: "admin", age: 30, profile: { city: "Hyderabad" } },
  { name: "Shan",  role: "user",  age: 35, profile: { city: "Bengaluru" } },
  { name: "Alice", role: "admin", age: 28, profile: { city: "Hyderabad" } },
];

const teams = [
  {
    name: "platform",
    members: [
      { name: "John",  role: "admin", roles: ["admin", "reviewer"], profile: { city: "Hyderabad" } },
      { name: "Shan",  role: "user",  roles: ["developer"],         profile: { city: "Bengaluru" } },
    ],
  },
  {
    name: "mobile",
    members: [
      { name: "Alice", role: "admin", roles: ["admin"], profile: { city: "Pune" } },
    ],
  },
];
```

```ts
// Extract — nested paths included
resolve(users).get("name");          // ["John", "Shan", "Alice"]        (string[])
resolve(users).get("profile.city");  // ["Hyderabad", "Bengaluru", ...]  (string[])

// Narrow — filters chain
resolve(users).filter("role=admin").filter("age>=30").get("name");
// ["John"]  (string[])

// Select one item
resolve(users).filter("role=admin").at(0).get("name");
// "John"  (string | undefined)

// Aggregate
resolve(users).sum("age");   // 93  (number)
resolve(users).avg("age");   // 31  (number)
resolve(users).min("age");   // 28  (number | undefined)
resolve(users).max("age");   // 35  (number | undefined)
resolve(users).count();      // 3   (number)

// Inspect
resolve(users).some("role=admin");   // true
resolve(users).every("age>=18");     // true
resolve(users).none("role=guest");   // true

// Deduplicate & group
resolve(users).unique("profile.city");
// ["Hyderabad", "Bengaluru"]  (string[])

resolve(users).groupBy("role");
// {
//   admin: [{ name: "John", ... }, { name: "Alice", ... }],
//   user:  [{ name: "Shan", ... }]
// }
```

## Mental Model

```text
resolve(data)
   ↓
filter() / at()        → select / narrow          (chainable)
   ↓
get / some / every     → answer a question / extract
none / index / first
groupBy / sum / avg    → aggregate                (terminal)
```

1. **`resolve(data)`** wraps a single object or an array collection.
2. **`filter()`** and **`at()`** are the only chainable methods.
3. **Everything else is terminal** — it returns a native TypeScript value (`string[]`, `number`, `boolean`, `Record`, …) and cannot be chained.

## API Reference

### Entry point

| Signature | Purpose |
| :--- | :--- |
| `resolve(data)` | Wrap a single object or an array collection for querying |

### Chainable methods

| Signature | Purpose |
| :--- | :--- |
| `.filter(matcher)` | Narrow items with the [matcher DSL](#matcher-dsl), e.g. `"role=admin"` |
| `.filter(path, predicate)` | Narrow items with a type-safe callback — see [Predicates](#predicates) |
| `.at(index)` | Select one item by zero-based or negative index (`-1` = last); out-of-range gives `undefined` |

### Terminal methods

| Signature | Purpose | Returns |
| :--- | :--- | :--- |
| `.get(path)` | Extract values at a dot-notated/indexed path | Native inferred type |
| `.sum(path?)` | Sum of numeric values (skips non-numeric; `0` when empty) | `number` |
| `.avg(path?)` | Average of numeric values (skips non-numeric; `0` when empty) | `number` |
| `.min(path?)` | Minimum comparable value | Inferred type \| `undefined` |
| `.max(path?)` | Maximum comparable value | Inferred type \| `undefined` |
| `.unique(path?)` | Deduplicated values, source order preserved | Inferred array type |
| `.count()` | Number of items | `number` |
| `.exists(path)` | `true` if the path exists as a key on any item — even if the value is `null`/`undefined` | `boolean` |
| `.hasValue(path)` | `true` if the path exists **and** has a non-nullish value | `boolean` |
| `.some(matcher)` | `true` if at least one item matches the matcher DSL | `boolean` |
| `.every(matcher)` | `true` if all items match the matcher DSL | `boolean` |
| `.none(matcher)` | `true` if no item matches the matcher DSL | `boolean` |
| `.index(matcher)` | Index of the first matching item in the current collection | `number` |
| `.some(path, predicate)` | Predicate form — see [Predicates](#predicates) | `boolean` |
| `.every(path, predicate)` | Predicate form | `boolean` |
| `.none(path, predicate)` | Predicate form | `boolean` |
| `.index(path, predicate)` | Predicate form | `number` |
| `.groupBy(path)` | Group items by path value — see [Grouping](#grouping--groupby) | Typed `Record` |
| `.first()` | First item, or `undefined` if empty | Item \| `undefined` |
| `.last()` | Last item, or `undefined` if empty | Item \| `undefined` |

### Standalone utilities

| Signature | Purpose | Returns |
| :--- | :--- | :--- |
| `combinations(factors)` | Cartesian product of factor arrays, with `name` + `metadata.tags` | `Combination[]` |
| `concat(...matrices)` | Concatenate multiple combination matrices | `Combination[]` |

## Predicates

`filter()`, `some()`, `none()`, `every()`, and `index()` accept a type-safe `(path, predicate)` pair. One rule explains everything:

> **The path determines what the predicate receives.**

```ts
const team = teams[0]!;

resolve(team).some("members.role", (role) => role === "admin");
// role → "admin" | "user"

resolve(team).some("members", (member) => member.role === "admin");
// member → Member

resolve(team).some("members.roles", (role) => role === "reviewer");
// role → string (array elements tested individually)
```

### `filter(path, predicate)`

```text
teams → members[] → role → predicate(role) → matching member objects
```

```ts
resolve(teams).filter("members.role", (role) => role === "admin");
// [
//   { name: "John",  role: "admin", roles: ["admin", "reviewer"], profile: { city: "Hyderabad" } },
//   { name: "Alice", role: "admin", roles: ["admin"],             profile: { city: "Pune" } }
// ]  (Resolve<Member[]>)
```

> ⚠️ **Note:** Unlike `filter(matcher)` — which keeps collection items — the predicate form keeps the objects associated with path values that satisfy the predicate.

### `index(path, predicate)`

`index(path, predicate)` returns the index of the first item in the **current collection** whose path value matches — never a nested array index:

```ts
const testTeams = [
  { name: "platform", members: [{ name: "John", role: "user" }] },
  { name: "mobile",   members: [{ name: "Alice", role: "admin" }] },
];

resolve(testTeams).index("members.role", (role) => role === "admin");
// 1  ← index of the "mobile" TEAM in teams, NOT Alice's position inside members[]
```

Matcher and predicate forms are independent:

- **Matcher form** (`"role=admin"`) — compares resolved values with the [matcher DSL](#matcher-dsl).
- **Predicate form** (`"role", (v) => ...`) — receives each resolved value, typed by the path, and returns a boolean.

Short-circuit behavior: `some`/`none` stop at the first decisive value; `every` stops at the first failure and returns `true` for empty collections.

## Paths & Arrays

These traversal rules are one set of semantics shared by every path-accepting method — `get()`, `filter(path, predicate)`, `some/none/every/index(path, predicate)`, and `groupBy(path)`. Learn them once here; examples below use `get()` because the result is easiest to see.

```ts
// 1. Leaf array properties flatten
const matrix = { values: [["a", "b"], ["c"]] };
resolve(matrix).get("values");
// ["a", "b", "c"]  (string[])

// 2. Traversing across arrays collects and flattens
const team = { members: [{ name: "John", roles: ["admin", "dev"] }] };
resolve(team).get("members.roles");
// ["admin", "dev"]  (string[])

// 3. Explicit indexing does NOT flatten
const data = { roles: [["admin", "reviewer"], ["user"]] };
resolve(data).get("roles[0]");     // ["admin", "reviewer"]  (string[] | undefined)
resolve(data).get("roles[0][1]");  // "reviewer"             (string | undefined)
resolve(data).get("roles[-1]");    // ["user"]               (string[] | undefined)

// 4. Collections: missing properties contribute no element; explicit undefined/null preserved
resolve([{ name: "John" }, {}]).get("name");  // ["John"]  (string[])
resolve([{ name: undefined }]).get("name");   // [undefined]  ((string | undefined)[])
resolve([{ name: null }]).get("name");        // [null]       ((string | null)[])

// 5. Union objects: path on all members → exact type; on some members → | undefined injected
type Mixed =
  | { user: { name: string } }
  | { user: { name: string }[] };

const mixed: Mixed = { user: { name: "John" } };
resolve(mixed).get("user.name");
// type: string | string[]

type MixedUsers =
  | { users: { name: string } }
  | { users: { name: string }[] };

const mixedUsers: MixedUsers = { users: [{ name: "John" }] };
resolve(mixedUsers).get("users[0].name");
// type: string | undefined
```

## Matcher DSL

Shared by `filter()`, `some()`, `every()`, `none()`, and `index()`.

| Operator | Meaning | Example |
| :---: | :--- | :--- |
| `=` | Equal | `role=admin` |
| `!=` | Not equal | `role!=admin` |
| `~` | Contains | `name~John` |
| `!~` | Doesn't contain | `name!~John` |
| `^` | Starts with | `name^Jo` |
| `$` | Ends with | `name$hn` |
| `>` | Greater than | `age>30` |
| `>=` | Greater or equal | `age>=30` |
| `<` | Less than | `age<30` |
| `<=` | Less or equal | `age<=30` |

### Value coercion

- **Booleans** — `"true"` / `"false"` parse as booleans: `active=true`
- **Numbers** — unquoted numerics parse as numbers: `age>=30`
- **Explicit strings** — quotes prevent coercion: `code="123"`
- **No implicit coercion** — the string `"30"` does **not** match the number `30`

### Negated matchers (`!=`, `!~`)

Positive matchers are **existential** — for array paths, any matching element
is enough. Negated matchers are **universal** — no element may match. This
means items where the path is absent also satisfy negated matchers:

```ts
const accounts = [
  { name: "John",  role: "admin" },
  { name: "Shan",  role: "user" },
  { name: "Ghost" }, // no `role` key
];

resolve(accounts).filter("role!=admin").get("name");
// ["Shan", "Ghost"] — "Ghost" (no `role` key) matches because the path is absent
```

If you need "has a defined value AND the value differs", filter out
missing/undefined values first:

```ts
resolve(accounts)
  .filter("role", (role) => role !== undefined)  // drops items without a defined role
  .filter("role!=admin")
  .get("name");
// ["Shan"]
```

> **Note:** `(role) => role !== undefined` keeps items whose resolved value is not `undefined` — it is **not** a key-existence check. `{ role: undefined }` is excluded, while `exists("role")` would return `true` for it. Use `exists()` / `hasValue()` for presence questions.

## Presence vs Value Checking

`exists()` checks key presence; `hasValue()` checks presence **and** a non-nullish value.

| Data | `exists("x")` | `hasValue("x")` | Why |
| :--- | :---: | :---: | :--- |
| `{}` | `false` | `false` | Key doesn't exist |
| `{ x: undefined }` | `true` | `false` | Key exists, value is `undefined` |
| `{ x: null }` | `true` | `false` | Key exists, value is `null` |
| `{ x: [] }` | `true` | `true` | Empty array is a valid value |
| `{ x: 0 }` | `true` | `true` | Falsy number is valid |
| `{ x: "" }` | `true` | `true` | Empty string is valid |
| `{ x: false }` | `true` | `true` | `false` is valid |

> **Invariant:** `hasValue(path) === true` strictly implies `exists(path) === true`.

## Grouping — `groupBy(path)`

`groupBy(path)` groups the objects that produced each grouping value into a typed dictionary keyed by `String(value)`.

### Basic usage

```ts
resolve(users).groupBy("role");
// {
//   admin: [{ name: "John", role: "admin", age: 30, ... }, { name: "Alice", ... }],
//   user:  [{ name: "Shan", role: "user", age: 35, ... }]
// }
```

### Nested arrays — descendants are grouped, not parents

```ts
resolve(teams).groupBy("members.role");
// {
//   admin: [{ name: "John", role: "admin", ... }, { name: "Alice", role: "admin", ... }],
//   user:  [{ name: "Shan", role: "user", ... }]
// }
```

The **member** objects land in the buckets — the parent team is never duplicated.

### Array-valued properties — items appear in every bucket

```ts
const user = { name: "John", roles: ["admin", "reviewer"] };

resolve([user]).groupBy("roles");
// {
//   admin:    [{ name: "John", roles: ["admin", "reviewer"] }],
//   reviewer: [{ name: "John", roles: ["admin", "reviewer"] }]
// }
```

### GroupBy behavior

| Situation | Result |
| :--- | :--- |
| Missing or `undefined` grouping value | Item grouped under key `"undefined"` |
| `null` grouping value | Item grouped under key `"null"` |
| Numeric key `20` | Stringified to `"20"` |
| Boolean key `true` | Stringified to `"true"` |
| Key collisions after stringification | Buckets merge |
| Literal-union path | Output typed as `Partial<Record<"admin" \| "user", Item[]>>` |

## Aggregations

```ts
resolve(users).sum("age");   // 93  — non-numeric values are skipped; 0 when empty
resolve(users).avg("age");   // 31  — non-numeric values are skipped; 0 when empty
resolve(users).min("age");   // 28  — undefined when no comparable value exists
resolve(users).max("age");   // 35
```

`min`/`max` compare within a single value domain (`number`, `string`, `bigint`, `boolean`).

## Test Matrices

```ts
import { combinations, concat } from "ts-lib-core";

const browserEnvMatrix = combinations({
  browser: ["chromium", "firefox"],
  env: ["local", "ci"],
});

// [
//   {
//     data: { browser: "chromium", env: "local" },
//     name: "chromium - local",
//     metadata: { tags: ["@browser:chromium", "@env:local"] }
//   },
//   ...
// ]

const mobileMatrix = combinations({ device: ["pixel", "iphone"] });
const allTestCases = concat(browserEnvMatrix, mobileMatrix);
```

### Using with Playwright

```ts
for (const { name, data, metadata } of browserEnvMatrix) {
  test(`runs on ${name}`, { tag: metadata.tags }, async ({ page }) => {
    // data.browser, data.env are fully typed
  });
}
```

## License

MIT
