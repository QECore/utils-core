export type Primitive =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type StringKey<T> = Extract<keyof T, string>;

export type ArrayItem<T> =
  T extends readonly (infer U)[] ? U : never;

export type ResolvedItem<T> =
  T extends readonly (infer U)[] ? U : T;

export type SumResult<T> =
  ResolvedItem<T> extends number
    ? number
    : ResolvedItem<T> extends string
      ? string
      : ResolvedItem<T> extends number | string
        ? number | string
        : never;

export type ContainsTarget<T> =
  T extends readonly (infer U)[]
    ? U
    : string;

/* ============================================================
 * PATH TYPES
 * ========================================================== */

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

export type Comparable =
  | string
  | number
  | bigint
  | Date;