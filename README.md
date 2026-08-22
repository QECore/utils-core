# utils-core

A high-performance, strongly-typed TypeScript utility library providing safe deep data resolution and Cartesian product test combination generation.

```bash
npm install utils-core
```

```ts
import { resolve, combinations, combine } from "utils-core";
```

---

## Features

- **Zero-Friction API**: Import directly from `"utils-core"` with full TypeScript inference and IntelliSense.
- **Deep Path Resolution (`resolve`)**: Safe nested property access, single-level array boundary traversal, indexing, filtering, and aggregations.
- **Strict Type-Safe Predicates**: Compile-time type checking on `equals()`, `notEquals()`, and `contains()`.
- **Cartesian Product Combinations (`combinations`)**: Powerful test-matrix generator with deterministic test case names and Playwright-compatible metadata tags.
- **Multiple Output Combining (`combine`)**: Concatenate independent combination suites without Cartesian re-multiplication.
- **Dual ESM & CommonJS**: Fully packaged for modern ESM (`import`) and Node CommonJS (`require`).
- **Zero Runtime Dependencies**: Lightweight, reliable, and blazing fast.

---

## 1. `resolve`

`resolve` provides a chainable, lazy query engine for deep data structures.

```ts
import { resolve } from "utils-core";

const data = {
  teams: [
    {
      name: "Engineering",
      lead: { role: "admin", name: "Alice" },
      members: [
        { id: 1, name: "John", role: "developer", age: 30 },
        { id: 2, name: "Shan", role: "architect", age: 35 },
      ],
    },
    {
      name: "Product",
      lead: { role: "manager", name: "Bob" },
      members: [
        { id: 3, name: "Charlie", role: "designer", age: 28 },
      ],
    },
  ],
};
```

### Deep Path & Array Traversal

Array boundaries are automatically flattened by one level during property traversal:

```ts
// Returns: [{ id: 1, name: "John", ... }, { id: 2, ... }, { id: 3, ... }]
const allMembers = resolve(data)
  .get("teams.members")
  .values();

// Returns: ["John", "Shan", "Charlie"]
const memberNames = resolve(data)
  .get("teams.members.name")
  .values();
```

### Array Indexing (`at(index)` vs `value(index)`)

- `at(index)` is a **lazy pipeline operation** returning a `Resolve` instance for further chaining.
- `value(index)` is a **terminal operation** returning the resolved value directly.

```ts
// Pipeline operation
resolve(data).get("teams").at(0).get("name").value(); // "Engineering"

// Terminal operation with index
resolve(data).get("teams.members.name").value();  // "John" (defaults to index 0)
resolve(data).get("teams.members.name").value(0); // "John"
resolve(data).get("teams.members.name").value(1); // "Shan"
resolve(data).get("teams.members.name").value(2); // "Charlie"

// Matrix index selection (preserves nested arrays without accidental flattening)
const matrix = [[10, 20], [30, 40]];
resolve(matrix).get("[0]").value(); // [10, 20]
```

### Terminal Value Operations

| Method | Return Type | Description |
| :--- | :--- | :--- |
| `.value(index?)` | `T \| undefined` | Returns the resolved value at `index` (defaults to index `0`) |
| `.first()` | `T \| undefined` | Returns the first resolved value (alias for `.value(0)`) |
| `.last()` | `T \| undefined` | Returns the last resolved value |
| `.values()` | `T[]` | Returns all resolved values as an array |
| `.count()` | `number` | Returns the total number of resolved items |
| `.exists()` | `boolean` | `true` if at least one item was resolved |

### Type-Safe Equality and Predicates

`equals()` and `notEquals()` enforce strict compile-time type safety against the resolved type:

```ts
resolve(data).get("teams[0].members[0].age").equals(30); // Valid

// @ts-expect-error Type mismatch: number vs string
resolve(data).get("teams[0].members[0].age").equals("30");
```

Date comparisons evaluate timestamp equality via `.getTime()`:

```ts
resolve({ date: new Date("2025-01-01") })
  .get("date")
  .equals(new Date("2025-01-01")); // matches
```

### `contains()` Semantics

- **Strings**: Case-insensitive substring matching.
- **Arrays**: Strict element membership (exact match without string conversion).

