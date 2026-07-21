import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { schemas } from '@/lib/generated/install-v1';
import { toApprovalHistoryPage } from '@/lib/types/task-queue';

// GET /admin/queue/approval-history?toStatuses=&page=&size=
// Global approval history (P2 전체 History 확인). The upstream 200 is the generic
// Page — the content item shape is a documented contract gap owned by
// lib/types/task-queue.ts (ApprovalHistoryItemWire). Route owns wire→camel.
export const GET = withV1(async (request) => {
  const params = new URL(request.url).searchParams;
  const toStatusesRaw = params.get('toStatuses');
  const toStatuses = toStatusesRaw
    ? toStatusesRaw.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined;
  const page = Number(params.get('page') ?? 0);
  const size = Number(params.get('size') ?? 10);

  const raw = schemas.Page.parse(await bff.taskQueue.getApprovalHistory({ toStatuses, page, size }));
  return NextResponse.json(toApprovalHistoryPage(raw));
});
