import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type { Project } from '@/lib/types';
import { isValidIdcIp } from '@/lib/constants/idc';
import {
  SDU_DB_TYPE_MAX,
  SDU_DB_TYPE_MAXLEN,
  SDU_REGIONS_BY_SCOPE,
  isSduCloud,
  isSduRegion,
  sortSduRegions,
} from '@/lib/types/sdu';
import type {
  SduAcksRequestWire,
  SduBdcStatus,
  SduCommandRowWire,
  SduDefinitionRequestWire,
  SduDefinitionWire,
  SduFirewallRowWire,
  SduFirewallWire,
  SduInvalidationWire,
  SduRegion,
  SduRegionScope,
  SduTargetWire,
  SduUploadWire,
} from '@/lib/types/sdu';

/**
 * SDU (Self Data Upload) mocks for the ASSUMED contracts
 * (docs/api/sdu-assumed-contracts.md §1–§6). No SDU operation exists in
 * install-v1.yaml, so these handlers author the snake wire a future BFF is expected to
 * speak, backed by a globalThis-guarded in-memory store (the ops/access mock pattern —
 * a module-level Map would be re-created by the second bundle and silently lose writes).
 */

// ── Region → bucket / endpoint table ──────────────────────────────────────────
//
// Illustrative mock values, kept in ONE table. The real mapping is the upstream's
// (assumed doc Q3: it may differ per target source, and China is a different AWS
// partition). Nothing else in this file re-derives an endpoint or a bucket name.

interface RegionFacts {
  /** AWS region code the region name maps to. */
  awsRegion: string;
  s3Endpoint: string;
  destinationIps: string[];
}

const REGION_FACTS: Record<SduRegion, RegionFacts> = {
  asia: {
    awsRegion: 'ap-northeast-2',
    s3Endpoint: 's3.ap-northeast-2.amazonaws.com',
    destinationIps: ['52.219.56.0/22', '3.5.140.0/22'],
  },
  us: {
    awsRegion: 'us-east-1',
    s3Endpoint: 's3.us-east-1.amazonaws.com',
    destinationIps: ['52.216.0.0/15', '54.231.0.0/16', '3.5.0.0/19'],
  },
  eu: {
    awsRegion: 'eu-west-1',
    s3Endpoint: 's3.eu-west-1.amazonaws.com',
    destinationIps: ['52.218.0.0/17', '54.231.128.0/19'],
  },
  cx: {
    awsRegion: 'ap-southeast-1',
    s3Endpoint: 's3.ap-southeast-1.amazonaws.com',
    destinationIps: ['52.219.128.0/21', '3.5.148.0/22'],
  },
  china: {
    // Different partition — the endpoint suffix is `.com.cn`, not `.com`.
    awsRegion: 'cn-north-1',
    s3Endpoint: 's3.cn-north-1.amazonaws.com.cn',
    destinationIps: ['52.82.128.0/19', '52.80.0.0/16', '54.222.0.0/19'],
  },
};

const S3_PORT = 443;
const PROXY_HOST = 'http://proxy.bdc.com:8080';

/**
 * The three lines the owner runs per region. Built here, sent as ONE string: the screen
 * must never parse `s3://` out of it, because the moment it does the wire format becomes
 * a screen contract (storyboard §03 note).
 */
const buildCommand = (region: SduRegion, targetSourceId: number): string =>
  [
    `export http_proxy=${PROXY_HOST}`,
    `export https_proxy=${PROXY_HOST}`,
    `aws s3 ls s3://bdc-sdu-${REGION_FACTS[region].awsRegion}/${targetSourceId}/ --recursive --human-readable`,
  ].join('\n');

// ── Store ─────────────────────────────────────────────────────────────────────

