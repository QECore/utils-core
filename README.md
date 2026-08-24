# ts-lib-core

A strongly typed TypeScript utility library for deep data resolution and test-data combination generation.

```bash
npm install ts-lib-core
```

```ts
import { resolve, combinations, combine } from "ts-lib-core";
```

## What does it solve?

| Utility          | Use it when you need to                                                      |
| ---------------- | ---------------------------------------------------------------------------- |
| `resolve()`      | Read, search, filter, compare, or aggregate nested data                      |
| `combinations()` | Generate every possible combination of candidate values                      |
| `combine()`      | Merge independently generated combinations without creating new combinations |

---

# `resolve`

`resolve()` provides a chainable, type-safe way to work with data.

## Basic access

```ts
const user = {
  name: "Shan",
  age: 30,
  profile: {
    city: "Hyderabad",
  },
};
```

| Need               | Usage                                       | Result        |
| ------------------ | ------------------------------------------- | ------------- |
| Get name           | `resolve(user).get("name").value()`         | `"Shan"`      |
| Get age            | `resolve(user).get("age").value()`          | `30`          |
| Get city           | `resolve(user).get("profile.city").value()` | `"Hyderabad"` |
| Check name exists  | `resolve(user).get("name").exists()`        | `true`        |
| Check email exists | `resolve(user).get("email").exists()`       | `false`       |
| Compare age        | `resolve(user).get("age").equals(30)`       | `true`        |
| Compare age        | `resolve(user).get("age").not.equals(40)`   | `true`        |

Invalid paths are caught by TypeScript:

```ts
resolve(user).get("email");
// TypeScript error
```

---

## Array values

Define the data once:

```ts
const users = [
  { name: "John", age: 30 },
  { name: "Shan", age: 35 },
  { name: "Alice", age: 28 },
];
```

| Need            | Usage                                 | Result                      |
| --------------- | ------------------------------------- | --------------------------- |
| Get all names   | `resolve(users).get("name").values()` | `["John", "Shan", "Alice"]` |
| Get first name  | `resolve(users).get("name").first()`  | `"John"`                    |
| Get last name   | `resolve(users).get("name").last()`   | `"Alice"`                   |
| Get second name | `resolve(users).get("name").value(1)` | `"Shan"`                    |
| Count users     | `resolve(users).get("name").count()`  | `3`                         |
| Get all ages    | `resolve(users).get("age").values()`  | `[30, 35, 28]`              |
| Sum ages        | `resolve(users).get("age").sum()`     | `93`                        |

---

## `at()` vs `value()`

Use the same `users` data above.

| Need                            | Usage                                      | Result                      |
| ------------------------------- | ------------------------------------------ | --------------------------- |
| Select second user              | `resolve(users).at(1).value()`             | `{ name: "Shan", age: 35 }` |
| Select second user and continue | `resolve(users).at(1).get("name").value()` | `"Shan"`                    |
| Get second name directly        | `resolve(users).get("name").value(1)`      | `"Shan"`                    |

`at()` keeps the pipeline alive, while `value()` is terminal.

---

## Nested arrays

Define the data once:

```ts
const teams = [
  {
    name: "Engineering",
    members: [
      { name: "John", role: "developer" },
      { name: "Shan", role: "architect" },
    ],
  },
  {
    name: "Design",
    members: [
      { name: "Alice", role: "designer" },
    ],
  },
];
```

| Need                 | Usage                                         | Result                                   |
| -------------------- | --------------------------------------------- | ---------------------------------------- |
| Get teams            | `resolve(teams).values()`                     | All teams                                |
| Get all members      | `resolve(teams).get("members").values()`      | 3 member objects                         |
| Get all member names | `resolve(teams).get("members.name").values()` | `["John", "Shan", "Alice"]`              |
| Get all roles        | `resolve(teams).get("members.role").values()` | `["developer", "architect", "designer"]` |
| Count members        | `resolve(teams).get("members.name").count()`  | `3`                                      |
| Get first member     | `resolve(teams).get("members.name").first()`  | `"John"`                                 |

Array boundaries are automatically flattened by one level during property traversal.

---

# `where()`

Define the data once:

