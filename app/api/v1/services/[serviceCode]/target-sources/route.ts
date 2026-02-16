import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async (_request, { params }) => {
  const { serviceCode } = params;
  const response = await client.services.projects.list(serviceCode);
  if (!response.ok) return response;
  const { projects } = await response.json();
  return NextResponse.json({ targetSources: projects });
}, { expectedDuration: '100ms ~ 500ms' });

export const POST = withV1(async (request, { params }) => {
  const { serviceCode } = params;
  const body = await request.json().catch(() => ({}));
  return client.projects.create({ ...body, serviceCode });
}, { expectedDuration: '300ms ~ 1s' });
