import {
  type Path,
  type ResolvedItem,
  type GetReturnType,
  type FilterMatcher,
  type PathMatchValue,
  type FilterResultItem,
  type GroupablePath,
  type GroupResult,
  type SumResult,
} from "./types";
import {
  flattenDeep,
  parseMatcher,
  evaluateMatcher,
} from "./matcher";

export * from "./types";

type Operation =
  | { type: "filter"; matcher: string }
  | { type: "filterPredicate"; path: string; predicate: (value: any) => boolean }
  | { type: "at"; index: number };

/**
 * Fluent query and navigation wrapper over hierarchical and flat data structures.
 */
export class Resolve<T> implements Iterable<ResolvedItem<T>> {
  private readonly source: T;
  private readonly operations: readonly Operation[];
  private readonly isSingle: boolean;
  private cachedResult: unknown[] | undefined;

  constructor(
    source: T,
    operations: readonly Operation[] = [],
    isSingle: boolean = !Array.isArray(source)
  ) {
    this.source = source;
    this.operations = operations;
    this.isSingle = isSingle;
  }

  /**
   * Factory function that creates a new Resolve instance.
   */
  static from<T>(source: T): Resolve<T> {
    return new Resolve<T>(source);
  }

  /* ==========================================================
   * CHAINABLE OPERATIONS (ONLY filter and at)
   * ======================================================== */

  /**
   * Narrows the collection to items matching the matcher DSL, e.g.
   * `"role=admin"`, `"name~John"`, `"age>=30"`.
   *
   * Negated matchers (`!=`, `!~`) also match items where the path is absent.
   * Chainable: call further `filter()` or `at()` on the result.
   *
   * @param matcher - A matcher string.
   * @returns A narrowed `Resolve<T>`.
   *
   * @example
   * ```ts
   * resolve(users).filter("role=admin").get("name");
   * // ["John", "Alice"]
   * ```
   */
  filter<M extends string>(matcher: FilterMatcher<T, M>): Resolve<T>;

  /**
   * Keeps the objects associated with path values that satisfy the predicate.
   * When the path traverses an intermediate array, these are the descendants
   * that produced matching values — not the items you started with. Arrays
   * along the path are traversed element-by-element; a missing path resolves
   * to `undefined` and is passed to the predicate.
   *
   * @param path - Dot-notated path, e.g. `"members.role"`.
   * @param predicate - Type-safe callback; its parameter type is inferred from the path.
   * @returns A narrowed `Resolve<FilterResultItem<T, P>>`.
   *
   * @example
   * ```ts
   * resolve(teams).filter("members.role", (role) => role === "admin");
   * // the matched member objects, not the parent teams
   * ```
   */
  filter<P extends Path<ResolvedItem<T>>>(
    path: P,
    predicate: (value: PathMatchValue<T, P>) => boolean
  ): Resolve<FilterResultItem<T, P>>;

  filter(
    matcherOrPath: string,
    predicate?: (value: any) => boolean
  ): Resolve<any> {
    if (typeof predicate === "function") {
      return new Resolve<any>(
        this.source,
        [
          ...this.operations,
          { type: "filterPredicate", path: matcherOrPath, predicate },
        ],
        false
      );
    }
    return new Resolve<any>(
      this.source,
      [...this.operations, { type: "filter", matcher: matcherOrPath }],
      this.isSingle
    );
  }

  /**
   * Selects a single item by index. Supports negative indexes (`-1` is the
   * last item). Out-of-range indexes model absence.
   *
   * @param index - Zero-based position, or a negative index counted from the end.
   * @returns A `Resolve` wrapper around the item, possibly `undefined`.
   *
   * @example
   * ```ts
   * resolve(users).at(-1).get("name"); // last user's name
   * ```
   */
  at(
    index: number
  ): Resolve<(T extends readonly (infer Item)[] ? Item : T) | undefined> {
    return new Resolve<(T extends readonly (infer Item)[] ? Item : T) | undefined>(
      this.source as any,
      [...this.operations, { type: "at", index }],
      true
    );
  }

