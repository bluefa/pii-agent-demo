import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import { minutesAgo } from '@/lib/bff/mock/clock';
import { ProcessStatus } from '@/lib/types';
import type {
  CollaborationChannelQuery,
  CollaborationChannelWire,
  FailedWatcherWire,
  OpsProcessStatusWire,
  OpsStatusHistoryItemWire,
  OpsTargetSourceListItemWire,
} from '@/lib/bff/types';

/**
 * Ops-console mocks for the ASSUMED contracts (docs/api/ops-assumed-contracts.md).
 * None of these endpoints exist in install-v1.yaml yet — handlers author the
 * snake wire the future BFF is expected to speak, backed by a globalThis-guarded
 * in-memory store (admin-queue mock pattern; survives dev hot reloads).
 */

interface OpsTargetState {
  history: OpsStatusHistoryItemWire[];
  /** Install-mode override (null until PUT). */
  grantTfExecution: boolean | null;
  /** Role-ARN overrides written by the assumed PUT endpoints. */
  roleArns: { scan?: string; execution?: string };
  /** One verify GET after a role save reports IN_PROGRESS (fresh ARN, unverified). */
  pendingVerify: { scan?: boolean; execution?: boolean };
}

const globalStore = globalThis as typeof globalThis & {
  __opsConsoleMockStore?: Map<number, OpsTargetState>;
};

const STATUS_ORDER: readonly OpsStatusHistoryItemWire['to_status'][] = [
  'IDLE', 'PENDING', 'CONFIRMING', 'CONFIRMED', 'INSTALLED', 'CONNECTED', 'COMPLETED',
];

/** lib/types numeric ProcessStatus → wire status index (same 7-step lattice). */
const wireStatusIndex = (processStatus: ProcessStatus): number => {
  switch (processStatus) {
    case ProcessStatus.WAITING_APPROVAL: return 1;
    case ProcessStatus.APPLYING_APPROVED: return 2;
    case ProcessStatus.INSTALLING: return 3;
    case ProcessStatus.WAITING_CONNECTION_TEST: return 4;
    case ProcessStatus.CONNECTION_VERIFIED: return 5;
    case ProcessStatus.INSTALLATION_COMPLETE: return 6;
    default: return 0;
  }
};

const SEED_TIMES = [
  '2026-07-16T09:02:00+09:00', '2026-07-16T10:31:00+09:00', '2026-07-17T18:56:00+09:00',
  '2026-07-20T18:09:00+09:00', '2026-07-21T14:12:00+09:00', '2026-07-22T09:45:00+09:00',
  '2026-07-23T16:30:00+09:00',
];
const SEED_ACTORS = ['system', '김유진', 'admin.kim', 'system', 'system', 'admin.kim', 'system'];

/** Transition log from creation up to the project's CURRENT step (newest first). */
const seedHistory = (processStatus: ProcessStatus): OpsStatusHistoryItemWire[] => {
  const currentIndex = wireStatusIndex(processStatus);
  const rows: OpsStatusHistoryItemWire[] = [];
  for (let i = 0; i <= currentIndex; i++) {
    rows.push({
      changed_at: SEED_TIMES[i],
      from_status: i === 0 ? null : STATUS_ORDER[i - 1],
      to_status: STATUS_ORDER[i],
      actor: SEED_ACTORS[i],
    });
  }
  return rows.reverse();
};

const getState = (targetSourceId: number, processStatus: ProcessStatus): OpsTargetState => {
  const store = (globalStore.__opsConsoleMockStore ??= new Map());
  let state = store.get(targetSourceId);
  if (!state) {
    state = {
      history: seedHistory(processStatus),
      grantTfExecution: null,
      roleArns: {},
      pendingVerify: {},
    };
    store.set(targetSourceId, state);
  }
  return state;
};

const notFound = (message = '프로젝트를 찾을 수 없습니다.') =>
  NextResponse.json({ error: 'NOT_FOUND', message }, { status: 404 });

/** Real account id when the seed has one; else the lib/bff/mock/aws.ts derivation. */
const accountId = (project: { id: string; awsAccountId?: string }): string =>
  project.awsAccountId ?? project.id.replace(/\D/g, '').padStart(12, '1').slice(0, 12);

/**
 * Cross-module hook for lib/bff/mock/aws.ts: verify GETs surface the ARN saved
 * through the assumed PUT endpoints (first read after a save = IN_PROGRESS).
 */