interface SduState {
  targets: SduTargetWire[];
  definitionUpdatedAt: string | null;
  submittedAt: string | null;
  firewallAcked: SduRegion[];
  commandsAcked: SduRegion[];
  recipientIds: string[];
  recipientsUpdatedAt: string | null;
  bdcStatus: SduBdcStatus;
  /** Epoch ms the BDC step entered IN_PROGRESS; null otherwise. */
  bdcStartedAtMs: number | null;
  bdcCompletedAt: string | null;
  invalidation: SduInvalidationWire;
}

const globalStore = globalThis as typeof globalThis & {
  __sduMockStore?: Map<number, SduState>;
};

const NO_INVALIDATION: SduInvalidationWire = {
  added_regions: [],
  removed_regions: [],
  upload_ip_changed: false,
};

const emptyInvalidation = (): SduInvalidationWire => ({ ...NO_INVALIDATION });

const SEED_DEFINITION_AT = '2026-08-24T05:40:00Z';
const SEED_SUBMITTED_AT = '2026-08-24T05:41:00Z';
const SEED_RECIPIENTS_AT = '2026-08-24T07:41:00Z';

/** Target source 1100 — the mid-Step-4 fixture: 2 targets / 2 regions, firewall US only. */
const SEED_1100_TARGETS: SduTargetWire[] = [
  {
    target_id: 'sdu-1100-1',
    cloud: 'AWS',
    region: 'us',
    upload_ip: '10.20.30.40',
    database_types: ['MySQL', 'PostgreSQL'],
  },
  {
    target_id: 'sdu-1100-2',
    cloud: 'GCP',
    region: 'eu',
    upload_ip: '10.20.30.41',
    database_types: ['BigQuery'],
  },
];

const SEED_1100_RECIPIENTS = ['user-3', 'user-4', 'user-5'];

const blankState = (): SduState => ({
  targets: [],
  definitionUpdatedAt: null,
  submittedAt: null,
  firewallAcked: [],
  commandsAcked: [],
  recipientIds: [],
  recipientsUpdatedAt: null,
  bdcStatus: 'NOT_STARTED',
  bdcStartedAtMs: null,
  bdcCompletedAt: null,
  invalidation: emptyInvalidation(),
});

/**
 * 권역은 대상소스가 가진 값이다 — 저장되는 상태가 아니라 `metadata.is_china_region`
 * (`project.isChinaRegion`) 에서 읽는 파생값이고, AWS 가 같은 필드로 갈리는 것과 같다.
 * 그래서 스토어에 담지 않고 읽을 때마다 다시 계산한다.
 */
const scopeOf = (targetSourceId: number): SduRegionScope =>
  mockData.getProjectByTargetSourceId(targetSourceId)?.isChinaRegion === true
    ? 'CHINA'
    : 'GLOBAL';

/** Lazy per-target seed. */
const seedState = (targetSourceId: number): SduState => {
  const state = blankState();

  if (targetSourceId === 1100) {
    state.targets = SEED_1100_TARGETS.map((target) => ({
      ...target,
      database_types: [...target.database_types],
    }));
    state.definitionUpdatedAt = SEED_DEFINITION_AT;
    state.submittedAt = SEED_SUBMITTED_AT;
    // Firewall confirmed for US only — the half-done shape Step 4 renders as
    // "1곳 확인함" against 2 regions.
    state.firewallAcked = ['us'];
    state.recipientIds = [...SEED_1100_RECIPIENTS];
    state.recipientsUpdatedAt = SEED_RECIPIENTS_AT;
  }

  return state;
};

const getState = (targetSourceId: number): SduState => {
  const store = (globalStore.__sduMockStore ??= new Map());
  let state = store.get(targetSourceId);
  if (!state) {
    state = seedState(targetSourceId);
    store.set(targetSourceId, state);
  }
  return state;
};

/** Test hook — drops every seeded/derived state so each case starts from the fixture. */
export const resetSduMockStore = (): void => {
  globalStore.__sduMockStore = undefined;
};

/**
 * Called by the system reset (`POST …/reset`). The DEFINITION survives: reset returns the
 * target to Step 1, and Step 1 is where the definition is edited — wiping it would hand
 * the owner an empty screen to re-type from memory. What goes is the Step-4 upload state,
 * which describes an integration that no longer exists.
 */
