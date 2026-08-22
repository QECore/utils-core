import type {
  CombinationCase,
  CombinationListItem,
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
 * - Non-array plain objects: recursively resolved as a nested combination definition.
 * - Non-array scalar/primitive: treated as a single candidate value.
 * - Array: each element is a candidate value directly. Objects inside candidate arrays
 *   are preserved as discrete values and are not recursively expanded.
 * - Empty array []: produces zero candidate values (resulting in zero combinations).
 */
function resolveValue(value: unknown): unknown[] {
  if (!Array.isArray(value)) {
    if (isPlainObject(value)) {
      return resolveObject(value);
    }

    return [value];
  }

  // Candidate array: each element of the array is a discrete candidate value.
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

    // If any property has zero candidate values, the Cartesian product is empty.
    if (values.length === 0) {
      return [];
    }

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

function generateObjectCases<T extends object>(
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
function generateArrayCases<T extends object>(
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
    if (elementCombinations.length === 0) {
      return [];
    }

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
 * Combines independent combination outputs into one array.
 *
 * This does not create another Cartesian product.
 *
 * @param lists Combination case lists to concatenate.
 *
 * @example
 * ```ts
 * const browsers = combinations({ browser: ["chrome", "firefox"] });
 * const environments = combinations({ env: ["local", "ci"] });
 * const allCases = combine(browsers, environments);
 * // 4 cases total
 * ```
 */
export function combine<
  const Lists extends readonly (readonly CombinationCase<unknown>[])[],
>(...lists: Lists): CombinationListItem<Lists[number]>[] {
  const result: CombinationListItem<Lists[number]>[] = [];
  for (const list of lists) {
    for (const item of list) {
      result.push(item as CombinationListItem<Lists[number]>);
    }
  }
  return result;
}

/**
 * Generates the Cartesian product of the supplied option values.
 *
 * @param input Object containing candidate option arrays or scalar values.
 * @param options Configuration options such as custom `nameSeparator`.
 *
 * @example
 * ```ts
 * const cases = combinations({
 *   browser: ["chrome", "firefox"],
 *   env: ["local", "ci"],
 * });
 * ```
 */
export const combinations = Object.assign(
  function combinations<T extends object>(
    input: T,
    options: CombinationOptions = {}
  ): CombinationCase<T>[] {
    return generateObjectCases(input, options);
  },
  {
    asArray: generateArrayCases,
    combine,
  }
) as CombinationsFunction;