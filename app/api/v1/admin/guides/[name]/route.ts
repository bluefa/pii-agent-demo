import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';

export const GET = withV1(
  async (_req, ctx) => {
    const data = await bff.guides.get(ctx.params.name);
    return NextResponse.json(schemas.GuideDetail.parse(data));
  },
  { expectedDuration: '100ms ~ 500ms' },
);
