// @vitest-environment jsdom
import { beforeAll, describe, expect, it, vi } from 'vitest';

/**
 * 승인 요청 한 바퀴 — 목 어댑터를 그대로 쓴다.
 *
 * `approval-input.test.ts` 는 `bff` 를 통째로 vi.mock 하므로 리졸버만 본다. 여기서는 그
 * 위아래를 전부 실물로 이어 한 프로세스에서 돌린다:
 *
 *   화면이 쓰는 어댑터(`getConfirmResources`) → 화면이 쓰는 변환(`catalogToCandidates`)
 *   → 매퍼(`toApprovalRequestInput` / `toIdcApprovalRequestInput`) → `fetchJson`
 *   → 라우트 핸들러 → 리졸버 → 목 BFF(저장) → 되읽기(`getApprovalRequestLatest`)
 *
 * `fetch` 만 갈아 끼워 `/pass/api/v1/...` 를 실제 라우트 핸들러로 보낸다 — 어댑터가 만드는
 * 경로 문자열이 라우트 디렉터리와 어긋나면 여기서 `unrouted` 로 터진다.
 *
 * `createApprovalRequest` 만 위임 스파이로 감싼다(대체가 아니다 — 목이 그대로 실행된다).
 * 상류로 나가는 계약 본문은 이 경계에서만 볼 수 있고, 이 작업의 요점이 바로 그 본문을
 * 누가 채우는가이기 때문이다. 되읽기는 목이 제 시드에서 다시 그리므로 상류 본문과 같지
 * 않다 — 둘을 따로 단언한다.
 */
vi.mock('@/lib/bff/client', async () => {
  const { mockBff } = await import('@/lib/bff/mock-adapter');
  return {
    bff: {
      ...mockBff,
      confirm: {
        ...mockBff.confirm,
        createApprovalRequest: vi.fn(mockBff.confirm.createApprovalRequest),
      },
    },
  };
});

import { GET as getResourcesRoute } from '@/app/api/v1/target-sources/[targetSourceId]/resources/route';
import { POST as postApprovalRequestRoute } from '@/app/api/v1/target-sources/[targetSourceId]/approval-requests/route';
import { GET as getLatestRoute } from '@/app/api/v1/target-sources/[targetSourceId]/approval-requests/latest/route';
import { bff } from '@/lib/bff/client';
import { createApprovalRequest, getApprovalRequestLatest, getConfirmResources } from '@/app/lib/api';
import { catalogToCandidates } from '@/lib/resource-catalog';
import { toApprovalRequestInput } from '@/app/target-sources/[targetSourceId]/_components/candidate/approval-payload';
import { toManualEc2Candidate } from '@/app/target-sources/[targetSourceId]/_components/candidate/manual-ec2';
import { toIdcApprovalRequestInput } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep1TargetInput';
import type { IdcStep1Row } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcTargetListTable';
import type { CandidateDraftState } from '@/lib/types/resources';
import type { ApprovalSelection } from '@/lib/approval-selection';

/**
 * 목 스토어는 globalThis 하나이고 승인 요청은 상태를 바꾼다 — 한 대상이 성공하면 그 대상은
 * WAITING_APPROVAL 이 되어 다음 요청이 409 다. 그래서 케이스마다 대상을 나누고, 1006 의
 * 실패 케이스는 성공 케이스보다 **먼저** 온다(파일 안 실행 순서에 기댄다).
 */
const AWS_SCANNED = 1006;
const AWS_MANUAL = 1008;
const IDC = 1020;
const NO_SCAN = 1101;

const drafts: CandidateDraftState = { endpointDrafts: {}, rdsInstanceDrafts: {} };

const routeParams = (targetSourceId: number | string) => ({
  params: Promise.resolve({ targetSourceId: String(targetSourceId) }),
});