export const clearSduUploadState = (targetSourceId: number): void => {
  const store = globalStore.__sduMockStore;
  const state = store?.get(targetSourceId);
  if (!state) return;
  state.submittedAt = null;
  state.firewallAcked = [];
  state.commandsAcked = [];
  state.recipientIds = [];
  state.recipientsUpdatedAt = null;
  state.bdcStatus = 'NOT_STARTED';
  state.bdcStartedAtMs = null;
  state.bdcCompletedAt = null;
  state.invalidation = emptyInvalidation();
};

// ── Errors / auth ─────────────────────────────────────────────────────────────

const errorResponse = (status: number, code: string, message: string): NextResponse =>
  NextResponse.json({ error: { code, message } }, { status });

const invalidParameter = (message: string): NextResponse =>
  errorResponse(400, 'INVALID_PARAMETER', message);

const noContent = (): NextResponse => NextResponse.json({ ok: true });

type AuthResult = { error: NextResponse } | { project: Project };

/** Same gate as the IDC mock: session → target exists → caller owns the service. */
const authorize = (targetSourceId: number): AuthResult => {
  const user = mockData.getCurrentUser();
  if (!user) return { error: errorResponse(401, 'UNAUTHORIZED', '인증이 필요합니다.') };

  const project = mockData.getProjectByTargetSourceId(targetSourceId);
  if (!project) {
    return {
      error: errorResponse(404, 'TARGET_SOURCE_NOT_FOUND', '요청하신 Target Source를 찾을 수 없습니다.'),
    };
  }

  if (user.role !== 'ADMIN' && !user.serviceCodePermissions.includes(project.serviceCode)) {
    return { error: errorResponse(403, 'FORBIDDEN', '해당 리소스에 접근할 권한이 없습니다.') };
  }
  return { project };
};

// ── Derived reads ─────────────────────────────────────────────────────────────

/** Distinct regions the definition references, in canonical order. */
const regionsOf = (state: SduState): SduRegion[] =>
  sortSduRegions(state.targets.map((target) => target.region));

const BDC_DURATION_MS = 60_000;

/**
 * BDC progression, evaluated on every read and every write rather than on a timer.
 * A `setTimeout` would not survive a hot reload and would keep the node process alive in
 * tests; elapsed time is the same fact measured where it is read (the pattern
 * `lib/mock-installation.ts` uses for terraform scripts).
 *
 * Entry condition: every current region acknowledged on BOTH lists, and at least one key
 * recipient. Losing any of those before completion sends it back to NOT_STARTED — an
 * invalidated ack means BDC is waiting again, not that it is half-done.
 */
const refreshBdc = (targetSourceId: number, state: SduState): void => {
  if (state.bdcStatus === 'COMPLETED') return;

  const regions = regionsOf(state);
  const ready =
    regions.length > 0 &&
    regions.every((region) => state.firewallAcked.includes(region)) &&
    regions.every((region) => state.commandsAcked.includes(region)) &&
    state.recipientIds.length > 0;

  if (!ready) {
    state.bdcStatus = 'NOT_STARTED';
    state.bdcStartedAtMs = null;
    return;
  }

  if (state.bdcStatus === 'NOT_STARTED') {
    state.bdcStatus = 'IN_PROGRESS';
    state.bdcStartedAtMs = Date.now();
    return;
  }

  if (state.bdcStartedAtMs !== null && Date.now() - state.bdcStartedAtMs >= BDC_DURATION_MS) {
    state.bdcStatus = 'COMPLETED';
    state.bdcCompletedAt = new Date().toISOString();
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (project && project.processStatus < ProcessStatus.WAITING_CONNECTION_TEST) {
      mockData.updateProject(project.id, {
        processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
      });
    }
  }
};

/**
 * Test hook — backdates the BDC start past its duration and re-evaluates, so a test can
 * observe the completion transition without waiting 60 s of wall clock. It drives the
 * SAME code path a real elapsed minute drives; it does not set COMPLETED by hand.
 */
