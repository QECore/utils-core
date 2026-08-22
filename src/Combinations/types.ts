export type CombinationValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export interface CombinationMetadata {
  tags: string[];
}

export interface CombinationCase<T> {
  data: T;
  name: string;
  metadata: CombinationMetadata;
}

export interface CombinationOptions {
  /**
   * Separator used to generate the automatic testcase name.
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
   * ```
   */
  <T extends object>(
    input: T,
    options?: CombinationOptions
  ): CombinationCase<T>[];

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
   * ```
   */
  asArray<T extends object>(
    input: T[],
    options?: CombinationOptions
  ): CombinationCase<T[]>[];

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
   * ```
   */
  combine<
    const Lists extends readonly (readonly CombinationCase<unknown>[])[],
  >(...lists: Lists): Lists[number][number][];
}