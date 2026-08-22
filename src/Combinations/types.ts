/**
 * Primitive and scalar value types supported in combinations.
 *
 * @example
 * ```ts
 * const val: CombinationValue = "chromium";
 * ```
 */
export type CombinationValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

/**
 * Resolves a single candidate value type from an array of candidates, nested combination object, or scalar.
 */
export type ResolvedCombinationValue<V> =
  V extends readonly (infer Item)[]
    ? Item
    : V extends object
      ? ResolvedCombination<V>
      : V;

/**
 * Resolves the generated Cartesian combination payload data shape from an input definition type `T`.
 *
 * @example
 * ```ts
 * type Def = { browser: ["chrome", "firefox"]; env: ["local", "ci"] };
 * type Res = ResolvedCombination<Def>;
 * // { browser: "chrome" | "firefox"; env: "local" | "ci" }
 * ```
 */
export type ResolvedCombination<T extends object> = {
  [K in keyof T]: ResolvedCombinationValue<T[K]>;
};

/**
 * Resolves the individual test case type from a combination collection.
 */
export type CombinationCaseItem<T> =
  T extends readonly (infer Case)[]
    ? Case
    : T;

/**
 * Metadata tags generated for a combination test case.
 *
 * @example
 * ```ts
 * const metadata: CombinationMetadata = {
 *   tags: ["@browser:chromium", "@env:ci"],
 * };
 * ```
 */
export interface CombinationMetadata {
  /**
   * Playwright-style path metadata tags (e.g. `@browser:chromium`).
   */
  tags: string[];
}

/**
 * Represents a single generated Cartesian test case.
 *
 * @template T Type of the resolved combination data payload.
 *
 * @example
 * ```ts
 * const testCase: CombinationCase<{ browser: "chromium" | "firefox" }> = {
 *   data: { browser: "chromium" },
 *   name: "chromium",
 *   metadata: { tags: ["@browser:chromium"] },
 * };
 * ```
 */
export interface CombinationCase<T> {
  /**
   * Resolved option data payload for this combination.
   */
  data: T;

  /**
   * Deterministic human-readable name joined by the configured separator.
   */
  name: string;

  /**
   * Metadata associated with this test case (e.g. tags).
   */
  metadata: CombinationMetadata;
}

/**
 * Configuration options for combination generation.
 */
export interface CombinationOptions {
  /**
   * Separator used to join property values into the test case name.
   *
   * @default " - "
   *
   * @example
   * ```ts
   * combinations(
   *   { browser: ["chromium"], env: ["ci"] },
   *   { nameSeparator: " | " }
   * );
   * ```
   */
  nameSeparator?: string;
}

/**
 * Callable combinations generator function with attached helper methods.
 */
export interface CombinationsFunction {
  /**
   * Generates the Cartesian product of the supplied option values.
   *
   * @param input Object containing candidate option arrays or scalar values.
   * @param options Configuration options such as custom `nameSeparator`.
   *
   * @example
   * ```ts
   * const cases = combinations({
   *   browser: ["chromium", "firefox"],
   *   env: ["local", "ci"],
   * });
   * // Produces 4 test cases
   * ```
   */
  <const T extends object>(
    input: T,
    options?: CombinationOptions
  ): CombinationCase<ResolvedCombination<T>>[];

  /**
   * Generates Cartesian combinations where the data payload itself is an array of objects.
   *
   * @param input Array of combination definition objects.
   * @param options Configuration options.
   *
   * @example
   * ```ts
   * const cases = combinations.asArray([
   *   { browser: ["chromium", "firefox"] },
   *   { env: ["local", "ci"] }
   * ]);
   * // Each case has data: [{ browser: "..." }, { env: "..." }]
   * ```
   */
  asArray<const T extends object>(
    input: readonly T[],
    options?: CombinationOptions
  ): CombinationCase<ResolvedCombination<T>[]>[];

  /**
   * Combines independent combination outputs into one array without Cartesian multiplication.
   *
   * @param lists Combination case lists to concatenate.
   *
   * @example
   * ```ts
   * const browsers = combinations({ browser: ["chromium", "firefox"] });
   * const envs = combinations({ env: ["local", "ci"] });
   * const allCases = combinations.combine(browsers, envs);
   * // Total 4 test cases (concatenated)
   * ```
   */
  combine<
    const Lists extends readonly (readonly CombinationCase<unknown>[])[],
  >(...lists: Lists): CombinationCaseItem<Lists[number]>[];
}