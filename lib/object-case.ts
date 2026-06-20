const SNAKE_CASE_BOUNDARY = /([a-z0-9])([A-Z])/g;
const CAMEL_CASE_BOUNDARY = /_([a-z0-9])/g;

const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (value === null || typeof value !== 'object') return false;
  return Object.getPrototypeOf(value) === Object.prototype;
};

export const toSnakeCase = (value: string): string =>
  value
    .replace(SNAKE_CASE_BOUNDARY, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();

export const toCamelCase = (value: string): string =>
  value.replace(CAMEL_CASE_BOUNDARY, (_match, char: string) => char.toUpperCase());

/**
 * Field names whose VALUE is a data-keyed map — the keys are data (e.g.
 * resource-type enum values like `RDS_CLUSTER`), not DTO field names. Key
 * conversion transforms the field name itself but must NOT recurse into such a
 * value, or a lower-case data key would be silently corrupted (it survives today
 * only because the keys happen to be UPPERCASE). Both casings are listed so the
 * guard is direction-symmetric. Pair each field with `OpaqueKeys<>` at the DTO so
 * the type marker and this runtime set stay in sync (ADR-019 D2.3 / D6).
 */
const OPAQUE_VALUE_KEYS: ReadonlySet<string> = new Set([
  'resource_count_by_resource_type',
  'resourceCountByResourceType',
]);

const transformObjectKeys = (
  value: unknown,
  transformKey: (key: string) => string,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => transformObjectKeys(item, transformKey));
  }

  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => [
      transformKey(key),
      OPAQUE_VALUE_KEYS.has(key)
        ? nestedValue
        : transformObjectKeys(nestedValue, transformKey),
    ]),
  );
};

export const snakeCaseKeys = <T>(value: T): T =>
  transformObjectKeys(value, toSnakeCase) as T;

export const camelCaseKeys = <T>(value: T): T =>
  transformObjectKeys(value, toCamelCase) as T;

/**
 * Marks a value as raw snake_case wire data that `camelCaseKeys` was deliberately
 * NOT applied to (ADR-019 D2/D6). A documentation alias (resolves to `T`): the
 * enforcement is the dedicated `getSnakeRaw` entry point that never camelCases.
 * It makes the casing opt-out greppable and typed, instead of a silent
 * `{ raw: true }` flag.
 */
export type SnakeRaw<T> = T;

/**
 * Marks a map whose KEYS are data (e.g. `RDS_CLUSTER`), not field names, so a
 * reader sees that `camelCaseKeys` must not transform them (ADR-019 D2.3 / D6).
 * A documentation alias (resolves to `T`); the runtime guarantee is the
 * `OPAQUE_VALUE_KEYS` set in this module. Keep the two in sync: a field typed
 * `OpaqueKeys<>` must have its wire key listed there.
 */
export type OpaqueKeys<T> = T;
