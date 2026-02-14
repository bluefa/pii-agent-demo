import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as scanFns from '@/lib/mock-scan';
import { SCAN_ERROR_CODES } from '@/lib/constants/scan';

export const mockScan = {
  get: async (projectId: string, scanId: string) => {
    const user = await mockData.getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
        { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
      );
    }

    const project = await mockData.getProjectById(projectId);
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

    const scan = await scanFns.getScanJob(scanId);
    if (!scan || scan.projectId !== projectId) {
      return NextResponse.json(
        { error: 'SCAN_NOT_FOUND', message: SCAN_ERROR_CODES.SCAN_NOT_FOUND.message },
        { status: SCAN_ERROR_CODES.SCAN_NOT_FOUND.status }
      );
    }

    return NextResponse.json({
      scanId: scan.id,
      projectId: scan.projectId,
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

    const project = await mockData.getProjectById(projectId);
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

    const { history, total } = await scanFns.getScanHistory(projectId, query.limit, query.offset);

    return NextResponse.json({
      history: history.map((h) => ({
        scanId: h.scanId,
        status: h.status,
        startedAt: h.startedAt,
        completedAt: h.completedAt,
        duration: h.duration,
        result: h.result,
        error: h.error,
      })),
      total,
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

    const project = await mockData.getProjectById(projectId);
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

    const validation = await scanFns.validateScanRequest(project, force);
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

    const scanJob = await scanFns.createScanJob(project);

    const estimatedDuration = Math.ceil(
      (new Date(scanJob.estimatedEndAt).getTime() - new Date(scanJob.startedAt).getTime()) / 1000
    );

    return NextResponse.json(
      {
        scanId: scanJob.id,
        status: 'STARTED',
        startedAt: scanJob.startedAt,
        estimatedDuration,
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

    const project = await mockData.getProjectById(projectId);
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

    const activeScan = await scanFns.getLatestScanForProject(projectId);

    let currentScan = null;
    let isScanning = false;

    if (activeScan) {
      const updated = await scanFns.calculateScanStatus(activeScan);
      if (updated.status === 'SCANNING') {
        isScanning = true;
        currentScan = {
          scanId: updated.id,
          status: updated.status,
          startedAt: updated.startedAt,
          progress: updated.progress,
        };
      }
    }

    const { history } = await scanFns.getScanHistory(projectId, 1, 0);
    const lastCompletedScan = history.length > 0 ? {
      scanId: history[0].scanId,
      status: history[0].status,
      completedAt: history[0].completedAt,
      result: history[0].result,
    } : null;

    const scanability = await scanFns.canScan(project);

    return NextResponse.json({
      isScanning,
      canScan: scanability.canScan,
      canScanReason: scanability.reason,
      cooldownUntil: scanability.cooldownUntil,
      currentScan,
      lastCompletedScan,
    });
  },
};
