import { NextResponse } from 'next/server';
import { CPN_CLUSTER_ARN, cpnAthenaRegionId } from '@/lib/mock-data';
import type { DagAgentStatus, DagDatabaseStatus, DagDayStatus, DagStatusResponse } from '@/lib/types/dag-status';

/**
 * DAG weekly health status mock — ASSUMED CONTRACT
 * (docs/api/ops-assumed-contracts.md §10). Read-only and stateless, so no
 * globalThis store: every call regenerates deterministically from the
 * targetSourceId (only the 7-day window follows the clock).
 *
 * Profiles are pinned to the SEED_TC targets that actually reach the approval
 * tab (lib/bff/mock/task-queue.ts):
 *   1642 AWS   — HEALTHY, approve enabled            (truth row 5)
 *                RDS 인스턴스 · RDS 클러스터 · Athena 리전 2개를 한 대상에 모아 둔다
 *   1511 GCP   — UNHEALTHY, 5 DBs without a success  (truth row 6)
 *   1801 AZURE — UNHEALTHY at scale: 1,560 DBs       (truth row 6 + 1,500-row demo)
 *   1799 AZURE — HEALTHY, single agent
 * Any other id gets a small HEALTHY default so the gate works on targets the
 * demo flips to TEST_CONNECTION_COMPLETED at runtime. Every seed stays inside
 * the declared healthStatus enum — the unknown-value lock (truth row 7) is
 * covered by unit tests, not by a fixture asserting a value the contract says
 * cannot exist.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

/** Last 7 KST dates (oldest first), YYYY-MM-DD. */
const kstDays = (): string[] => {
  const nowKst = new Date(Date.now() + KST_OFFSET_MS);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(nowKst.getTime() - (6 - i) * DAY_MS);
    return d.toISOString().slice(0, 10);
  });
};

type DbPattern = 'success' | 'runningToday' | 'failed' | 'unscheduled';

/** Deterministic per-row jitter so success times differ without Math.random. */
const jitter = (seed: number, mod: number): number => (seed * 7919 + 104729) % mod;

const buildDays = (pattern: DbPattern, days: string[], seed: number): DagDayStatus[] =>
  days.map((day, i) => {
    const isToday = i === days.length - 1;
    const successTime = `${day}T07:${String(40 + jitter(seed + i, 19)).padStart(2, '0')}:${String(jitter(seed + i, 59)).padStart(2, '0')}+09:00`;
    switch (pattern) {
      case 'success':
        return { day, status: 'SUCCESS', successTime };
      case 'runningToday':
        return isToday
          ? { day, status: 'RUNNING', successTime: null }
          : { day, status: 'SUCCESS', successTime };
      case 'failed':
        // No success anywhere in the window — the row 판정 is "성공 없음".
        return jitter(seed + i, 5) === 0
          ? { day, status: 'NOT_SCHEDULED', successTime: null }
          : { day, status: 'FAILED', successTime: null };
      case 'unscheduled':
        return { day, status: 'NOT_SCHEDULED', successTime: null };
    }
  });

interface DbSpec {
  uri: string;
  name: string | null;
  pattern: DbPattern;
  seed: number;
  /**
   * 스키마가 데이터베이스 이름과 다른 엔진(postgres 계열)에서만 채운다. MySQL 은
   * 스키마와 데이터베이스가 같은 객체라 기본값이 이름 그대로다 — 화면의 두 줄이
   * 정말 서로 다른 필드에 물려 있는지 보려면 다른 값이 나오는 행이 있어야 한다.
   */
  schema?: string | null;
  /** DAG id 직접 지정 — 300자짜리 실제 이름을 픽스처가 만들 수 있어야 한다. */
  dag?: string;
}

const buildDb = (spec: DbSpec, days: string[]): DagDatabaseStatus => {
  const built = buildDays(spec.pattern, days, spec.seed);
  const lastSuccess = [...built].reverse().find((d) => d.status === 'SUCCESS');
  const succeeded = spec.pattern === 'success' || spec.pattern === 'runningToday';
  return {
    databaseUri: spec.uri,
    databaseName: spec.name,
    schemaName: spec.schema !== undefined ? spec.schema : spec.name,
    // 스케줄이 없는 행 = 7일 전부 NOT_SCHEDULED and no DAG reference (PR #707 rule).
    dagName:
      spec.pattern === 'unscheduled'
        ? null
        : (spec.dag ?? `pii_scan_${spec.name ?? `db_${spec.seed}`}`),
    namespace: spec.pattern === 'unscheduled' ? null : 'composer-prod',
    succeededThisWeek: succeeded,
    lastSuccessAt: lastSuccess?.successTime ?? null,
    days: built,
  };
};

