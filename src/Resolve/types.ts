/**
 * Primitive scalar value types.
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
 * Extracts string keys from an object type, distributing over unions.
 */
export type StringKey<T> = T extends unknown ? Extract<keyof T, string> : never;

/**
 * Extracts the item type from an array, or `never` if not an array.
 */
export type ArrayItem<T> =
  T extends readonly (infer U)[] ? U : never;

/**
 * Resolves the underlying element type if `T` is an array, or returns `T` directly.
 */
export type ResolvedItem<T> =
  T extends readonly (infer U)[] ? U : T;

/* ============================================================
 * PATH TYPES
 * ========================================================== */

/**
 * Type-safe dot-notated and indexed property paths for a given type `T`.
 * Distributes over unions of object types.
 */
export type Path<T> =
  T extends readonly (infer U)[]
    ? ArrayPath<NonNullable<U>>
    : T extends object
      ? ObjectPath<NonNullable<T>>
      : never;

type ObjectPath<T extends object> = T extends object ? {
  [K in StringKey<T>]:
    [T[K]] extends [Primitive]
      ? K
      : [NonNullable<T[K]>] extends [never]
        ? K
        : NonNullable<T[K]> extends readonly (infer U)[]
          ? K
            | `${K}.${Path<NonNullable<U>>}`
            | `${K}[${number}]`
            | `${K}[${number}]${ArrayPath<NonNullable<U>> extends `[${string}` ? ArrayPath<NonNullable<U>> : never}`
            | `${K}[${number}].${Path<NonNullable<U>>}`
          : K
            | `${K}.${Path<NonNullable<T[K]>>}`;
}[StringKey<T>] : never;

type ArrayPath<T> = T extends unknown ? (
  [T] extends [Primitive]
    ? `[${number}]`
    : [NonNullable<T>] extends [never]
      ? `[${number}]`
      : T extends readonly (infer U)[]
        ? `[${number}]` | `[${number}]${ArrayPath<NonNullable<U>>}` | `[${number}].${ArrayPath<NonNullable<U>>}` | ArrayPath<NonNullable<U>>
        : T extends object
          ? ObjectPath<T> | `[${number}]` | `[${number}]${Path<T> extends `[${string}` ? Path<T> : never}` | `[${number}].${Path<T>}`
          : never
) : never;

/* ============================================================
 * VALUE AT PATH & ABSENCE TRACKING
 * ========================================================== */

/**
 * Strips optionality/nullability and indexed array multiplicity to drill
 * down to the raw underlying TypeScript type at path `P`, distributing over unions.
 */
export type RawValueAtPath<T, P extends string> =
  T extends unknown
    ? NonNullable<T> extends readonly (infer U)[]
      ? P extends `[${number}]${infer Rest}`
        ? Rest extends `.${infer R}`
          ? RawValueAtPath<NonNullable<U>, R>
          : Rest extends `[${number}]${string}`
            ? RawValueAtPath<NonNullable<U>, Rest>
            : NonNullable<U>
        : RawValueAtPath<NonNullable<U>, P>

      : P extends `${infer K}[${number}]${infer Rest}`
        ? K extends keyof NonNullable<T>
          ? NonNullable<NonNullable<T>[K]> extends readonly (infer U)[]
            ? Rest extends `.${infer R}`
              ? RawValueAtPath<NonNullable<U>, R>
              : Rest extends `[${number}]${string}`
                ? RawValueAtPath<NonNullable<U>, Rest>
                : NonNullable<U>
            : never
          : never

      : P extends `${infer K}.${infer Rest}`
        ? K extends keyof NonNullable<T>
          ? RawValueAtPath<NonNullable<NonNullable<T>[K]>, Rest>
          : never

      : P extends keyof NonNullable<T>
        ? {} extends Pick<NonNullable<T>, P>
          ? Exclude<NonNullable<T>[P], undefined>
          : NonNullable<T>[P]
        : never
    : never;

type SinglePathInjectsUndefined<T, P extends string> =
  undefined extends T
    ? true
    : null extends T
      ? true
      : P extends `${string}[${number}]${string}`
        ? true
        : P extends `${infer K}.${infer Rest}`
          ? K extends keyof NonNullable<T>
            ? undefined extends NonNullable<T>[K]
              ? true
              : null extends NonNullable<T>[K]
                ? true
                : NonNullable<T>[K] extends readonly (infer U)[]
                  ? Rest extends `${string}[${number}]${string}`
                    ? SinglePathInjectsUndefined<U, Rest>
                    : false
                  : SinglePathInjectsUndefined<NonNullable<T>[K], Rest>
            : true
          : P extends keyof NonNullable<T>
            ? undefined extends NonNullable<T>[P]
              ? true
              : false
            : true;

/**
 * True when the PATH (not the leaf value) can produce absence:
 *  - an intermediate segment that is optional (undefined) or nullable (null — traversal stops)
 *  - an explicit array index [n] that may not exist
 *  - a path that exists on only some union members
 * A nullable LEAF does NOT inject undefined; RawValueAtPath preserves its null.
 */
export type PathInjectsUndefined<T, P extends string> =
  true extends (T extends unknown ? SinglePathInjectsUndefined<T, P> : never)
    ? true
    : false;

/**
 * Resolves the TypeScript type located at the specified dot-notated or indexed path `P` in `T`,
 * preserving any accumulated undefined/nullability from source, intermediate, or index segments.
 */
export type ValueAtPath<T, P extends string> =
  PathInjectsUndefined<T, P> extends true
    ? RawValueAtPath<T, P> | undefined
    : RawValueAtPath<T, P>;

/* ============================================================
 * NUMERIC PATH
 * ========================================================== */

/**
 * Filter paths of `T` to only those that resolve to numbers.
 */
export type NumericPath<T> = {
  [P in Path<T>]: [FlatItem<NonNullable<RawValueAtPath<T, P>>>] extends [number] ? P : never;
}[Path<T>];

/* ============================================================
 * PATH TRAVERSAL & GET RETURN TYPE
 * ========================================================== */

type SinglePathTraversesArray<T, P extends string> =
  [T] extends [never]
    ? false
    : [T] extends [readonly unknown[]]
      ? true
      : P extends `[${number}].${infer Rest}`
        ? [T] extends [readonly (infer U)[]]
          ? SinglePathTraversesArray<NonNullable<U>, Rest>
          : false
        : P extends `[${number}]`
          ? false
          : P extends `${infer K}[${number}].${infer Rest}`
            ? K extends keyof NonNullable<T>
              ? [NonNullable<NonNullable<T>[K]>] extends [readonly (infer U)[]]
                ? SinglePathTraversesArray<NonNullable<U>, Rest>
                : false
              : false
            : P extends `${infer K}[${number}]`
              ? false
              : P extends `${infer K}.${infer Rest}`
                ? K extends keyof NonNullable<T>
                  ? [NonNullable<NonNullable<T>[K]>] extends [readonly unknown[]]
                    ? true
                    : SinglePathTraversesArray<NonNullable<NonNullable<T>[K]>, Rest>
                  : false
                : false;

/**
 * Detects if a path traverses across an array (which flattens/yields multiple values).
 * Explicit indexing like `[0]` consumes the array element and does NOT count as array traversal multiplicity.
 * Distributes over unions of object types.
 */
export type PathTraversesArray<T, P extends string> =
  true extends (T extends unknown ? SinglePathTraversesArray<T, P> : never)
    ? true
    : false;

/**
 * Unwraps an array type recursively to its element type, or returns `T` directly.
 */
export type FlatItem<T> =
  T extends readonly (infer U)[] ? FlatItem<U> : T;

type GetReturnTypeSingle<T, P extends string> =
  [T] extends [never]
    ? never
    : [T] extends [readonly unknown[]]
      ? FlatItem<RawValueAtPath<ResolvedItem<T>, P>>[]
      : [SinglePathTraversesArray<NonNullable<T>, P>] extends [true]
        ? [RawValueAtPath<NonNullable<T>, P>] extends [never]
          ? SinglePathInjectsUndefined<T, P> extends true
            ? undefined
            : never
          : SinglePathInjectsUndefined<T, P> extends true
            ? FlatItem<RawValueAtPath<NonNullable<T>, P>>[] | undefined
            : FlatItem<RawValueAtPath<NonNullable<T>, P>>[]
        : [RawValueAtPath<T, P>] extends [never]
          ? SinglePathInjectsUndefined<T, P> extends true
            ? undefined
            : never
          : [NonNullable<RawValueAtPath<T, P>>] extends [readonly unknown[]]
            ? FlatItem<NonNullable<RawValueAtPath<T, P>>>[]
                | (null extends RawValueAtPath<T, P> ? null : never)
                | (undefined extends RawValueAtPath<T, P> ? undefined : never)
                | (SinglePathInjectsUndefined<T, P> extends true ? undefined : never)
            : SinglePathInjectsUndefined<T, P> extends true
              ? RawValueAtPath<T, P> | undefined
              : RawValueAtPath<T, P>;

/**
 * Collection mode: missing properties contribute no element to the result array.
 * An explicit undefined property value IS preserved as an element.
 * null values are also preserved (per the nullable-leaf contract).
 */
export type GetReturnType<T, P extends string> =
  T extends unknown
    ? GetReturnTypeSingle<T, P>
    : never;

/* ============================================================
 * MATCHER & FILTER TYPES
 * ========================================================== */

export type MatcherOperator =
  | "="
  | "!="
  | "~"
  | "!~"
  | "^"
  | "$"
  | ">"
  | ">="
  | "<"
  | "<=";

type InvalidOperatorSeq = "===" | "==" | "!==";

/**
 * Reusable finite union of valid filter/query paths for type T.
 */
export type FilterPath<T> = Path<ResolvedItem<T>>;

/**
 * Validates a matcher string against the finite FilterPath<T> union and supported operators.
 * - When unconstrained (S = string), provides clean `${FilterPath<T>}=` IntelliSense completions.
 * - When a string literal is provided, validates that the path is valid and uses a supported operator.
 */
export type ValidateFilterMatcher<T, S extends string> =
  string extends S
    ? `${FilterPath<T>}=`
    : S extends `${string}${InvalidOperatorSeq}${string}`
      ? `${FilterPath<T>}=`
      : S extends `${infer P extends FilterPath<T>}${MatcherOperator}${string}`
        ? S
        : `${FilterPath<T>}=`;

/**
 * Strongly typed filter matcher string DSL.
 */
export type FilterMatcher<T, S extends string = string> = ValidateFilterMatcher<T, S>;

/**
 * Strongly typed matcher string DSL: `${path}${operator}${value}`.
 */
export type Matcher<T, S extends string = string> = ValidateFilterMatcher<T, S>;

/**
 * Resolves the exact individual value/object type evaluated by filter predicates at path `P`.
 * - If path points to an array (e.g. `roles: string[]` or `members: Member[]`), yields the element type (`string` or `Member`).
 * - Preserves literal unions (e.g. `role: "admin" | "user"`).
 */
export type PathMatchValue<T, P extends string> =
  FlatItem<RawValueAtPath<ResolvedItem<T>, P>>;

/* ============================================================
 * GROUP BY RESULT & FILTER RESULT
 * ========================================================== */

type LastArrayItemInPath<T, P extends string> =
  T extends unknown
    ? P extends `${infer K}[${number}].${infer Rest}`
      ? K extends keyof NonNullable<T>
        ? NonNullable<NonNullable<T>[K]> extends readonly (infer U)[]
          ? LastArrayItemInPath<NonNullable<U>, Rest>
          : never
        : never
      : P extends `${infer K}.${infer Rest}`
        ? K extends keyof NonNullable<T>
          ? NonNullable<NonNullable<T>[K]> extends readonly (infer U)[]
            ? [LastArrayItemInPath<NonNullable<U>, Rest>] extends [never]
              ? NonNullable<U>
              : LastArrayItemInPath<NonNullable<U>, Rest>
            : LastArrayItemInPath<NonNullable<NonNullable<T>[K]>, Rest>
          : never
        : never
    : never;

/**
 * Determines the item type of the Resolve instance returned after filter(path, predicate).
 * - If path traverses intermediate arrays, returns the innermost traversed array items `Member[]`.
 * - If path targets an object array property directly on a single object (e.g. `team.members`), returns `Member[]`.
 * - If filtering a root collection (e.g. `User[]`), returns `User[]`.
 * - If filtering a single object on a scalar property (e.g. `team.name`), returns `T`.
 */
export type FilterResultItem<T, P extends string> =
  [LastArrayItemInPath<ResolvedItem<T>, P>] extends [never]
    ? [RawValueAtPath<ResolvedItem<T>, P>] extends [readonly (infer Item)[]]
      ? Item extends object
        ? Item[]
        : T
      : T
    : LastArrayItemInPath<ResolvedItem<T>, P>[];

/**
 * Resolves the item type returned inside group buckets:
 * - If path traverses intermediate array(s), returns the element type of the innermost traversed array.
 * - Otherwise, returns the root item type `ResolvedItem<T>`.
 */
export type GroupItemType<T, P extends string> =
  [LastArrayItemInPath<ResolvedItem<T>, P>] extends [never]
    ? ResolvedItem<T>
    : LastArrayItemInPath<ResolvedItem<T>, P>;

/**
 * Filters paths of `T` to those that can be grouped (excludes symbols).
 */
export type GroupablePath<T> = {
  [P in Path<T>]: [FlatItem<RawValueAtPath<T, P>>] extends [symbol]
    ? never
    : P;
}[Path<T>];

/**
 * Converts statically-predictable grouping values into string key types:
 * - String literal unions ("admin" | "user") → "admin" | "user"
 * - Number literals (1 | 2) → "1" | "2"
 * - BigInt literals (1n | 2n) → "1" | "2"
 * - Booleans → "true" | "false"
 * - Broad types (string, number, bigint) → string
 * - Unpredictable stringification types (Date, objects) → never (triggering deliberate Record<string, ...> fallback)
 */
export type StringifiedGroupKey<V> =
  V extends string
    ? string extends V
      ? string
      : V
    : V extends number
      ? number extends V
        ? string
        : `${V}`
      : V extends bigint
        ? bigint extends V
          ? string
          : `${V}`
        : V extends boolean
          ? `${V}`
          : never;

/**
 * Maps grouping results to strongly-typed records:
 * - Known literal key unions produce `Partial<Record<K, GroupItemType<T, P>[]>>`.
 * - Broad types (string, number, bigint) produce `Record<string, GroupItemType<T, P>[]>>`.
 * - Unpredictable runtime stringification (Date, objects) deliberately falls back to `Record<string, GroupItemType<T, P>[]>>`.
 */
export type GroupResult<T, P extends string> =
  StringifiedGroupKey<FlatItem<RawValueAtPath<ResolvedItem<T>, P>>> extends infer K
    ? [K] extends [never]
      ? Record<string, GroupItemType<T, P>[]>
      : string extends K
        ? Record<string, GroupItemType<T, P>[]>
        : [K] extends [PropertyKey]
          ? Partial<Record<K, GroupItemType<T, P>[]>>
          : Record<string, GroupItemType<T, P>[]>
    : never;

/* ============================================================
 * MISC HELPER TYPES
 * ========================================================== */

export type Comparable = number | string | bigint | boolean | Date;
export type ContainsTarget = string | number | boolean;
export type SumResult<T> = number;
export type SortablePath<T> = Path<T>;
