const SNAKE_CASE_BOUNDARY = /([a-z0-9])([A-Z])/g;
const CAMEL_CASE_BOUNDARY = /_([a-z0-9])/g;

/**
 * ADR-019 D6 "loud API": a compile-time marker for a record whose KEYS are
 * data (e.g. resource-type values), not DTO field names, and therefore must
 * survive `camelCaseKeys`/`snakeCaseKeys` untransformed. Pure type alias —
 * the runtime guard is {@link OPAQUE_VALUE_KEYS}. Mark the field so a reviewer
 * sees the exception in the type, not by luck:
 *   resourceCountByResourceType: OpaqueKeys<Record<string, number>>
 */
export type OpaqueKeys<T> = T;

/**
 * ADR-019 D2.3: field names whose VALUE is a data-keyed map. The field name
 * itself is still transformed; only its value's keys are left verbatim.
 * Listed in both casings because the field name flips between them. Without
 * this, `resource_count_by_resource_type` is safe only by accident (its keys
 * are UPPERCASE enums the boundary regex never matches) — a latent corruption
 * the moment a lower-case key appears.
 */
const OPAQUE_VALUE_KEYS = new Set<string>([
  'resource_count_by_resource_type',
  'resourceCountByResourceType',
]);

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

const transformObjectKeys = (
  value: unknown,
  transformKey: (key: string) => string,
): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => transformObjectKeys(item, transformKey));
  }

  if (!isPlainObject(value)) return value;

  return Object.fromEntries(
    Object.entries(value).map(([key, nestedValue]) => {
      const newKey = transformKey(key);
      // ADR-019 D2.3: transform the field name, keep the data-keyed value verbatim.
      if (OPAQUE_VALUE_KEYS.has(key) || OPAQUE_VALUE_KEYS.has(newKey)) {
        return [newKey, nestedValue];
      }
      return [newKey, transformObjectKeys(nestedValue, transformKey)];
    }),
  );
};

export const snakeCaseKeys = <T>(value: T): T =>
  transformObjectKeys(value, toSnakeCase) as T;

export const camelCaseKeys = <T>(value: T): T =>
  transformObjectKeys(value, toCamelCase) as T;
