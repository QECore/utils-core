/**
 * Primitive scalar value types.
 *
 * @example
 * ```ts
 * const val: Primitive = "hello";
 * ```
 */
export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

/**
 * Extracts string keys from an object type.
 *
 * @example
 * ```ts
 * type Keys = StringKey<{ name: string; age: number }>;
 * // "name" | "age"
 * ```
 */
export type StringKey<T> = Extract<keyof T, string>;

/**
 * Extracts the item type from an array, or `never` if not an array.
 *
 * @example
 * ```ts
 * type Item = ArrayItem<string[]>;
 * // string
 * ```
 */
export type ArrayItem<T> =
  T extends readonly (infer U)[] ? U : never;

/**
 * Resolves the underlying element type if `T` is an array, or returns `T` directly.
 *
 * @example
 * ```ts
 * type A = ResolvedItem<string[]>; // string
 * type B = ResolvedItem<number>;   // number
 * ```
 */
export type ResolvedItem<T> =
  T extends readonly (infer U)[] ? U : T;

/**
 * Evaluates the return type of `sum()` based on the collection item type.
 * Evaluates to `number` for number arrays, `string` for string arrays, and `never` for unsupported types.
 *
 * @example
 * ```ts
 * type N = SumResult<number[]>; // number
 * type S = SumResult<string[]>; // string
 * type X = SumResult<boolean[]>; // never
 * ```
 */
export type SumResult<T> =
  ResolvedItem<T> extends number
    ? number
    : ResolvedItem<T> extends string
      ? string
      : never;

/**
 * Target type for `contains()` filtering: substring needle for strings, or exact element value for arrays.
 *
 * @example
 * ```ts
 * type StrTarget = ContainsTarget<string>;   // string
 * type ArrTarget = ContainsTarget<number[]>; // number
 * ```
 */
export type ContainsTarget<T> =
  T extends readonly (infer U)[]
    ? U
    : string;

/* ============================================================
 * PATH TYPES
 * ========================================================== */

/**
 * Type-safe dot-notated and indexed property paths for a given type `T`.
 *
 * @example
 * ```ts
 * type UserPaths = Path<{ users: [{ name: string }] }>;
 * // "users" | "users.name" | "users[0].name" | ...
 * ```
 */
export type Path<T> =
  T extends readonly (infer U)[]
    ? ArrayPath<U>
    : T extends object
      ? ObjectPath<T>
      : never;