export const consumeOpsRoleOverride = (
  targetSourceId: number,
  kind: 'scan' | 'execution',
): { roleArn: string; pending: boolean } | null => {
  const state = globalStore.__opsConsoleMockStore?.get(targetSourceId);
  const roleArn = state?.roleArns[kind];
  if (!state || !roleArn) return null;
  const pending = state.pendingVerify[kind] === true;
  state.pendingVerify[kind] = false;
  return { roleArn, pending };
};

/**
 * Cross-module hook for lib/bff/mock/target-sources.ts: the ARN saved through
 * the assumed PUT shows up in the detail metadata, which is what the ops header
 * reads. Unlike consumeOpsRoleOverride this does not touch pendingVerify —
 * 조회는 검증 상태를 소비하지 않는다.
 */
export const opsRoleArnOverride = (
  targetSourceId: number,
  kind: 'scan' | 'execution',
): string | null =>
  globalStore.__opsConsoleMockStore?.get(targetSourceId)?.roleArns[kind] ?? null;

/** Cross-module hook for lib/bff/mock/target-sources.ts: install-mode override. */
export const opsInstallModeOverride = (targetSourceId: number): boolean | null =>
  globalStore.__opsConsoleMockStore?.get(targetSourceId)?.grantTfExecution ?? null;

/* ── 서비스별 Jira 티켓 연결 store (실계약 services.jiraTickets) ── */

interface OpsServiceState {
  /** cloudProvider → issueKey. Provider 가 키이므로 provider 당 최대 1건 (실계약). */
  jira: Partial<Record<string, string>>;
  /** cloudProvider → watcher userId 목록 (실계약 watchers POST 의 누적분). */
  watchers: Partial<Record<string, string[]>>;
  /** 화면의 "서비스 PII Agent 설치완료"(update-service-installed)를 마지막으로 실행한 시각. */
  serviceInstalledUpdatedAt: string | null;
  /** 화면의 "EOS 처리"(end-of-service)를 실행한 시각 (null = 운영 중). */
  endOfServiceAt: string | null;
}

const serviceGlobal = globalThis as typeof globalThis & {
  __opsConsoleServiceStore?: Map<string, OpsServiceState>;
};

/**
 * 앞 두 서비스만 일부 provider 를 연결된 상태로 둔다 — 연결/미연결 두 타일 모양이 한
 * 화면에 같이 보여야 한다. store 는 티켓 키만 담는다 — 주소는 응답의 browseUrl 로
 * BFF(여기서는 목)가 조립해 준다(v5 계약: issueKey 는 키, browseUrl 이 열 주소).
 */
const SEED_JIRA: ReadonlyArray<Record<string, string>> = [
  { AWS: 'BDCDIP-2211', IDC: 'BDCDIP-2103' },
  { AZURE: 'BDCDIP-1799' },
];

const serviceCodes = (): string[] =>
  [...new Set(mockData.mockProjects.map((p) => p.serviceCode))].sort();

const serviceState = (code: string): OpsServiceState => {
  const store = (serviceGlobal.__opsConsoleServiceStore ??= new Map());
  let state = store.get(code);
  if (!state) {
    const index = serviceCodes().indexOf(code);
    state = {
      // The collaboration-channel fixtures are the other half of the same truth: a unit
      // the channel store marks CREATED is a mapped ticket here too (watcher POSTs read this).
      jira: { ...(SEED_JIRA[index] ?? {}), ...channelLinkedTickets(code) },
      watchers: {},
      serviceInstalledUpdatedAt: null,
      endOfServiceAt: null,
    };
    store.set(code, state);
  }
  return state;
};

/** SDU 는 하위 CSP 가 있어도 계정을 노출하지 않는다 — IDC 와 같이 전 필드 null. */
const isAccountless = (project: (typeof mockData.mockProjects)[number]): boolean =>
  project.isSduType === true || project.cloudProvider === 'IDC';

