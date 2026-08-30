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
  SduAckRequestWire,
  SduBdcCompletionRequestWire,
  SduBdcStatus,
  SduCommandsWire,
  SduDefinitionRequestWire,
  SduDefinitionWire,
  SduFirewallRowWire,
  SduFirewallWire,
  SduInvalidationWire,
  SduRecipientWire,
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

/**
 * 한 확인의 답. `acked` 만으로는 승인 조건 ①의 근거 행(「방화벽 확인 · 홍길동 · 08-25
 * 10:40」)을 세울 수 없어서 누가·언제를 같이 진다. 되돌린 답도 갱신이지 비움이 아니다.
 */
interface SduAckState {
  acked: boolean;
  ackedAt: string | null;
  ackedBy: SduRecipientWire | null;
}

interface SduState {
  targets: SduTargetWire[];
  definitionUpdatedAt: string | null;
  submittedAt: string | null;
  firewall: SduAckState;
  commands: SduAckState;
  /** 마지막으로 발급한 target id 의 일련번호. 되돌아가지 않는다. */
  targetSeq: number;
  recipientIds: string[];
  recipientsUpdatedAt: string | null;
  bdcStatus: SduBdcStatus;
  bdcCompletedAt: string | null;
  /** 완료를 단언한 사람 (델타 §2). 파생값에는 저자가 없고 단언에는 있다. */
  bdcCompletedBy: SduRecipientWire | null;
  invalidation: SduInvalidationWire;
}

const globalStore = globalThis as typeof globalThis & {
  __sduMockStore?: Map<number, SduState>;
};

const NO_INVALIDATION: SduInvalidationWire = {
  added_regions: [],
  upload_ip_changed: false,
};

const emptyInvalidation = (): SduInvalidationWire => ({ ...NO_INVALIDATION });

const blankAck = (): SduAckState => ({ acked: false, ackedAt: null, ackedBy: null });

/** 시드가 쓰는 사람 하나. 목 사용자 명부 밖의 사람을 근거 행에 앉히지 않는다. */
const seedUser = (id: string): SduRecipientWire | null => {
  const user = mockData.mockUsers.find((candidate) => candidate.id === id);
  return user ? { id: user.id, name: user.name, email: user.email } : null;
};

const SEED_DEFINITION_AT = '2026-08-24T05:40:00Z';
const SEED_SUBMITTED_AT = '2026-08-24T05:41:00Z';
const SEED_RECIPIENTS_AT = '2026-08-24T07:41:00Z';
const SEED_FIREWALL_ACKED_AT = '2026-08-25T10:40:00Z';

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

/**
 * 후보는 이 서비스(`SDU`)의 담당자뿐이므로 시드도 그 안에서 고른다 — 담당자가 아닌
 * 사람이 수신자로 앉아 있으면 화면은 고를 수 없는 상태를 그리게 된다. 셋 중 둘만 넣어
 * 「더 넣을 사람이 남은」 모양을 만든다.
 */
const SEED_1100_RECIPIENTS = ['user-1', 'user-5'];

