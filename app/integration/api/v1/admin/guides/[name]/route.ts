import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(
  async (_req, ctx) => client.guides.get(ctx.params.name),
  { expectedDuration: '100ms ~ 500ms' },
);

export const PUT = withV1(
  async (req, ctx) => {
    const body = (await req.json().catch(() => null)) as unknown;
    return client.guides.put(ctx.params.name, body);
  },
  { expectedDuration: '200ms ~ 1s' },
);
