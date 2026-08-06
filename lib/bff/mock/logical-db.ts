/**
 * Logical DB (Step 5 modal) — mock BFF handlers, wire-snake == swagger.
 *
 * Emits the swagger wire shape (snake) so mock output == contract
 * (`docs/swagger/install-v1.yaml`: TestedLogicalDatabasesResponse /
 * SkipLogicalDatabaseResponse / UpdateSkipLogicalDatabaseRequest). Structure
 * mirrors `lib/bff/mock/idc.ts` (authorize guard → NextResponse.json / error
 * envelope); the `mockBff.logicalDb` adapter wraps these via `unwrap<…Wire>`.
 *
 * State is held in a module-local Map (keyed targetSourceId:resourceId) so the
 * PUT round-trips (GET-after-PUT returns what was saved) without touching the
 * shared mock-store. The skip list is lazily seeded on first access from the
 * step-aware seed below; the tested list is derived (read-only) per step.
 *
 * Per-step (process-status) data: connection-test-phase targets (Step 5/6/7)
 * get the rich topology + initial skip policy; any other step gets empty lists
 * (no test connection has run, so nothing is discovered or excluded).
 *
 * The seed deliberately exercises:
 *   - dedup / grey-out      : `stg`, `dev`, `prd.temp` appear in tested AND skip
 *   - parent-child          : DATABASE `prd` ⊃ SCHEMA `prd.temp`
 *   - excluded-only         : `legacy` is in the policy but absent from tested
 *   - enum coverage         : STG / DEV / TEMP all present (TEMP spelling)
 * Names are PII-free placeholders.
 */
import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import { getTcLogicalDbs } from '@/lib/bff/mock/task-queue';
import { ProcessStatus } from '@/lib/types';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';

type SkipLogicalDatabaseItemWire = NonNullable<z.infer<typeof schemas.SkipLogicalDatabaseResponse>['skip_logical_database_list']>[number];
type SkipLogicalDatabaseResponseWire = z.infer<typeof schemas.SkipLogicalDatabaseResponse>;
type TestedLogicalDatabaseItemWire = NonNullable<z.infer<typeof schemas.TestedLogicalDatabasesResponse>['logical_database_list']>[number];
type TestedLogicalDatabasesResponseWire = z.infer<typeof schemas.TestedLogicalDatabasesResponse>;
type UpdateSkipLogicalDatabaseRequestWire = z.infer<typeof schemas.UpdateSkipLogicalDatabaseRequest>;

// ===== Auth (mirrors lib/bff/mock/idc.ts) =====

const AUTH_ERRORS = {
  UNAUTHORIZED: { code: 'UNAUTHORIZED', message: '인증이 필요합니다.', status: 401 },
  NOT_FOUND: {
    code: 'TARGET_SOURCE_NOT_FOUND',
    message: '요청하신 Target Source를 찾을 수 없습니다.',
    status: 404,
  },
  FORBIDDEN: { code: 'FORBIDDEN', message: '해당 리소스에 접근할 권한이 없습니다.', status: 403 },
} as const;

const errorResponse = (e: { code: string; message: string; status: number }) =>
  NextResponse.json({ error: { code: e.code, message: e.message } }, { status: e.status });

const authorize = (targetSourceId: string) => {
  const user = mockData.getCurrentUser();
  if (!user) return { error: errorResponse(AUTH_ERRORS.UNAUTHORIZED) };

  const project = mockData.getProjectByTargetSourceId(Number(targetSourceId));
  if (!project) return { error: errorResponse(AUTH_ERRORS.NOT_FOUND) };

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return { error: errorResponse(AUTH_ERRORS.FORBIDDEN) };
  }
  return { user, project };
};

// ===== Seed (wire-snake) =====