const toListItem = (project: (typeof mockData.mockProjects)[number]): OpsTargetSourceListItemWire => ({
  target_source_id: project.targetSourceId,
  service_code: project.serviceCode,
  service_name:
    mockData.mockServiceCodes.find((s) => s.code === project.serviceCode)?.name
      ?? project.serviceCode,
  description: project.description ?? null,
  cloud_provider: project.cloudProvider,
  is_sdu_type: project.isSduType === true,
  // 어떤 fixture 도 dbType 을 세팅하지 않아 운영 목록의 DB 열이 전부 — 로 보였다.
  // 대상의 리소스에서 대표 DB 종류를 뽑아 채운다 (계약상 단일 문자열).
  database_type:
    project.dbType ?? project.resources.find((r) => r.databaseType)?.databaseType ?? null,
  process_status: STATUS_ORDER[wireStatusIndex(project.processStatus)],
  last_changed_at: project.updatedAt,
  // IDC·SDU 는 CSP 계정이 없어 전 필드 null — 목록이 계정 열을 비운다.
  metadata: isAccountless(project)
    ? { aws_account_id: null, aws_region_type: null, subscription_id: null, gcp_project_id: null }
    : {
        aws_account_id: project.cloudProvider === 'AWS' ? accountId(project) : null,
        aws_region_type:
          project.cloudProvider !== 'AWS'
            ? null
            : (project.isChinaRegion ?? project.awsRegionType === 'china')
              ? 'china'
              : 'global',
        subscription_id: project.subscriptionId ?? null,
        gcp_project_id: project.gcpProjectId ?? null,
      },
});


export const mockOps = {
  // GET …/status-history?page&size → Page<OpsStatusHistoryItemWire> (assumed §1).
  getStatusHistory: async (targetSourceId: number, page: number, size: number) => {
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) return notFound();
    const { history } = getState(targetSourceId, project.processStatus);
    const start = page * size;
    return NextResponse.json({
      totalElements: history.length,
      totalPages: Math.max(1, Math.ceil(history.length / size)),
      size,
      number: page,
      content: history.slice(start, start + size),
    });
  },

  // PUT …/installation-mode (assumed §2) — 업스트림은 void 를 답한다(오너 확인
  // 2026-09-07). 저장한 값을 되돌려주지 않으므로 목도 본문을 짓지 않는다.
  putInstallationMode: async (targetSourceId: number, grant: boolean) => {
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) return notFound();
    getState(targetSourceId, project.processStatus).grantTfExecution = grant;
    return new NextResponse(null, { status: 204 });
  },

  // PUT …/aws/{scan-role|terraform-execution-role} — REAL upsert contract:
  // AwsAssumeRoleUpsertRequest { roleArn } → AwsAssumeRoleUpsertResponse (camel).
  putRole: async (targetSourceId: number, kind: 'scan' | 'execution', roleArn: string) => {
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) return notFound();
    const state = getState(targetSourceId, project.processStatus);
    state.roleArns[kind] = roleArn;
    state.pendingVerify[kind] = true;
    return NextResponse.json({ targetSourceId, roleArn, readOnly: false });
  },

  // GET /admin/ops/target-sources?query&page&size (assumed §5).
  getTargetSourceList: async (query: string | undefined, page: number, size: number) => {
    const q = query?.trim().toLowerCase();
    const rows = mockData.mockProjects
      .map(toListItem)
      .filter((row) =>
        !q
        || String(row.target_source_id).includes(q)
        || row.service_code.toLowerCase().includes(q)
        || row.service_name.toLowerCase().includes(q))
      .sort((a, b) => b.last_changed_at.localeCompare(a.last_changed_at));
    const start = page * size;
    return NextResponse.json({
      totalElements: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / size)),
      size,
      number: page,
      content: rows.slice(start, start + size),
    });
  },

  // POST /service-infos/{serviceCode}/update-service-installed — bodyless, and
  // install-v1.yaml declares success as a bodyless 204, so there is no schema to
  // author against; the mock records WHEN it ran so a repeat call is
  // distinguishable from a first one.
  updateServiceInstalled: async (serviceCode: string) => {
    if (!serviceCodes().includes(serviceCode)) return notFound('서비스를 찾을 수 없습니다.');
    serviceState(serviceCode).serviceInstalledUpdatedAt = minutesAgo(0);
    return new NextResponse(null, { status: 204 });
  },

  // POST /service-infos/{serviceCode}/end-of-service — same shape. 종료 시각을
  // 남겨 두어 종료된 서비스와 운영 중인 서비스가 구분된다.
  endOfService: async (serviceCode: string) => {
    if (!serviceCodes().includes(serviceCode)) return notFound('서비스를 찾을 수 없습니다.');
    serviceState(serviceCode).endOfServiceAt = minutesAgo(0);
    return new NextResponse(null, { status: 204 });
  },

  // Assumed §4 — the store and fixtures live below the Jira Tickets block.
  getCollaborationChannel: async (targetSourceId: number, query?: CollaborationChannelQuery) =>
    mockCollaborationChannel.get(targetSourceId, query),
  putCollaborationChannel: async (targetSourceId: number, body: { issue_key: string; url?: string }) =>
    mockCollaborationChannel.put(targetSourceId, body),
};