export const completeSduBdcForTest = (targetSourceId: number): void => {
  const state = getState(targetSourceId);
  refreshBdc(targetSourceId, state);
  if (state.bdcStartedAtMs === null) return;
  state.bdcStartedAtMs -= BDC_DURATION_MS;
  refreshBdc(targetSourceId, state);
};

const toDefinitionWire = (targetSourceId: number, state: SduState): SduDefinitionWire => ({
  region_scope: scopeOf(targetSourceId),
  targets: state.targets.map((target) => ({ ...target, database_types: [...target.database_types] })),
  updated_at: state.definitionUpdatedAt,
});

const toFirewallWire = (state: SduState, regions: SduRegion[]): SduFirewallWire => {
  const rows: SduFirewallRowWire[] = regions.map((region) => ({
    region,
    s3_endpoint: REGION_FACTS[region].s3Endpoint,
    port: S3_PORT,
    destination_ips: [...REGION_FACTS[region].destinationIps],
  }));
  return { rows, acked_regions: sortSduRegions(state.firewallAcked) };
};

const toCommandsWire = (
  targetSourceId: number,
  state: SduState,
  regions: SduRegion[],
): { rows: SduCommandRowWire[]; acked_regions: SduRegion[] } => ({
  rows: regions.map((region) => ({ region, command: buildCommand(region, targetSourceId) })),
  acked_regions: sortSduRegions(state.commandsAcked),
});

const toUploadWire = (targetSourceId: number, state: SduState): SduUploadWire => {
  const regions = regionsOf(state);
  const users = state.recipientIds.flatMap((id) => {
    const user = mockData.mockUsers.find((candidate) => candidate.id === id);
    return user ? [{ id: user.id, name: user.name, email: user.email }] : [];
  });

  return {
    submitted_at: state.submittedAt,
    regions,
    firewall: toFirewallWire(state, regions),
    recipients: { users, updated_at: state.recipientsUpdatedAt },
    commands: toCommandsWire(targetSourceId, state, regions),
    bdc: {
      status: state.bdcStatus,
      checked_at: new Date().toISOString(),
      completed_at: state.bdcCompletedAt,
    },
    invalidation: { ...state.invalidation },
  };
};

// ── Definition validation ─────────────────────────────────────────────────────

type ValidationFailure = { message: string };

/** Returns the trimmed list, so the caller never has to cast `unknown` back to string[]. */
const normalizeDatabaseTypes = (
  value: unknown,
  index: number,
): { databaseTypes: string[] } | ValidationFailure => {
  if (!Array.isArray(value)) {
    return { message: `targets[${index}].database_types는 배열이어야 합니다.` };
  }
  if (value.length > SDU_DB_TYPE_MAX) {
    return {
      message: `targets[${index}].database_types는 최대 ${SDU_DB_TYPE_MAX}개까지 입력할 수 있습니다.`,
    };
  }
  const databaseTypes: string[] = [];
  for (const entry of value) {
    if (typeof entry !== 'string' || entry.trim().length === 0) {
      return { message: `targets[${index}].database_types의 항목은 비어 있을 수 없습니다.` };
    }
    if (entry.trim().length > SDU_DB_TYPE_MAXLEN) {
      return {
        message: `targets[${index}].database_types의 항목은 ${SDU_DB_TYPE_MAXLEN}자를 넘을 수 없습니다.`,
      };
    }
    databaseTypes.push(entry.trim());
  }
  return { databaseTypes };
};