```ts
const users = [
  { name: "John", role: "admin" },
  { name: "Shan", role: "user" },
  { name: "Alice", role: "administrator" },
];
```

| Need                           | Usage                                         | Result      |
| ------------------------------ | --------------------------------------------- | ----------- |
| Find admins                    | `resolve(users).where("role:admin").values()` | John, Alice |
| Find users                     | `resolve(users).where("role:user").values()`  | Shan        |
| Find anyone containing `"min"` | `resolve(users).where("role:min").values()`   | John, Alice |

`where()` uses `"path:expected"` and performs a case-insensitive substring match.

---

## Nested `where()`

Define the data once:

```ts
const users = [
  {
    name: "John",
    profile: { role: "admin" },
  },
  {
    name: "Shan",
    profile: { role: "user" },
  },
];
```

| Need        | Usage                                                 | Result |
| ----------- | ----------------------------------------------------- | ------ |
| Find admins | `resolve(users).where("profile.role:admin").values()` | John   |
| Find users  | `resolve(users).where("profile.role:user").values()`  | Shan   |

---

## `where()` with nested arrays

Using the `teams` data defined above:

| Need                 | Usage                                                     | Result      |
| -------------------- | --------------------------------------------------------- | ----------- |
| Find developer teams | `resolve(teams).where("members.role:developer").values()` | Engineering |
| Find designer teams  | `resolve(teams).where("members.role:designer").values()`  | Design      |
| Find architect teams | `resolve(teams).where("members.role:architect").values()` | Engineering |

If multiple values are resolved, the item matches when **any** value qualifies.

---

# `contains()`

## Strings

Define the data once:

```ts
const message = "Hello World";
```

| Need                    | Usage                                | Result            |
| ----------------------- | ------------------------------------ | ----------------- |
| Find `"World"`          | `resolve(message).contains("World")` | `["Hello World"]` |
| Case-insensitive search | `resolve(message).contains("world")` | `["Hello World"]` |
| Missing text            | `resolve(message).contains("test")`  | `[]`              |

---

## Arrays

Define the data once:

```ts
const roles = ["admin", "user"];
```

| Need           | Usage                              | Result      |
| -------------- | ---------------------------------- | ----------- |
| Existing value | `resolve(roles).contains("admin")` | `["admin"]` |
| Missing value  | `resolve(roles).contains("guest")` | `[]`        |

Array matching uses strict element membership.

```ts
resolve([123, 456]).contains(23);
// []
```

---

# Predicates & Fluent `.not` Namespace

`Resolve<T>` exposes intuitive positive predicates and their inverted negative forms under the fluent `.not` namespace.

Calling `.not` returns an immutable, stateless predicate interface and never mutates the underlying resolver.

## Basic usage

```ts
const numbers = [1, 2, 3];

resolve(numbers).equals(2);
// [2]

resolve(numbers).not.equals(2);
// [1, 3]
```

```ts
const roles = ["admin", "user", "guest"];

resolve(roles).contains("admin");
// ["admin"]

resolve(roles).not.contains("admin");
// ["user", "guest"]
```

## General Rule

```text
positive predicate:
.predicate()

negative predicate:
.not.predicate()
```

## Predicate Reference

| Positive | Negative | Description |
| :--- | :--- | :--- |
| `.equals(value)` | `.not.equals(value)` | Strict equality (matches Dates by timestamp) |
| `.contains(value)` | `.not.contains(value)` | Case-insensitive substring (strings) or element membership (arrays) |
| `.startsWith(value)` | `.not.startsWith(value)` | Prefix matching on string values |
| `.endsWith(value)` | `.not.endsWith(value)` | Suffix matching on string values |
| `.greaterThan(value)` | `.not.greaterThan(value)` | Relative order `>` comparison |
| `.greaterThanOrEqual(value)` | `.not.greaterThanOrEqual(value)` | Relative order `>=` comparison |
| `.lessThan(value)` | `.not.lessThan(value)` | Relative order `<` comparison |
| `.lessThanOrEqual(value)` | `.not.lessThanOrEqual(value)` | Relative order `<=` comparison |
| `.isNull()` | `.not.isNull()` | Strict `null` check |
| `.isUndefined()` | `.not.isUndefined()` | Strict `undefined` check |
| `.isTruthy()` | `.not.isTruthy()` | Boolean truthiness check |
| `.isFalsy()` | `.not.isFalsy()` | Boolean falsiness check |
| `.matches(regex)` | `.not.matches(regex)` | Regular expression pattern match |