/* ── Collaboration channel — ASSUMED §4 (BE PR #8891, 2026-09-30 revision) ── */

/**
 * One row of the Jira Ticket console fixtures — the TargetSourceInfo identity the two
 * failure lists serve (`lib/bff/mock/task-queue.ts`). Hand-authored rather than derived
 * from PROC: the console needs two targets of ONE service on AWS (the ticket is shared
 * per service + cloud) and an SDU target, and the monitor fixture has neither. Who
 * failed as a watcher is NOT on the row — it rides the channel GET, per ticket unit.
 */
export interface JiraFailureFixtureRow {
  ts: number;
  svc: string;
  code: string;
  pv: string;
  isSdu: boolean;
  description: string;
}

export const JIRA_TICKET_FAILED_FIXTURE: readonly JiraFailureFixtureRow[] = [
  { ts: 2113, svc: '결제서비스', code: 'PAY', pv: 'AWS', isSdu: false, description: '결제 승인 원장 RDS' },
  { ts: 2114, svc: '결제서비스', code: 'PAY', pv: 'AWS', isSdu: false, description: '정산 대사용 읽기 복제본' },
  { ts: 1099, svc: 'SDU', code: 'SDU', pv: 'AWS', isSdu: true, description: 'SDU 업로드 버킷 (서울)' },
  { ts: 1980, svc: '회원서비스', code: 'MBR', pv: 'GCP', isSdu: false, description: '회원 프로필 Cloud SQL' },
];

export const JIRA_WATCHER_FAILED_FIXTURE: readonly JiraFailureFixtureRow[] = [
  { ts: 1861, svc: '정산서비스', code: 'STL', pv: 'AWS', isSdu: false, description: '정산 마감 배치 RDS' },
  { ts: 1799, svc: '배송서비스', code: 'DLV', pv: 'AZURE', isSdu: false, description: '배송 추적 Azure SQL' },
];

const ALL_JIRA_FIXTURES = [...JIRA_TICKET_FAILED_FIXTURE, ...JIRA_WATCHER_FAILED_FIXTURE];

/** The ticket unit: (service, cloud), SDU on its own. */
const unitKey = (row: JiraFailureFixtureRow): string => `${row.code}/${row.pv}/${row.isSdu ? 'sdu' : 'csp'}`;

/** The unit's `cloudProvider` on the service × provider axis (`/services/{code}/jira-tickets/{provider}`). */
const jiraProviderOf = (row: JiraFailureFixtureRow): string => (row.isSdu ? 'SDU' : row.pv);

/** Fixture services the console lists but the project catalog does not know (PAY·MBR·STL). */
const jiraFixtureServiceCodes = (): string[] => ALL_JIRA_FIXTURES.map((r) => r.code);

type ChannelSeed = Omit<
  CollaborationChannelWire,
  'failed_watchers' | 'failed_watchers_total' | 'watcher_page' | 'watcher_size'
>;

const channelGlobal = globalThis as typeof globalThis & {
  __opsCollaborationChannelStore?: {
    channels: Map<number, ChannelSeed>;
    /** unit key → failed watchers, username asc. */
    watchers: Map<string, FailedWatcherWire[]>;
  };
};

const JIRA_BROWSE_BASE = 'https://jira.sec.samsung.net/browse/';

const createdChannel = (issueKey: string): ChannelSeed => ({
  issue_key: issueKey,
  url: `${JIRA_BROWSE_BASE}${issueKey}`,
  status: 'CREATED',
  attempt_count: null,
  max_attempts: null,
  next_attempt_at: null,
  retry_phase: null,
  retry_expires_at: null,
});

const NONE_CHANNEL: ChannelSeed = {
  issue_key: null, url: null, status: 'NONE', attempt_count: null, max_attempts: null,
  next_attempt_at: null, retry_phase: null, retry_expires_at: null,
};

