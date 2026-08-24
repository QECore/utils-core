import type {
  ArrayItem,
  Comparable,
  ContainsTarget,
  Matcher,
  Path,
  ResolvedItem,
  SumResult,
  ValueAtPath,
} from "./types";

export type * from "./types";

/* ============================================================
 * INTERNAL TYPES
 * ========================================================== */

type Operation =
  | {
      type: "path";
      value: string;
    }
  | {
      type: "where";
      value: string;
    }
  | {
      type: "index";
      value: number;
    };

/* ============================================================
 * PREDICATE CHAIN CLASS
 * ========================================================== */

/**
 * Provides type-safe predicate operations for resolved values.
 */
export class PredicateChain<T> {
  protected readonly resolverInstance: Resolve<T>;
  protected readonly negated: boolean;

  constructor(resolver?: Resolve<T>, negated = false) {
    this.resolverInstance = resolver ?? (this as unknown as Resolve<T>);
    this.negated = negated;
  }

  /**
   * Returns a predicate chain with inverted predicate semantics.
   *
   * @example
   * ```ts
   * resolve(users).get("age").not.equals(30);
   * resolve(roles).not.contains("admin");
   * ```
   */
  get not(): PredicateChain<T> {
    return new PredicateChain(this.resolverInstance, !this.negated);
  }

  /**
   * Filters items strictly equal to the expected value.
   * Date comparisons evaluate timestamp equality.
   *
   * @param expected Target value compatible with the resolved type.
   *
   * @example
   * ```ts
   * resolve(users).get("age").equals(30);
   * // [30]
   * ```
   */
  equals(expected: ResolvedItem<T>): ResolvedItem<T>[] {
    return this.filter(Resolve.equalsPredicate(expected));
  }

  /**
   * Filters items containing the target:
   * - For strings: case-insensitive substring search.
   * - For arrays: exact element membership (no string coercion).
   *
   * @param expected Substring needle for strings, or exact element value for arrays.
   *
   * @example
   * ```ts
   * resolve("hello world").contains("world"); // ["hello world"]
   * resolve(["admin", "user"]).contains("admin"); // ["admin"]
   * ```
   */
  contains(expected: ContainsTarget<T>): ResolvedItem<T>[] {
    return this.filter(Resolve.containsPredicate(expected));
  }

  /**
   * Filters string values starting with the specified prefix.
   *
   * @param expected Prefix string.
   *
   * @example
   * ```ts
   * resolve(["apple", "banana"]).startsWith("app");
   * // ["apple"]
   * ```
   */
  startsWith(expected: string): ResolvedItem<T>[] {
    return this.filter(Resolve.startsWithPredicate(expected));
  }

  /**
   * Filters string values ending with the specified suffix.
   *
   * @param expected Suffix string.
   *
   * @example
   * ```ts
   * resolve(["apple", "banana"]).endsWith("le");
   * // ["apple"]
   * ```
   */
  endsWith(expected: string): ResolvedItem<T>[] {
    return this.filter(Resolve.endsWithPredicate(expected));
  }

  /**
   * Filters values strictly greater than the expected value.
   *
   * @param expected Comparable boundary (number, string, bigint, or Date).
   *
   * @example
   * ```ts
   * resolve([10, 20, 30]).greaterThan(15);
   * // [20, 30]
   * ```
   */
  greaterThan(expected: Comparable): ResolvedItem<T>[] {
    return this.filter(Resolve.greaterThanPredicate(expected));
  }

  /**
   * Filters values greater than or equal to the expected value.
   *
   * @param expected Comparable boundary.
   *
   * @example
   * ```ts
   * resolve([10, 20, 30]).greaterThanOrEqual(20);
   * // [20, 30]
   * ```
   */
  greaterThanOrEqual(expected: Comparable): ResolvedItem<T>[] {
    return this.filter(Resolve.greaterThanOrEqualPredicate(expected));
  }

  /**
   * Filters values strictly less than the expected value.
   *
   * @param expected Comparable boundary.
   *
   * @example
   * ```ts
   * resolve([10, 20, 30]).lessThan(25);
   * // [10, 20]
   * ```
   */
  lessThan(expected: Comparable): ResolvedItem<T>[] {
    return this.filter(Resolve.lessThanPredicate(expected));
  }

