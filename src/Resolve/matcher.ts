import type { MatcherOperator } from "./types";

/**
 * Recursively flattens an array of values to arbitrary depth.
 * Non-array elements are preserved intact.
 */
export function flattenDeep<T = unknown>(values: readonly unknown[]): T[] {
  const result: T[] = [];
  for (const v of values) {
    if (Array.isArray(v)) {
      result.push(...flattenDeep<T>(v));
    } else {
      result.push(v as T);
    }
  }
  return result;
}

export interface ParsedMatcher {
  path: string;
  operator: MatcherOperator;
  value: unknown;
}

const MULTI_CHAR_OPERATORS: readonly MatcherOperator[] = [
  ">=",
  "<=",
  "!=",
  "!~",
];

const SINGLE_CHAR_OPERATORS: readonly MatcherOperator[] = [
  "=",
  "~",
  "^",
  "$",
  ">",
  "<",
];

/**
 * Parses a string matcher DSL expression into path, operator, and coerced value.
 * Identifies the first valid operator occurrence and splits only once.
 *
 * @example
 * parseMatcher("name=a=b") // { path: "name", operator: "=", value: "a=b" }
 * parseMatcher("age>=30")  // { path: "age", operator: ">=", value: 30 }
 * parseMatcher('code="123"') // { path: "code", operator: "=", value: "123" }
 */
export function parseMatcher(expression: string): ParsedMatcher {
  const len = expression.length;

  for (let i = 1; i < len; i++) {
    // Check 2-character operators first
    if (i + 1 < len) {
      const twoChar = expression.slice(i, i + 2) as MatcherOperator;
      if (MULTI_CHAR_OPERATORS.includes(twoChar)) {
        const path = expression.slice(0, i);
        const rawVal = expression.slice(i + 2);
        return {
          path,
          operator: twoChar,
          value: coerceValue(rawVal),
        };
      }
    }

    // Check 1-character operators
    const oneChar = expression[i] as MatcherOperator;
    if (SINGLE_CHAR_OPERATORS.includes(oneChar)) {
      const path = expression.slice(0, i);
      const rawVal = expression.slice(i + 1);
      return {
        path,
        operator: oneChar,
        value: coerceValue(rawVal),
      };
    }
  }

  throw new Error(`Invalid matcher expression: "${expression}"`);
}

/**
 * Coerces raw string matcher values:
 * 1. Wrapped in "..." or '...' -> string literal (surrounding quotes removed)
 * 2. "true" / "false" -> boolean
 * 3. Valid numeric literal -> number
 * 4. Everything else -> raw string
 */
export function coerceValue(rawVal: string): unknown {
  // Rule 3: Quoted strings
  if (
    (rawVal.startsWith('"') && rawVal.endsWith('"') && rawVal.length >= 2) ||
    (rawVal.startsWith("'") && rawVal.endsWith("'") && rawVal.length >= 2)
  ) {
    return rawVal.slice(1, -1);
  }

  // Rule 1: Booleans
  if (rawVal === "true") return true;
  if (rawVal === "false") return false;

  // Rule 2: Numbers
  if (/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?$/.test(rawVal)) {
    const num = Number(rawVal);
    if (!Number.isNaN(num)) {
      return num;
    }
  }

  // Rule 4: Raw string
  return rawVal;
}

function matchSingleValue(
  actual: unknown,
  op: MatcherOperator,
  expected: unknown
): boolean {
  // null / undefined property values never match any matcher except via != and !~
  if (actual === null || actual === undefined) {
    return op === "!=" || op === "!~";
  }

  // NaN never equals anything, including itself
  if (typeof actual === "number" && Number.isNaN(actual)) {
    return op === "!=" || op === "!~";
  }
  if (typeof expected === "number" && Number.isNaN(expected)) {
    return op === "!=" || op === "!~";
  }

  switch (op) {
    case "=": {
      if (typeof actual !== typeof expected) {
        return false;
      }
      return actual === expected;
    }

    case "!=": {
      return !matchSingleValue(actual, "=", expected);
    }

    case "~": {
      if (typeof actual === "string") {
        return actual.includes(String(expected));
      }
      if (Array.isArray(actual)) {
        return flattenDeep(actual).some((el) => matchSingleValue(el, "~", expected));
      }
      return false;
    }

    case "!~": {
      return !matchSingleValue(actual, "~", expected);
    }

    case "^": {
      // ^ applies to string property values only
      if (typeof actual !== "string") {
        return false;
      }
      return actual.startsWith(String(expected));
    }

    case "$": {
      // $ applies to string property values only
      if (typeof actual !== "string") {
        return false;
      }
      return actual.endsWith(String(expected));
    }

    case ">": {
      if (typeof actual === "number" && typeof expected === "number") {
        return actual > expected;
      }
      if (typeof actual === "bigint" && typeof expected === "bigint") {
        return actual > expected;
      }
      if (typeof actual === "string") {
        return actual.localeCompare(String(expected)) > 0;
      }
      if (actual instanceof Date && expected instanceof Date) {
        return actual.getTime() > expected.getTime();
      }
      return false;
    }

    case ">=": {
      if (typeof actual === "number" && typeof expected === "number") {
        return actual >= expected;
      }
      if (typeof actual === "bigint" && typeof expected === "bigint") {
        return actual >= expected;
      }
      if (typeof actual === "string") {
        return actual.localeCompare(String(expected)) >= 0;
      }
      if (actual instanceof Date && expected instanceof Date) {
        return actual.getTime() >= expected.getTime();
      }
      return false;
    }

    case "<": {
      if (typeof actual === "number" && typeof expected === "number") {
        return actual < expected;
      }
      if (typeof actual === "bigint" && typeof expected === "bigint") {
        return actual < expected;
      }
      if (typeof actual === "string") {
        return actual.localeCompare(String(expected)) < 0;
      }
      if (actual instanceof Date && expected instanceof Date) {
        return actual.getTime() < expected.getTime();
      }
      return false;
    }

    case "<=": {
      if (typeof actual === "number" && typeof expected === "number") {
        return actual <= expected;
      }
      if (typeof actual === "bigint" && typeof expected === "bigint") {
        return actual <= expected;
      }
      if (typeof actual === "string") {
        return actual.localeCompare(String(expected)) <= 0;
      }
      if (actual instanceof Date && expected instanceof Date) {
        return actual.getTime() <= expected.getTime();
      }
      return false;
    }

    default:
      return false;
  }
}

/**
 * Evaluates a parsed matcher against an item given a path extractor function.
 */
export function evaluateMatcher(
  item: unknown,
  matcher: ParsedMatcher,
  resolveValues: (target: unknown, path: string) => unknown[]
): boolean {
  if (item === null || item === undefined) {
    return false;
  }

  const values = resolveValues(item, matcher.path);
  if (values.length === 0) {
    // If no values resolved (path not present on item):
    // For != and !~, absence matches the negation
    return matcher.operator === "!=" || matcher.operator === "!~";
  }

  const { operator, value: expected } = matcher;

  if (operator === "!=") {
    // Multi-value negation: NO resolved value equals expected
    return !values.some((v) => matchSingleValue(v, "=", expected));
  }

  if (operator === "!~") {
    // Multi-value negation: NO resolved value contains expected
    return !values.some((v) => matchSingleValue(v, "~", expected));
  }

  // Positive operators match existentially across resolved values
  return values.some((v) => matchSingleValue(v, operator, expected));
}