  /* ==========================================================
   * TERMINAL OPERATIONS
   * ======================================================== */

  /**
   * Extracts values at a dot-notated path. Paths traversing arrays are
   * flattened; explicit indexing (`[n]`, including negative) picks one position.
   *
   * @param path - Dot-notated path, e.g. `"profile.city"` or `"roles[0]"`.
   * @returns The resolved values, fully typed from the path.
   *
   * @example
   * ```ts
   * resolve(users).get("profile.city");
   * // ["Hyderabad", "Bengaluru", "Hyderabad"]
   * ```
   */
  get<P extends Path<ResolvedItem<T>>>(
    path: P
  ): GetReturnType<T, P> {
    const items = this.execute();

    if (this.isSingle) {
      if (items.length === 0) {
        return undefined as GetReturnType<T, P>;
      }
      const item = items[0];
      const values = this.resolveItemValues(item, path);
      if (this.isPathTraversingArray(path, item)) {
        return flattenDeep(values) as GetReturnType<T, P>;
      }
      if (values.length === 0) {
        return undefined as GetReturnType<T, P>;
      }
      return values[0] as GetReturnType<T, P>;
    }

    const result: unknown[] = [];
    for (const item of items) {
      const values = this.resolveItemValues(item, path);
      result.push(...values);
    }
    return flattenDeep(result) as GetReturnType<T, P>;
  }

  /**
   * Extracts resolved values as a flattened native array.
   */
  values<P extends Path<ResolvedItem<T>>>(path?: P): unknown[] {
    return this.extractPathValues(path);
  }

  /**
   * Returns the number of items in the current collection.
   *
   * @example
   * ```ts
   * resolve(users).count(); // 3
   * ```
   */
  count(): number {
    return this.execute().length;
  }

  /**
   * Returns the sum of numeric values at the path. Non-numeric values are
   * skipped; returns `0` when nothing numeric is found.
   *
   * @param path - Optional dot-notated path.
   * @returns The numeric sum.
   *
   * @example
   * ```ts
   * resolve(users).sum("age"); // 93
   * ```
   */
  sum<P extends Path<ResolvedItem<T>>>(path?: P): SumResult<T> {
    const values = this.extractPathValues(path as string | undefined);
    if (values.length === 0) {
      return 0 as SumResult<T>;
    }
    let total = 0;
    for (const v of values) {
      if (typeof v === "number" && !Number.isNaN(v)) {
        total += v;
      }
    }
    return total as SumResult<T>;
  }

  /**
   * Returns the average of numeric values at the path. Non-numeric values are
   * skipped; returns `0` when nothing numeric is found.
   *
   * @param path - Optional dot-notated path.
   * @returns The numeric average.
   *
   * @example
   * ```ts
   * resolve(users).avg("age"); // 31
   * ```
   */
  avg<P extends Path<ResolvedItem<T>>>(path?: P): number {
    const values = this.extractPathValues(path as string | undefined);
    if (values.length === 0) {
      return 0;
    }
    const numbers = values.filter(
      (v): v is number => typeof v === "number" && !Number.isNaN(v)
    );
    if (numbers.length === 0) {
      return 0;
    }
    const total = numbers.reduce((a, b) => a + b, 0);
    return total / numbers.length;
  }

  /**
   * Returns the minimum comparable value at the path, or `undefined` when
   * no comparable value exists.
   *
   * @param path - Optional dot-notated path.
   * @returns The minimum value.
   *
   * @example
   * ```ts
   * resolve(users).min("age"); // 28
   * ```
   */
  min<P extends Path<ResolvedItem<T>>>(path?: P): unknown {
    const values = this.extractPathValues(path as string | undefined);
    const valid = values.filter((v) => v !== null && v !== undefined);
    if (valid.length === 0) {
      return undefined;
    }
    let minimum: any = valid[0];
    for (let i = 1; i < valid.length; i++) {
      if ((valid[i] as any) < minimum) {
        minimum = valid[i];
      }
    }
    return minimum;
  }