const normalizeTarget = (
  raw: unknown,
  index: number,
  scope: SduRegionScope,
  fallbackId: string,
): { target: SduTargetWire } | ValidationFailure => {
  if (typeof raw !== 'object' || raw === null) {
    return { message: `targets[${index}]는 object여야 합니다.` };
  }
  const candidate = raw as Record<string, unknown>;

  if (!isSduCloud(candidate.cloud)) {
    return { message: `targets[${index}].cloud 값이 올바르지 않습니다.` };
  }
  if (!isSduRegion(candidate.region)) {
    return { message: `targets[${index}].region 값이 올바르지 않습니다.` };
  }
  // A region belongs to exactly one scope. Accepting `china` under GLOBAL would produce a
  // bucket path no scope owns, and the invalidation table could never be computed.
  if (!SDU_REGIONS_BY_SCOPE[scope].includes(candidate.region)) {
    return {
      message: `targets[${index}].region "${candidate.region}"은 ${scope} 권역의 Region이 아닙니다.`,
    };
  }
  if (typeof candidate.upload_ip !== 'string' || !isValidIdcIp(candidate.upload_ip)) {
    return { message: `targets[${index}].upload_ip는 올바른 IPv4 주소여야 합니다.` };
  }

  const dbTypes = normalizeDatabaseTypes(candidate.database_types, index);
  if ('message' in dbTypes) return dbTypes;

  const targetId =
    typeof candidate.target_id === 'string' && candidate.target_id.trim().length > 0
      ? candidate.target_id
      : fallbackId;

  return {
    target: {
      target_id: targetId,
      cloud: candidate.cloud,
      region: candidate.region,
      upload_ip: candidate.upload_ip.trim(),
      database_types: dbTypes.databaseTypes,
    },
  };
};

/**
 * The invalidation table (storyboard "무엇을 고치면 무엇이 무효가 되나"), applied to the
 * stored acks:
 *
 *   region added        → nothing to drop; it simply has no ack yet
 *   region removed      → its acks go from BOTH lists (they answer a path that is gone)
 *   upload_ip changed   → ALL firewall acks go; command acks stay
 *   cloud / db types    → nothing
 *
 * The IP is the only edit with a blast radius wider than its own row: a firewall rule is
 * a source→destination PAIR, so a new source makes every rule a different rule. The
 * commands do not carry the source IP, so they survive.
 */
const applyInvalidation = (
  state: SduState,
  previous: SduTargetWire[],
  next: SduTargetWire[],
): SduInvalidationWire => {
  const previousRegions = sortSduRegions(previous.map((target) => target.region));
  const nextRegions = sortSduRegions(next.map((target) => target.region));

  const added = nextRegions.filter((region) => !previousRegions.includes(region));
  const removed = previousRegions.filter((region) => !nextRegions.includes(region));

  const previousIps = new Map(previous.map((target) => [target.target_id, target.upload_ip]));
  const uploadIpChanged = next.some((target) => {
    const before = previousIps.get(target.target_id);
    return before !== undefined && before !== target.upload_ip;
  });

  if (removed.length > 0) {
    state.firewallAcked = state.firewallAcked.filter((region) => !removed.includes(region));
    state.commandsAcked = state.commandsAcked.filter((region) => !removed.includes(region));
  }
  if (uploadIpChanged) {
    state.firewallAcked = [];
  }

  return { added_regions: added, removed_regions: removed, upload_ip_changed: uploadIpChanged };
};

// ── Handlers ──────────────────────────────────────────────────────────────────