## Migration Note

`notEquals()` has been removed from the public API in favor of `.not.equals()`.

```ts
// Before
resolve(data).get("age").notEquals(30);

// After
resolve(data).get("age").not.equals(30);
```

---

# `sum()`

Define the data once:

```ts
const numbers = [1, 2, 3];
const words = ["a", "b", "c"];
```

| Need                | Usage                     | Result      |
| ------------------- | ------------------------- | ----------- |
| Sum numbers         | `resolve(numbers).sum()`  | `6`         |
| Concatenate strings | `resolve(words).sum()`    | `"abc"`     |
| Empty collection    | `resolve([]).sum()`       | `0`         |
| Mixed types         | `resolve([1, "2"]).sum()` | `TypeError` |
| Unsupported type    | `resolve([true]).sum()`   | `TypeError` |

---

# Array indexing

Define the data once:

```ts
const matrix = [
  [1, 2],
  [3, 4],
];
```

| Need       | Usage                                | Result   |
| ---------- | ------------------------------------ | -------- |
| First row  | `resolve(matrix).get("[0]").value()` | `[1, 2]` |
| Second row | `resolve(matrix).get("[1]").value()` | `[3, 4]` |

Selecting an array item preserves its nested array structure.

---

# Terminal operations

| Method           | Return type        | Purpose                            |
| ---------------- | ------------------ | ---------------------------------- |
| `.value(index?)` | `T \| undefined`   | Get one resolved value             |
| `.first()`       | `T \| undefined`   | Get the first value                |
| `.last()`        | `T \| undefined`   | Get the last value                 |
| `.values()`      | `T[]`              | Get all resolved values            |
| `.count()`       | `number`           | Count resolved values              |
| `.exists()`      | `boolean`          | Check whether a value exists       |
| `.sum()`         | `number \| string` | Sum numbers or concatenate strings |

---

# `combinations`

`combinations()` generates every possible combination of candidate values.

## One option

Define the data once:

```ts
const browsers = ["chromium", "firefox"];
```

```ts
const cases = combinations({
  browser: browsers,
});
```

| Need            | Usage                    | Result                    |
| --------------- | ------------------------ | ------------------------- |
| Get first data  | `cases[0].data`          | `{ browser: "chromium" }` |
| Get second data | `cases[1].data`          | `{ browser: "firefox" }`  |
| Get first name  | `cases[0].name`          | `"chromium"`              |
| Get first tags  | `cases[0].metadata.tags` | `["@browser:chromium"]`   |

```text
2 candidates = 2 combinations
```

---

## Two options

Define the data once:

```ts
const browsers = ["chromium", "firefox"];
const environments = ["local", "ci"];
```

```ts
const cases = combinations({
  browser: browsers,
  environment: environments,
});
```

| Need            | Usage                    | Result                                          |
| --------------- | ------------------------ | ----------------------------------------------- |
| First data      | `cases[0].data`          | `{ browser: "chromium", environment: "local" }` |
| First name      | `cases[0].name`          | `"chromium - local"`                            |
| First tags      | `cases[0].metadata.tags` | `["@browser:chromium", "@environment:local"]`   |
| Number of cases | `cases.length`           | `4`                                             |

The generated combinations are:

```text
chromium + local
chromium + ci
firefox  + local
firefox  + ci
```

```text
2 × 2 = 4 combinations
```

---

## Three options

Define the data once:

```ts
const browsers = ["chromium", "firefox"];
const environments = ["local", "ci"];
const devices = ["desktop", "mobile"];
```

```ts
const cases = combinations({
  browser: browsers,
  environment: environments,
  device: devices,
});
```

| Need            | Usage           | Result                                                             |
| --------------- | --------------- | ------------------------------------------------------------------ |
| Number of cases | `cases.length`  | `8`                                                                |
| First data      | `cases[0].data` | `{ browser: "chromium", environment: "local", device: "desktop" }` |
| First name      | `cases[0].name` | `"chromium - local - desktop"`                                     |