/** 어댑터가 부르는 `fetch` 를 라우트 핸들러로 보낸다. 경로는 어댑터가 만든 그대로 받는다. */
const dispatch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? 'GET').toUpperCase();
  const matched = /\/pass\/api\/v1\/target-sources\/([^/]+)\/(.+)$/.exec(url);
  if (!matched) throw new Error(`unrouted ${method} ${url}`);
  const [, targetSourceId, rest] = matched;
  const request = new Request(`http://localhost${url}`, {
    method,
    headers: new Headers((init?.headers as HeadersInit) ?? {}),
    ...(method === 'POST' ? { body: init?.body as BodyInit } : {}),
  });
  if (rest === 'resources' && method === 'GET') return getResourcesRoute(request, routeParams(targetSourceId));
  if (rest === 'approval-requests' && method === 'POST') {
    return postApprovalRequestRoute(request, routeParams(targetSourceId));
  }
  if (rest === 'approval-requests/latest' && method === 'GET') {
    return getLatestRoute(request, routeParams(targetSourceId));
  }
  throw new Error(`unrouted ${method} ${url}`);
};

beforeAll(() => { vi.stubGlobal('fetch', dispatch); });

/** 거부 경로는 라우트를 직접 부른다 — 어댑터는 problem 본문을 `AppError` 로 접어 title 을 잃는다. */
const postRaw = async (targetSourceId: number, payload: unknown) => {
  const response = await postApprovalRequestRoute(
    new Request(`http://localhost/pass/api/v1/target-sources/${targetSourceId}/approval-requests`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'content-type': 'application/json' },
    }),
    routeParams(targetSourceId),
  );
  return { status: response.status, body: await response.json() as Record<string, unknown> };
};

const upstream = vi.mocked(bff.confirm.createApprovalRequest);

/** 상류로 나간 계약 본문의 한 행. */
const upstreamRow = (resourceId: string) => {
  const body = upstream.mock.calls.at(-1)?.[1] as { resources?: Record<string, unknown>[] };
  return body.resources?.find((row) => row.resource_id === resourceId);
};

const latestRow = async (targetSourceId: number, resourceId: string) => {
  const latest = await getApprovalRequestLatest(targetSourceId) as {
    request: Record<string, unknown>;
    resources: Record<string, unknown>[];
  };
  return {
    request: latest.request,
    row: latest.resources.find((row) => row.resource_id === resourceId),
  };
};

const keysOf = (value: unknown): string[] => Object.keys(value as object).sort();

describe('오래된 화면 · 모양 위반 — 목 BFF 에 닿기 전에 끝난다', () => {
  it('스캔에 없는 id 를 표시 없이 보내면 409 이고, 상류 쓰기는 일어나지 않는다', async () => {
    upstream.mockClear();

    const { status, body } = await postRaw(AWS_SCANNED, {
      resources: [{ resource_id: '스캔에-없는-것', selected: true }],
    });

    expect(status).toBe(409);
    expect(body.detail).toBe('연동 대상 목록이 변경되었습니다. 화면을 새로 읽고 다시 선택해 주세요.');
    // 제 코드를 달고 나가야 확인 모달이 "새로고침" 을 말한다 — 코드가 없으면 `fetchJson` 이
    // status 로 접어 CONFLICT("이미 진행 중") + 다시 요청하기가 된다.
    expect(body.code).toBe('CONFLICT_STALE_TARGET_LIST');
    expect(body.retriable).toBe(false);
    expect(upstream).not.toHaveBeenCalled();
  });

  it('스캔 행에 접속 정보를 실으면 400 이고, 상류 쓰기는 일어나지 않는다', async () => {
    upstream.mockClear();

    const { status, body } = await postRaw(AWS_SCANNED, {
      resources: [{ resource_id: 'x', selected: true, endpoint: { host: 'attacker.internal' } }],
    });

    expect(status).toBe(400);
    expect(body.title).toBe('연동 대상 정보를 읽지 못했습니다.');
    expect(body.detail).toBe("Unrecognized key(s) in object: 'endpoint'");
    expect(upstream).not.toHaveBeenCalled();
  });
});

