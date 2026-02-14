import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import type { ScanStatus, ScanResult, ResourceType } from '@/lib/types';

interface LegacyHistoryItem {
  scanId: string;
  status: ScanStatus;
  startedAt: string;
  completedAt: string;
  duration: number;
  result: ScanResult | null;
  error?: string;
}

export const GET = withV1(async (request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const resolved = resolveProjectId(parsed.value, requestId);
  if (!resolved.ok) return problemResponse(resolved.problem);

  const { searchParams } = new URL(request.url);
  const page = Number(searchParams.get('page') ?? '0');
  const size = Number(searchParams.get('size') ?? '10');
  const offset = page * size;

  const response = await client.scan.getHistory(resolved.projectId, { limit: size, offset });
  if (!response.ok) return response;

  const data = await response.json() as { history: LegacyHistoryItem[]; total: number };
  const totalElements = data.total;
  const totalPages = Math.ceil(totalElements / size);

  // Transform legacy history items → Swagger ScanJob schema
  const content = data.history.map((item, idx) => {
    const resourceCountByResourceType: Record<string, number> = {};
    if (item.result?.byResourceType) {
      for (const { resourceType, count } of item.result.byResourceType) {
        resourceCountByResourceType[resourceType as ResourceType] = count;
      }
    }

    return {
      id: Number(item.scanId.replace(/\D/g, '')) || (offset + idx + 1),
      scanStatus: item.status,
      targetSourceId: parsed.value,
      createdAt: item.startedAt,
      updatedAt: item.completedAt,
      scanVersion: 1,
      durationSeconds: item.duration,
      scanProgress: null,
      resourceCountByResourceType,
      scanError: item.error ?? null,
    };
  });

  return NextResponse.json({
    content,
    page: {
      totalElements,
      totalPages,
      number: page,
      size,
    },
  });
}, { errorFormat: 'flat' });
