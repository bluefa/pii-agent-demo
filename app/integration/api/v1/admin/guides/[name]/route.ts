import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

export const GET = withV1(
  async (_req, ctx) => {
    const data = await bff.guides.get(ctx.params.name);
    return NextResponse.json(data);
  },
  { expectedDuration: '100ms ~ 500ms' },
);

export const PUT = withV1(
  async (req, ctx) => {
    const body = (await req.json().catch(() => null)) as unknown;
    const data = await bff.guides.put(ctx.params.name, body);
    return NextResponse.json(data);
  },
  { expectedDuration: '200ms ~ 1s' },
);
