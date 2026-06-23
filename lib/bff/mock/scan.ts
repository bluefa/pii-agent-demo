import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as scanFns from '@/lib/mock-scan';
import { SCAN_ERROR_CODES } from '@/lib/constants/scan';
import type { ScanResult } from '@/lib/types';

const parseNumericId = (id: string): number =>
  Number(id.replace(/\D/g, '')) || 0;

const toResourceCountMap = (result: ScanResult | null | undefined): Record<string, number> | null => {
  if (!result?.byResourceType) return null;
  const counts: Record<string, number> = {};
  for (const { resourceType, count } of result.byResourceType) {
    counts[resourceType] = count;
  }
  return counts;
};

export const mockScan = {
  get: async (projectId: string, scanId: string) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
        { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
      );
    }

    const targetSourceId = Number(projectId);
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: SCAN_ERROR_CODES.NOT_FOUND.message },
        { status: SCAN_ERROR_CODES.NOT_FOUND.status }
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: SCAN_ERROR_CODES.FORBIDDEN.message },
        { status: SCAN_ERROR_CODES.FORBIDDEN.status }
      );
    }

    const scan = scanFns.getScanJob(scanId);
    if (!scan || scan.targetSourceId !== targetSourceId) {
      return NextResponse.json(
        { error: 'SCAN_NOT_FOUND', message: SCAN_ERROR_CODES.SCAN_NOT_FOUND.message },
        { status: SCAN_ERROR_CODES.SCAN_NOT_FOUND.status }
      );
    }

    return NextResponse.json({
      scanId: scan.id,
      targetSourceId: scan.targetSourceId,
      provider: scan.provider,
      status: scan.status,
      startedAt: scan.startedAt,
      completedAt: scan.completedAt,
      progress: scan.progress,
      result: scan.result,
      error: scan.error,
    });
  },

  getHistory: async (projectId: string, query: { limit: number; offset: number }) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
        { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
      );
    }

    const targetSourceId = Number(projectId);
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: SCAN_ERROR_CODES.NOT_FOUND.message },
        { status: SCAN_ERROR_CODES.NOT_FOUND.status }
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: SCAN_ERROR_CODES.FORBIDDEN.message },
        { status: SCAN_ERROR_CODES.FORBIDDEN.status }
      );
    }

    const { history, total } = scanFns.getScanHistory(targetSourceId, query.limit, query.offset);

    const size = query.limit > 0 ? query.limit : 10;
    const number = size > 0 ? Math.floor(query.offset / size) : 0;
    const totalPages = size > 0 ? Math.ceil(total / size) : 0;

    // Full Spring PageScanJobResponse. Top-level page meta is camelCase on the
    // wire (Spring); content items mirror the camel ScanJob the GET boundary
    // produces. The route reads totalElements/totalPages/number/size flat.
    return NextResponse.json({
      content: history.map((h) => ({
        id: parseNumericId(h.scanId),
        scanStatus: h.status,
        targetSourceId,
        createdAt: h.startedAt,
        updatedAt: h.completedAt,
        scanVersion: 1,
        scanProgress: null,
        durationSeconds: h.duration,
        resourceCountByResourceType: toResourceCountMap(h.result),
        scanError: h.error ?? null,
      })),
      totalElements: total,
      totalPages,
      number,
      size,
      numberOfElements: history.length,
      first: number === 0,
      last: number >= totalPages - 1,
      empty: history.length === 0,
      pageable: {
        paged: true,
        unpaged: false,
        pageNumber: number,
        pageSize: size,
        offset: query.offset,
        sort: [],
      },
      sort: [],
    });
  },

  create: async (projectId: string, body: unknown) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
        { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
      );
    }

    const targetSourceId = Number(projectId);
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: SCAN_ERROR_CODES.NOT_FOUND.message },
        { status: SCAN_ERROR_CODES.NOT_FOUND.status }
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: SCAN_ERROR_CODES.FORBIDDEN.message },
        { status: SCAN_ERROR_CODES.FORBIDDEN.status }
      );
    }

    const typedBody = (body ?? {}) as { force?: boolean };
    const force = typedBody.force === true;

    const validation = scanFns.validateScanRequest(project, force);
    if (!validation.valid) {
      const response: Record<string, unknown> = {
        error: validation.errorCode,
        message: validation.errorMessage,
      };
      if (validation.existingScanId) {
        response.scanId = validation.existingScanId;
      }
      return NextResponse.json(response, { status: validation.httpStatus });
    }

    const scanJob = scanFns.createScanJob(project);

    return NextResponse.json(
      {
        id: parseNumericId(scanJob.id),
        scan_status: 'SCANNING',
        target_source_id: targetSourceId,
        created_at: scanJob.startedAt,
        updated_at: scanJob.startedAt,
        scan_version: 1,
        scan_progress: scanJob.progress,
        duration_seconds: 0,
        resource_count_by_resource_type: null,
        scan_error: null,
      },
      { status: 202 }
    );
  },

  getStatus: async (projectId: string) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
        { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
      );
    }

    const targetSourceId = Number(projectId);
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) {
      return NextResponse.json(
        { error: 'NOT_FOUND', message: SCAN_ERROR_CODES.NOT_FOUND.message },
        { status: SCAN_ERROR_CODES.NOT_FOUND.status }
      );
    }

    if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
      return NextResponse.json(
        { error: 'FORBIDDEN', message: SCAN_ERROR_CODES.FORBIDDEN.message },
        { status: SCAN_ERROR_CODES.FORBIDDEN.status }
      );
    }

    const activeScan = scanFns.getLatestScanForProject(targetSourceId);

    if (activeScan) {
      const updated = scanFns.calculateScanStatus(activeScan);
      if (updated.status === 'SCANNING') {
        return NextResponse.json({
          id: parseNumericId(updated.id),
          scanStatus: updated.status,
          targetSourceId,
          createdAt: updated.startedAt,
          updatedAt: updated.startedAt,
          scanVersion: 1,
          scanProgress: updated.progress,
          durationSeconds: 0,
          resourceCountByResourceType: null,
          scanError: null,
        });
      }
    }

    const { history } = scanFns.getScanHistory(targetSourceId, 1, 0);
    if (history.length > 0) {
      const last = history[0];
      return NextResponse.json({
        id: parseNumericId(last.scanId),
        scanStatus: last.status,
        targetSourceId,
        createdAt: last.startedAt,
        updatedAt: last.completedAt,
        scanVersion: 1,
        scanProgress: null,
        durationSeconds: last.duration,
        resourceCountByResourceType: toResourceCountMap(last.result),
        scanError: last.error ?? null,
      });
    }

    return NextResponse.json({
      id: 0,
      scanStatus: 'NO_SCAN',
      targetSourceId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      scanVersion: null,
      scanProgress: null,
      durationSeconds: 0,
      resourceCountByResourceType: null,
      scanError: null,
    });
  },
};