```ts
// Substring search on strings
resolve("hello world").contains("world"); // ["hello world"]

// Array element membership
resolve(["admin", "user"]).contains("admin"); // ["admin"]
resolve([123, 456]).contains(23);             // []
```

### Filtering with `where()`

Filters collection items by evaluating a path expression formatted as `"path:expected"`. Matching is performed as a case-insensitive substring search against the resolved string value at that path:

```ts
// Filter teams where lead.role contains "admin"
const adminTeams = resolve(data)
  .get("teams")
  .where("lead.role:admin")
  .values();

// Filter teams where any member has role "developer"
const devTeams = resolve(data)
  .get("teams")
  .where("members.role:developer")
  .values();
```

### Homogeneous `sum()`

`sum()` aggregates numbers to `number` or concatenates strings to `string`. Mixed or unsupported types throw a `TypeError`:

```ts
resolve([1, 2, 3]).sum();      // 6
resolve(["a", "b", "c"]).sum(); // "abc"
resolve([]).sum();              // 0

resolve([1, "2"]).sum();        // Throws TypeError (mixed types)
resolve([true]).sum();          // Throws TypeError (unsupported type)
```

---

## 2. `combinations`

`combinations` generates Cartesian products of test options for parameterized testing (e.g. Playwright, Vitest, Jest).

```ts
import { combinations } from "utils-core";

const testCases = combinations({
  browser: ["chromium", "firefox"],
  environment: ["local", "ci"],
});
```

### Result Format

```json
[
  {
    "data": { "browser": "chromium", "environment": "local" },
    "name": "chromium - local",
    "metadata": {
      "tags": ["@browser:chromium", "@environment:local"]
    }
  },
  {
    "data": { "browser": "chromium", "environment": "ci" },
    "name": "chromium - ci",
    "metadata": {
      "tags": ["@browser:chromium", "@environment:ci"]
    }
  },
  {
    "data": { "browser": "firefox", "environment": "local" },
    "name": "firefox - local",
    "metadata": {
      "tags": ["@browser:firefox", "@environment:local"]
    }
  },
  {
    "data": { "browser": "firefox", "environment": "ci" },
    "name": "firefox - ci",
    "metadata": {
      "tags": ["@browser:firefox", "@environment:ci"]
    }
  }
]
```

### Objects Inside Candidate Arrays

Objects inside candidate arrays are treated as discrete candidate **values** (not recursively Cartesian expanded):

```ts
const cases = combinations({
  user: [
    { role: "admin" },
    { role: "user" },
  ],
});

// cases[0].data === { user: { role: "admin" } }
// cases[1].data === { user: { role: "user" } }
```

### Nested Objects & Playwright Tags

Nested objects outside candidate arrays are Cartesian expanded and generate path-based metadata tags:

```ts
const cases = combinations({
  user: {
    role: ["admin", "member"],
    active: true,
  },
  mode: ["standard"],
});

// cases[0].metadata.tags === ["@user.role:admin", "@user.active:true", "@mode:standard"]
```

### Custom `nameSeparator`

```ts
const cases = combinations(
  {
    browser: ["chromium", "firefox"],
    env: ["staging", "prod"],
  },
  { nameSeparator: " | " }
);

// cases[0].name === "chromium | staging"
```

### `combinations.asArray`

Generates combinations where each test case payload is an array:

```ts
const cases = combinations.asArray([
  { browser: ["chromium", "firefox"] },
  { env: ["local", "ci"] },
]);

// cases[0].data === [{ browser: "chromium" }, { env: "local" }]
```

### Combining Generated Outputs (`combine`)

Concatenate independent combination suites into a single test collection without multiplying them:

```ts
import { combinations, combine } from "utils-core";

const browsers = combinations({ browser: ["chromium", "firefox"] });
const environments = combinations({ env: ["local", "ci"] });

// 2 browser cases + 2 env cases = 4 total cases
const allCases = combine(browsers, environments);
```

---

## TypeScript & Type Safety

`utils-core` provides end-to-end compile-time type safety. Invalid property paths are caught at compile time:

```ts
const data = {
  users: [{ id: 1, name: "Alice" }],
};

// Strongly typed as string[]
const names = resolve(data).get("users.name").values();

// @ts-expect-error Type error: "users.unknown" does not exist
resolve(data).get("users.unknown");
```

---

## License

MIT
