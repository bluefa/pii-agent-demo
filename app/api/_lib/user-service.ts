import type { UserService } from '@/app/api/_lib/v1-types';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const pickString = (record: Record<string, unknown>, ...keys: readonly string[]): string | null => {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string') return value;
  }
  return null;
};

/**
 * Resolves a `UserService` from any of the legacy upstream shapes.
 * Accepts `serviceCode | service_code | code` and `serviceName | service_name | name`.
 */
export const resolveUserService = (value: unknown): UserService => {
  if (!isRecord(value)) {
    throw new Error('Invalid user service item');
  }

  const serviceCode = pickString(value, 'serviceCode', 'service_code', 'code');
  const serviceName = pickString(value, 'serviceName', 'service_name', 'name');

  if (!serviceCode || !serviceName) {
    throw new Error('Invalid user service item');
  }

  return { serviceCode, serviceName };
};