  /**
   * Returns the maximum comparable value at the path, or `undefined` when
   * no comparable value exists.
   *
   * @param path - Optional dot-notated path.
   * @returns The maximum value.
   *
   * @example
   * ```ts
   * resolve(users).max("age"); // 35
   * ```
   */
  max<P extends Path<ResolvedItem<T>>>(path?: P): unknown {
    const values = this.extractPathValues(path as string | undefined);
    const valid = values.filter((v) => v !== null && v !== undefined);
    if (valid.length === 0) {
      return undefined;
    }
    let maximum: any = valid[0];
    for (let i = 1; i < valid.length; i++) {
      if ((valid[i] as any) > maximum) {
        maximum = valid[i];
      }
    }
    return maximum;
  }

  /**
   * Returns the deduplicated values at the path, preserving source order.
   *
   * @param path - Optional dot-notated path.
   * @returns An array of unique values.
   *
   * @example
   * ```ts
   * resolve(users).unique("profile.city");
   * // ["Hyderabad", "Bengaluru"]
   * ```
   */
  unique<P extends Path<ResolvedItem<T>>>(path?: P): unknown[] {
    const values = this.extractPathValues(path as string | undefined);
    return Array.from(new Set(values));
  }

  /**
   * Alias for exists().
   */
  has<P extends Path<ResolvedItem<T>>>(path: P): boolean {
    return this.exists(path);
  }