const agent = (
  ts: number,
  idx: number,
  resourceId: string,
  gcpRegion: string | null,
  connectionStatus: string,
  dbs: DbSpec[],
  days: string[] = kstDays(),
): DagAgentStatus => ({
  agentId: `agent-${ts}-${idx + 1}`,
  resourceId,
  gcpRegion,
  connectionStatus,
  databaseStatuses: dbs.map((spec) => buildDb(spec, days)),
});

const spec = (
  uri: string,
  name: string | null,
  pattern: DbPattern,
  seed: number,
  schema?: string | null,
): DbSpec => ({
  uri,
  name,
  pattern,
  seed,
  ...(schema !== undefined ? { schema } : {}),
});

/** 1801 물류서비스 — the scale fixture: 30 agents × 52 DBs = 1,560 rows. */
const buildScaleAgents = (days: string[]): DagAgentStatus[] =>
  Array.from({ length: 30 }, (_, agentIdx) =>
    agent(
      1801,
      agentIdx,
      `/subscriptions/5f1a2b3c/resourceGroups/rg-lgs-prod/providers/Microsoft.DBforMySQL/servers/lgs-mysql-${String(agentIdx + 1).padStart(2, '0')}`,
      null,
      'SUCCESS',
      Array.from({ length: 52 }, (_, dbIdx) => {
        const globalIdx = agentIdx * 52 + dbIdx;
        const pattern: DbPattern =
          globalIdx < 14
            ? 'failed'
            : globalIdx < 18
              ? 'unscheduled'
              : globalIdx % 97 === 0
                ? 'runningToday'
                : 'success';
        const name = `lgs_${agentIdx + 1}_${dbIdx + 1}`;
        return spec(
          `mysql://10.31.${agentIdx + 1}.${20 + (dbIdx % 200)}:3306/lgs_db_${agentIdx + 1}_${dbIdx + 1}`,
          name,
          pattern,
          globalIdx,
        );
      }),
      days,
    ),
  );

