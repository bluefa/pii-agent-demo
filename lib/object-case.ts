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
      transformObjectKeys(nestedValue, transformKey),
    ]),
  );
};

export const snakeCaseKeys = <T>(value: T): T =>
  transformObjectKeys(value, toSnakeCase) as T;

export const camelCaseKeys = <T>(value: T): T =>
  transformObjectKeys(value, toCamelCase) as T;
