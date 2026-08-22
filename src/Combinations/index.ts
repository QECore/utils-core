import type {
  CombinationCase,
  CombinationInput,
  CombinationOptions,
  CombinationsFunction,
} from "./types";

export type * from "./types";

const DEFAULT_NAME_SEPARATOR = " - ";

type PlainObject = Record<string, unknown>;

function isPlainObject(value: unknown): value is PlainObject {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function valueToString(value: unknown): string {
  if (value === undefined) {
    return "undefined";
  }

  if (value === null) {
    return "null";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Generates possible candidate values for a payload property.
 *
 * Rules:
 * - Non-array plain objects: recursively resolved as a nested combination space.
 * - Non-array scalar/primitive: treated as a single candidate value.
 * - Array: each element is a candidate value directly. Objects inside candidate arrays
 *   are preserved as discrete values and are not recursively expanded.
 * - Empty array []: resolved to [undefined] (property not supplied).
 */
function resolveValue(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    if (isPlainObject(value)) {
      return resolveObject(value);
    }

    return [value];
  }

  // Empty candidate list means "parameter not supplied".
  if (value.length === 0) {
    return [undefined];
  }

  // Candidate array: each element of the array is a candidate value directly.
  return [...value];
}

/**
 * Generates the Cartesian product of the properties of one object.
 */
function resolveObject(input: PlainObject): PlainObject[] {
  const entries = Object.entries(input);

  if (entries.length === 0) {
    return [{}];
  }

  let results: PlainObject[] = [{}];

  for (const [key, value] of entries) {
    const values = resolveValue(value);

    results = results.flatMap((result) =>
      values.map((resolvedValue) => ({
        ...result,
        [key]: resolvedValue,
      }))
    );
  }

  return results;
}

function getObjectNameParts(value: unknown): string[] {
  if (!isPlainObject(value)) {
    return [valueToString(value)];
  }

  return Object.values(value).flatMap((item) => {
    if (isPlainObject(item)) {
      return getObjectNameParts(item);
    }

    if (Array.isArray(item)) {
      return [valueToString(item)];
    }

    return [valueToString(item)];
  });
}

function createTags(value: unknown, prefix = ""): string[] {
  if (!isPlainObject(value)) {
    return [];
  }

  return Object.entries(value).flatMap(([key, childValue]) => {
    const path = prefix ? `${prefix}.${key}` : key;

    if (isPlainObject(childValue)) {
      return createTags(childValue, path);
    }

    return [`@${path}:${valueToString(childValue)}`];
  });
}

function createArrayTags(value: unknown[]): string[] {
  return value.flatMap((item, index) =>
    createTags(item, String(index))
  );
}

function createCase<T>(
  data: T,
  nameSeparator: string,
  nameParts: string[],
  tags: string[]
): CombinationCase<T> {
  return {
    data,
    name: nameParts.join(nameSeparator),
    metadata: {
      tags,
    },
  };
}

function generateObjectCases<T extends CombinationInput>(
  input: T,
  options: CombinationOptions = {}
): CombinationCase<T>[] {
  const nameSeparator =
    options.nameSeparator ?? DEFAULT_NAME_SEPARATOR;

  const resolved = resolveObject(input as PlainObject) as T[];

  return resolved.map((data) =>
    createCase(
      data,
      nameSeparator,
      getObjectNameParts(data),
      createTags(data)
    )
  );
}

/**
 * Generates Cartesian combinations where the payload itself is an array of objects.
 *
 * @param input Array of combination objects.
 * @param options Optional configuration (e.g. nameSeparator).
 *
 * @example
 * ```ts
 * const cases = combinations.asArray([
 *   { browser: ["chromium", "firefox"] },
 *   { env: ["local", "ci"] }
 * ]);
 * ```
 */
function generateArrayCases<T extends CombinationInput>(
  input: T[],
  options: CombinationOptions = {}
): CombinationCase<T[]>[] {
  if (input.length === 0) {
    return [];
  }

  const nameSeparator =
    options.nameSeparator ?? DEFAULT_NAME_SEPARATOR;

  const resolvedElements = input.map((item) =>
    resolveObject(item as PlainObject)
  );

  let payloads: PlainObject[][] = [[]];

  for (const elementCombinations of resolvedElements) {
    payloads = payloads.flatMap((current) =>
      elementCombinations.map((element) => [...current, element])
    );
  }

  return payloads.map((data) =>
    createCase(
      data as T[],
      nameSeparator,
      data.flatMap(getObjectNameParts),
      createArrayTags(data)
    )
  );
}

/**
 * Concatenates multiple combination result arrays into a single collection
 * without re-multiplying them as a Cartesian product.
 *
 * @param lists Combination case lists to combine.
 *
 * @example
 * ```ts
 * const browsers = combinations({ browser: ["chromium", "firefox"] });
 * const envs = combinations({ env: ["local", "ci"] });
 * const allCases = combine(browsers, envs);
 * // Total 4 test cases
 * ```
 */
export function combine<
  T extends readonly (readonly CombinationCase<object>[])[],
>(...lists: T): T[number][number][] {
  return lists.flat() as unknown as T[number][number][];
}

/**
 * Generates Cartesian product test cases with deterministic naming and metadata tags.
 *
 * @param input An object with option arrays or an array of option objects.
 * @param options Configuration options (such as custom `nameSeparator`).
 *
 * @example
 * ```ts
 * const cases = combinations({
 *   browser: ["chromium", "firefox"],
 *   env: ["local", "ci"]
 * });
 * // Produces 4 test cases with name and @tags
 * ```
 */
export const combinations = Object.assign(
  function combinations<T extends CombinationInput>(
    input: T | T[],
    options: CombinationOptions = {}
  ): CombinationCase<T>[] {
    if (!Array.isArray(input)) {
      return generateObjectCases(input, options);
    }

    return input.flatMap((item) =>
      generateObjectCases(item, options)
    );
  },
  {
    asArray: generateArrayCases,
    combine,
  }
) as CombinationsFunction;