const buildResponse = (targetSourceId: number): DagStatusResponse => {
  const days = kstDays();
  switch (targetSourceId) {
    // 쿠폰서비스 AWS — everything green: the approve CTA mounts. AWS 형태를 한 대상에
    // 다 모아 둔 픽스처이기도 하다: RDS 단일 인스턴스 · RDS 클러스터 · Athena 리전 2개.
    //
    // resourceId 는 확정 정보가 부르는 이름과 글자 단위로 같아야 한다 — 표의 Region·DB 열은
    // 그 값으로 조인해서 채워지고, 어긋나면 열이 통째로 대시가 된다(그러고도 화면은 멀쩡해
    // 보인다). 그래서 세 id 를 mock-data 에서 그대로 가져온다.
    case 1642:
      return {
        targetSourceId,
        connectionStatus: 'SUCCESS',
        healthStatus: 'HEALTHY',
        timezone: 'KST',
        agents: [
          agent(1642, 0, 'rds-cpn-main', null, 'SUCCESS', [
            spec('mysql://rds-cpn-main.ap-northeast-2.rds.amazonaws.com:3306/coupon', 'coupon', 'success', 1),
            spec('mysql://rds-cpn-main.ap-northeast-2.rds.amazonaws.com:3306/coupon_history', 'coupon_history', 'runningToday', 2),
            spec('mysql://rds-cpn-main.ap-northeast-2.rds.amazonaws.com:3306/promotion', 'promotion', 'success', 3),
            spec('mysql://rds-cpn-main.ap-northeast-2.rds.amazonaws.com:3306/segment', 'segment', 'success', 4),
            spec('mysql://rds-cpn-main.ap-northeast-2.rds.amazonaws.com:3306/issuance', 'issuance', 'success', 5),
            spec('mysql://rds-cpn-main.ap-northeast-2.rds.amazonaws.com:3306/budget', 'budget', 'success', 6),
          ]),
          agent(1642, 1, CPN_CLUSTER_ARN, null, 'SUCCESS', [
            spec('mysql://cpn-aurora-order.cluster-cpnabc.ap-northeast-2.rds.amazonaws.com:3306/settlement', 'settlement', 'success', 7),
            spec('mysql://cpn-aurora-order.cluster-cpnabc.ap-northeast-2.rds.amazonaws.com:3306/partner', 'partner', 'success', 8),
            spec('mysql://cpn-aurora-order.cluster-cpnabc.ap-northeast-2.rds.amazonaws.com:3306/ledger', 'ledger', 'runningToday', 9),
            spec('mysql://cpn-aurora-order.cluster-cpnabc.ap-northeast-2.rds.amazonaws.com:3306/audit', 'audit', 'success', 10),
            spec('mysql://cpn-aurora-order.cluster-cpnabc.ap-northeast-2.rds.amazonaws.com:3306/notify', 'notify', 'success', 11),
            spec('mysql://cpn-aurora-order.cluster-cpnabc.ap-northeast-2.rds.amazonaws.com:3306/stats', 'stats', 'success', 12),
          ]),
          // Athena 는 리전 하나가 한 에이전트다. 확정 정보에 ap-northeast-2 DB 가 둘 있어도
          // 여기 오는 논리 DB 는 하나 — 카탈로그 단위로 한 번 도는 DAG 다.
          agent(1642, 2, cpnAthenaRegionId('ap-northeast-2'), null, 'SUCCESS', [
            spec('athena://ap-northeast-2/AwsDataCatalog', 'AwsDataCatalog', 'success', 13),
          ]),
          agent(1642, 3, cpnAthenaRegionId('us-east-1'), null, 'SUCCESS', [
            spec('athena://us-east-1/AwsDataCatalog', 'AwsDataCatalog', 'runningToday', 14),
          ]),
          // 논리 DB 가 하나도 없는 에이전트 — 설치는 됐는데 아직 걸린 DAG 가 없는 리소스다.
          // 0 은 조회 실패와 다른 사실이고 화면도 갈린다("DAG 없음" + 진입 링크 없음),
          // 그러니 목이 그 사실을 만들 수 있어야 한다.
          agent(1642, 4, 'ddb-cpn-issue', null, 'SUCCESS', []),
        ],
      };
    case 1511: // 리뷰서비스 GCP — 5 DBs without a success this week: approve locked.
      return {
        targetSourceId,
        connectionStatus: 'SUCCESS',
        healthStatus: 'UNHEALTHY',
        timezone: 'KST',
        agents: [
          agent(1511, 0, 'projects/pii-rvw-prod/instances/review-db-1', 'asia-northeast3', 'SUCCESS', [
            spec('mysql://10.20.4.31:3306/reviews', 'reviews', 'success', 21),
            // 실제 Composer DAG id 는 300자까지 온다 — 축약이 필요한 최악의 행을
            // 픽스처가 직접 만든다. 접두사가 길어서 머리만 남기면 다른 행과 구분되지 않는다.
            {
              uri: 'mysql://10.20.4.31:3306/review_media',
              name: 'review_media',
              pattern: 'failed',
              seed: 22,
              // 정확히 300자 — 계약이 말하는 상한을 픽스처가 그대로 만든다.
              dag: 'pii_scan__gcp__pii_rvw_prod__asia_northeast3__cloudsql__review_db_1__review_media__daily_full_scan__0300_kst__owner_dataplatform_kr__retry_3__sla_6h__partition_by_day__managed_by_infra_manager__generated__do_not_edit__stage_prod__region_kr__tenant_pass__schedule_0_3_star__catchup_false__rev_0142__v3',
            },
            spec('mysql://10.20.4.31:3306/review_reports', 'review_reports', 'success', 23),
            spec('mysql://10.20.4.31:3306/moderation', 'moderation', 'success', 24),
          ]),
          agent(1511, 1, 'projects/pii-rvw-prod/instances/review-db-2', 'asia-northeast3', 'SUCCESS', [
            spec('mysql://10.20.4.32:3306/ratings', 'ratings', 'success', 25),
            spec('mysql://10.20.4.32:3306/rating_rollup', 'rating_rollup', 'failed', 26),
            spec('mysql://10.20.4.32:3306/badges', 'badges', 'runningToday', 27),
            spec('mysql://10.20.4.32:3306/billing_v2', 'billing_v2', 'unscheduled', 28),
          ]),
          // Cloud SQL for PostgreSQL — 스키마가 데이터베이스와 갈라지는 유일한
          // 에이전트다. MySQL 행(위 두 에이전트)에서는 둘이 같은 값으로 남는다.
          agent(1511, 2, 'projects/pii-rvw-prod/instances/review-db-3', 'asia-northeast3', 'FAIL', [
            spec('postgres://10.20.4.33:5432/comments', 'comments', 'failed', 29, 'public'),
            // 스키마만 없는 행 — 보드에서 Schema 줄이 라벨째 접히는지 보는 픽스처.
            spec('postgres://10.20.4.33:5432/comment_archive', 'comment_archive', 'unscheduled', 30, null),
            spec('postgres://10.20.4.33:5432/reactions', 'reactions', 'success', 31, 'analytics'),
          ]),
        ],
      };
    case 1801: { // 물류서비스 AZURE — the 1,500+ row scale target.
      const agents = buildScaleAgents(days);
      return {
        targetSourceId,
        connectionStatus: 'SUCCESS',
        healthStatus: 'UNHEALTHY',
        timezone: 'KST',
        agents,
      };
    }
    case 1799: // 배송서비스 AZURE — single-agent all-green fixture.
      return {
        targetSourceId,
        connectionStatus: 'SUCCESS',
        healthStatus: 'HEALTHY',
        timezone: 'KST',
        agents: [
          agent(
            1799,
            0,
            '/subscriptions/9d8c7b6a/resourceGroups/rg-dlv-prod/providers/Microsoft.DBforMySQL/servers/dlv-mysql-1',
            null,
            'SUCCESS',
            Array.from({ length: 8 }, (_, i) =>
              spec(`mysql://10.28.1.${10 + i}:3306/dlv_db_${i + 1}`, `dlv_db_${i + 1}`, 'success', 40 + i),
            ),
          ),
        ],
      };
    default: // Targets flipped to COMPLETED at runtime still get a working gate.
      return {
        targetSourceId,
        connectionStatus: 'SUCCESS',
        healthStatus: 'HEALTHY',
        timezone: 'KST',
        agents: [
          agent(
            targetSourceId,
            0,
            `mock-agent-${targetSourceId}`,
            null,
            'SUCCESS',
            Array.from({ length: 6 }, (_, i) =>
              spec(`mysql://10.99.0.${10 + i}:3306/db_${targetSourceId}_${i + 1}`, `db_${i + 1}`, 'success', 60 + i),
            ),
          ),
        ],
      };
  }
};

