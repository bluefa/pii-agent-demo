import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type {
  OpsCollabChannelWire,
  OpsJiraTicketWire,
  OpsServiceDetailWire,
  OpsServiceSummaryWire,
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

const notFound = () =>
  NextResponse.json({ error: 'NOT_FOUND', message: '프로젝트를 찾을 수 없습니다.' }, { status: 404 });

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

/** Cross-module hook for lib/bff/mock/target-sources.ts: install-mode override. */
export const opsInstallModeOverride = (targetSourceId: number): boolean | null =>
  globalStore.__opsConsoleMockStore?.get(targetSourceId)?.grantTfExecution ?? null;

/* ── 서비스 운영 store (assumed §6) ── */

interface OpsServiceState {
  owner: string;
  status: 'OPERATING' | 'EOS';
  jira: OpsJiraTicketWire[];
}

const serviceGlobal = globalThis as typeof globalThis & {
  __opsConsoleServiceStore?: Map<string, OpsServiceState>;
};

const SEED_OWNERS = ['김유진', '이도현', '정하늘', '최민서', '한지우', '오세라'];

const serviceCodes = (): string[] =>
  [...new Set(mockData.mockProjects.map((p) => p.serviceCode))].sort();

const serviceState = (code: string): OpsServiceState => {
  const store = (serviceGlobal.__opsConsoleServiceStore ??= new Map());
  let state = store.get(code);
  if (!state) {
    const index = serviceCodes().indexOf(code);
    state = {
      owner: SEED_OWNERS[Math.max(0, index) % SEED_OWNERS.length],
      status: 'OPERATING',
      jira: (index === 0
        ? [
            { ticket_key: 'INFRA-2211', summary: 'PII Agent 설치 요청', status: 'IN_PROGRESS', users: ['김유진'] },
            { ticket_key: 'INFRA-2103', summary: 'ScanRole 권한 재검토', status: 'DONE', users: [] },
          ]
        : []),
    };
    store.set(code, state);
  }
  return state;
};

const toListItem = (project: (typeof mockData.mockProjects)[number]): OpsTargetSourceListItemWire => ({
  target_source_id: project.targetSourceId,
  service_code: project.serviceCode,
  service_name:
    mockData.mockServiceCodes.find((s) => s.code === project.serviceCode)?.name
      ?? project.serviceCode,
  cloud_provider: project.cloudProvider,
  is_sdu_type: project.isSduType === true,
  database_type: project.dbType ?? null,
  process_status: STATUS_ORDER[wireStatusIndex(project.processStatus)],
  last_changed_at: project.updatedAt,
});

const serviceSummary = (code: string): OpsServiceSummaryWire => {
  const projects = mockData.mockProjects.filter((p) => p.serviceCode === code);
  const state = serviceState(code);
  return {
    service_code: code,
    service_name: mockData.mockServiceCodes.find((s) => s.code === code)?.name ?? code,
    owner: state.owner,
    status: state.status,
    target_source_count: projects.length,
    jira_ticket_count: state.jira.length,
  };
};

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

  // PUT …/aws/scan-role | execution-role (assumed §3) — server composes the ARN.
  putRole: async (targetSourceId: number, kind: 'scan' | 'execution', roleName: string) => {
    const project = mockData.getProjectByTargetSourceId(targetSourceId);
    if (!project) return notFound();
    const state = getState(targetSourceId, project.processStatus);
    const isChina = project.isChinaRegion ?? project.awsRegionType === 'china';
    const partition = isChina ? 'aws-cn' : 'aws';
    const roleArn = `arn:${partition}:iam::${accountId(project)}:role/${roleName}`;
    state.roleArns[kind] = roleArn;
    state.pendingVerify[kind] = true;
    return NextResponse.json({ role_arn: roleArn });
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

  // GET /admin/ops/services (assumed §6).
  getServices: async () =>
    NextResponse.json(serviceCodes().map(serviceSummary)),

  // GET /admin/ops/services/{code} (assumed §6).
  getService: async (code: string) => {
    if (!serviceCodes().includes(code)) return notFound();
    const state = serviceState(code);
    const summary = serviceSummary(code);
    const detail: OpsServiceDetailWire = {
      service_code: summary.service_code,
      service_name: summary.service_name,
      owner: summary.owner,
      status: summary.status,
      jira_tickets: state.jira,
      target_sources: mockData.mockProjects
        .filter((p) => p.serviceCode === code)
        .map(toListItem)
        .sort((a, b) => b.last_changed_at.localeCompare(a.last_changed_at)),
    };
    return NextResponse.json(detail);
  },

  // POST /admin/ops/services/{code}/eos (assumed §6) — non-force fails while a
  // target source is still mid-pipeline (INSTALLED = install running here).
  postServiceEos: async (code: string, force: boolean) => {
    if (!serviceCodes().includes(code)) return notFound();
    const running = mockData.mockProjects.filter(
      (p) => p.serviceCode === code && p.processStatus === ProcessStatus.INSTALLING,
    ).length;
    if (running > 0 && !force) {
      return NextResponse.json(
        {
          error: 'EOS_BLOCKED',
          message: `진행 중인 파이프라인이 있는 Target Source가 ${running}건 있습니다. Force 옵션을 사용하세요.`,
        },
        { status: 409 },
      );
    }
    serviceState(code).status = 'EOS';
    return NextResponse.json(serviceSummary(code));
  },

  // POST /admin/ops/services/{code}/jira-tickets/{key}/users (assumed §6).
  postJiraUser: async (code: string, ticketKey: string, userId: string) => {
    if (!serviceCodes().includes(code)) return notFound();
    const ticket = serviceState(code).jira.find((j) => j.ticket_key === ticketKey);
    if (!ticket) return notFound();
    if (!ticket.users.includes(userId)) ticket.users.push(userId);
    return NextResponse.json(ticket);
  },
};
