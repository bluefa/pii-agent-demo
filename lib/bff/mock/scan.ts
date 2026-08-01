import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import * as scanFns from '@/lib/mock-scan';
import { SCAN_ERROR_CODES } from '@/lib/constants/scan';

const parseNumericId = (id: string): number =>
  Number(id.replace(/\D/g, '')) || 0;

/**
 * 데모용 카운트 합성 — 운영 규모(타입 ~12종, 단일 타입 최대 ~7만, 총 ~10만)에서
 * 태그·증감·총계 렌더링을 검증하려고 실 mock 리소스 수 대신 scan_version 기반
 * 결정적 수치를 리턴한다(같은 버전 = 항상 같은 맵). 버전이 1 오를 때마다 타입별로
 * drift만큼 증감해 +/− 표기가 자연히 생기고, fromVersion 타입은 그 버전부터
 * 등장해 신규 타입 케이스를 만든다. 키는 계약 resource_type enum 실값.
 * 주의: step 1 사용자 화면의 리소스 테이블은 실 mock 리소스 그대로라 이 수치와
 * 다르다 — 관리자 스캔 탭 데모 전용.
 */
interface DemoCountSpec {
  type: string;
  base: number;
  drift: number;
  fromVersion?: number;
}

const DEMO_COUNTS: Record<string, DemoCountSpec[]> = {
  AWS: [
    { type: 'AWS_NETWORK_INTERFACE', base: 68_000, drift: 137 },
    { type: 'AWS_SUBNET', base: 21_800, drift: 61 },
    { type: 'AWS_EC2_INSTANCE', base: 9_100, drift: -45 },
    { type: 'AWS_VPC_SECURITY_GROUP', base: 4_070, drift: 23 },
    { type: 'AWS_IAM_ROLE', base: 2_580, drift: 9 },
    { type: 'AWS_DYNAMO_DB_TABLE', base: 1_180, drift: -4 },
    { type: 'AWS_DB_INSTANCE', base: 590, drift: 3 },
    { type: 'AWS_S3_BUCKET_POLICY', base: 240, drift: 2 },
    { type: 'AWS_DB_CLUSTER', base: 84, drift: -1 },
    { type: 'AWS_REDSHIFT_CLUSTER', base: 30, drift: 1 },
    { type: 'AWS_ATHENA_DATABASE', base: 12, drift: 1 },
    { type: 'AWS_KMS', base: 5, drift: 2, fromVersion: 3 },
  ],
  Azure: [
    { type: 'AZURE_NETWORK_INTERFACE', base: 54_000, drift: 118 },
    { type: 'AZURE_VIRTUAL_SUBNET', base: 18_600, drift: 44 },
    { type: 'AZURE_VIRTUAL_MACHINE', base: 7_300, drift: -32 },
    { type: 'AZURE_PRIVATE_ENDPOINT', base: 3_450, drift: 19 },
    { type: 'AZURE_SERVICE_PRINCIPAL', base: 1_940, drift: 8 },
    { type: 'AZURE_SQL_SERVER', base: 820, drift: 4 },
    { type: 'AZURE_MYSQL_FLEXIBLE_SERVER', base: 410, drift: -3 },
    { type: 'AZURE_POSTGRESQL_FLEXIBLE_SERVER', base: 260, drift: 3 },
    { type: 'AZURE_COSMOSDB_NOSQL', base: 96, drift: 2 },
    { type: 'AZURE_MARIADB', base: 34, drift: -1 },
    { type: 'AZURE_SYNAPSE_WORKSPACE', base: 14, drift: 1 },
    { type: 'AZURE_SQL_SERVER_MANAGED_INSTANCE', base: 6, drift: 1, fromVersion: 3 },
  ],
  // GCP는 계약 enum 자체가 3종뿐 — 종수 대신 규모로 렌더링을 검증한다.
  GCP: [
    { type: 'GCP_VPC_NETWORK', base: 46_000, drift: 92 },
    { type: 'GCP_BIGQUERY_DATASET_REGION', base: 12_400, drift: 31 },
    { type: 'GCP_SQL', base: 3_800, drift: -12 },
  ],
  IDC: [{ type: 'IDC_RESOURCE', base: 96_000, drift: 210 }],
};

const demoCountMap = (provider: string, version: number | null | undefined): Record<string, number> => {
  const specs = DEMO_COUNTS[provider] ?? DEMO_COUNTS.AWS;
  const v = Math.max(1, version ?? 1);
  const counts: Record<string, number> = {};
  for (const { type, base, drift, fromVersion } of specs) {
    if (fromVersion !== undefined && v < fromVersion) continue;
    counts[type] = Math.max(0, base + drift * (v - 1));
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

    // Full Spring PageScanJobResponse. The route validates with
    // schemas.PageScanJobResponse.parse(raw) — content items must be snake wire.
    return NextResponse.json({
      // scan_version = 타깃 내 실행 순번 (오래된 것부터 1) — 이력은 최신순이라
      // 페이지 오프셋을 더한 역순 인덱스로 파생한다.
      content: history.map((h, index) => {
        const version = total - (query.offset + index);
        return {
          id: parseNumericId(h.scanId),
          scan_status: h.status,
          target_source_id: targetSourceId,
          created_at: h.startedAt,
          updated_at: h.completedAt,
          scan_version: version,
          scan_progress: null,
          duration_seconds: h.duration,
          // 실패 스캔은 집계가 없다(null 유지) — 성공만 데모 카운트 합성.
          resource_count_by_resource_type: h.result ? demoCountMap(h.provider, version) : null,
          scan_error: h.error ?? null,
        };
      }),
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
    // 새 스캔의 버전 = 완료된 이력 수 + 1.
    const { total: completedTotal } = scanFns.getScanHistory(targetSourceId, 1, 0);

    return NextResponse.json(
      {
        id: parseNumericId(scanJob.id),
        scan_status: 'SCANNING',
        target_source_id: targetSourceId,
        created_at: scanJob.startedAt,
        updated_at: scanJob.startedAt,
        scan_version: completedTotal + 1,
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
        const { total: completedTotal } = scanFns.getScanHistory(targetSourceId, 1, 0);
        return NextResponse.json({
          id: parseNumericId(updated.id),
          scan_status: updated.status,
          target_source_id: targetSourceId,
          created_at: updated.startedAt,
          updated_at: updated.startedAt,
          scan_version: completedTotal + 1,
          scan_progress: updated.progress,
          duration_seconds: 0,
          resource_count_by_resource_type: null,
          scan_error: null,
        });
      }
    }

    const { history, total } = scanFns.getScanHistory(targetSourceId, 1, 0);
    if (history.length > 0) {
      const last = history[0];
      return NextResponse.json({
        id: parseNumericId(last.scanId),
        scan_status: last.status,
        target_source_id: targetSourceId,
        created_at: last.startedAt,
        updated_at: last.completedAt,
        scan_version: total,
        scan_progress: null,
        duration_seconds: last.duration,
        resource_count_by_resource_type: last.result ? demoCountMap(last.provider, total) : null,
        scan_error: last.error ?? null,
      });
    }

    return NextResponse.json({
      id: 0,
      scan_status: 'NO_SCAN',
      target_source_id: targetSourceId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      scan_version: null,
      scan_progress: null,
      duration_seconds: 0,
      resource_count_by_resource_type: null,
      scan_error: null,
    });
  },
};