  /**
   * Filters values less than or equal to the expected value.
   *
   * @param expected Comparable boundary.
   *
   * @example
   * ```ts
   * resolve([10, 20, 30]).lessThanOrEqual(20);
   * // [10, 20]
   * ```
   */
  lessThanOrEqual(expected: Comparable): ResolvedItem<T>[] {
    return this.filter(Resolve.lessThanOrEqualPredicate(expected));
  }

  /**
   * Filters values that are strictly null.
   *
   * @example
   * ```ts
   * resolve([null, 1, 2]).isNull();
   * // [null]
   * ```
   */
  isNull(): ResolvedItem<T>[] {
    return this.filter(Resolve.isNullPredicate);
  }

  /**
   * Filters values that are strictly undefined.
   *
   * @example
   * ```ts
   * resolve([undefined, 1, 2]).isUndefined();
   * // [undefined]
   * ```
   */
  isUndefined(): ResolvedItem<T>[] {
    return this.filter(Resolve.isUndefinedPredicate);
  }

  /**
   * Filters truthy values.
   *
   * @example
   * ```ts
   * resolve([0, 1, false, "text"]).isTruthy();
   * // [1, "text"]
   * ```
   */
  isTruthy(): ResolvedItem<T>[] {
    return this.filter(Resolve.isTruthyPredicate);
  }

  /**
   * Filters falsy values.
   *
   * @example
   * ```ts
   * resolve([0, 1, false, "text"]).isFalsy();
   * // [0, false]
   * ```
   */
  isFalsy(): ResolvedItem<T>[] {
    return this.filter(Resolve.isFalsyPredicate);
  }

  /**
   * Filters strings matching the provided regular expression.
   * Cleans global/sticky flags to prevent stateful RegExp index bugs.
   *
   * @param regex Target regular expression pattern.
   *
   * @example
   * ```ts
   * resolve(["Alice", "Bob"]).matches(/^A/);
   * // ["Alice"]
   * ```
   */
  matches(regex: RegExp): ResolvedItem<T>[] {
    return this.filter(Resolve.matchesPredicate(regex));
  }

  protected filter(predicate: (value: unknown) => boolean): ResolvedItem<T>[] {
    return this.resolverInstance.filter(predicate, this.negated);
  }
}

/* ============================================================
 * RESOLVE CLASS
 * ========================================================== */

export class Resolve<T> extends PredicateChain<T> {
  private constructor(
    private readonly source: T,
    private readonly operations: readonly Operation[] = []
  ) {
    super();
  }

  /**
   * Internal factory for constructing chained Resolve instances.
   */
  private static create<T>(
    source: T,
    operations: readonly Operation[] = []
  ): Resolve<T> {
    return new Resolve<T>(source, operations);
  }

  /**
   * Creates a root resolver instance for deep querying and filtering.
   *
   * @param source Data source (object, array, primitive).
   *
   * @example
   * ```ts
   * const r = resolve(data);
   * ```
   */
  static from<T>(source: T): Resolve<T> {
    return Resolve.create(source);
  }

  /* ==========================================================
   * PIPELINE / NAVIGATION
   * ======================================================== */

  /**
   * Traverses a deep property path, automatically flattening one level of array boundaries.
   *
   * @param path Dot-delimited property path or index bracket notation.
   *
   * @example
   * ```ts
   * resolve(users).get("teams.members.name");
   * ```
   */
  get<P extends Path<T>>(
    path: P
  ): Resolve<ValueAtPath<T, P>> {
    return Resolve.create(this.source as any, [
      ...this.operations,
      { type: "path", value: path },
    ]);
  }

  /**
   * Navigates to a specific zero-based index in the current resolved array.
   * Keeps the pipeline active for subsequent chaining.
   *
   * @param index Zero-based element position.
   *
   * @example
   * ```ts
   * resolve(users).at(0).get("name").value();
   * ```
   */
  at(
    index: number
  ): Resolve<ArrayItem<T> extends never ? T : ArrayItem<T>> {
    return Resolve.create(this.source as any, [
      ...this.operations,
      { type: "index", value: index },
    ]) as Resolve<ArrayItem<T> extends never ? T : ArrayItem<T>>;
  }