export const mockSdu = {
  // GET …/sdu/definition (assumed §1).
  getDefinition: async (targetSourceId: number) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth) return auth.error;
    return NextResponse.json(toDefinitionWire(targetSourceId, getState(targetSourceId)));
  },

  // PUT …/sdu/definition (assumed §2).
  putDefinition: async (targetSourceId: number, body: SduDefinitionRequestWire) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth) return auth.error;

    const state = getState(targetSourceId);

    if (!Array.isArray(body?.targets)) {
      return invalidParameter('targets는 배열이어야 합니다.');
    }

    // 권역은 본문이 아니라 대상소스가 정한다. 옛 클라이언트가 `region_scope` 를 실어
    // 보내더라도 거절하지 않고 무시한다 — 쓸 수 없는 값을 보냈을 뿐, 틀린 요청은 아니다.
    const scope = scopeOf(targetSourceId);

    const normalized: SduTargetWire[] = [];
    for (const [index, raw] of body.targets.entries()) {
      const result = normalizeTarget(raw, index, scope, `sdu-${targetSourceId}-${index + 1}`);
      if ('message' in result) return invalidParameter(result.message);
      normalized.push(result.target);
    }

    const previous = state.targets;
    state.invalidation = applyInvalidation(state, previous, normalized);
    state.targets = normalized;
    state.definitionUpdatedAt = new Date().toISOString();
    refreshBdc(targetSourceId, state);

    return NextResponse.json(toDefinitionWire(targetSourceId, state));
  },

  // POST …/sdu/definition/submit (assumed §3).
  submitDefinition: async (targetSourceId: number) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth) return auth.error;

    const state = getState(targetSourceId);
    if (state.targets.length === 0) {
      return invalidParameter('연동 대상을 최소 한 건 추가해주세요.');
    }

    state.submittedAt = new Date().toISOString();
    // SDU has no approval step — Step 1 hands straight over to the upload step.
    if (auth.project.processStatus === ProcessStatus.WAITING_TARGET_CONFIRMATION) {
      mockData.updateProject(auth.project.id, { processStatus: ProcessStatus.INSTALLING });
    }
    return noContent();
  },

  // GET …/sdu/upload (assumed §4).
  getUpload: async (targetSourceId: number) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth) return auth.error;

    const state = getState(targetSourceId);
    refreshBdc(targetSourceId, state);
    return NextResponse.json(toUploadWire(targetSourceId, state));
  },

  // PUT …/sdu/upload/acks (assumed §5).
  putAcks: async (targetSourceId: number, body: SduAcksRequestWire) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth) return auth.error;

    const state = getState(targetSourceId);

    if (body?.kind !== 'FIREWALL' && body?.kind !== 'UPLOAD') {
      return invalidParameter('kind는 FIREWALL 또는 UPLOAD여야 합니다.');
    }
    if (typeof body.confirmed !== 'boolean') {
      return invalidParameter('confirmed는 boolean이어야 합니다.');
    }
    if (!Array.isArray(body.regions) || !body.regions.every(isSduRegion)) {
      return invalidParameter('regions는 Region 배열이어야 합니다.');
    }

    const current = regionsOf(state);
    const offRoster = body.regions.filter((region) => !current.includes(region));
    if (offRoster.length > 0) {
      return invalidParameter(`연동 대상에 없는 Region입니다: ${offRoster.join(', ')}`);
    }

    const target = body.kind === 'FIREWALL' ? state.firewallAcked : state.commandsAcked;
    const next = body.confirmed
      ? sortSduRegions([...target, ...body.regions])
      : target.filter((region) => !body.regions.includes(region));

    if (body.kind === 'FIREWALL') state.firewallAcked = next;
    else state.commandsAcked = next;

    // 무효화 안내는 한 번만 말한다 — 다음 확인 응답이 들어온 순간 그 안내는 이미 읽힌 것이다.
    state.invalidation = emptyInvalidation();
    refreshBdc(targetSourceId, state);

    return noContent();
  },

  // PUT …/sdu/upload/recipients (assumed §6).
  putRecipients: async (targetSourceId: number, body: { user_ids: string[] }) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth) return auth.error;

    if (!Array.isArray(body?.user_ids) || !body.user_ids.every((id) => typeof id === 'string')) {
      return invalidParameter('user_ids는 문자열 배열이어야 합니다.');
    }

    const resolved: string[] = [];
    for (const id of body.user_ids) {
      const user = mockData.mockUsers.find((candidate) => candidate.id === id);
      if (!user) return invalidParameter(`존재하지 않는 사용자입니다: ${id}`);
      if (!resolved.includes(user.id)) resolved.push(user.id);
    }

    const state = getState(targetSourceId);
    state.recipientIds = resolved;
    state.recipientsUpdatedAt = new Date().toISOString();
    refreshBdc(targetSourceId, state);

    return noContent();
  },
};