type ObjectPath<T extends object> = {
  [K in StringKey<T>]:
    T[K] extends Primitive
      ? K
      : T[K] extends readonly (infer U)[]
        ? K
          | `${K}.${Path<U>}`
          | `${K}[${number}]`
          | `${K}[${number}]${ArrayPath<U> extends `[${string}` ? ArrayPath<U> : never}`
          | `${K}[${number}].${Path<U>}`
        : K
          | `${K}.${Path<T[K]>}`;
}[StringKey<T>];

type ArrayPath<T> =
  T extends Primitive
    ? `[${number}]`
    : T extends readonly (infer U)[]
      ? `[${number}]` | `[${number}]${ArrayPath<U>}` | `[${number}].${ArrayPath<U>}` | ArrayPath<U>
      : T extends object
        ? ObjectPath<T> | `[${number}]` | `[${number}]${Path<T> extends `[${string}` ? Path<T> : never}` | `[${number}].${Path<T>}`
        : never;

/* ============================================================
 * MATCHER
 * ========================================================== */

/**
 * Strongly-typed path matcher string formatted as `"path:expectedValue"`.
 *
 * @example
 * ```ts
 * type TeamMatcher = Matcher<{ lead: { role: string } }>;
 * // "lead.role:string" | "lead.role:number" | ...
 * ```
 */
export type Matcher<T> =
  T extends readonly (infer U)[]
    ? Matcher<U>
    : T extends object
      ? {
          [P in Path<T>]: `${P}:${string | number | boolean}`;
        }[Path<T>]
      : never;

/* ============================================================
 * VALUE AT PATH
 * ========================================================== */

/**
 * Resolves the TypeScript type located at the specified dot-notated or indexed path `P` in `T`.
 *
 * @example
 * ```ts
 * type Name = ValueAtPath<{ users: [{ name: string }] }, "users.name">;
 * // string
 * ```
 */
export type ValueAtPath<
  T,
  P extends string
> =
  T extends readonly (infer U)[]
    ? P extends `[${number}]${infer Rest}`
      ? Rest extends `.${infer R}`
        ? ValueAtPath<U, R>
        : Rest extends `[${number}]${string}`
          ? ValueAtPath<U, Rest>
          : U
      : ValueAtPath<U, P>

    : P extends `${infer K}[${number}]${infer Rest}`
      ? K extends keyof T
        ? T[K] extends readonly (infer U)[]
          ? Rest extends `.${infer R}`
            ? ValueAtPath<U, R>
            : Rest extends `[${number}]${string}`
              ? ValueAtPath<U, Rest>
              : U
          : never
        : never

    : P extends `${infer K}.${infer Rest}`
      ? K extends keyof T
        ? ValueAtPath<T[K], Rest>
        : never

    : P extends keyof T
      ? T[P]
      : never;

/* ============================================================
 * COMPARABLE
 * ========================================================== */

/**
 * Values supporting relative order comparison (e.g. `greaterThan`, `lessThan`).
 *
 * @example
 * ```ts
 * const date: Comparable = new Date("2025-01-01");
 * const num: Comparable = 42;
 * ```
 */
export type Comparable =
  | string
  | number
  | bigint
  | Date;

/* ============================================================
 * NEGATED PREDICATES
 * ========================================================== */

/**
 * Fluent namespace exposing inverted (negated) predicate filtering methods for `Resolve<T>`.
 *
 * @example
 * ```ts
 * resolve(users).get("age").not.equals(30);
 * resolve(roles).not.contains("admin");
 * ```
 */
export interface NegatedPredicates<T> {
  /**
   * Filters items not equal to the expected value.
   *
   * @param expected Target value compatible with the resolved type.
   *
   * @example
   * ```ts
   * resolve(users).get("age").not.equals(30);
   * // [22, 40]
   * ```
   */
  equals(expected: ResolvedItem<T>): ResolvedItem<T>[];

  /**
   * Filters items not containing the target:
   * - For strings: inverted case-insensitive substring search.
   * - For arrays: inverted element membership (no string coercion).
   *
   * @param expected Substring needle for strings, or exact element value for arrays.
   *
   * @example
   * ```ts
   * resolve(["apple", "banana"]).not.contains("app"); // ["banana"]
   * resolve(["admin", "user"]).not.contains("admin"); // ["user"]
   * ```
   */
  contains(expected: ContainsTarget<T>): ResolvedItem<T>[];

  /**
   * Filters items not starting with the specified prefix.
   *
   * @param expected Prefix string.
   *
   * @example
   * ```ts
   * resolve(["apple", "banana"]).not.startsWith("app");
   * // ["banana"]
   * ```
   */
  startsWith(expected: string): ResolvedItem<T>[];

  /**
   * Filters items not ending with the specified suffix.
   *
   * @param expected Suffix string.
   *
   * @example
   * ```ts
   * resolve(["apple", "banana"]).not.endsWith("le");
   * // ["banana"]
   * ```
   */
  endsWith(expected: string): ResolvedItem<T>[];

  /**
   * Filters values not strictly greater than the expected value (i.e. <= or incomparable).
   *
   * @param expected Comparable boundary (number, string, bigint, or Date).
   *
   * @example
   * ```ts
   * resolve([10, 20, 30]).not.greaterThan(20);
   * // [10, 20]
   * ```
   */
  greaterThan(expected: Comparable): ResolvedItem<T>[];

  /**
   * Filters values not greater than or equal to the expected value (i.e. < or incomparable).
   *
   * @param expected Comparable boundary.
   *
   * @example
   * ```ts
   * resolve([10, 20, 30]).not.greaterThanOrEqual(20);
   * // [10]
   * ```
   */
  greaterThanOrEqual(expected: Comparable): ResolvedItem<T>[];

  /**
   * Filters values not strictly less than the expected value (i.e. >= or incomparable).
   *
   * @param expected Comparable boundary.
   *
   * @example
   * ```ts
   * resolve([10, 20, 30]).not.lessThan(20);
   * // [20, 30]
   * ```
   */
  lessThan(expected: Comparable): ResolvedItem<T>[];

  /**
   * Filters values not less than or equal to the expected value (i.e. > or incomparable).
   *
   * @param expected Comparable boundary.
   *
   * @example
   * ```ts
   * resolve([10, 20, 30]).not.lessThanOrEqual(20);
   * // [30]
   * ```
   */
  lessThanOrEqual(expected: Comparable): ResolvedItem<T>[];

  /**
   * Filters values that are not strictly null.
   *
   * @example
   * ```ts
   * resolve([null, 1, 2]).not.isNull();
   * // [1, 2]
   * ```
   */
  isNull(): ResolvedItem<T>[];

  /**
   * Filters values that are not strictly undefined.
   *
   * @example
   * ```ts
   * resolve([undefined, 1, 2]).not.isUndefined();
   * // [1, 2]
   * ```
   */
  isUndefined(): ResolvedItem<T>[];

  /**
   * Filters values that are not truthy (i.e. falsy).
   *
   * @example
   * ```ts
   * resolve([0, 1, false, "text"]).not.isTruthy();
   * // [0, false]
   * ```
   */
  isTruthy(): ResolvedItem<T>[];

  /**
   * Filters values that are not falsy (i.e. truthy).
   *
   * @example
   * ```ts
   * resolve([0, 1, false, "text"]).not.isFalsy();
   * // [1, "text"]
   * ```
   */
  isFalsy(): ResolvedItem<T>[];

  /**
   * Filters values that do not match the regular expression pattern.
   *
   * @param regex Target regular expression pattern.
   *
   * @example
   * ```ts
   * resolve(["Alice", "Bob"]).not.matches(/^A/);
   * // ["Bob"]
   * ```
   */
  matches(regex: RegExp): ResolvedItem<T>[];
}