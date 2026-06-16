/**
 * IDC Provider — mock backend (in-memory).
 *
 * Returns wire (snake_case) shapes per `docs/swagger/idc.yaml`; the
 * NextResponse/auth wrapping lives in `lib/bff/mock/idc.ts` (mirrors the
 * `lib/mock-gcp.ts` ↔ `lib/bff/mock/gcp.ts` split).
 *
 * `idcStore` is mock SERVER state keyed by targetSourceId — module-level is
 * correct here (it is the mock "database", not React UI state; the DR rules in
 * docs/reports/idc-v15 govern the client, not this file). Each target source
 * gets its own deep-cloned seed so mutating one never leaks into another.
 */

import type { IdcInstallationStatus, IdcResourceInput } from '@/lib/bff/types/idc';

export interface MockIdcError {
  code: string;
  message: string;
  status: number;
}
type MockIdcResult<T> = { data: T } | { error: MockIdcError };

const cloneSeed = (seed: IdcResourceInput[]): IdcResourceInput[] =>
  seed.map((r) => ({ ...r, ips: r.ips ? [...r.ips] : undefined, source_ips: r.source_ips ? [...r.source_ips] : undefined }));

/** Step-progression demo seed — the v15 `idcTargets` (3 rows). */
const IDC_SEED: IdcResourceInput[] = [
  {
    resource_id: 'idc-r1',
    name: '10.20.30.40',
    input_format: 'IP',
    ips: ['10.20.30.40'],
    port: 3306,
    database_type: 'MYSQL',
    source_ips: ['172.16.0.11'],
    firewall_open: true,
    connection_status: 'SUCCESS',
    health: 'HEALTHY',
    done: '연동 완료',
  },
  {
    resource_id: 'idc-r2',
    name: '10.20.31.10',
    input_format: 'IP',
    ips: ['10.20.31.10', '10.20.31.11', '10.20.31.12'],
    port: 1521,
    database_type: 'ORACLE',
    service_id: 'PRODORCL_ASIA_NORTHEAST_CLUSTER_NODE_PRIMARY_2026A',
    source_ips: ['172.16.0.11', '172.16.0.12'],
    firewall_open: false,
    connection_status: 'PENDING',
    health: 'UNHEALTHY',
    done: '연동 진행중',
  },
  {
    resource_id: 'idc-r3',
    name: 'analytics-readreplica',
    input_format: 'HOST',
    host: 'analytics-readreplica-cluster-01.internal.bigdata-platform.prod.svc-a.example.io',
    port: 5432,
    database_type: 'POSTGRESQL',
    source_ips: ['172.16.0.12'],
    firewall_open: true,
    connection_status: 'SUCCESS',
    health: 'HEALTHY',
    exclusion_reason: 'StageDB',
    done: '—',
  },
];

/** "기존 연동 요청 정보 불러오기" preview — the v15 `IDC_PREV_REQUEST` (7 rows). */
export const IDC_PREV_REQUEST_SEED: IdcResourceInput[] = [
  { resource_id: 'idc-p1', name: '10.20.30.40', input_format: 'IP', ips: ['10.20.30.40'], port: 3306, database_type: 'MYSQL' },
  { resource_id: 'idc-p2', name: '10.20.31.10', input_format: 'IP', ips: ['10.20.31.10', '10.20.31.11'], port: 1521, database_type: 'ORACLE', service_id: 'ORCL' },
  { resource_id: 'idc-p3', name: 'db.svc-a.io', input_format: 'HOST', host: 'db.svc-a.io', port: 5432, database_type: 'POSTGRESQL', exclusion_reason: 'StageDB' },
  { resource_id: 'idc-p4', name: '10.20.32.7', input_format: 'IP', ips: ['10.20.32.7'], port: 3306, database_type: 'MYSQL' },
  { resource_id: 'idc-p5', name: '10.20.32.8', input_format: 'IP', ips: ['10.20.32.8'], port: 27017, database_type: 'MONGODB' },
  { resource_id: 'idc-p6', name: 'cache.svc-a.io', input_format: 'HOST', host: 'cache.svc-a.io', port: 6379, database_type: 'REDIS', exclusion_reason: '캐시 전용 DB로 PII 데이터를 보관하지 않아 제외합니다.' },
  { resource_id: 'idc-p7', name: '10.20.33.2', input_format: 'IP', ips: ['10.20.33.2'], port: 1433, database_type: 'MSSQL' },
];

const idcStore = new Map<number, IdcResourceInput[]>();

const ensureSeeded = (targetSourceId: number): IdcResourceInput[] => {
  let list = idcStore.get(targetSourceId);
  if (!list) {
    list = cloneSeed(IDC_SEED);
    idcStore.set(targetSourceId, list);
  }
  return list;
};

/** Test/dev reset. */
export const resetIdcStore = (): void => idcStore.clear();

export const getIdcResources = (targetSourceId: number): MockIdcResult<{ resources: IdcResourceInput[] }> => ({
  data: { resources: ensureSeeded(targetSourceId) },
});

export const updateIdcResources = (
  targetSourceId: number,
  body: unknown,
): MockIdcResult<{ resources: IdcResourceInput[] }> => {
  if (typeof body !== 'object' || body === null || !Array.isArray((body as { resources?: unknown }).resources)) {
    return { error: { code: 'BAD_REQUEST', message: 'resources 배열이 필요합니다.', status: 400 } };
  }
  const incoming = (body as { resources: IdcResourceInput[] }).resources.map((r, i) => ({
    ...r,
    resource_id: r.resource_id ?? `idc-r-${targetSourceId}-${i}-${r.name}`,
  }));
  idcStore.set(targetSourceId, incoming);
  return { data: { resources: incoming } };
};

export const getIdcInstallationStatus = (
  targetSourceId: number,
): MockIdcResult<IdcInstallationStatus> => {
  const live = ensureSeeded(targetSourceId).filter((r) => !r.exclusion_reason);
  const resources = live.map((r) => ({
    resource_id: r.resource_id ?? r.name,
    source_ips: r.source_ips ?? [],
    firewall_open: r.firewall_open ?? false,
  }));
  return {
    data: {
      provider: 'IDC',
      bdc_tf: 'COMPLETED',
      firewall_opened: resources.length > 0 && resources.every((r) => r.firewall_open),
      resources,
      last_checked_at: new Date().toISOString(),
    },
  };
};

export const confirmIdcFirewall = (
  targetSourceId: number,
): MockIdcResult<{ confirmed: boolean; confirmed_at: string }> => {
  const list = ensureSeeded(targetSourceId);
  list.forEach((r) => {
    r.firewall_open = true;
  });
  return { data: { confirmed: true, confirmed_at: new Date().toISOString() } };
};

export const getIdcSourceIpRecommendation = (
  ipType: string,
): MockIdcResult<{ source_ips: string[]; port: number; description: string }> => {
  const byType: Record<string, string[]> = {
    public: ['172.16.0.11', '172.16.0.12'],
    private: ['10.0.0.11', '10.0.0.12'],
    vpc: ['192.168.0.11'],
  };
  return {
    data: {
      source_ips: byType[ipType] ?? byType.public,
      port: 443,
      description: 'BDC Agent가 DB에 접근할 때 사용하는 출발지 IP입니다. 서비스 측 방화벽에 허용 규칙을 등록해주세요.',
    },
  };
};