/** Steps where a Test Connection has run, so logical DBs are discovered. */
const CONNECTION_TEST_STEPS: ReadonlySet<ProcessStatus> = new Set([
  ProcessStatus.WAITING_CONNECTION_TEST, // Step 5
  ProcessStatus.CONNECTION_VERIFIED, // Step 6
  ProcessStatus.INSTALLATION_COMPLETE, // Step 7
]);

/** Discovered topology (left panel). DATABASE rows + their child SCHEMA rows. */
const SEED_TESTED: readonly TestedLogicalDatabaseItemWire[] = [
  { database_name: 'live', type: 'DATABASE' },
  { database_name: 'live', schema_name: 'public', type: 'SCHEMA' },
  { database_name: 'live', schema_name: 'analytics', type: 'SCHEMA' },
  { database_name: 'prd', type: 'DATABASE' },
  { database_name: 'prd', schema_name: 'temp', type: 'SCHEMA' },
  { database_name: 'stg', type: 'DATABASE' },
  { database_name: 'dev', type: 'DATABASE' },
  { database_name: 'reporting', type: 'DATABASE' },
  { database_name: 'reporting', schema_name: 'public', type: 'SCHEMA' },
];

/** Initial skip policy (right panel). `legacy` is excluded-only (not in tested). */
const SEED_SKIP: readonly SkipLogicalDatabaseItemWire[] = [
  { database_name: 'stg', skip_reason: 'STG', type: 'DATABASE' },
  { database_name: 'dev', skip_reason: 'DEV', type: 'DATABASE' },
  { database_name: 'prd', schema_name: 'temp', skip_reason: 'TEMP', type: 'SCHEMA' },
  { database_name: 'legacy', skip_reason: 'TEMP', type: 'DATABASE' },
];

/**
 * Per-resource scenario seeds (target 1010's MySQL clusters — real-wire ids,
 * matched by suffix so the mock stays independent of the account id). MySQL
 * discovers DATABASE rows only, so these also demo the unit judgment:
 *  - …:cluster:rds-aurora-dip-stg-ap-northeast   → DATABASE-unit flat list
 *  - …:cluster:database-1                        → everything excluded: tested
 *    is EMPTY (the feedback loop collected nothing), only policy rows remain —
 *    the unit chip must NOT appear (judging it from the skip list is forbidden)
 *  - …:cluster:rds-aurora-dip-stg-ap-northeast-2 → both lists empty
 */
const SEED_TESTED_MYSQL: readonly TestedLogicalDatabaseItemWire[] = [
  { database_name: 'live', type: 'DATABASE' },
  { database_name: 'prd', type: 'DATABASE' },
  { database_name: 'stg', type: 'DATABASE' },
  { database_name: 'dev', type: 'DATABASE' },
  { database_name: 'reporting', type: 'DATABASE' },
];

const SEED_SKIP_MYSQL: readonly SkipLogicalDatabaseItemWire[] = [
  { database_name: 'stg', skip_reason: 'STG', type: 'DATABASE' },
  { database_name: 'dev', skip_reason: 'DEV', type: 'DATABASE' },
  { database_name: 'legacy', skip_reason: 'TEMP', type: 'DATABASE' },
];

const RESOURCE_SEEDS: ReadonlyArray<{
  suffix: string;
  tested: readonly TestedLogicalDatabaseItemWire[];
  skip: readonly SkipLogicalDatabaseItemWire[];
}> = [
  {
    suffix: ':cluster:rds-aurora-dip-stg-ap-northeast',
    tested: SEED_TESTED_MYSQL,
    skip: SEED_SKIP_MYSQL,
  },
  {
    suffix: ':cluster:database-1',
    tested: [],
    skip: [
      { database_name: 'analytics_archive', skip_reason: 'TEMP', type: 'DATABASE' },
      { database_name: 'reporting_stg', skip_reason: 'STG', type: 'DATABASE' },
    ],
  },
  { suffix: ':cluster:rds-aurora-dip-stg-ap-northeast-2', tested: [], skip: [] },
];

