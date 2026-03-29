import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';

export const GET = withV1(async () => {
  return client.dashboard.summary();
}, { expectedDuration: '100ms ~ 500ms' });