const blankState = (): SduState => ({
  targets: [],
  definitionUpdatedAt: null,
  submittedAt: null,
  firewall: blankAck(),
  commands: blankAck(),
  targetSeq: 0,
  recipientIds: [],
  recipientsUpdatedAt: null,
  bdcStatus: 'NOT_STARTED',
  bdcCompletedAt: null,
  bdcCompletedBy: null,
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
    state.targetSeq = SEED_1100_TARGETS.length;
    state.definitionUpdatedAt = SEED_DEFINITION_AT;
    state.submittedAt = SEED_SUBMITTED_AT;
    // 방화벽만 답이 있고 업로드 확인은 아직 없다 — 2단계가 반쯤 끝난 모양이다. 답은 대상
    // 소스 단위 하나이므로 Region 을 가리지 않는다.
    state.firewall = {
      acked: true,
      ackedAt: SEED_FIREWALL_ACKED_AT,
      ackedBy: seedUser('user-1'),
    };
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
  state.firewall = blankAck();
  state.commands = blankAck();
  state.recipientIds = [];
  state.recipientsUpdatedAt = null;
  // 단언된 완료도 **무조건** 버린다 (델타 §5). 파생값이던 시절에는 조건이 사라지면 완료도
  // 따라 사라졌지만, 단언은 스스로 남으려 하므로 여기서 이름을 불러 지워야 한다 — 누가
  // 언제 단언했든 초기화가 봐줄 이유가 없다.
  state.bdcStatus = 'NOT_STARTED';
  state.bdcCompletedAt = null;
  state.bdcCompletedBy = null;
  state.invalidation = emptyInvalidation();
};

// ── Errors / auth ─────────────────────────────────────────────────────────────

const errorResponse = (status: number, code: string, message: string): NextResponse =>
  NextResponse.json({ error: { code, message } }, { status });

const invalidParameter = (message: string): NextResponse =>
  errorResponse(400, 'INVALID_PARAMETER', message);

/** 본문 없는 성공. 계약이 말하는 204 그대로 — 상류가 실제로 내는 것을 목도 낸다. */
const noContent = (): NextResponse => new NextResponse(null, { status: 204 });

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

/**
 * 여덟 번째 쓰기만 ADMIN 이다 (델타 §2). 앞의 일곱은 담당자가 **자기 쪽 사실**을 보고하는
 * 것이고, 이것은 BDC 쪽 작업에 대한 단언이라 담당자가 누르면 제 설치를 스스로 다음 단계로
 * 밀어내게 된다 — SDU 에는 그 앞을 막아 줄 승인 단계가 없다.
 */
const authorizeAdmin = (targetSourceId: number): AuthResult => {
  const auth = authorize(targetSourceId);
  if ('error' in auth) return auth;
  if (mockData.getCurrentUser()?.role !== 'ADMIN') {
    return { error: errorResponse(403, 'FORBIDDEN', '관리자만 BDC 완료를 처리할 수 있습니다.') };
  }
  return auth;
};

// ── Derived reads ─────────────────────────────────────────────────────────────

/** Distinct regions the definition references, in canonical order. */
const regionsOf = (state: SduState): SduRegion[] =>
  sortSduRegions(state.targets.map((target) => target.region));

/**
 * BDC 진입 조건 (계약 §8) — 현재 정의의 모든 Region 이 두 목록 모두에서 확인됐고, S3 Access
 * Key 수신자가 1명 이상. `putBdcCompletion` 의 전제이기도 하다 (델타 §4).
 */
const bdcReady = (state: SduState): boolean =>
  regionsOf(state).length > 0 &&
  state.firewall.acked &&
  state.commands.acked &&
  state.recipientIds.length > 0;

/**
 * BDC 진행 — 읽을 때마다, 쓸 때마다 다시 센다.
 *
 * **완료는 여기서 나오지 않는다** (2026-08-30 델타 §0). 예전에는 조건을 갖춘 뒤 60초가 지나면
 * 이 함수가 스스로 COMPLETED 로 넘어갔는데, 완료가 관리자의 단언이 된 지금 그 경로를 남겨 두면
 * 목이 버튼 없이도 설치를 밀어내 계약과 다른 것을 모델링하게 된다. 이 함수가 말하는 것은
 * 둘뿐이다 — 조건을 갖췄으면 IN_PROGRESS, 잃었으면 NOT_STARTED.
 *
 * 이미 단언된 COMPLETED 는 조건이 깨져도 살아남는다. 단언은 사실의 보고이지 조건의 요약이
 * 아니라서인데, **계약이 아직 답하지 않은 질문**이다 — 반대로 답이 오면 바뀌는 것은 아래 한
 * 줄이다 (요청서 `2026-08-30-sdu-bdc-completion.md` §5 #1).
 */
const refreshBdc = (state: SduState): void => {
  if (state.bdcStatus === 'COMPLETED') return;
  state.bdcStatus = bdcReady(state) ? 'IN_PROGRESS' : 'NOT_STARTED';
};

// 권역은 이 응답에 없다 — 대상 소스가 가진 사실이고, 두 곳에서 말하면 어긋날 자리가 생긴다.
const toDefinitionWire = (state: SduState): SduDefinitionWire => ({
  targets: state.targets.map((target) => ({ ...target, database_types: [...target.database_types] })),
  updated_at: state.definitionUpdatedAt,
});

const toAckStampWire = (ack: SduAckState) => ({
  acked: ack.acked,
  acked_at: ack.ackedAt,
  acked_by: ack.ackedBy,
});

const toFirewallWire = (state: SduState, regions: SduRegion[]): SduFirewallWire => {
  const rows: SduFirewallRowWire[] = regions.map((region) => ({
    region,
    s3_endpoint: REGION_FACTS[region].s3Endpoint,
    port: S3_PORT,
    destination_ips: [...REGION_FACTS[region].destinationIps],
  }));
  return { rows, ...toAckStampWire(state.firewall) };
};

const toCommandsWire = (
  targetSourceId: number,
  state: SduState,
  regions: SduRegion[],
): SduCommandsWire => ({
  rows: regions.map((region) => ({ region, command: buildCommand(region, targetSourceId) })),
  ...toAckStampWire(state.commands),
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
    access_key_recipients: { users, updated_at: state.recipientsUpdatedAt },
    commands: toCommandsWire(targetSourceId, state, regions),
    bdc: {
      status: state.bdcStatus,
      checked_at: new Date().toISOString(),
      completed_at: state.bdcCompletedAt,
      completed_by: state.bdcCompletedBy,
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
 *   region added        → BOTH answers reset — the new region has a firewall rule nobody
 *                         has confirmed and an upload path nobody has run `ls` against
 *   region removed      → nothing; the answer that remains is still true
 *   upload_ip changed   → the firewall answer resets; the command answer stays
 *   cloud / db types    → nothing
 *
 * The IP resets only the firewall because a firewall rule is a source→destination PAIR, so
 * a new source makes every rule a different rule. The commands do not carry the source IP.
 */
const applyInvalidation = (
  state: SduState,
  previous: SduTargetWire[],
  next: SduTargetWire[],
): SduInvalidationWire => {
  const previousRegions = sortSduRegions(previous.map((target) => target.region));
  const nextRegions = sortSduRegions(next.map((target) => target.region));

  const added = nextRegions.filter((region) => !previousRegions.includes(region));

  const previousIps = new Map(previous.map((target) => [target.target_id, target.upload_ip]));
  const uploadIpChanged = next.some((target) => {
    const before = previousIps.get(target.target_id);
    return before !== undefined && before !== target.upload_ip;
  });

  if (added.length > 0) {
    state.firewall = blankAck();
    state.commands = blankAck();
  }
  if (uploadIpChanged) {
    state.firewall = blankAck();
  }

  // 이번 저장의 결과를 **덮어쓰지 않고 얹는다.** 답은 이미 지워졌는데 안내만 사라지면,
  // 담당자는 아무 설명 없이 비어 있는 확인 블록을 본다 — 안내가 막으라고 있는 바로 그
  // 상태다. 지우는 것은 다음 확인 응답 하나뿐이다(계약 §3.1).
  const pending = state.invalidation;
  return {
    added_regions: sortSduRegions([...pending.added_regions, ...added]),
    upload_ip_changed: pending.upload_ip_changed || uploadIpChanged,
  };
};

/**
 * 두 확인이 하는 일은 같다 — 어느 확인인지는 경로가 이미 말했으므로 본문에 남는 것은
 * `confirmed` 하나다.
 */
const writeAck = (
  targetSourceId: number,
  body: SduAckRequestWire,
  block: 'firewall' | 'commands',
): NextResponse => {
  const auth = authorize(targetSourceId);
  if ('error' in auth) return auth.error;

  if (typeof body?.confirmed !== 'boolean') {
    return invalidParameter('confirmed는 boolean이어야 합니다.');
  }

  const user = mockData.getCurrentUser();
  const state = getState(targetSourceId);
  state[block] = {
    acked: body.confirmed,
    ackedAt: new Date().toISOString(),
    ackedBy: user ? { id: user.id, name: user.name, email: user.email } : null,
  };

  // 무효화 안내는 한 번만 말한다 — 다음 확인 응답이 들어온 순간 그 안내는 이미 읽힌 것이다.
  state.invalidation = emptyInvalidation();
  refreshBdc(state);

  return noContent();
};

// ── Handlers ──────────────────────────────────────────────────────────────────

export const mockSdu = {
  // GET …/sdu/definition (assumed §1).
  getDefinition: async (targetSourceId: number) => {
    const auth = authorize(targetSourceId);
    if ('error' in auth) return auth.error;
    return NextResponse.json(toDefinitionWire(getState(targetSourceId)));
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
      // 자리 번호로 id 를 짓지 않는다 — 앞 행을 지우고 새 행을 더하면 새 행이 남은 행의
      // 번호를 물려받아 같은 id 가 둘이 된다. 스토어의 카운터는 한 방향으로만 오른다.
      state.targetSeq += 1;
      const result = normalizeTarget(raw, index, scope, `sdu-${targetSourceId}-${state.targetSeq}`);
      if ('message' in result) return invalidParameter(result.message);
      normalized.push(result.target);
    }

    const previous = state.targets;
    state.invalidation = applyInvalidation(state, previous, normalized);
    state.targets = normalized;
    state.definitionUpdatedAt = new Date().toISOString();
    refreshBdc(state);

    return NextResponse.json(toDefinitionWire(state));
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
    refreshBdc(state);
    return NextResponse.json(toUploadWire(targetSourceId, state));
  },

  // PUT …/sdu/upload/firewall/ack (assumed §5).
  putFirewallAck: async (targetSourceId: number, body: SduAckRequestWire) =>
    writeAck(targetSourceId, body, 'firewall'),

  // PUT …/sdu/upload/commands/ack (assumed §5).
  putCommandsAck: async (targetSourceId: number, body: SduAckRequestWire) =>
    writeAck(targetSourceId, body, 'commands'),

  /**
   * PUT …/sdu/upload/bdc/completion (2026-08-30 델타 §1).
   *
   * 완료는 파생이 아니라 **단언**이다. `true` 는 세우고 단계를 5로 밀고, `false` 는 단언을
   * 지워 §8 의 파생으로 되돌린다 — 지우기가 아니라 **다시 세기**다.
   *
   * **단언에는 전제가 있다** (오너 2026-08-30 2차, 델타 §4): §8 의 진입 조건 — 두 확인 「예」
   * + 수신자 1명 이상. 시작조차 할 수 없었던 BDC 가 **끝났다**고 말하는 것은 앞뒤가 맞지
   * 않는다. 모달이 스캔·확정·Terraform 의 실제 상태를 옆에 적는 것은 그대로이고(무엇을
   * 덮어쓰는지 보여준다), 다만 그것이 유일한 방어선은 아니다.
   *
   * **되돌리기는 전제가 없다.** 오너의 「언제든」은 그쪽 방향에 그대로 남는다.
   */
  putBdcCompletion: async (targetSourceId: number, body: SduBdcCompletionRequestWire) => {
    const auth = authorizeAdmin(targetSourceId);
    if ('error' in auth) return auth.error;

    if (typeof body?.completed !== 'boolean') {
      return invalidParameter('completed는 boolean이어야 합니다.');
    }

    const state = getState(targetSourceId);

    if (!body.completed) {
      // COMPLETED 가 아니었어도 거절하지 않는다 — 결과가 이미 그 값이라, 관리자가 할 수 있는
      // 일이 없는 거절이 된다. ProcessStatus 는 움직이지 않는다(델타 §3): 그 사이 연결
      // 테스트가 돌았을 수 있고, 되돌리기가 취소하는 것은 단언이지 그 뒤에 일어난 일이 아니다.
      state.bdcStatus = 'NOT_STARTED';
      state.bdcCompletedAt = null;
      state.bdcCompletedBy = null;
      refreshBdc(state);
      return noContent();
    }

    // 시작 조건을 못 갖춘 BDC 는 끝났을 수가 없다 (델타 §4).
    if (!bdcReady(state)) {
      return invalidParameter(
        'BDC 진행 조건을 갖추지 못했습니다 — 방화벽 결재 확인과 데이터 업로드 확인, S3 Access Key 수신자 1명 이상이 필요합니다.',
      );
    }

    const user = mockData.getCurrentUser();
    state.bdcStatus = 'COMPLETED';
    state.bdcCompletedAt = new Date().toISOString();
    state.bdcCompletedBy = user ? { id: user.id, name: user.name, email: user.email } : null;
    // **5다** (오너 2026-08-30 3차, 「1->4->5->7」). 08-28 §8 의 「ProcessStatus 5」가 옳고
    // §9 의 「2·3·5 비활성」에서 5 가 오기였다(델타 §3.2). 대상은 실제로 「연결 테스트 필요」에
    // 앉고, 그래야 승인 조건 ②(최신 TC 성공)를 무언가가 만족시킬 수 있다.
    // 이미 5 이상인 대상은 옮기지 않는다: 6·7단계를 5로 끌어내리는 것은 전진이 아니다.
    // 5 → 6 → 7 은 이 엔드포인트의 일이 아니다 — 관리자 승인 CTA 가 그 구간을 진다.
    if (auth.project.processStatus < ProcessStatus.WAITING_CONNECTION_TEST) {
      mockData.updateProject(auth.project.id, {
        processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
      });
    }
    return noContent();
  },

  // PUT …/sdu/upload/access-key-recipients (assumed §6).
  putAccessKeyRecipients: async (targetSourceId: number, body: { user_ids: string[] }) => {
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
    refreshBdc(state);

    return noContent();
  },
};