```text
2 × 2 × 2 = 8 combinations
```

---

# Nested combinations

Define the data once:

```ts
const roles = ["admin", "user"];
const states = [true, false];
```

```ts
const cases = combinations({
  user: {
    role: roles,
    active: states,
  },
});
```

| Need            | Usage                    | Result                                      |
| --------------- | ------------------------ | ------------------------------------------- |
| Number of cases | `cases.length`           | `4`                                         |
| First data      | `cases[0].data`          | `{ user: { role: "admin", active: true } }` |
| First name      | `cases[0].name`          | `"admin - true"`                            |
| First tags      | `cases[0].metadata.tags` | `["@user.role:admin", "@user.active:true"]` |

```text
2 × 2 = 4 combinations
```

---

# Constant values

Define the data once:

```ts
const roles = ["admin", "user"];
const active = true;
```

```ts
const cases = combinations({
  role: roles,
  active,
});
```

| Need            | Usage                    | Result                            |
| --------------- | ------------------------ | --------------------------------- |
| Number of cases | `cases.length`           | `2`                               |
| First data      | `cases[0].data`          | `{ role: "admin", active: true }` |
| First tags      | `cases[0].metadata.tags` | `["@role:admin", "@active:true"]` |

Constant values are not expanded.

---

# Objects as candidates

Define the data once:

```ts
const users = [
  { role: "admin" },
  { role: "user" },
];
```

```ts
const cases = combinations({
  user: users,
});
```

| Need            | Usage           | Result                        |
| --------------- | --------------- | ----------------------------- |
| Number of cases | `cases.length`  | `2`                           |
| First data      | `cases[0].data` | `{ user: { role: "admin" } }` |
| Second data     | `cases[1].data` | `{ user: { role: "user" } }`  |

Objects inside candidate arrays are treated as individual values.

---

# Empty candidate arrays

Define the data once:

```ts
const browsers = ["chromium"];
const environments: string[] = [];
```

```ts
const cases = combinations({
  browser: browsers,
  environment: environments,
});
```

| Need            | Usage          | Result |
| --------------- | -------------- | ------ |
| Generated cases | `cases`        | `[]`   |
| Number of cases | `cases.length` | `0`    |

```text
N × 0 = 0
```

---

# Custom `nameSeparator`

Define the data once:

```ts
const browsers = ["chromium"];
const environments = ["ci"];
```

```ts
const cases = combinations(
  {
    browser: browsers,
    environment: environments,
  },
  {
    nameSeparator: " | ",
  },
);
```

| Need           | Usage           | Result             |
| -------------- | --------------- | ------------------ |
| Generated name | `cases[0].name` | `"chromium | ci"` |

The default separator is `" - "`.

---

# `combinations.asArray()`

Define the data once:

```ts
const browsers = ["chromium", "firefox"];
const environments = ["local", "ci"];
```

```ts
const cases = combinations.asArray([
  { browser: browsers },
  { environment: environments },
]);
```

| Need            | Usage           | Result                                                |
| --------------- | --------------- | ----------------------------------------------------- |
| Number of cases | `cases.length`  | `4`                                                   |
| First data      | `cases[0].data` | `[{ browser: "chromium" }, { environment: "local" }]` |
| Second data     | `cases[1].data` | `[{ browser: "chromium" }, { environment: "ci" }]`    |

---

# `combine`

`combine()` merges already-generated combination results.

It does **not** create another Cartesian product.

## Combine two suites

Define the suites once:

```ts
const browsers = combinations({
  browser: ["chromium", "firefox"],
});

const environments = combinations({
  environment: ["local", "ci"],
});
```

```ts
const cases = combine(
  browsers,
  environments,
);
```

| Need                        | Usage                 | Result                     |
| --------------------------- | --------------------- | -------------------------- |
| Number of browser cases     | `browsers.length`     | `2`                        |
| Number of environment cases | `environments.length` | `2`                        |
| Number after combine        | `cases.length`        | `4`                        |
| First result                | `cases[0].data`       | `{ browser: "chromium" }`  |
| Third result                | `cases[2].data`       | `{ environment: "local" }` |

