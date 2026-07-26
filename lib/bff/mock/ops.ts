import { NextResponse } from 'next/server';
import * as mockData from '@/lib/mock-data';
import { ProcessStatus } from '@/lib/types';
import type { OpsCollabChannelWire, OpsStatusHistoryItemWire } from '@/lib/bff/types';

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
};
