import { NextResponse } from 'next/server';
import { withV1 } from '@/app/api/_lib/handler';
import { client } from '@/lib/api-client';
import { parseTargetSourceId, resolveProjectId } from '@/app/api/_lib/target-source';
import { problemResponse } from '@/app/api/_lib/problem';
import type { ScanStatus, ScanResult, ResourceType } from '@/lib/types';

interface BffHistoryItem {
  id: number;
  scan_status: string;
  target_source_id: number;
  created_at: string;
  updated_at: string;
  scan_version: number | null;
  scan_progress: number | null;
  duration_seconds: number;
  resource_count_by_resource_type: Record<string, number> | null;
  scan_error: string | null;
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

  const data = await response.json() as { content: BffHistoryItem[]; totalElements: number };
  const totalElements = data.totalElements;
  const totalPages = Math.ceil(totalElements / size);

  // Transform BFF history items → Swagger ScanJob schema
  const content = data.content.map((item, idx) => {
    return {
      id: item.id,
      scanStatus: item.scan_status,
      targetSourceId: item.target_source_id,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
      scanVersion: item.scan_version || 1,
      durationSeconds: item.duration_seconds,
      scanProgress: item.scan_progress,
      resourceCountByResourceType: item.resource_count_by_resource_type || {},
      scanError: item.scan_error,
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
});