```text
2 + 2 = 4
```

`combine()` concatenates results.

---

## `combinations()` vs `combine()`

| Goal                    | Usage                                    | Behavior          |
| ----------------------- | ---------------------------------------- | ----------------- |
| Generate combinations   | `combinations({ browser, environment })` | Cartesian product |
| Merge generated results | `combine(browsers, environments)`        | Concatenation     |

For example:

```text
combinations()
2 browsers × 2 environments = 4

combine()
2 browser cases + 2 environment cases = 4
```

---

## Combine multiple suites

Define the suites once:

```ts
const browsers = combinations({
  browser: ["chromium", "firefox"],
});

const environments = combinations({
  environment: ["local", "ci"],
});

const devices = combinations({
  device: ["desktop", "mobile"],
});
```

```ts
const cases = combine(
  browsers,
  environments,
  devices,
);
```

| Need        | Usage          | Result |
| ----------- | -------------- | ------ |
| Total cases | `cases.length` | `6`    |
| Calculation | `2 + 2 + 2`    | `6`    |

---

# TypeScript type safety

## Type-safe paths

Define the data once:

```ts
const user = {
  name: "Alice",
  age: 30,
};
```

| Usage                        | Result           |
| ---------------------------- | ---------------- |
| `resolve(user).get("name")`  | Valid            |
| `resolve(user).get("age")`   | Valid            |
| `resolve(user).get("email")` | TypeScript error |

---

## Type inference

Using the same `user` data:

| Usage                                | Inferred type         |
| ------------------------------------ | --------------------- |
| `resolve(user).get("name").value()`  | `string | undefined` |
| `resolve(user).get("age").value()`   | `number | undefined` |
| `resolve(user).get("name").values()` | `string[]`            |
| `resolve(user).get("age").values()`  | `number[]`            |

---

## Type-safe predicates

Using:

```ts
const user = {
  age: 30,
};
```

| Usage                                   | Result           |
| --------------------------------------- | ---------------- |
| `resolve(user).get("age").equals(30)`   | Valid            |
| `resolve(user).get("age").equals(40)`   | Valid            |
| `resolve(user).get("age").equals("30")` | TypeScript error |

---

# Real-world example

The same APIs can be used with larger structures once the basic operations are understood.

Define the data once:

```ts
const application = {
  teams: [
    {
      name: "Engineering",
      lead: {
        name: "Alice",
        role: "admin",
      },
      members: [
        {
          name: "John",
          role: "developer",
          age: 30,
        },
        {
          name: "Shan",
          role: "architect",
          age: 35,
        },
      ],
    },
    {
      name: "Product",
      lead: {
        name: "Bob",
        role: "manager",
      },
      members: [
        {
          name: "Charlie",
          role: "designer",
          age: 28,
        },
      ],
    },
  ],
};
```

| Need                 | Usage                                                                        | Result                        |
| -------------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| Get all members      | `resolve(application).get("teams.members").values()`                         | 3 members                     |
| Get member names     | `resolve(application).get("teams.members.name").values()`                    | `["John", "Shan", "Charlie"]` |
| Get member ages      | `resolve(application).get("teams.members.age").values()`                     | `[30, 35, 28]`                |
| Find developer teams | `resolve(application).get("teams").where("members.role:developer").values()` | Engineering                   |
| Get first lead       | `resolve(application).get("teams").at(0).get("lead.name").value()`           | `"Alice"`                     |
| Sum member ages      | `resolve(application).get("teams.members.age").sum()`                        | `93`                          |

---

# Package characteristics

* **TypeScript-first** — strong compile-time inference.
* **Framework agnostic** — works with Playwright, Jest, Vitest, or independently.
* **ESM + CommonJS** — supports modern `import` and Node.js `require`.
* **Zero runtime dependencies**.
* **Composable APIs**.
* **Type-safe property paths and predicates**.

## Imports

```ts
import { resolve } from "ts-lib-core";
```

```ts
import { combinations } from "ts-lib-core";
```

```ts
import { combine } from "ts-lib-core";
```

Or:

```ts
import {
  resolve,
  combinations,
  combine,
} from "ts-lib-core";
```

# License

MIT
