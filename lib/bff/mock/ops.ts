import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type {
  OpsCollabChannelWire,
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
  channel: OpsCollabChannelWire | null;
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
      channel: { issue_key: 'INFRA-2211', url: 'https://jira.example.com/browse/INFRA-2211' },
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
    state = { jira: { ...(SEED_JIRA[index] ?? {}) }, watchers: {} };
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

  // PUT …/installation-mode (assumed §2).
  putInstallationMode: async (targetSourceId: number, grant: boolean) => {
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) return notFound();
    getState(targetSourceId, project.processStatus).grantTfExecution = grant;
    return NextResponse.json({
      target_source_id: targetSourceId,
      grant_service_terraform_execution_permission: grant,
    });
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

  // GET …/collaboration-channel (assumed §4) — 200 body is the channel or null.
  getCollabChannel: async (targetSourceId: number) => {
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) return notFound();
    return NextResponse.json(getState(targetSourceId, project.processStatus).channel);
  },

  // PUT …/collaboration-channel (assumed §4).
  putCollabChannel: async (targetSourceId: number, channel: OpsCollabChannelWire) => {
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) return notFound();
    getState(targetSourceId, project.processStatus).channel = channel;
    return NextResponse.json(channel);
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

export const mockServiceJiraTickets = {
  // GET /services/{code}/jira-tickets → JiraTicketResponse[].
  list: async (code: string) => {
    if (!serviceCodes().includes(code)) return notFound('서비스를 찾을 수 없습니다.');
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
    if (!serviceCodes().includes(code)) return notFound('서비스를 찾을 수 없습니다.');
    // validate=true 면 실 BFF 가 Jira 에서 존재를 확인한다 — 목은 키 형태로 흉내낸다.
    if (validate === true && !JIRA_ISSUE_KEY_RE.test(issueKey)) {
      return notFound('Jira에서 티켓을 찾을 수 없습니다.');
    }
    serviceState(code).jira[provider] = issueKey;
    return new NextResponse(null, { status: 204 });
  },

  // DELETE /services/{code}/jira-tickets/{provider} → { issueKey }.
  // 매핑만 끊는다 — Jira 의 티켓은 그대로 남는다.
  detach: async (code: string, provider: string) => {
    if (!serviceCodes().includes(code)) return notFound('서비스를 찾을 수 없습니다.');
    const state = serviceState(code);
    const issueKey = state.jira[provider];
    if (!issueKey) return notFound('연결된 Jira 티켓이 없습니다.');
    delete state.jira[provider];
    return NextResponse.json({ issueKey });
  },

  // POST /services/{code}/jira-tickets/{provider}/watchers { userId } → 204.
  // 티켓이 연결돼 있어야 watcher 를 붙일 곳이 있다; 중복 등록은 409 로 거른다.
  addWatcher: async (code: string, provider: string, userId: string) => {
    if (!serviceCodes().includes(code)) return notFound('서비스를 찾을 수 없습니다.');
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
