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