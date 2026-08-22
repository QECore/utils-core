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
      members: [
        { id: 1, name: "John", role: "developer", age: 30 },
        { id: 2, name: "Shan", role: "architect", age: 35 },
      ],
    },
    {
      name: "Product",
      members: [
        { id: 3, name: "Alice", role: "manager", age: 28 },
        { id: 4, name: "Bob", role: "designer", age: 32 },
      ],
    },
  ],
};
```

### Deep Path & Array Traversal

Array boundaries are automatically flattened by one level during property traversal:

```ts
// Returns: [{ id: 1, name: "John", ... }, { id: 2, ... }, { id: 3, ... }, { id: 4, ... }]
const allMembers = resolve(data)
  .get("teams.members")
  .values();

// Returns: ["John", "Shan", "Alice", "Bob"]
const memberNames = resolve(data)
  .get("teams.members.name")
  .values();
```

### Array Indexing

Use explicit index notation or `.at(index)`:

```ts
// Property index
resolve(data).get("teams[0].members[1].name").value(); // "Shan"

// Multi-dimensional array index
const matrix = [[10, 20], [30, 40]];
resolve(matrix).get("[0][1]").value(); // 20

// Method index
resolve(data).get("teams").at(0).get("name").value(); // "Engineering"
```

### Type-Safe Equality and Predicates

`equals()` and `notEquals()` enforce strict type agreement with the resolved value:

```ts
resolve(data).get("teams[0].members[0].age").equals(30); // Valid

// @ts-expect-error Type mismatch: number vs string
resolve(data).get("teams[0].members[0].age").equals("30");
```

`contains()` uses substring matching for string values and exact element membership for arrays:

```ts
// Substring search on strings
resolve("hello world").contains("world"); // ["hello world"]

// Array membership (not string conversion)
resolve(["admin", "user"]).contains("admin"); // ["admin"]
resolve([123, 456]).contains(23);             // []
```

### Filtering with `where()`

Filter collections using property matchers or deep paths:

```ts
// Filter with deep matcher
const devTeams = resolve(data)
  .get("teams")
  .where("members.role:developer")
  .values();
```

### Homogeneous `sum()`

`sum()` aggregates numbers or concatenates strings. Mixed or unsupported types throw a `TypeError`:

```ts
resolve([1, 2, 3]).sum();      // 6
resolve(["a", "b", "c"]).sum(); // "abc"
resolve([]).sum();              // 0

resolve([1, "2"]).sum();        // Throws TypeError (mixed types)
```

### Terminal Operations

| Method | Return Type | Description |
| :--- | :--- | :--- |
| `.values()` | `T[]` | Returns all resolved values as an array |
| `.value()` | `T \| undefined` | Returns the first resolved value or `undefined` |
| `.first()` | `T \| undefined` | Alias for `.value()` |
| `.last()` | `T \| undefined` | Returns the last resolved value or `undefined` |
| `.count()` | `number` | Returns total number of resolved items |
| `.exists()` | `boolean` | `true` if at least one item was resolved |
| `.sum()` | `number \| string` | Sums numeric values or concatenates string values |
| `.equals(expected)` | `T[]` | Filters items equal to `expected` (strictly typed) |
| `.notEquals(expected)` | `T[]` | Filters items not equal to `expected` (strictly typed) |
| `.contains(target)` | `T[]` | Substring match for strings, membership match for arrays |
| `.startsWith(str)` | `T[]` | Filters strings starting with `str` |
| `.endsWith(str)` | `T[]` | Filters strings ending with `str` |
| `.greaterThan(num)` | `T[]` | Filters values `> num` |
| `.greaterThanOrEqual(num)` | `T[]` | Filters values `>= num` |
| `.lessThan(num)` | `T[]` | Filters values `< num` |
| `.lessThanOrEqual(num)` | `T[]` | Filters values `<= num` |
| `.isNull()` | `T[]` | Filters `null` values |
| `.isUndefined()` | `T[]` | Filters `undefined` values |
| `.isTruthy()` | `T[]` | Filters truthy values |
| `.isFalsy()` | `T[]` | Filters falsy values |
| `.matches(regex)` | `T[]` | Filters strings matching regular expression (safe with `/g`/`/y`) |

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

### Nested Objects & Playwright Tags

Nested objects produce path-based metadata tags automatically:

```ts
const cases = combinations({
  user: {
    role: ["admin", "member"],
  },
  auth: ["sso"],
});

// cases[0].metadata.tags === ["@user.role:admin", "@auth:sso"]
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

Concatenate independent combination suites without multiplying them:

```ts
import { combinations, combine } from "utils-core";

const browsers = combinations({ browser: ["chromium", "firefox"] });
const environments = combinations({ env: ["local", "ci"] });

// 2 browser cases + 2 env cases = 4 total cases
const allCases = combine(browsers, environments);
// or: combinations.combine(browsers, environments)
```

---

## TypeScript & Type Safety

`utils-core` provides end-to-end type safety. Invalid property paths are caught at compile time:

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