/**
 * 논리 DB 한 건의 DAG 주소 (assumed §11). 목은 uri 하나만 받으므로 실제 DAG id 를 알
 * 수 없다 — 주소의 마지막 조각은 데이터베이스 이름이고, 300자짜리 dagName 과 일치하지
 * 않는다(그 매핑은 업스트림만 안다). rollup 계열은 빈 문자열: "주소 확인 불가" 화면은
 * 그 사실을 만들 수 있는 목이 없으면 검증되지 않는다.
 */
const airflowHost = (databaseUri: string): string => {
  if (databaseUri.includes('rollup')) return '';
  const dbName = databaseUri.split('/').pop() || 'unknown';
  return `https://airflow-prod.pii.internal/dags/pii_scan_${dbName}/grid`;
};

export const mockMonitoring = {
  // GET /install/v1/target-sources/{id}/dag-status (assumed §10).
  getDagStatus: async (targetSourceId: number) => NextResponse.json(buildResponse(targetSourceId)),
  // GET /pipeline-manager/airflow-host?databaseUri=… (assumed §11) — 문자열 하나.
  // moderation 계열은 502 로 터진다: 조회 실패는 "주소가 없다"(rollup 의 빈 문자열)와
  // 다른 사실이고, 화면도 재시도 CTA 로 갈린다 — 목이 두 사실을 다 만들 수 있어야 한다.
  getAirflowHost: async (databaseUri: string) => {
    if (databaseUri.includes('moderation')) {
      return NextResponse.json(
        { error: 'BAD_GATEWAY', message: 'pipeline-manager 응답 없음' },
        { status: 502 },
      );
    }
    return NextResponse.json(airflowHost(databaseUri));
  },
};
