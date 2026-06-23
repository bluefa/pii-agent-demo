import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { bff } from '@/lib/bff/client';
import { parseTargetSourceId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';

export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? '10');
  const offset = page * size;

  const data = await bff.scan.getHistory(parsed.value, { limit: size, offset });

  const content = data.content.map((item) => ({
    id: item.id,
    scanStatus: item.scanStatus,
    targetSourceId: item.targetSourceId,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    scanVersion: item.scanVersion || 1,
    durationSeconds: item.durationSeconds,
    scanProgress: item.scanProgress,
    resourceCountByResourceType: item.resourceCountByResourceType || {},
    scanError: item.scanError,
  }));

  // Read the flat Spring Page fields straight off the wire (PageScanJobResponse)
  // — no recompute. Preserve the route→CSR `{content, page}` 2-hop envelope.
  return NextResponse.json({
    content,
    page: {
      totalElements: data.totalElements,
      totalPages: data.totalPages,
      number: data.number,
      size: data.size,
    },
  });
});