/** Server-local datetimes, no offset — the screen cuts them, never converts them. */
const watcher = (
  username: string,
  status: FailedWatcherWire['status'],
  attempt_count: number,
  next_attempt_at: string | null,
): FailedWatcherWire => ({
  username,
  status,
  attempt_count,
  retry_phase: status === 'PENDING' ? (attempt_count >= 6 ? 'LONG_TERM' : 'SHORT_TERM') : null,
  next_attempt_at,
  retry_expires_at: status === 'PENDING' ? '2026-10-14T00:00:00' : null,
});

/** Seed: every ticket-failed row is not CREATED, every watcher-failed row already is. */
const seedStore = (): NonNullable<typeof channelGlobal.__opsCollaborationChannelStore> => {
  const channels = new Map<number, ChannelSeed>();
  // PAY/AWS — one ticket unit, two targets, SHORT_TERM (10-minute interval).
  const payRetrying: ChannelSeed = {
    issue_key: '', url: null, status: 'RETRYING', attempt_count: 2, max_attempts: 6,
    next_attempt_at: '2026-09-30T14:20:00', retry_phase: 'SHORT_TERM', retry_expires_at: '2026-10-14T00:00:00',
  };
  channels.set(2113, { ...payRetrying });
  channels.set(2114, { ...payRetrying });
  // SDU — expired: the 14-day window closed without a ticket.
  channels.set(1099, {
    issue_key: '', url: null, status: 'FAILED', attempt_count: 9, max_attempts: null,
    next_attempt_at: null, retry_phase: null, retry_expires_at: '2026-09-28T00:00:00',
  });
  // MBR/GCP — LONG_TERM (24-hour interval): six failures alone do not make FAILED.
  channels.set(1980, {
    issue_key: '', url: null, status: 'RETRYING', attempt_count: 6, max_attempts: null,
    next_attempt_at: '2026-10-01T00:50:00', retry_phase: 'LONG_TERM', retry_expires_at: '2026-10-14T00:00:00',
  });
  channels.set(1861, createdChannel('BDCDIP-2211'));
  channels.set(1799, createdChannel('BDCDIP-1799'));

  const watchers = new Map<string, FailedWatcherWire[]>();
  // STL/AWS — two people; DLV/AZURE — twelve, so the modal's pager shows once.
  watchers.set('STL/AWS/csp', [
    watcher('hong.gildong', 'FAILED', 6, null),
    watcher('kim.cs', 'PENDING', 3, '2026-09-30T14:40:00'),
  ]);
  watchers.set(
    'DLV/AZURE/csp',
    [
      'ahn.sy', 'bae.jh', 'choi.mr', 'do.hk', 'eom.js', 'go.ye', 'ha.jw', 'im.sh', 'jang.dy', 'ko.mj', 'lee.mj', 'moon.bk',
    ].map((name, i) =>
      i % 3 === 0
        ? watcher(name, 'FAILED', 6, null)
        : watcher(name, 'PENDING', i >= 6 ? 6 : 1, i >= 6 ? '2026-10-01T00:50:00' : '2026-09-30T14:40:00'),
    ),
  );
  return { channels, watchers };
};

const store = () => (channelGlobal.__opsCollaborationChannelStore ??= seedStore());

const fixtureRow = (targetSourceId: number): JiraFailureFixtureRow | undefined =>
  ALL_JIRA_FIXTURES.find((r) => r.ts === targetSourceId);

/** Cross-module hook for the failure lists: a ticket-failed row leaves once its channel is CREATED. */
export const collaborationChannelOf = (targetSourceId: number): ChannelSeed =>
  store().channels.get(targetSourceId) ?? NONE_CHANNEL;

/** provider → issueKey for every CREATED unit of a service — seeds the service × provider mapping. */
const channelLinkedTickets = (code: string): Record<string, string> => {
  const linked: Record<string, string> = {};
  for (const row of ALL_JIRA_FIXTURES) {
    if (row.code !== code) continue;
    const channel = collaborationChannelOf(row.ts);
    if (channel.status === 'CREATED' && channel.issue_key) linked[jiraProviderOf(row)] = channel.issue_key;
  }
  return linked;
};

/**
 * Mirror of the service × provider mapping (attach/detach on the 서비스 운영 screen) into
 * the channel store, so the ops service screen and the Jira console never disagree.
 * Only fixture units exist here; a service the console does not list has no channel rows.
 */
