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
 * RESOLVE CLASS
 * ========================================================== */

export class Resolve<T> {
  private constructor(
    private readonly source: T,
    private readonly operations: readonly Operation[] = []
  ) {}

  /* ==========================================================
   * FACTORY
   * ======================================================== */

  static from<T>(source: T): Resolve<T> {
    return new Resolve(source);
  }

  /* ==========================================================
   * GET
   * ======================================================== */

  get<P extends Path<T>>(
    path: P
  ): Resolve<ValueAtPath<T, P>>;

  get(
    matcher: Matcher<T>
  ): Resolve<T>;

  get(
    pathOrMatcher: string
  ): Resolve<any> {
    if (pathOrMatcher.includes(":")) {
      return new Resolve(this.source, [
        ...this.operations,
        {
          type: "where",
          value: pathOrMatcher,
        },
      ]);
    }

    return new Resolve(this.source as any, [
      ...this.operations,
      {
        type: "path",
        value: pathOrMatcher,
      },
    ]);
  }

  /* ==========================================================
   * WHERE
   * ======================================================== */

  where(matcher: Matcher<T>): Resolve<T>;
  where(matcher: string): Resolve<any> {
    return new Resolve(this.source, [
      ...this.operations,
      {
        type: "where",
        value: matcher,
      },
    ]);
  }

  /* ==========================================================
   * AT
   * ======================================================== */

  at(
    index: number
  ): Resolve<ArrayItem<T> extends never ? T : ArrayItem<T>> {
    return new Resolve(this.source, [
      ...this.operations,
      {
        type: "index",
        value: index,
      },
    ]) as Resolve<ArrayItem<T> extends never ? T : ArrayItem<T>>;
  }

  /* ==========================================================
   * TERMINAL METHODS
   * ======================================================== */

  values(): ResolvedItem<T>[] {
    return this.execute() as ResolvedItem<T>[];
  }

  value(): ResolvedItem<T> | undefined {
    const results = this.execute();
    return results.length > 0 ? (results[0] as ResolvedItem<T>) : undefined;
  }

  first(): ResolvedItem<T> | undefined {
    const results = this.execute();
    return results.length > 0 ? (results[0] as ResolvedItem<T>) : undefined;
  }

  last(): ResolvedItem<T> | undefined {
    const results = this.execute();
    return results.length > 0
      ? (results[results.length - 1] as ResolvedItem<T>)
      : undefined;
  }

  count(): number {
    return this.execute().length;
  }

  exists(): boolean {
    return this.execute().length > 0;
  }

  equals(expected: ResolvedItem<T>): ResolvedItem<T>[] {
    return this.execute().filter((value) => {
      if (value instanceof Date && expected instanceof Date) {
        return value.getTime() === expected.getTime();
      }
      return value === expected;
    }) as ResolvedItem<T>[];
  }

  notEquals(expected: ResolvedItem<T>): ResolvedItem<T>[] {
    return this.execute().filter((value) => {
      if (value instanceof Date && expected instanceof Date) {
        return value.getTime() !== expected.getTime();
      }
      return value !== expected;
    }) as ResolvedItem<T>[];
  }

  contains(expected: ContainsTarget<T>): ResolvedItem<T>[] {
    const isExpectedString = typeof expected === "string";
    const needle = isExpectedString
      ? (expected as string).toLowerCase()
      : undefined;

    return this.execute().filter((value) => {
      if (value === expected) {
        return true;
      }

      if (value instanceof Date && expected instanceof Date) {
        return value.getTime() === expected.getTime();
      }

      if (Array.isArray(value)) {
        return value.includes(expected);
      }

      if (typeof value === "string" && needle !== undefined) {
        return value.toLowerCase().includes(needle);
      }

      return false;
    }) as ResolvedItem<T>[];
  }

  startsWith(expected: string): ResolvedItem<T>[] {
    return this.execute().filter(
      (value) => typeof value === "string" && value.startsWith(expected)
    ) as ResolvedItem<T>[];
  }

  endsWith(expected: string): ResolvedItem<T>[] {
    return this.execute().filter(
      (value) => typeof value === "string" && value.endsWith(expected)
    ) as ResolvedItem<T>[];
  }

  greaterThan(expected: Comparable): ResolvedItem<T>[] {
    return this.execute().filter((value) => {
      const diff = Resolve.compare(value, expected);
      return diff !== null && diff > 0;
    }) as ResolvedItem<T>[];
  }

  greaterThanOrEqual(expected: Comparable): ResolvedItem<T>[] {
    return this.execute().filter((value) => {
      const diff = Resolve.compare(value, expected);
      return diff !== null && diff >= 0;
    }) as ResolvedItem<T>[];
  }

  lessThan(expected: Comparable): ResolvedItem<T>[] {
    return this.execute().filter((value) => {
      const diff = Resolve.compare(value, expected);
      return diff !== null && diff < 0;
    }) as ResolvedItem<T>[];
  }

  lessThanOrEqual(expected: Comparable): ResolvedItem<T>[] {
    return this.execute().filter((value) => {
      const diff = Resolve.compare(value, expected);
      return diff !== null && diff <= 0;
    }) as ResolvedItem<T>[];
  }

  isNull(): ResolvedItem<T>[] {
    return this.execute().filter(
      (value) => value === null
    ) as ResolvedItem<T>[];
  }

  isUndefined(): ResolvedItem<T>[] {
    return this.execute().filter(
      (value) => value === undefined
    ) as ResolvedItem<T>[];
  }

  isTruthy(): ResolvedItem<T>[] {
    return this.execute().filter((value) =>
      Boolean(value)
    ) as ResolvedItem<T>[];
  }

  isFalsy(): ResolvedItem<T>[] {
    return this.execute().filter((value) => !value) as ResolvedItem<T>[];
  }

  matches(regex: RegExp): ResolvedItem<T>[] {
    const cleanRegex =
      regex.global || regex.sticky
        ? new RegExp(regex.source, regex.flags.replace(/[gy]/g, ""))
        : regex;

    return this.execute().filter(
      (value) => typeof value === "string" && cleanRegex.test(value)
    ) as ResolvedItem<T>[];
  }

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
        current = this.applyIndex(current, segment.index);
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
      if (item === undefined) {
        return [];
      }
      if (Array.isArray(item)) {
        return [...item];
      }
      return [item];
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
 */
export function resolve<T>(source: T): Resolve<T> {
  return Resolve.from(source);
}