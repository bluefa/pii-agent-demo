import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import type { UserMeResponse } from '@/app/api/_lib/v1-types';
import { client } from '@/lib/api-client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeUserMeResponse = (value: unknown): UserMeResponse => {
  const candidate = isRecord(value) && isRecord(value.user) ? value.user : value;

  if (
    !isRecord(candidate) ||
    typeof candidate.id !== 'string' ||
    typeof candidate.name !== 'string' ||
    typeof candidate.email !== 'string'
  ) {
    throw new Error('Invalid user/me response payload');
  }

  return {
    id: candidate.id,
    name: candidate.name,
    email: candidate.email,
  };
};

export const GET = withV1(async () => {
  const response = await client.users.getMe();
  if (!response.ok) return response;

  return NextResponse.json(normalizeUserMeResponse(await response.json()));
}, { expectedDuration: '50ms ~ 200ms' });
