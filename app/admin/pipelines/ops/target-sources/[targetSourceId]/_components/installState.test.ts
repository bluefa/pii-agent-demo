/**
 * The 21 states the 설치 상태 card can show (AWS 자동 4 · AWS 수동 4 · GCP 4 ·
 * Azure 5 · IDC 4), plus the variants that change a row but never the count:
 * FAIL with a guide, a step that is SKIP everywhere, a resource set that is only
 * partly through a step.
 */
import { describe, it, expect } from 'vitest';
import {
  DONE_SENTENCE,
  UNKNOWN_SENTENCE,
  installStateView,
  type InstallStateInput,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installState';
import type {
  InstallDetailResource,
  InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';

type Cells = Record<string, InstallStepValue | [InstallStepValue, string]>;

const resource = (id: string, cells: Cells): InstallDetailResource => ({
  resourceId: id,
  resourceName: id,
  rollup: { status: 'IN_PROGRESS', guide: null },
  cells: Object.fromEntries(
    Object.entries(cells).map(([k, v]) => [
      k,
      Array.isArray(v) ? { status: v[0], guide: v[1] } : { status: v, guide: null },
    ]),
  ),
});

const detail = (
  resources: InstallDetailResource[],
  roleVerify?: InstallStepValue,
): NonNullable<InstallStateInput['detail']> => ({
  lastCheck: { status: 'SUCCESS', checkedAt: '2026-09-12T05:03:00Z' },
  unavailable: false,
  resources,
  ...(roleVerify !== undefined && { roleVerify }),
});

const IP: InstallStepValue = 'IN_PROGRESS';
const CO: InstallStepValue = 'COMPLETED';

/** [title, side, state] per row — the whole card in one line. */
const rows = (v: ReturnType<typeof installStateView>) =>
  v?.steps.map((s) => [s.title, s.side, s.state]);

describe('installStateView — AWS 자동 (4)', () => {
  const aws = (cells: Cells, role: InstallStepValue) =>
    installStateView({ provider: 'aws', manualInstall: false, detail: detail([resource('db-1', cells)], role) });

  it('① nothing done yet: the service owner grants the role first', () => {
    // 07-30 BE capture: every unfinished cell is IN_PROGRESS, role included.
    const v = aws({ service: IP, bdcCommon: IP, bdcService: IP }, IP);
    expect(v?.kind).toBe('svc');
    expect(v?.sentence).toBe('서비스 담당자가 Terraform 권한을 부여해야 합니다');
    expect(rows(v)).toEqual([
      ['Terraform 권한 부여 확인', '서비스', 'now'],
      ['서비스 계정 Terraform 적용', '관리자', 'wait'],
      ['BDC 공통 영역', '관리자', 'wait'],
      ['BDC 서비스 영역', '관리자', 'wait'],
    ]);
  });

  it('② role verified: the operator applies', () => {
    const v = aws({ service: IP, bdcCommon: IP, bdcService: IP }, CO);
    expect(v?.kind).toBe('me');
    expect(v?.sentence).toBe('관리자가 Terraform을 적용할 차례입니다');
    expect(rows(v)).toEqual([
      ['Terraform 권한 부여 확인', '서비스', 'done'],
      ['서비스 계정 Terraform 적용', '관리자', 'now'],
      ['BDC 공통 영역', '관리자', 'wait'],
      ['BDC 서비스 영역', '관리자', 'wait'],
    ]);
  });

  it('③ everything settled', () => {
    const v = aws({ service: CO, bdcCommon: CO, bdcService: CO }, CO);
    expect(v?.kind).toBe('done');
    expect(v?.sentence).toBe(DONE_SENTENCE);
    expect(v?.steps.every((s) => s.state === 'done')).toBe(true);
  });

  it('④ not read', () => {
    const v = installStateView({ provider: 'aws', manualInstall: false, detail: null });
    expect(v).toEqual({ kind: 'unk', sentence: UNKNOWN_SENTENCE, steps: [] });
  });

  it('first read in flight: null, not 확인 불가 (the card draws its skeleton)', () => {
    expect(
      installStateView({ provider: 'aws', manualInstall: false, detail: null, loading: true }),
    ).toBeNull();
  });

  it('a refetch keeps the previous snapshot readable', () => {
    const v = installStateView({
      provider: 'aws',
      manualInstall: false,
      loading: true,
      detail: detail([resource('db-1', { service: IP, bdcCommon: IP, bdcService: IP })], 'COMPLETED'),
    });
    expect(v?.kind).toBe('me');
  });

  it('still the operator while BDC runs: IN_PROGRESS is not "running"', () => {
    // The wire cannot tell a run in flight from one never started. Owner: 조치 필요 either way.
    const v = aws({ service: CO, bdcCommon: IP, bdcService: IP }, CO);
    expect(v?.kind).toBe('me');
    expect(rows(v)?.[2]).toEqual(['BDC 공통 영역', '관리자', 'now']);
  });
});

describe('installStateView — AWS 수동 (4)', () => {
  const aws = (cells: Cells, role?: InstallStepValue) =>
    installStateView({ provider: 'aws', manualInstall: true, detail: detail([resource('db-1', cells)], role) });

  it('① the service applies the script itself; there is no role row', () => {
    const v = aws({ service: IP, bdcCommon: IP, bdcService: IP }, 'SKIP');
    expect(v?.kind).toBe('svc');
    expect(v?.sentence).toBe('서비스 담당자가 Terraform을 직접 적용해야 합니다');
    expect(rows(v)).toEqual([
      ['서비스 측 Terraform 적용', '서비스', 'now'],
      ['BDC 공통 영역', '관리자', 'wait'],
      ['BDC 서비스 영역', '관리자', 'wait'],
    ]);
  });

  it('② service done: the operator applies', () => {
    const v = aws({ service: CO, bdcCommon: IP, bdcService: IP });
    expect(v?.kind).toBe('me');
    expect(rows(v)).toEqual([
      ['서비스 측 Terraform 적용', '서비스', 'done'],
      ['BDC 공통 영역', '관리자', 'now'],
      ['BDC 서비스 영역', '관리자', 'wait'],
    ]);
  });

  it('③ everything settled', () => {
    expect(aws({ service: CO, bdcCommon: CO, bdcService: CO })?.kind).toBe('done');
  });

  it('④ not read: FAILED last_check', () => {
    const d = { ...detail([resource('db-1', { service: CO })]), lastCheck: { status: 'FAILED' as const } };
    expect(installStateView({ provider: 'aws', manualInstall: true, detail: d })?.kind).toBe('unk');
  });

  it('the role verify is ignored in manual mode even when the wire sends one', () => {
    const v = aws({ service: IP, bdcCommon: IP, bdcService: IP }, IP);
    expect(v?.steps.some((s) => s.id === 'role')).toBe(false);
  });
});

describe('installStateView — GCP (4)', () => {
  const gcp = (...res: InstallDetailResource[]) =>
    installStateView({ provider: 'gcp', manualInstall: true, detail: detail(res) });

  it('① Subnet first, by the service', () => {
    const v = gcp(resource('sql-1', { subnet: IP, service: IP, bdc: IP }));
    expect(v?.kind).toBe('svc');
    expect(v?.sentence).toBe('서비스 담당자가 PSC용 Subnet을 만들어야 합니다');
    expect(rows(v)).toEqual([
      ['PSC용 Subnet 생성', '서비스', 'now'],
      ['서비스측 Terraform 적용', '관리자', 'wait'],
      ['BDC측 Terraform 적용', '관리자', 'wait'],
    ]);
  });

  it('② Subnet done: the operator applies both sides', () => {
    const v = gcp(resource('sql-1', { subnet: CO, service: IP, bdc: IP }));
    expect(v?.kind).toBe('me');
    expect(rows(v)?.[1]).toEqual(['서비스측 Terraform 적용', '관리자', 'now']);
  });

  it('③ everything settled', () => {
    expect(gcp(resource('sql-1', { subnet: CO, service: CO, bdc: CO }))?.kind).toBe('done');
  });

  it('④ not read: unavailable', () => {
    const d = { ...detail([resource('sql-1', { subnet: CO })]), unavailable: true };
    expect(installStateView({ provider: 'gcp', manualInstall: true, detail: d })?.kind).toBe('unk');
  });

  it('a Subnet step that is SKIP on every resource has no row at all', () => {
    const v = gcp(
      resource('sql-1', { subnet: 'SKIP', service: IP, bdc: IP }),
      resource('sql-2', { subnet: 'SKIP', service: IP, bdc: IP }),
    );
    expect(v?.kind).toBe('me');
    expect(rows(v)).toEqual([
      ['서비스측 Terraform 적용', '관리자', 'now'],
      ['BDC측 Terraform 적용', '관리자', 'wait'],
    ]);
  });

  it('a Subnet step that is SKIP on SOME resources keeps its row and counts them as settled', () => {
    const v = gcp(
      resource('sql-1', { subnet: CO, service: CO, bdc: IP }),
      resource('sql-2', { subnet: CO, service: IP, bdc: IP }),
      resource('sql-3', { subnet: 'SKIP', service: IP, bdc: IP }),
      resource('sql-4', { subnet: IP, service: IP, bdc: IP }),
    );
    expect(v?.kind).toBe('svc');
    expect(v?.steps[0]).toMatchObject({ id: 'subnet', state: 'now', done: 3, total: 4 });
    expect(v?.steps[1]).toMatchObject({ id: 'service', state: 'wait', done: 1, total: 4 });
  });
});

describe('installStateView — Azure (5)', () => {
  const azure = (...res: InstallDetailResource[]) =>
    installStateView({ provider: 'azure', manualInstall: true, detail: detail(res) });
  const cells = (vmSubnet: InstallStepValue, vmApply: InstallStepValue, bdc: InstallStepValue, pe: InstallStepValue): Cells =>
    ({ vmSubnet, vmApply, bdc, pe });

  it('① the service builds the VM resources first', () => {
    const v = azure(resource('vm-1', cells(IP, IP, IP, IP)));
    expect(v?.kind).toBe('svc');
    expect(v?.sentence).toBe('서비스 담당자가 VM 리소스를 만들어야 합니다');
    expect(rows(v)).toEqual([
      ['VM Subnet 생성', '서비스', 'now'],
      ['VM Terraform 적용', '서비스', 'wait'],
      ['BDC측 Terraform 적용', '관리자', 'wait'],
      ['Private Endpoint 승인', '서비스', 'wait'],
    ]);
  });

  it('①-b Subnet done, VM apply open: the sentence moves to the VM apply', () => {
    const v = azure(resource('vm-1', cells(CO, IP, IP, IP)));
    expect(v?.kind).toBe('svc');
    expect(v?.sentence).toBe('서비스 담당자가 VM Terraform을 적용해야 합니다');
  });

  it('② VM done: the operator applies', () => {
    const v = azure(resource('vm-1', cells(CO, CO, IP, IP)));
    expect(v?.kind).toBe('me');
    expect(rows(v)?.[2]).toEqual(['BDC측 Terraform 적용', '관리자', 'now']);
  });

  it('③ BDC done: the service approves the Private Endpoint — the second service turn', () => {
    const v = azure(resource('vm-1', cells(CO, CO, CO, IP)));
    expect(v?.kind).toBe('svc');
    expect(v?.sentence).toBe('서비스 담당자가 Private Endpoint 연결을 승인해야 합니다');
    expect(rows(v)?.[3]).toEqual(['Private Endpoint 승인', '서비스', 'now']);
  });

  it('④ everything settled', () => {
    expect(azure(resource('vm-1', cells(CO, CO, CO, CO)))?.kind).toBe('done');
  });

  it('⑤ not read: zero resources', () => {
    expect(azure()?.kind).toBe('unk');
  });

  it('no VM: both VM rows are gone and the operator goes first', () => {
    const v = azure(resource('db-1', cells('SKIP', 'SKIP', IP, IP)));
    expect(v?.kind).toBe('me');
    expect(rows(v)).toEqual([
      ['BDC측 Terraform 적용', '관리자', 'now'],
      ['Private Endpoint 승인', '서비스', 'wait'],
    ]);
  });
});

describe('installStateView — IDC (4)', () => {
  const idc = (cells: Cells) =>
    installStateView({ provider: 'idc', manualInstall: true, detail: detail([resource('idc-1', cells)]) });

  it('① the operator applies BDC Terraform first', () => {
    const v = idc({ cx: IP, bdp: IP, firewall: IP });
    expect(v?.kind).toBe('me');
    expect(v?.sentence).toBe('관리자가 BDC Terraform을 적용할 차례입니다');
    expect(rows(v)).toEqual([
      ['BDC CX 영역', '관리자', 'now'],
      ['BDC BDP 영역', '관리자', 'wait'],
      ['접근 허용', '서비스', 'wait'],
    ]);
  });

  it('② BDC done: the service confirms the firewall', () => {
    const v = idc({ cx: CO, bdp: CO, firewall: IP });
    expect(v?.kind).toBe('svc');
    expect(v?.sentence).toBe('서비스 담당자가 접근 허용을 확인해야 합니다');
  });

  it('③ everything settled', () => {
    expect(idc({ cx: CO, bdp: CO, firewall: CO })?.kind).toBe('done');
  });

  it('④ not read', () => {
    expect(installStateView({ provider: 'idc', manualInstall: true, detail: null })?.kind).toBe('unk');
  });
});

describe('installStateView — variants that change a row, not the state', () => {
  it('FAIL on the service step: same verdict, the row is fail and carries the guide', () => {
    const v = installStateView({
      provider: 'aws',
      manualInstall: true,
      detail: detail([
        resource('db-1', { service: CO, bdcCommon: IP, bdcService: IP }),
        resource('db-2', { service: CO, bdcCommon: IP, bdcService: IP }),
        resource('db-3', { service: ['FAIL', '서브넷 가용 IP 부족으로 ENI 생성에 실패했습니다.'], bdcCommon: IP, bdcService: IP }),
        resource('db-4', { service: CO, bdcCommon: IP, bdcService: IP }),
      ]),
    });
    expect(v?.kind).toBe('svc');
    expect(v?.sentence).toBe('서비스 담당자가 Terraform을 직접 적용해야 합니다');
    expect(v?.steps[0]).toMatchObject({
      state: 'fail',
      done: 3,
      total: 4,
      failed: 1,
      open: [
        {
          resourceId: 'db-3',
          resourceName: 'db-3',
          failed: true,
          guide: '서브넷 가용 IP 부족으로 ENI 생성에 실패했습니다.',
        },
      ],
    });
  });

  it('FAIL on a BDC step: the operator reruns, so the verdict stays 관리자', () => {
    const v = installStateView({
      provider: 'aws',
      manualInstall: false,
      detail: detail(
        [
          resource('db-1', { service: CO, bdcCommon: ['FAIL', 'timeout'], bdcService: IP }),
          resource('db-2', { service: CO, bdcCommon: ['FAIL', 'timeout'], bdcService: IP }),
        ],
        CO,
      ),
    });
    expect(v?.kind).toBe('me');
    expect(v?.steps[2]).toMatchObject({ id: 'bdcCommon', state: 'fail', failed: 2 });
    expect(v?.steps[2].open.map((r) => [r.resourceId, r.failed, r.guide])).toEqual([
      ['db-1', true, 'timeout'],
      ['db-2', true, 'timeout'],
    ]);
  });

  it('the open list names the resources still on the step, in wire order; settled ones are not in it', () => {
    const v = installStateView({
      provider: 'idc',
      manualInstall: true,
      detail: detail([
        resource('idc-res-001', { cx: CO, bdp: CO, firewall: CO }),
        resource('idc-res-002', { cx: CO, bdp: CO, firewall: IP }),
        resource('idc-res-003', { cx: CO, bdp: CO, firewall: CO }),
        resource('idc-res-004', { cx: CO, bdp: CO, firewall: ['FAIL', null as unknown as string] }),
      ]),
    });
    expect(v?.kind).toBe('svc');
    expect(v?.steps.map((s) => [s.id, s.state, s.open.length])).toEqual([
      ['cx', 'done', 0],
      ['bdp', 'done', 0],
      ['firewall', 'fail', 2],
    ]);
    expect(v?.steps[2].open).toEqual([
      { resourceId: 'idc-res-002', resourceName: 'idc-res-002', failed: false, guide: null },
      { resourceId: 'idc-res-004', resourceName: 'idc-res-004', failed: true, guide: null },
    ]);
  });

  it('IDC BDP is one apply for the whole target: counted, never listed by resource', () => {
    const v = installStateView({
      provider: 'idc',
      manualInstall: true,
      detail: detail([
        resource('idc-res-001', { cx: CO, bdp: CO, firewall: IP }),
        resource('idc-res-002', { cx: CO, bdp: IP, firewall: IP }),
      ]),
    });
    expect(v?.steps[1]).toMatchObject({ id: 'bdp', state: 'now', done: 1, total: 2, listResources: false });
    expect(v?.steps[1].open).toHaveLength(1);
    expect(v?.steps.map((s) => [s.id, s.listResources])).toEqual([
      ['cx', true],
      ['bdp', false],
      ['firewall', true],
    ]);
  });

  it('AWS and GCP never list resources under a step (owner 2026-09-15); Azure does', () => {
    const aws = installStateView({
      provider: 'aws',
      manualInstall: true,
      detail: detail([resource('db-1', { service: IP, bdcCommon: IP, bdcService: IP })]),
    });
    expect(aws?.steps.every((s) => s.listResources === false)).toBe(true);
    const gcp = installStateView({
      provider: 'gcp',
      manualInstall: false,
      detail: detail([resource('db-1', { subnet: IP, service: IP, bdc: IP })]),
    });
    expect(gcp?.steps.every((s) => s.listResources === false)).toBe(true);
    const azure = installStateView({
      provider: 'azure',
      manualInstall: false,
      detail: detail([resource('db-1', { vmSubnet: IP, vmApply: IP, bdc: IP, pe: IP })]),
    });
    expect(azure?.steps.every((s) => s.listResources)).toBe(true);
  });

  it('the role check is target-level: it lists no resource', () => {
    const v = installStateView({
      provider: 'aws',
      manualInstall: false,
      detail: detail([resource('db-1', { service: IP, bdcCommon: IP, bdcService: IP })], IP),
    });
    expect(v?.steps[0]).toMatchObject({ id: 'role', state: 'now', open: [] });
  });

  it('a step with no cell on any resource is dropped, not counted as done', () => {
    const v = installStateView({
      provider: 'gcp',
      manualInstall: true,
      detail: detail([resource('sql-1', { service: IP, bdc: IP })]),
    });
    expect(v?.steps.map((s) => s.id)).toEqual(['service', 'bdc']);
  });

  it('every step dropped reads as not read, never as done', () => {
    const v = installStateView({
      provider: 'gcp',
      manualInstall: true,
      detail: detail([resource('sql-1', { subnet: 'SKIP', service: 'SKIP', bdc: 'SKIP' })]),
    });
    expect(v?.kind).toBe('unk');
  });

  it('SDU and unknown providers have no install state here', () => {
    expect(installStateView({ provider: 'sdu', manualInstall: false, detail: null })).toBeNull();
    expect(installStateView({ provider: 'oci', manualInstall: false, detail: null })).toBeNull();
  });
});