const mirrorMappingIntoChannels = (code: string, provider: string, issueKey: string | null): void => {
  for (const row of ALL_JIRA_FIXTURES) {
    if (row.code !== code || jiraProviderOf(row) !== provider) continue;
    // Detach removes the MAPPING only — the console then reads the unit as having no ticket.
    store().channels.set(row.ts, issueKey ? createdChannel(issueKey) : { ...NONE_CHANNEL });
  }
};

/** Every fixture target of the same unit — what a PUT links at once. */
const sameTicketUnit = (row: JiraFailureFixtureRow): number[] =>
  ALL_JIRA_FIXTURES.filter((r) => unitKey(r) === unitKey(row)).map((r) => r.ts);

const DEFAULT_WATCHER_SIZE = 10;

/** The channel plus one page of its watchers (username asc). Echoes page/size even with no ticket. */
const channelResponse = (targetSourceId: number, query?: CollaborationChannelQuery): CollaborationChannelWire => {
  const page = query?.watcherPage ?? 0;
  const size = query?.watcherSize ?? DEFAULT_WATCHER_SIZE;
  const row = fixtureRow(targetSourceId);
  const all = (row ? store().watchers.get(unitKey(row)) : undefined) ?? [];
  const sorted = [...all].sort((a, b) => a.username.localeCompare(b.username));
  return {
    ...collaborationChannelOf(targetSourceId),
    failed_watchers: sorted.slice(page * size, page * size + size),
    failed_watchers_total: sorted.length,
    watcher_page: page,
    watcher_size: size,
  };
};

export const mockCollaborationChannel = {
  // GET …/collaboration-channel?watcher_page&watcher_size → always 200 (NONE when nothing was ever created).
  get: async (targetSourceId: number, query?: CollaborationChannelQuery) =>
    NextResponse.json(channelResponse(targetSourceId, query)),

  // PUT …/collaboration-channel { issue_key, url? } → CREATED for the whole (service, cloud) unit.
  // The response is the link result only — the screen re-GETs for watcher/retry state.
  put: async (targetSourceId: number, body: { issue_key: string; url?: string }) => {
    const issueKey = body.issue_key.trim();
    if (!issueKey) {
      return NextResponse.json(
        { error: 'VALIDATION_FAILED', message: 'issue_key는 비어 있을 수 없습니다.' },
        { status: 400 },
      );
    }
    // Demo hook: the key `BDCDIP-409` stands in for "auto-creation is writing right now" —
    // the real BFF answers this whenever its retry loop holds the same ticket unit.
    if (issueKey === 'BDCDIP-409') {
      return NextResponse.json(
        { error: 'JIRA_TICKET_CREATION_IN_PROGRESS', message: '자동 생성이 진행 중입니다.' },
        { status: 409 },
      );
    }
    const current = collaborationChannelOf(targetSourceId);
    if (current.status === 'CREATED' && current.issue_key && current.issue_key !== issueKey) {
      return NextResponse.json(
        { error: 'CONFLICT', message: '이미 다른 티켓이 연결돼 있습니다.' },
        { status: 409 },
      );
    }
    const created: ChannelSeed = body.url
      ? { ...createdChannel(issueKey), url: body.url }
      : createdChannel(issueKey);
    const row = fixtureRow(targetSourceId);
    for (const ts of row ? sameTicketUnit(row) : [targetSourceId]) {
      store().channels.set(ts, { ...created });
    }
    // Same truth on the service × provider axis: the watcher POST and the 서비스 운영 tile read it.
    if (row) serviceState(row.code).jira[jiraProviderOf(row)] = issueKey;
    return NextResponse.json(channelResponse(targetSourceId));
  },
};

/* ── Jira Tickets tag — REAL contract (install-v1.yaml, docs/api/jira-tickets.md §1) ── */

/** JiraTicketResponse.targetSourceId: 그 provider 의 첫 target source (없으면 0). */
const providerTargetSourceId = (code: string, provider: string): number =>
  mockData.mockProjects.find(
    (p) => p.serviceCode === code && p.cloudProvider.toUpperCase() === provider,
  )?.targetSourceId ?? 0;

/** CAMEL wire — JiraTicketResponse 는 서비스 목록 wire 와 달리 camelCase 다. */
const toJiraTicketResponse = (code: string, provider: string, issueKey: string) => ({
  id: providerTargetSourceId(code, provider),
  targetSourceId: providerTargetSourceId(code, provider),
  serviceCode: code,
  issueKey,
  cloudProvider: provider,
  // v5 계약 — 열 주소는 BFF 가 조립해 싣는다. 프론트는 이 값을 그대로 연다.
  browseUrl: `https://jira.example.com/browse/${issueKey}`,
});

