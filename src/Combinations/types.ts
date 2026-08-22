export type CombinationValue =
  | string
  | number
  | boolean
  | bigint
  | symbol
  | null
  | undefined;

export type CombinationInput = object;

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
   */
  nameSeparator?: string;
}

export type CombinationObjectResult<T extends CombinationInput> =
  CombinationCase<T>;

export type CombinationArrayResult<T extends CombinationInput> =
  CombinationCase<T[]>;

export interface CombinationsFunction {
  <T extends CombinationInput>(
    input: T,
    options?: CombinationOptions
  ): CombinationCase<T>[];

  <T extends CombinationInput>(
    input: T[],
    options?: CombinationOptions
  ): CombinationCase<T>[];

  /**
   * Generates combinations where the final data itself is an array.
   */
  asArray<T extends CombinationInput>(
    input: T[],
    options?: CombinationOptions
  ): CombinationCase<T[]>[];

  /**
   * Combines multiple combination case arrays into a single flattened array.
   */
  combine<T extends readonly (readonly CombinationCase<object>[])[]>(
    ...lists: T
  ): T[number][number][];
}