const resourceSeed = (resourceId: string) =>
  RESOURCE_SEEDS.find((s) => resourceId.endsWith(s.suffix));

const cloneTested = (items: readonly TestedLogicalDatabaseItemWire[]) =>
  items.map((i) => ({ ...i }));

const cloneSkip = (items: readonly SkipLogicalDatabaseItemWire[]) => items.map((i) => ({ ...i }));

// ===== State (module-local; PUT round-trips) =====

const stateKey = (targetSourceId: number, resourceId: string) => `${targetSourceId}:${resourceId}`;

/** Per-(target,resource) skip policy. Lazily seeded; mutated by the PUT. */
const skipState = new Map<string, SkipLogicalDatabaseItemWire[]>();

const isTested = (targetSourceId: number): boolean => {
  const project = mockData.getProjectByTargetSourceId(targetSourceId);
  return project !== undefined && CONNECTION_TEST_STEPS.has(project.processStatus);
};

const getSkipList = (targetSourceId: number, resourceId: string): SkipLogicalDatabaseItemWire[] => {
  if (!isTested(targetSourceId)) return [];
  const key = stateKey(targetSourceId, resourceId);
  const existing = skipState.get(key);
  if (existing) return existing;
  const seeded = cloneSkip(resourceSeed(resourceId)?.skip ?? SEED_SKIP);
  skipState.set(key, seeded);
  return seeded;
};

const getTestedList = (targetSourceId: number, resourceId: string): TestedLogicalDatabaseItemWire[] =>
  isTested(targetSourceId) ? cloneTested(resourceSeed(resourceId)?.tested ?? SEED_TESTED) : [];

// ===== Handlers (resourceId is the modal's only key) =====

export const mockLogicalDb = {
  getTestedByResourceId: async (targetSourceId: string, resourceId: string) => {
    // Admin Task Queue demo targets (1799/1583) live outside the store — their
    // per-resource lists come from the task-queue fixture.
    const demo = getTcLogicalDbs(Number(targetSourceId), resourceId);
    if (demo) {
      const demoBody: TestedLogicalDatabasesResponseWire = { logical_database_list: demo.tested };
      return NextResponse.json(demoBody);
    }
    // Tested topology: per-resource scenario seeds where declared (RESOURCE_SEEDS),
    // shared default otherwise.
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    const body: TestedLogicalDatabasesResponseWire = {
      logical_database_list: getTestedList(Number(targetSourceId), resourceId),
    };
    return NextResponse.json(body);
  },

  getExcludedByResourceId: async (targetSourceId: string, resourceId: string) => {
    const demo = getTcLogicalDbs(Number(targetSourceId), resourceId);
    if (demo) {
      // The fixture only seeds the list — a save writes to skipState, and the
      // client now re-reads through this GET, so a stored set has to win.
      const stored = skipState.get(stateKey(Number(targetSourceId), resourceId));
      const demoBody: SkipLogicalDatabaseResponseWire = {
        skip_logical_database_list: stored ?? demo.excluded,
      };
      return NextResponse.json(demoBody);
    }
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    const body: SkipLogicalDatabaseResponseWire = {
      skip_logical_database_list: getSkipList(Number(targetSourceId), resourceId),
    };
    return NextResponse.json(body);
  },

  updateExcludedByResourceId: async (
    targetSourceId: string,
    resourceId: string,
    requestBody: UpdateSkipLogicalDatabaseRequestWire,
  ) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth && auth.error instanceof NextResponse) return auth.error;
    // Full replace (swagger: "전체 교체(replace)"). Store the desired set verbatim.
    const next = cloneSkip(requestBody.skip_logical_database_list ?? []);
    skipState.set(stateKey(Number(targetSourceId), resourceId), next);
    const body: SkipLogicalDatabaseResponseWire = { skip_logical_database_list: next };
    return NextResponse.json(body);
  },
};
