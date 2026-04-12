import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import type { UserService } from '@/app/api/_lib/v1-types';
import { client } from '@/lib/api-client';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const normalizeServiceItem = (value: unknown): UserService => {
  if (!isRecord(value)) {
    throw new Error('Invalid service item');
  }

  const serviceCode =
    typeof value.serviceCode === 'string'
      ? value.serviceCode
      : typeof value.service_code === 'string'
        ? value.service_code
        : null;
  const serviceName =
    typeof value.serviceName === 'string'
      ? value.serviceName
      : typeof value.service_name === 'string'
        ? value.service_name
        : null;

  if (!serviceCode || !serviceName) {
    throw new Error('Invalid service item');
  }

  return { serviceCode, serviceName };
};

export const GET = withV1(async (request) => {
  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? '10');
  const query = searchParams.get('query') ?? undefined;

  const response = await client.users.getServicesPage(page, size, query);
  if (!response.ok) return response;

  const raw = await response.json();

  if (!isRecord(raw) || !Array.isArray(raw.content) || !isRecord(raw.page)) {
    throw new Error('Invalid services/page response payload');
  }

  return NextResponse.json({
    content: raw.content.map(normalizeServiceItem),
    page: {
      totalElements: Number(raw.page.totalElements ?? 0),
      totalPages: Number(raw.page.totalPages ?? 0),
      number: Number(raw.page.page ?? raw.page.number ?? 0),
      size: Number(raw.page.size ?? 10),
    },
  });
}, { expectedDuration: '50ms ~ 300ms' });