  /**
   * Filters the collection by matching elements against a `"path:expected"` expression.
   * If the path resolves to an array, the item matches if ANY nested value satisfies the condition.
   *
   * @param expression Filter expression in `"path:expected"` format.
   *
   * @example
   * ```ts
   * resolve(teams).where("lead.role:admin");
   * resolve(teams).where("members.role:developer");
   * ```
   */
  where(expression: Matcher<T>): Resolve<T> {
    return Resolve.create(this.source, [
      ...this.operations,
      { type: "where", value: expression },
    ]);
  }

  /* ==========================================================
   * TERMINAL ACCESSORS
   * ======================================================== */

  /**
   * Executes the pipeline and returns the value at the specified index, or the first value.
   * Returns `undefined` if no value exists at the index.
   *
   * @param index Optional zero-based element position (defaults to 0).
   *
   * @example
   * ```ts
   * resolve(user).get("name").value(); // "Shan"
   * resolve(users).get("name").value(1); // "John"
   * ```
   */
  value(index = 0): ResolvedItem<T> | undefined {
    const results = this.execute();
    if (index >= 0 && index < results.length) {
      return results[index] as ResolvedItem<T>;
    }
    return undefined;
  }

  /**
   * Returns the first resolved value, or `undefined` if the result set is empty.
   *
   * @example
   * ```ts
   * resolve(users).get("name").first();
   * ```
   */
  first(): ResolvedItem<T> | undefined {
    return this.value(0);
  }

  /**
   * Returns the last resolved value, or `undefined` if the result set is empty.
   *
   * @example
   * ```ts
   * resolve(users).get("name").last();
   * ```
   */
  last(): ResolvedItem<T> | undefined {
    const values = this.execute();
    return values.length > 0 ? (values[values.length - 1] as ResolvedItem<T>) : undefined;
  }

  /**
   * Executes the resolution pipeline and returns all matching resolved values as an array.
   *
   * @example
   * ```ts
   * resolve(users).get("name").values();
   * // ["Alice", "Bob"]
   * ```
   */
  values(): ResolvedItem<T>[] {
    return this.execute() as ResolvedItem<T>[];
  }

  /**
   * Returns the number of resolved elements.
   *
   * @example
   * ```ts
   * resolve(users).get("name").count(); // 2
   * ```
   */
  count(): number {
    return this.execute().length;
  }

  /**
   * Checks whether any resolved elements exist.
   *
   * @example
   * ```ts
   * resolve(users).get("name").exists(); // true
   * ```
   */
  exists(): boolean {
    return this.execute().length > 0;
  }

  /* ==========================================================
   * FILTER ENGINE & PREDICATE LOGIC
   * ======================================================== */

  /**
   * Executes pipeline filtering with optional negation inversion.
   */
  filter(
    predicate: (value: unknown) => boolean,
    negate = false
  ): ResolvedItem<T>[] {
    return this.execute().filter((value) =>
      negate ? !predicate(value) : predicate(value)
    ) as ResolvedItem<T>[];
  }

  static isEqual(value: unknown, expected: unknown): boolean {
    if (value instanceof Date && expected instanceof Date) {
      return value.getTime() === expected.getTime();
    }
    return value === expected;
  }

  static equalsPredicate(expected: unknown) {
    return (value: unknown): boolean => Resolve.isEqual(value, expected);
  }

  static containsPredicate(expected: unknown) {
    const isExpectedString = typeof expected === "string";
    const needle = isExpectedString
      ? (expected as string).toLowerCase()
      : undefined;

    return (value: unknown): boolean => {
      if (Resolve.isEqual(value, expected)) {
        return true;
      }

      if (Array.isArray(value)) {
        return value.includes(expected);
      }

      if (typeof value === "string" && needle !== undefined) {
        return value.toLowerCase().includes(needle);
      }

      return false;
    };
  }

  static startsWithPredicate(expected: string) {
    return (value: unknown): boolean =>
      typeof value === "string" && value.startsWith(expected);
  }

  static endsWithPredicate(expected: string) {
    return (value: unknown): boolean =>
      typeof value === "string" && value.endsWith(expected);
  }

  static greaterThanPredicate(expected: Comparable) {
    return (value: unknown): boolean => {
      const diff = Resolve.compare(value, expected);
      return diff !== null && diff > 0;
    };
  }

