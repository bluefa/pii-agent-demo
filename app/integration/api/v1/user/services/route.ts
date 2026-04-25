import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import type { UserServicesResponse } from '@/app/api/_lib/v1-types';
import { resolveUserService } from '@/app/api/_lib/user-service';
import { bff } from '@/lib/bff/client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeUserServicesResponse = (value: unknown): UserServicesResponse => {
  if (!isRecord(value) || !Array.isArray(value.services)) {
    throw new Error('Invalid user/services response payload');
  }

  return {
    services: value.services.map(resolveUserService),
  };
};

export const GET = withV1(async () => {
  const data = await bff.users.getServices();
  return NextResponse.json(normalizeUserServicesResponse(data));
}, { expectedDuration: '50ms ~ 200ms' });
