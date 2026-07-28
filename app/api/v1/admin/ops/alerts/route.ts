import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';

// ASSUMED CONTRACT — docs/api/ops-assumed-contracts.md §7.
// GET /admin/ops/alerts?kind&page&size → { counts, alerts: Page<OpsAlertRow> }.
// The taxonomy, the test-connection join, the ordering and the counts all live
// upstream: the alert population is cross-service, so filtering a page of it in
// the browser would cap the counts and drop rows past the fetched window.
export const GET = withV1(async (request) => {
  const url = new URL(request.url);
  const kind = url.searchParams.get('kind') ?? undefined;
  const page = parseInt(url.searchParams.get('page') ?? '0', 10);
  const size = parseInt(url.searchParams.get('size') ?? '20', 10);

  const data = await bff.ops.getAlerts(kind, page, size);
  return NextResponse.json(data);
});