  static greaterThanOrEqualPredicate(expected: Comparable) {
    return (value: unknown): boolean => {
      const diff = Resolve.compare(value, expected);
      return diff !== null && diff >= 0;
    };
  }

  static lessThanPredicate(expected: Comparable) {
    return (value: unknown): boolean => {
      const diff = Resolve.compare(value, expected);
      return diff !== null && diff < 0;
    };
  }

  static lessThanOrEqualPredicate(expected: Comparable) {
    return (value: unknown): boolean => {
      const diff = Resolve.compare(value, expected);
      return diff !== null && diff <= 0;
    };
  }

  static isNullPredicate(value: unknown): boolean {
    return value === null;
  }

  static isUndefinedPredicate(value: unknown): boolean {
    return value === undefined;
  }

  static isTruthyPredicate(value: unknown): boolean {
    return Boolean(value);
  }

  static isFalsyPredicate(value: unknown): boolean {
    return !value;
  }

  static matchesPredicate(regex: RegExp) {
    const cleanRegex =
      regex.global || regex.sticky
        ? new RegExp(regex.source, regex.flags.replace(/[gy]/g, ""))
        : regex;

    return (value: unknown): boolean =>
      typeof value === "string" && cleanRegex.test(value);
  }

  /**
   * Aggregates homogeneous number arrays into a sum, or concatenates string arrays.
   * Returns 0 for empty collections. Throws a TypeError on mixed or unsupported types.
   *
   * @throws {TypeError} When elements contain mixed or non-numeric/non-string types.
   *
   * @example
   * ```ts
   * resolve([1, 2, 3]).sum(); // 6
   * resolve(["a", "b"]).sum(); // "ab"
   * resolve([]).sum(); // 0
   * ```
   */
  sum(): SumResult<T> {
    const values = this.execute();

    if (values.length === 0) {
      return 0 as SumResult<T>;
    }

    const firstVal = values[0];
    const firstType = typeof firstVal;

    if (
      firstVal === null ||
      (firstType !== "number" && firstType !== "string")
    ) {
      throw new TypeError(
        `Unsupported element type for resolve().sum(): ${firstVal === null ? "null" : firstType}`
      );
    }

    for (let i = 0; i < values.length; i++) {
      const val = values[i];
      if (val === null || typeof val !== firstType) {
        const valType = val === null ? "null" : typeof val;
        throw new TypeError(
          `Cannot sum mixed types in resolve().sum(): encountered '${valType}' alongside '${firstType}'`
        );
      }
    }

    if (firstType === "string") {
      let result = "";
      for (const value of values) {
        result += value as string;
      }
      return result as SumResult<T>;
    }

    let total = 0;
    for (const value of values) {
      total += value as number;
    }
    return total as SumResult<T>;
  }

  /* ==========================================================
   * EXECUTION PIPELINE
   * ======================================================== */

  private execute(): unknown[] {
    if (this.source === null || this.source === undefined) {
      return [];
    }

    let current: unknown[] = Array.isArray(this.source)
      ? [...this.source]
      : [this.source];

    for (const operation of this.operations) {
      switch (operation.type) {
        case "path":
          current = this.applyPath(current, operation.value);
          break;

        case "where":
          current = this.applyWhere(current, operation.value);
          break;

        case "index":
          current = this.applyIndex(current, operation.value);
          break;
      }

      if (current.length === 0) {
        break;
      }
    }

    return current;
  }

  /* ==========================================================
   * PATH EVALUATION
   * ======================================================== */

  private applyPath(
    sources: readonly unknown[],
    path: string
  ): unknown[] {
    const segments = Resolve.parsePath(path);
    let current: unknown[] = [...sources];

    for (const segment of segments) {
      if (segment.type === "property") {
        current = this.readProperty(current, segment.key);
      } else {
        current = this.readIndex(current, segment.index);
      }

      if (current.length === 0) {
        break;
      }
    }

    return current;
  }

  /* ==========================================================
   * PROPERTY ACCESS
   * ======================================================== */

  private readProperty(
    sources: readonly unknown[],
    key: string
  ): unknown[] {
    const result: unknown[] = [];

    for (const source of sources) {
      if (source === null || source === undefined) {
        continue;
      }

      if (Array.isArray(source)) {
        for (const item of source) {
          this.collectProperty(item, key, result);
        }
        continue;
      }

      this.collectProperty(source, key, result);
    }

    return result;
  }

