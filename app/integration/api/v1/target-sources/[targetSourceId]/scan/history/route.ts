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
  const totalElements = data.totalElements;
  const totalPages = Math.ceil(totalElements / size);

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

  return NextResponse.json({
    content,
    page: {
      totalElements,
      totalPages,
      number: page,
      size,
    },
  });
});
