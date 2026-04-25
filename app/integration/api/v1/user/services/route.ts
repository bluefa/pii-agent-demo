import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import type { UserService, UserServicesResponse } from '@/app/api/_lib/v1-types';
import { bff } from '@/lib/bff/client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeUserService = (value: unknown): UserService => {
  if (!isRecord(value)) {
    throw new Error('Invalid user/services item');
  }

  const serviceCode =
    typeof value.serviceCode === 'string'
      ? value.serviceCode
      : typeof value.service_code === 'string'
        ? value.service_code
        : typeof value.code === 'string'
          ? value.code
          : null;
  const serviceName =
    typeof value.serviceName === 'string'
      ? value.serviceName
      : typeof value.service_name === 'string'
        ? value.service_name
        : typeof value.name === 'string'
          ? value.name
          : null;

  if (!serviceCode || !serviceName) {
    throw new Error('Invalid user/services item');
  }

  return { serviceCode, serviceName };
};

const normalizeUserServicesResponse = (value: unknown): UserServicesResponse => {
  if (!isRecord(value) || !Array.isArray(value.services)) {
    throw new Error('Invalid user/services response payload');
  }

  return {
    services: value.services.map(normalizeUserService),
  };
};

export const GET = withV1(async () => {
  const data = await bff.users.getServices();
  return NextResponse.json(normalizeUserServicesResponse(data));
}, { expectedDuration: '50ms ~ 200ms' });