  private collectProperty(
    source: unknown,
    key: string,
    result: unknown[]
  ): void {
    if (
      source === null ||
      source === undefined ||
      typeof source !== "object"
    ) {
      return;
    }

    if (!(key in source)) {
      return;
    }

    const value = (source as Record<string, unknown>)[key];

    if (Array.isArray(value)) {
      for (const item of value) {
        result.push(item);
      }
      return;
    }

    result.push(value);
  }

  /* ==========================================================
   * INDEX ACCESS
   * ======================================================== */

  private applyIndex(
    sources: readonly unknown[],
    index: number
  ): unknown[] {
    if (index >= 0 && index < sources.length) {
      const item = sources[index];
      if (item !== undefined) {
        return [item];
      }
    }
    return [];
  }

  private readIndex(
    sources: readonly unknown[],
    index: number
  ): unknown[] {
    if (sources.length === 1 && Array.isArray(sources[0])) {
      const inner = sources[0];
      if (index >= 0 && index < inner.length) {
        const val = inner[index];
        return val !== undefined ? [val] : [];
      }
      return [];
    }

    if (index >= 0 && index < sources.length) {
      const item = sources[index];
      if (item !== undefined) {
        return [item];
      }
    }

    return [];
  }

  /* ==========================================================
   * COMPARISON HELPER
   * ======================================================== */

  private static compare(a: unknown, b: unknown): number | null {
    if (a instanceof Date && b instanceof Date) {
      return a.getTime() - b.getTime();
    }
    if (typeof a === "number" && typeof b === "number") {
      return a - b;
    }
    if (typeof a === "bigint" && typeof b === "bigint") {
      return a < b ? -1 : a > b ? 1 : 0;
    }
    if (typeof a === "string" && typeof b === "string") {
      return a < b ? -1 : a > b ? 1 : 0;
    }
    return null;
  }

  /* ==========================================================
   * WHERE FILTERING
   * ======================================================== */

  private applyWhere(
    sources: readonly unknown[],
    expression: string
  ): unknown[] {
    const separator = expression.indexOf(":");

    if (separator < 1) {
      return [];
    }

    const path = expression.slice(0, separator);
    const expected = expression.slice(separator + 1).toLowerCase();

    const result: unknown[] = [];

    for (const source of sources) {
      if (source === null || source === undefined) {
        continue;
      }

      if (Array.isArray(source)) {
        for (const item of source) {
          if (this.matchesItem(item, path, expected)) {
            result.push(item);
          }
        }
        continue;
      }

      if (this.matchesItem(source, path, expected)) {
        result.push(source);
      }
    }

    return result;
  }

  private matchesItem(
    source: unknown,
    path: string,
    expected: string
  ): boolean {
    if (
      source === null ||
      typeof source !== "object" ||
      Array.isArray(source)
    ) {
      return false;
    }

    const extracted = this.applyPath([source], path);
    if (extracted.length === 0) {
      return false;
    }

    return extracted.some((val) => {
      if (val === null || val === undefined) {
        return false;
      }
      return String(val).toLowerCase().includes(expected);
    });
  }

  /* ==========================================================
   * PATH PARSER
   * ======================================================== */

  private static parsePath(
    path: string
  ): Array<
    | { type: "property"; key: string }
    | { type: "index"; index: number }
  > {
    const result: Array<
      | { type: "property"; key: string }
      | { type: "index"; index: number }
    > = [];

    const regex = /([^[.\]]+)|\[(\d+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(path)) !== null) {
      if (match[1] !== undefined) {
        result.push({
          type: "property",
          key: match[1],
        });
      } else if (match[2] !== undefined) {
        result.push({
          type: "index",
          index: Number(match[2]),
        });
      }
    }

    return result;
  }
}

/**
 * Main public entrypoint for creating a Resolve instance.
 *
 * @param source The target object, array, or primitive data to resolve.
 *
 * @example
 * ```ts
 * const names = resolve(data).get("teams.members.name").values();
 * ```
 */
export function resolve<T>(source: T): Resolve<T> {
  return Resolve.from(source);
}