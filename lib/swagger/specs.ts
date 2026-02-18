export const SWAGGER_SPEC_NAMES = [
  'aws',
  'azure',
  'gcp',
  'scan',
  'user',
  'credential',
  'confirm',
  'logical-db-status',
  'test-connection',
] as const;

export type SwaggerSpecName = (typeof SWAGGER_SPEC_NAMES)[number];

const SWAGGER_SPEC_SET = new Set<string>(SWAGGER_SPEC_NAMES);

export const resolveSwaggerSpecName = (value: string): SwaggerSpecName | null => {
  const normalized = value.replace(/\.ya?ml$/i, '').toLowerCase();
  return SWAGGER_SPEC_SET.has(normalized) ? (normalized as SwaggerSpecName) : null;
};