describe('AWS 스캔 행 (1006) — 브라우저는 포인터와 선택만 보내고 사실은 서버가 채운다', () => {
  const CLUSTER = 'arn:aws:rds:ap-northeast-2:451814760281:cluster:demo-aurora-mysql-cluster';
  const WRITER = 'arn:aws:rds:ap-northeast-2:451814760281:db:demo-aurora-mysql-1';

  it('스캔 조회 → 선택 → 제출 → 되읽기가 한 바퀴 돈다', async () => {
    upstream.mockClear();

    // 화면과 같은 경로: 라우트에서 후보를 읽고, 화면이 쓰는 함수로 후보를 만든다.
    const scanned = await getConfirmResources(AWS_SCANNED);
    const candidates = catalogToCandidates(scanned.resources);
    const [first, second] = candidates;
    const cluster = candidates.find((candidate) => candidate.id === CLUSTER);
    expect(cluster?.behaviorKey).toBe('rdsInstance');

    const body = toApprovalRequestInput(
      candidates,
      new Set([first.id, CLUSTER]),
      // 사용자가 Writer 를 고른 상태(기본값은 정렬 최상단 Reader 다).
      { ...drafts, rdsInstanceDrafts: { [CLUSTER]: WRITER } },
      { [second.id]: '통합 테스트 제외' },
    );

    // 브라우저가 보내는 전부: id·선택·사유·고른 멤버. 사실 서술은 한 행에도 없다.
    for (const row of body.resources) {
      expect(keysOf(row).every((key) => [
        'resource_id', 'selected', 'exclusion_reason', 'selected_rds_instance_resource_id',
      ].includes(key))).toBe(true);
    }
    expect(body.resources.find((row) => row.resource_id === CLUSTER))
      .toEqual({ resource_id: CLUSTER, selected: true, selected_rds_instance_resource_id: WRITER });

    const created = await createApprovalRequest(AWS_SCANNED, body);
    expect(created.status).toBe('PENDING');
    expect(created.target_source_id).toBe(AWS_SCANNED);

    // 상류로 나간 본문은 스캔이 소유한 사실로 채워져 있다 — 클라이언트는 아무것도 안 보냈다.
    expect(keysOf(upstreamRow(first.id)?.metadata))
      .toEqual(['database_type', 'provider', 'region', 'resource_type']);
    expect(upstreamRow(first.id)).toEqual({
      resource_id: first.id,
      resource_name: 'raw-mongo-deq-test-1',
      resource_type: 'AWS_DB_CLUSTER',
      integration_category: 'TARGET',
      selected: true,
      metadata: {
        provider: 'AWS',
        region: 'ap-northeast-2',
        database_type: 'mongodb',
        // 스캔의 metadata.resource_type 은 최상위 값과 다르다(DOCUMENTDB vs AWS_DB_CLUSTER).
        // 서버는 스캔이 말한 것을 그대로 되싣는다 — 둘을 맞추려 들지 않는다.
        resource_type: 'DOCUMENTDB',
      },
    });

    // 스캔은 이 클러스터의 database_type 을 'MYSQL' 로 준다 — 요청 경계에서 소문자로 내린다.
    expect(keysOf(upstreamRow(CLUSTER)?.metadata)).toEqual([
      'database_type',
      'provider',
      'rds_instance_candidates',
      'region',
      'resource_type',
      'selected_rds_instance_resource_id',
      'selected_rds_instance_role',
    ]);
    expect(upstreamRow(CLUSTER)?.metadata).toMatchObject({
      database_type: 'mysql',
      selected_rds_instance_resource_id: WRITER,
      // 역할은 클라이언트가 보내지 않는다 — 서버가 고른 멤버에서 읽는다.
      selected_rds_instance_role: 'WRITER',
    });
  });

  it('되읽기에 선택·제외 사유·고른 멤버가 남는다', async () => {
    const scanned = await getConfirmResources(AWS_SCANNED);
    const [firstItem, secondItem] = scanned.resources;

    const selected = await latestRow(AWS_SCANNED, firstItem.resourceId);
    expect(selected.request.status).toBe('PENDING');
    expect(selected.row?.selected).toBe(true);
    expect(keysOf(selected.row?.metadata)).toEqual(['database_type', 'provider', 'region']);

    const excluded = await latestRow(AWS_SCANNED, secondItem.resourceId);
    expect(excluded.row?.selected).toBe(false);
    expect(excluded.row?.exclusion_reason).toBe('통합 테스트 제외');

    const cluster = await latestRow(AWS_SCANNED, CLUSTER);
    expect(keysOf(cluster.row?.metadata)).toEqual([
      'database_type',
      'provider',
      'rds_instance_candidates',
      'region',
      'selected_rds_instance_resource_id',
    ]);
    expect((cluster.row?.metadata as Record<string, unknown>).selected_rds_instance_resource_id)
      .toBe(WRITER);
  });

  it('같은 대상에 다시 요청하면 목 BFF 가 409 로 막는다 — 이번엔 상류까지 갔다', async () => {
    upstream.mockClear();

    const { status, body } = await postRaw(AWS_SCANNED, {
      resources: [{ resource_id: CLUSTER, selected: true }],
    });

    expect(status).toBe(409);
    // 리졸버가 아니라 목이 낸 거부다 — problem 본문이 상류 코드를 달고 온다.
    expect(body.code).toBe('CONFLICT_REQUEST_PENDING');
    expect(body.detail).toBe('승인 대기 중인 요청이 있습니다.');
    expect(upstream).toHaveBeenCalledTimes(1);
  });
});

