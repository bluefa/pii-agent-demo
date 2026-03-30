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

  const data = await response.json() as { 
    content: {
      id: number;
      scanStatus: string;
      targetSourceId: number;
      createdAt: string;
      updatedAt: string;
      scanVersion: number | null;
      scanProgress: number | null;
      durationSeconds: number;
      resourceCountByResourceType: Record<string, number> | null;
      scanError: string | null;
    }[];
    totalElements: number;
  };
  const totalElements = data.totalElements;
  const totalPages = Math.ceil(totalElements / size);

  // Transform BFF history items → Swagger ScanJob schema
  const content = data.content.map((item, idx) => {
    return {
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