/** validate=true 로 흉내내는 Jira 존재 검증 — 키 형태가 아니면 없는 티켓으로 친다. */
const JIRA_ISSUE_KEY_RE = /^[A-Z][A-Z0-9]*-\d+$/i;

/** A service the catalog knows, or one the Jira console's fixtures list (PAY·MBR·STL). */
const knownJiraService = (code: string): boolean =>
  serviceCodes().includes(code) || jiraFixtureServiceCodes().includes(code);

export const mockServiceJiraTickets = {
  // GET /services/{code}/jira-tickets → JiraTicketResponse[].
  list: async (code: string) => {
    if (!knownJiraService(code)) return notFound('서비스를 찾을 수 없습니다.');
    const { jira } = serviceState(code);
    return NextResponse.json(
      Object.entries(jira)
        .filter((entry): entry is [string, string] => typeof entry[1] === 'string')
        .map(([provider, issueKey]) => toJiraTicketResponse(code, provider, issueKey)),
    );
  },

  // POST /services/{code}/jira-tickets/{provider} { issueKey, validate } → 204.
  // 티켓을 만들지 않는다 — 이미 있는 issueKey 를 이 서비스·provider 에 매핑할 뿐.
  attach: async (code: string, provider: string, issueKey: string, validate?: boolean) => {
    if (!knownJiraService(code)) return notFound('서비스를 찾을 수 없습니다.');
    // validate=true 면 실 BFF 가 Jira 에서 존재를 확인한다 — 목은 키 형태로 흉내낸다.
    if (validate === true && !JIRA_ISSUE_KEY_RE.test(issueKey)) {
      return notFound('Jira에서 티켓을 찾을 수 없습니다.');
    }
    serviceState(code).jira[provider] = issueKey;
    mirrorMappingIntoChannels(code, provider, issueKey);
    return new NextResponse(null, { status: 204 });
  },

  // DELETE /services/{code}/jira-tickets/{provider} → { issueKey }.
  // 매핑만 끊는다 — Jira 의 티켓은 그대로 남는다.
  detach: async (code: string, provider: string) => {
    if (!knownJiraService(code)) return notFound('서비스를 찾을 수 없습니다.');
    const state = serviceState(code);
    const issueKey = state.jira[provider];
    if (!issueKey) return notFound('연결된 Jira 티켓이 없습니다.');
    delete state.jira[provider];
    mirrorMappingIntoChannels(code, provider, null);
    return NextResponse.json({ issueKey });
  },

  // POST /services/{code}/jira-tickets/{provider}/watchers { userId } → 204.
  // 티켓이 연결돼 있어야 watcher 를 붙일 곳이 있다; 중복 등록은 409 로 거른다.
  addWatcher: async (code: string, provider: string, userId: string) => {
    if (!knownJiraService(code)) return notFound('서비스를 찾을 수 없습니다.');
    const state = serviceState(code);
    if (!state.jira[provider]) return notFound('연결된 Jira 티켓이 없습니다.');
    // 실 BFF 는 Jira 를 왕복하느라 느리다 — 데모도 ~2초 기다려 submitting 상태가 보이게 한다.
    await new Promise((resolve) => setTimeout(resolve, 2000));
    // 데모용 확률 실패(30%) — 실 BFF 의 Jira 연동 오류를 흉내낸다. 모달의 인라인 에러
    // (fallback 문구) 경로가 데모에서 실제로 돌게 하기 위한 것으로, 판정 오류(404/409)와
    // 달리 재시도하면 성공할 수 있다.
    if (Math.random() < 0.3) {
      return NextResponse.json(
        { error: 'BAD_GATEWAY', message: 'Jira 연동 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.' },
        { status: 502 },
      );
    }
    // 핫리로드로 살아남은 구세대 store 엔 watchers 필드가 없다 — 여기서 붙인다.
    state.watchers ??= {};
    const list = (state.watchers[provider] ??= []);
    if (list.includes(userId)) {
      return NextResponse.json(
        { error: 'CONFLICT', message: '이미 watcher로 등록된 사용자입니다.' },
        { status: 409 },
      );
    }
    list.push(userId);
    return new NextResponse(null, { status: 204 });
  },
};