  /**
   * Returns `true` if the path exists as a key on any item — even when the
   * value is `null` or `undefined`.
   *
   * @param path - Dot-notated path.
   * @returns `true` if the path exists.
   *
   * @example
   * ```ts
   * resolve([{ x: undefined }]).exists("x"); // true
   * resolve([{}]).exists("x");               // false
   * ```
   */
  exists<P extends Path<ResolvedItem<T>>>(path: P): boolean {
    const items = this.execute();
    for (const item of items) {
      if (this.itemPathExists(item, path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns `true` if the path exists on any item **and** its value is
   * non-nullish (`!== null && !== undefined`).
   *
   * @param path - Dot-notated path.
   * @returns `true` if the path exists with a non-nullish value.
   *
   * @example
   * ```ts
   * resolve([{ x: 0 }]).hasValue("x");        // true
   * resolve([{ x: undefined }]).hasValue("x"); // false
   * ```
   */
  hasValue<P extends Path<ResolvedItem<T>>>(path: P): boolean {
    const items = this.execute();
    for (const item of items) {
      if (this.itemPathHasValue(item, path)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Returns `true` when at least one item matches the matcher DSL.
   * Short-circuits on the first match.
   *
   * @param matcher - A matcher string, e.g. `"role=admin"`.
   * @returns `true` if any item matches.
   *
   * @example
   * ```ts
   * resolve(users).some("role=admin"); // true
   * ```
   */
  some<M extends string>(matcher: FilterMatcher<T, M>): boolean;

  /**
   * Returns `true` when any value found at the path satisfies the predicate.
   * Arrays along the path are traversed element-by-element.
   * Short-circuits on the first match.
   *
   * @param path - Dot-notated path.
   * @param predicate - Type-safe callback; its parameter type is inferred from the path.
   * @returns `true` if any value satisfies the predicate.
   *
   * @example
   * ```ts
   * resolve(team).some("members.role", (role) => role === "admin"); // true
   * ```
   */
  some<P extends Path<ResolvedItem<T>>>(
    path: P,
    predicate: (value: PathMatchValue<T, P>) => boolean
  ): boolean;

  some(
    matcherOrPath: string,
    predicate?: (value: any) => boolean
  ): boolean {
    if (typeof predicate === "function") {
      const items = this.execute();
      for (const item of items) {
        for (const val of this.extractPathMatchValues(item, matcherOrPath)) {
          try {
            if (Boolean(predicate(val))) {
              return true;
            }
          } catch {
            // Ignore errors during predicate evaluation
          }
        }
      }
      return false;
    }
    const parsed = parseMatcher(matcherOrPath);
    return this.execute().some((item) =>
      evaluateMatcher(item, parsed, (target, p) =>
        this.resolveItemValuesFlat(target, p)
      )
    );
  }

  /**
   * Returns `true` when every item matches the matcher DSL.
   * Returns `true` for empty collections.
   *
   * @param matcher - A matcher string, e.g. `"age>=18"`.
   * @returns `true` if all items match.
   *
   * @example
   * ```ts
   * resolve(users).every("age>=18"); // true
   * ```
   */
  every<M extends string>(matcher: FilterMatcher<T, M>): boolean;

  /**
   * Returns `true` when every value found at the path satisfies the predicate.
   * Arrays along the path are traversed element-by-element.
   * Returns `true` for empty collections. Short-circuits on the first failure.
   *
   * @param path - Dot-notated path.
   * @param predicate - Type-safe callback; its parameter type is inferred from the path.
   * @returns `true` if all values satisfy the predicate.
   *
   * @example
   * ```ts
   * resolve(team).every("members.role", (role) => role === "admin"); // false
   * ```
   */
  every<P extends Path<ResolvedItem<T>>>(
    path: P,
    predicate: (value: PathMatchValue<T, P>) => boolean
  ): boolean;

  every(
    matcherOrPath: string,
    predicate?: (value: any) => boolean
  ): boolean {
    if (typeof predicate === "function") {
      const items = this.execute();
      if (items.length === 0) return true;
      for (const item of items) {
        for (const val of this.extractPathMatchValues(item, matcherOrPath)) {
          try {
            if (!Boolean(predicate(val))) {
              return false;
            }
          } catch {
            return false;
          }
        }
      }
      return true;
    }
    const parsed = parseMatcher(matcherOrPath);
    const items = this.execute();
    if (items.length === 0) return true;
    return items.every((item) =>
      evaluateMatcher(item, parsed, (target, p) =>
        this.resolveItemValuesFlat(target, p)
      )
    );
  }

  /**
   * Returns `true` when no item matches the matcher DSL.
   * Short-circuits on the first match.
   *
   * @param matcher - A matcher string, e.g. `"role=guest"`.
   * @returns `true` if no item matches.
   *
   * @example
   * ```ts
   * resolve(users).none("role=guest"); // true
   * ```
   */
  none<M extends string>(matcher: FilterMatcher<T, M>): boolean;

  /**
   * Returns `true` when no value found at the path satisfies the predicate.
   * Arrays along the path are traversed element-by-element.
   * Short-circuits on the first match.
   *
   * @param path - Dot-notated path.
   * @param predicate - Type-safe callback; its parameter type is inferred from the path.
   * @returns `true` if no value satisfies the predicate.
   *
   * @example
   * ```ts
   * resolve(team).none("members.role", (role) => role === "manager"); // true
   * ```
   */
  none<P extends Path<ResolvedItem<T>>>(
    path: P,
    predicate: (value: PathMatchValue<T, P>) => boolean
  ): boolean;

  none(
    matcherOrPath: string,
    predicate?: (value: any) => boolean
  ): boolean {
    if (typeof predicate === "function") {
      return !this.some(matcherOrPath as any, predicate);
    }
    return !this.some(matcherOrPath as any);
  }

  /**
   * Returns the zero-based index of the first item in the **current collection**
   * whose path value satisfies the predicate or matches the matcher, or `-1`
   * if none match. Nested arrays are traversed only to test values; the
   * returned index always refers to the collection itself.
   *
   * @param matcher - A matcher string.
   * @returns The index, or `-1`.
   *
   * @example
   * ```ts
   * resolve(users).index("role=admin"); // 0
   * ```
   */
  index<M extends string>(matcher: FilterMatcher<T, M>): number;

  /**
   * Returns the zero-based index of the first item in the **current collection**
   * whose path value satisfies the predicate, or `-1` if none match.
   *
   * @param path - Dot-notated path.
   * @param predicate - Type-safe callback; its parameter type is inferred from the path.
   * @returns The index, or `-1`.
   *
   * @example
   * ```ts
   * resolve(teams).index("members.role", (role) => role === "admin"); // 0
   * ```
   */
  index<P extends Path<ResolvedItem<T>>>(
    path: P,
    predicate: (value: PathMatchValue<T, P>) => boolean
  ): number;

  index(
    matcherOrPath: string,
    predicate?: (value: any) => boolean
  ): number {
    const items = this.execute();
    if (typeof predicate === "function") {
      for (let i = 0; i < items.length; i++) {
        for (const val of this.extractPathMatchValues(items[i], matcherOrPath)) {
          try {
            if (Boolean(predicate(val))) {
              return i;
            }
          } catch {
            // Ignore
          }
        }
      }
      return -1;
    }
    const parsed = parseMatcher(matcherOrPath);
    for (let i = 0; i < items.length; i++) {
      const matches = evaluateMatcher(items[i], parsed, (target, p) =>
        this.resolveItemValuesFlat(target, p)
      );
      if (matches) {
        return i;
      }
    }
    return -1;
  }

  /**
   * Groups the objects that produced each grouping value into a typed
   * dictionary keyed by `String(value)`.
   *
   * - Paths through intermediate arrays group the descendant objects.
   * - Array-valued properties place the item in every matching bucket.
   * - Missing/`undefined` values group under `"undefined"`; `null` under `"null"`.
   *
   * @param path - Dot-notated path, e.g. `"role"` or `"members.role"`.
   * @returns A typed dictionary of grouped items.
   *
   * @example
   * ```ts
   * resolve(users).groupBy("role");
   * // { admin: [John, Alice], user: [Shan] }
   * ```
   */
  groupBy<P extends GroupablePath<ResolvedItem<T>>>(
    path: P
  ): GroupResult<T, P> {
    const groups: Record<string, any[]> = {};
    const items = this.execute();

    for (const item of items) {
      const entries = this.resolveGroupEntries(item, path as string);
      for (const entry of entries) {
        const { target, value } = entry;
        const rawValues = Array.isArray(value) ? flattenDeep(value) : [value];
        const distinctKeys = Array.from(
          new Set(
            rawValues.map((v) =>
              v === undefined ? "undefined" : v === null ? "null" : String(v)
            )
          )
        );
        for (const key of distinctKeys) {
          (groups[key] ??= []).push(target);
        }
      }
    }

    return groups as GroupResult<T, P>;
  }

  /**
   * Returns the first item or undefined if empty.
   * Terminal: returns actual typed item or undefined.
   */
  first(): ResolvedItem<T> | undefined {
    const items = this.execute();
    return items.length > 0 ? (items[0] as ResolvedItem<T>) : undefined;
  }

  /**
   * Returns the last item or undefined if empty.
   * Terminal: returns actual typed item or undefined.
   */
  last(): ResolvedItem<T> | undefined {
    const items = this.execute();
    return items.length > 0
      ? (items[items.length - 1] as ResolvedItem<T>)
      : undefined;
  }

  /* ==========================================================
   * ITERABLE & LENGTH
   * ======================================================== */

  /**
   * Number of items currently resolved.
   */
  get length(): number {
    return this.execute().length;
  }

  /**
   * Allows iteration over resolved items.
   */
  *[Symbol.iterator](): IterableIterator<ResolvedItem<T>> {
    yield* this.execute() as ResolvedItem<T>[];
  }

  /* ==========================================================
   * EXECUTION ENGINE
   * ======================================================== */

  private execute(): unknown[] {
    if (this.cachedResult !== undefined) {
      return this.cachedResult;
    }

    if (this.source === null || this.source === undefined) {
      this.cachedResult = [];
      return this.cachedResult;
    }

    let current: unknown[] = Array.isArray(this.source)
      ? [...this.source]
      : [this.source];

    for (const op of this.operations) {
      if (op.type === "filter") {
        const parsed = parseMatcher(op.matcher);
        current = current.filter((item) =>
          evaluateMatcher(item, parsed, (target, p) =>
            this.resolveItemValuesFlat(target, p)
          )
        );
      } else if (op.type === "filterPredicate") {
        const matchedItems: unknown[] = [];
        const seen = new Set<unknown>();

        for (const item of current) {
          const rawEntries = this.resolveGroupEntries(item, op.path);
          for (const entry of rawEntries) {
            const { target, value } = entry;
            if (
              Array.isArray(value) &&
              target === item &&
              value.length > 0 &&
              typeof value[0] === "object" &&
              value[0] !== null
            ) {
              for (const elem of flattenDeep(value)) {
                if (!seen.has(elem)) {
                  try {
                    if (Boolean(op.predicate(elem))) {
                      seen.add(elem);
                      matchedItems.push(elem);
                    }
                  } catch {
                    // Ignore errors during predicate evaluation
                  }
                }
              }
            } else if (Array.isArray(value)) {
              if (!seen.has(target)) {
                for (const elem of flattenDeep(value)) {
                  try {
                    if (Boolean(op.predicate(elem))) {
                      seen.add(target);
                      matchedItems.push(target);
                      break;
                    }
                  } catch {
                    // Ignore
                  }
                }
              }
            } else {
              if (!seen.has(target)) {
                try {
                  if (Boolean(op.predicate(value))) {
                    seen.add(target);
                    matchedItems.push(target);
                  }
                } catch {
                  // Ignore
                }
              }
            }
          }
        }
        current = matchedItems;
      } else if (op.type === "at") {
        const targetIndex =
          op.index < 0 ? current.length + op.index : op.index;
        if (targetIndex >= 0 && targetIndex < current.length) {
          current = [current[targetIndex]];
        } else {
          current = [];
        }
      }

      if (current.length === 0) {
        break;
      }
    }

    this.cachedResult = current;
    return this.cachedResult;
  }

  private extractPathValues(path?: string): unknown[] {
    const items = this.execute();
    if (!path) {
      return flattenDeep(items);
    }

    const result: unknown[] = [];
    for (const item of items) {
      result.push(...this.resolveItemValues(item, path));
    }
    return flattenDeep(result);
  }

  private *extractPathMatchValues(
    item: unknown,
    path: string
  ): IterableIterator<unknown> {
    const rawEntries = this.resolveGroupEntries(item, path);
    for (const entry of rawEntries) {
      const { target, value } = entry;
      if (
        Array.isArray(value) &&
        target === item &&
        value.length > 0 &&
        typeof value[0] === "object" &&
        value[0] !== null
      ) {
        for (const elem of flattenDeep(value)) {
          yield elem;
        }
      } else if (Array.isArray(value)) {
        for (const elem of flattenDeep(value)) {
          yield elem;
        }
      } else {
        yield value;
      }
    }
  }

  private resolveGroupEntries(
    item: unknown,
    path: string
  ): { target: unknown; value: unknown }[] {
    if (item === null || item === undefined || typeof item !== "object") {
      return [{ target: item, value: undefined }];
    }

    const segments = Resolve.parsePath(path);
    let currentEntries: { current: unknown; target: unknown }[] = [
      { current: item, target: item },
    ];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const isLast = i === segments.length - 1;
      const nextIsIndex = !isLast && segments[i + 1]?.type === "index";
      const nextEntries: { current: unknown; target: unknown }[] = [];

      for (const entry of currentEntries) {
        const { current, target } = entry;

        if (current === null || current === undefined || typeof current !== "object") {
          nextEntries.push({ current: undefined, target });
          continue;
        }

        if (segment.type === "property") {
          const key = segment.key;
          if (Array.isArray(current)) {
            for (const elem of current) {
              if (elem !== null && elem !== undefined && typeof elem === "object" && key in elem) {
                const val = (elem as any)[key];
                const nextTarget =
                  isLast || nextIsIndex
                    ? elem
                    : typeof val === "object" && val !== null
                      ? elem
                      : target;
                nextEntries.push({ current: val, target: nextTarget });
              } else {
                nextEntries.push({ current: undefined, target: elem });
              }
            }
          } else if (key in current) {
            const val = (current as any)[key];
            const nextTarget =
              Array.isArray(val) && !isLast
                ? target
                : target;
            nextEntries.push({ current: val, target: nextTarget });
          } else {
            nextEntries.push({ current: undefined, target });
          }
        } else if (segment.type === "index") {
          const idx = segment.index;
          if (Array.isArray(current)) {
            const actualIdx = idx < 0 ? current.length + idx : idx;
            const elem = current[actualIdx];
            const nextTarget =
              elem !== null && typeof elem === "object" && !isLast
                ? elem
                : target;
            nextEntries.push({ current: elem, target: nextTarget });
          } else {
            nextEntries.push({ current: undefined, target });
          }
        }
      }

      currentEntries = nextEntries;
    }

    return currentEntries.map((e) => ({
      target: e.target,
      value: e.current,
    }));
  }

  private resolveItemValues(
    item: unknown,
    path: string
  ): unknown[] {
    if (item === null || item === undefined || typeof item !== "object") {
      return [];
    }

    const segments = Resolve.parsePath(path);
    let currentNodes: unknown[] = [item];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const isLast = i === segments.length - 1;
      const nextIsIndex = !isLast && segments[i + 1]?.type === "index";
      const nextNodes: unknown[] = [];

      for (const node of currentNodes) {
        if (node === null || node === undefined || typeof node !== "object") {
          continue;
        }

        if (segment.type === "property") {
          const key = segment.key;
          if (Array.isArray(node)) {
            for (const elem of node) {
              if (elem !== null && elem !== undefined && typeof elem === "object" && key in elem) {
                const val = (elem as any)[key];
                if (Array.isArray(val)) {
                  if (isLast || nextIsIndex) {
                    nextNodes.push(val);
                  } else {
                    nextNodes.push(...val);
                  }
                } else {
                  nextNodes.push(val);
                }
              }
            }
          } else if (key in node) {
            const val = (node as any)[key];
            if (Array.isArray(val)) {
              if (isLast || nextIsIndex) {
                nextNodes.push(val);
              } else {
                nextNodes.push(...val);
              }
            } else {
              nextNodes.push(val);
            }
          }
        } else if (segment.type === "index") {
          const idx = segment.index;
          if (Array.isArray(node)) {
            const actualIdx = idx < 0 ? node.length + idx : idx;
            if (actualIdx >= 0 && actualIdx < node.length) {
              nextNodes.push(node[actualIdx]);
            }
          }
        }
      }

      currentNodes = nextNodes;
    }

    return currentNodes;
  }

  private resolveItemValuesFlat(
    item: unknown,
    path: string
  ): unknown[] {
    const values = this.resolveItemValues(item, path);
    return flattenDeep(values);
  }

  private itemPathExists(item: unknown, path: string): boolean {
    if (item === null || item === undefined || typeof item !== "object") {
      return false;
    }

    const segments = Resolve.parsePath(path);
    let currentNodes: unknown[] = [item];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const isLast = i === segments.length - 1;
      const nextIsIndex = !isLast && segments[i + 1]?.type === "index";
      const nextNodes: unknown[] = [];
      let matchedInSegment = false;

      for (const node of currentNodes) {
        if (node === null || node === undefined || typeof node !== "object") {
          continue;
        }

        if (segment.type === "property") {
          const key = segment.key;
          if (Array.isArray(node)) {
            for (const elem of node) {
              if (elem !== null && elem !== undefined && typeof elem === "object" && key in elem) {
                matchedInSegment = true;
                const val = (elem as any)[key];
                if (Array.isArray(val)) {
                  if (isLast || nextIsIndex) {
                    nextNodes.push(val);
                  } else {
                    nextNodes.push(...val);
                  }
                } else {
                  nextNodes.push(val);
                }
              }
            }
          } else if (key in node) {
            matchedInSegment = true;
            const val = (node as any)[key];
            if (Array.isArray(val)) {
              if (isLast || nextIsIndex) {
                nextNodes.push(val);
              } else {
                nextNodes.push(...val);
              }
            } else {
              nextNodes.push(val);
            }
          }
        } else if (segment.type === "index") {
          const idx = segment.index;
          if (Array.isArray(node)) {
            const actualIdx = idx < 0 ? node.length + idx : idx;
            if (actualIdx >= 0 && actualIdx < node.length) {
              matchedInSegment = true;
              nextNodes.push(node[actualIdx]);
            }
          }
        }
      }

      if (!matchedInSegment && nextNodes.length === 0) {
        return false;
      }

      currentNodes = nextNodes;
    }

    return currentNodes.length > 0;
  }

  private itemPathHasValue(item: unknown, path: string): boolean {
    if (item === null || item === undefined || typeof item !== "object") {
      return false;
    }

    const segments = Resolve.parsePath(path);
    let currentNodes: unknown[] = [item];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      const isLast = i === segments.length - 1;
      const nextIsIndex = !isLast && segments[i + 1]?.type === "index";
      const nextNodes: unknown[] = [];

      for (const node of currentNodes) {
        if (node === null || node === undefined || typeof node !== "object") {
          continue;
        }

        if (segment.type === "property") {
          const key = segment.key;
          if (Array.isArray(node)) {
            for (const elem of node) {
              if (elem !== null && elem !== undefined && typeof elem === "object" && key in elem) {
                const val = (elem as any)[key];
                if (val !== null && val !== undefined) {
                  if (Array.isArray(val)) {
                    if (isLast || nextIsIndex) {
                      nextNodes.push(val);
                    } else {
                      nextNodes.push(...val);
                    }
                  } else {
                    nextNodes.push(val);
                  }
                }
              }
            }
          } else if (key in node) {
            const val = (node as any)[key];
            if (val !== null && val !== undefined) {
              if (Array.isArray(val)) {
                if (isLast || nextIsIndex) {
                  nextNodes.push(val);
                } else {
                  nextNodes.push(...val);
                }
              } else {
                nextNodes.push(val);
              }
            }
          }
        } else if (segment.type === "index") {
          const idx = segment.index;
          if (Array.isArray(node)) {
            const actualIdx = idx < 0 ? node.length + idx : idx;
            if (actualIdx >= 0 && actualIdx < node.length) {
              const val = node[actualIdx];
              if (val !== null && val !== undefined) {
                nextNodes.push(val);
              }
            }
          }
        }
      }

      currentNodes = nextNodes;
    }

    return currentNodes.length > 0;
  }

  private isPathTraversingArray(path: string, item: unknown): boolean {
    const segments = Resolve.parsePath(path);
    let current: unknown = item;
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!;
      if (segment.type === "property") {
        if (Array.isArray(current)) {
          return true;
        }
        if (current !== null && typeof current === "object" && segment.key in current) {
          current = (current as any)[segment.key];
        } else {
          return false;
        }
      } else if (segment.type === "index") {
        if (Array.isArray(current)) {
          const idx = segment.index < 0 ? current.length + segment.index : segment.index;
          current = current[idx];
        } else {
          return false;
        }
      }
    }
    return Array.isArray(current);
  }

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

    const regex = /([^[.\]]+)|\[(-?\d+)\]/g;
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
 * Wraps a single object or an array collection for type-safe, fluent querying.
 *
 * @template T - The type of the data.
 * @param source - A single object or an array of objects.
 * @returns A `Resolve<T>` instance.
 *
 * @example
 * ```ts
 * resolve(users).filter("role=admin").get("name");
 * // ["John", "Alice"]
 * ```
 */
export function resolve<T>(source: T): Resolve<T> {
  return Resolve.from(source);
}