describe('수기 추가 EC2 (1008) — 접속 정보는 manual_ec2 안에서만 온다', () => {
  const INSTANCE_ID = 'i-0a1b2c3d4e5f67890';

  it('추가 모달이 만든 행이 계약 본문의 EC2 행으로 조립된다', async () => {
    upstream.mockClear();

    const scanned = await getConfirmResources(AWS_MANUAL);
    const candidates = catalogToCandidates(scanned.resources);
    const manual = toManualEc2Candidate(
      {
        instanceId: INSTANCE_ID,
        privateIpAddress: '10.10.1.24',
        privateDnsName: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
      },
      { databaseType: 'MYSQL', port: 3306 },
    );

    const body = toApprovalRequestInput(
      [...candidates, manual],
      new Set([manual.id]),
      drafts,
      Object.fromEntries(candidates.map((candidate) => [candidate.id, '통합 테스트 제외'])),
    );

    // 브라우저가 보내는 접속 정보는 이 키 안에만 있다.
    expect(body.resources.find((row) => row.resource_id === INSTANCE_ID)).toEqual({
      resource_id: INSTANCE_ID,
      selected: true,
      manual_ec2: {
        resource_name: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
        host: '10.10.1.24',
        port: 3306,
        database_type: 'mysql',
      },
    });

    const created = await createApprovalRequest(AWS_MANUAL, body);
    expect(created.status).toBe('PENDING');
    expect(created.resource_selected_count).toBe(1);

    // 이 행의 metadata 는 유일하게 클라이언트가 적어 넣는 metadata 다 — 전부가 여기 있다.
    expect(upstreamRow(INSTANCE_ID)).toEqual({
      resource_id: INSTANCE_ID,
      resource_name: 'ip-10-10-1-24.ap-northeast-2.compute.internal',
      resource_type: 'AWS_EC2_INSTANCE',
      integration_category: 'NO_INSTALL_NEEDED',
      selected: true,
      metadata: {
        provider: 'AWS',
        resource_type: 'AWS_EC2_INSTANCE',
        host: '10.10.1.24',
        port: 3306,
        database_type: 'mysql',
      },
    });

    // 되읽기는 목이 제 시드에서 정체성을 다시 그리므로(host·port 는 응답에 없다) 이 화면이
    // 확인할 수 있는 것은 선택이 반영됐다는 사실뿐이다.
    const { request, row } = await latestRow(AWS_MANUAL, INSTANCE_ID);
    expect(row?.selected).toBe(true);
    expect(row?.resource_type).toBe('AWS_EC2_INSTANCE');
    expect(request.resource_selected_count).toBe(1);
  });
});

