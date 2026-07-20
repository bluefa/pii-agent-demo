import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { toDashboardSummary } from '@/lib/types/task-queue';

// GET /admin/queue/dashboard-summary — the 4 operator KPI counts.
// Route owns the wire→camel boundary (ADR-019, lib/types/task-queue.ts).
export const GET = withV1(async () => {
  const raw = schemas.DashboardSummaryResponse.parse(await bff.taskQueue.getDashboardSummary());
  return NextResponse.json(toDashboardSummary(raw));
});