describe('IDC (1020) — 대조할 스캔이 없어 값이 그대로 상류로 간다', () => {
  const idcRow = (overrides: Partial<IdcStep1Row> = {}): IdcStep1Row => ({
    resourceId: 'idc-1',
    persisted: false,
    kind: 'SINGLE',
    hosts: ['10.0.0.1'],
    port: 3306,
    databaseTypeLabel: 'MySQL',
    databaseTypeWire: 'MYSQL',
    sourceIps: [],
    firewallOpen: false,
    connection: 'PENDING',
    health: null,
    done: null,
    excluded: false,
    exclusionCustom: false,
    ...overrides,
  });

  it('IP 행과 도메인 행이 각자의 키로 조립되고 되읽기에 남는다', async () => {
    upstream.mockClear();

    const body: ApprovalSelection = toIdcApprovalRequestInput([
      idcRow(),
      idcRow({
        resourceId: 'idc-2',
        kind: 'DOMAIN',
        hosts: ['db-1.example.com'],
        port: 1521,
        databaseTypeLabel: 'Oracle',
        databaseTypeWire: 'ORACLE',
        oracleSid: 'ORCL',
        excluded: true,
        exclusionReason: 'StageDB',
      }),
    ]);

    const created = await createApprovalRequest(IDC, body);
    expect(created.status).toBe('PENDING');

    // IDC 는 스캔을 조회하지 않는다(조회할 원본이 없다) — 값이 그대로 계약 모양으로 옮겨진다.
    expect(upstreamRow('idc-1')).toEqual({
      resource_id: 'idc-1',
      selected: true,
      metadata: {
        provider: 'IDC',
        idc_host_format: 'IP',
        idc_ips: ['10.0.0.1'],
        database_type: 'mysql',
        port: 3306,
      },
    });
    expect(upstreamRow('idc-2')).toEqual({
      resource_id: 'idc-2',
      selected: false,
      exclusion_reason: 'StageDB',
      metadata: {
        provider: 'IDC',
        idc_host_format: 'HOST',
        idc_host: 'db-1.example.com',
        database_type: 'oracle',
        port: 1521,
        oracle_service_id: 'ORCL',
      },
    });

    const ip = await latestRow(IDC, 'idc-1');
    expect(ip.row?.selected).toBe(true);
    expect(keysOf(ip.row?.metadata)).toEqual([
      'database_type', 'idc_host_format', 'idc_ips', 'port', 'provider',
    ]);
    expect(ip.row?.metadata).toMatchObject({
      idc_host_format: 'IP',
      idc_ips: ['10.0.0.1'],
      port: 3306,
    });

    const domain = await latestRow(IDC, 'idc-2');
    expect(domain.row?.selected).toBe(false);
    expect(domain.row?.exclusion_reason).toBe('StageDB');
    expect(domain.row?.metadata).toMatchObject({
      idc_host_format: 'HOST',
      idc_host: 'db-1.example.com',
      port: 1521,
      oracle_service_id: 'ORCL',
    });
  });
});

describe('스캔이 없는 대상 (1101) — 상류의 거부를 그대로 옮긴다', () => {
  it('후보 조회가 404 면 제출도 404 로 끝난다 (500 으로 새지 않는다)', async () => {
    upstream.mockClear();

    const { status, body } = await postRaw(NO_SCAN, {
      resources: [{ resource_id: 'anything', selected: true }],
    });

    expect(status).toBe(404);
    // 우리가 판정한 problem(`about:blank`)이 아니라 상류가 낸 것이다.
    expect(body.code).toBe('TARGET_SOURCE_NOT_FOUND');
    expect(body.detail).toBe('스캔 결과가 없습니다.');
    expect(upstream).not.toHaveBeenCalled();
  });
});
