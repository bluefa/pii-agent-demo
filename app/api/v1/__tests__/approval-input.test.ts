import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: {
    confirm: { getResources: vi.fn() },
    aws: { searchEc2Resources: vi.fn() },
  },
}));

import { ApprovalSelectionInput, resolveApprovalInput } from '@/app/api/_lib/approval-input';
import { bff } from '@/lib/bff/client';

const getResources = vi.mocked(bff.confirm.getResources);
const searchEc2 = vi.mocked(bff.aws.searchEc2Resources);

/** 스캔이 찾은 한 행. 클라이언트가 절대 만들어 낼 수 없어야 하는 속성들이 여기 있다. */
const scanned = {
  resource_id: 'db-1',
  resource_name: '실제-이름',
  resource_type: 'RDS_CLUSTER',
  integration_category: 'TARGET',
  recommend_fail_reason: null,
  metadata: {
    provider: 'AWS',
    region: 'ap-northeast-2',
    database_type: 'MYSQL',
    rds_instance_candidates: [
      { resource_id: 'inst-a', cluster_member_role: 'WRITER' },
      { resource_id: 'inst-b', cluster_member_role: 'READER' },
    ],
  },
};

const parse = (body: unknown) => {
  const result = ApprovalSelectionInput.safeParse(body);
  if (!result.success) throw new Error(`입력 스키마가 거부: ${result.error.issues[0]?.message}`);
  return result.data;
};

beforeEach(() => {
  vi.clearAllMocks();
  getResources.mockResolvedValue({ resources: [scanned], total_count: 1 });
});

describe('선택형 — 스캔 집합이 사실을 소유한다', () => {
  it('클라이언트가 이름·리전·DB 타입을 보내려 해도 스키마가 먼저 거부한다', () => {
    const forged = {
      resources: [
        { resource_id: 'db-1', selected: true, resource_name: '위조', metadata: { region: 'us-east-1' } },
      ],
    };
    expect(ApprovalSelectionInput.safeParse(forged).success).toBe(false);
  });

  it('상류로 나가는 본문의 속성은 스캔 결과에서 온다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: 'db-1', selected: true }],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = result.value.resources ?? [];
    expect(row.resource_name).toBe('실제-이름');
    expect(row.metadata?.region).toBe('ap-northeast-2');
    expect(row.metadata?.database_type).toBe('MYSQL');
    // 멤버 목록은 클러스터가 무엇인지를 서술한다 — 상류가 준 배열 그대로 되싣는다.
    expect(row.metadata?.rds_instance_candidates).toEqual(
      scanned.metadata.rds_instance_candidates,
    );
  });

  it('스캔이 모르는 resource_id 는 409 로 막힌다', async () => {
    const result = await resolveApprovalInput(1, 'GCP', parse({
      resources: [{ resource_id: '스캔에-없는-것', selected: true }],
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.status).toBe(409);
  });

  it('같은 리소스를 두 번 담으면 거부한다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        { resource_id: 'db-1', selected: true },
        { resource_id: 'db-1', selected: false },
      ],
    }));

    expect(result.ok).toBe(false);
  });

  it('제외 행은 사용자 사유가 없으면 스캔 판정으로 채워진다', async () => {
    getResources.mockResolvedValue({
      resources: [{ ...scanned, recommend_fail_reason: '엔진 미지원' }],
      total_count: 1,
    });

    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: 'db-1', selected: false }],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources?.[0].exclusion_reason).toBe('엔진 미지원');
  });
});

describe('RDS 멤버 선택 — 고를 수는 있어도 지어낼 수는 없다', () => {
  it('후보 목록에 없는 인스턴스를 고르면 거부한다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        { resource_id: 'db-1', selected: true, selected_rds_instance_resource_id: 'inst-없음' },
      ],
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.status).toBe(400);
  });

  it('역할은 클라이언트가 아니라 후보 목록에서 읽는다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        { resource_id: 'db-1', selected: true, selected_rds_instance_resource_id: 'inst-b' },
      ],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources?.[0].metadata?.selected_rds_instance_role).toBe('READER');
  });
});

describe('VM — 정체성은 스캔이 정하고, 접속 정보는 사용자가 적는다', () => {
  const ec2Hit = {
    resource_id: 'i-abc123',
    resource_name: 'ip-10-10-1-24.internal',
    metadata: { private_ip_address: '10.10.1.24', private_dns_name: 'ip-10-10-1-24.internal' },
  };

  it('스캔 목록에 없어도 EC2 검색이 확인해 주면 통과한다', async () => {
    searchEc2.mockResolvedValue({ resources: [ec2Hit] });

    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        {
          resource_id: 'i-abc123',
          selected: true,
          endpoint: { port: 3306, database_type: 'MYSQL' },
        },
      ],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = result.value.resources ?? [];
    expect(row.resource_type).toBe('AWS_EC2_INSTANCE');
    expect(row.integration_category).toBe('NO_INSTALL_NEEDED');
    // 사용자가 실제로 친 것 — DB 종류·포트만 클라이언트에서 온다.
    expect(row.metadata?.database_type).toBe('MYSQL');
    expect(row.metadata?.port).toBe(3306);
    expect(searchEc2).toHaveBeenCalledWith(1, 'i-abc123', 1);
  });

  it('주소는 스캔이 보고한 Private IP 다 — 클라이언트가 보낸 host 는 쓰지 않는다', async () => {
    searchEc2.mockResolvedValue({ resources: [ec2Hit] });

    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        {
          resource_id: 'i-abc123',
          selected: true,
          endpoint: { host: '10.0.0.5', port: 3306, database_type: 'MYSQL' },
        },
      ],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources?.[0].metadata?.host).toBe('10.10.1.24');
  });

  it('prefix 만 겹치는 다른 인스턴스는 통과시키지 않는다', async () => {
    // 검색은 prefix 매칭이다 — 'i-abc' 로 걸면 'i-abc999' 가 돌아올 수 있다.
    searchEc2.mockResolvedValue({ resources: [{ resource_id: 'i-abc999' }] });

    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: 'i-abc', selected: true }],
    }));

    expect(result.ok).toBe(false);
  });

  it('여러 건을 추가해도 조회가 직렬로 쌓이지 않는다', async () => {
    const ids = Array.from({ length: 12 }, (_, i) => `i-${String(i).padStart(6, '0')}`);
    searchEc2.mockImplementation(async (_id, query) => ({
      resources: [{ resource_id: query, metadata: { private_ip_address: '10.0.0.1' } }],
    }));

    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: ids.map((id) => ({ resource_id: id, selected: true })),
    }));

    expect(result.ok).toBe(true);
    expect(searchEc2).toHaveBeenCalledTimes(12);
  });

  it('스캔이 모르는 id 가 상한을 넘으면 조회하지 않고 409 로 되돌린다', async () => {
    const many = Array.from({ length: 51 }, (_, i) => ({
      resource_id: `i-${String(i).padStart(6, '0')}`,
      selected: true,
    }));

    const result = await resolveApprovalInput(1, 'AWS', parse({ resources: many }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.status).toBe(409);
    expect(searchEc2).not.toHaveBeenCalled();
  });

  it('AWS 가 아니면 EC2 검색으로 되살리지 않는다', async () => {
    searchEc2.mockResolvedValue({ resources: [{ resource_id: 'i-abc123' }] });

    const result = await resolveApprovalInput(1, 'GCP', parse({
      resources: [{ resource_id: 'i-abc123', selected: true }],
    }));

    expect(result.ok).toBe(false);
    expect(searchEc2).not.toHaveBeenCalled();
  });
});

describe('IDC — 대조할 집합이 없으므로 형식만 본다', () => {
  const idcRow = (idc: Record<string, unknown>) => ({
    resources: [{ resource_id: 'idc-1', selected: true, idc }],
  });

  it('IP 행은 스캔을 조회하지 않는다 (조회할 원본이 없다)', async () => {
    const result = await resolveApprovalInput(1, 'IDC', parse(
      idcRow({ host_format: 'IP', hosts: ['10.1.2.3'], port: 1521 }),
    ));

    expect(result.ok).toBe(true);
    expect(getResources).not.toHaveBeenCalled();
  });

  it('IP 형식이 아닌 값을 IP 행에 넣으면 스키마가 거부한다', () => {
    const parsed = ApprovalSelectionInput.safeParse(
      idcRow({ host_format: 'IP', hosts: ['10.1.2.999'] }),
    );
    expect(parsed.success).toBe(false);
  });

  it('포트 범위를 벗어나면 거부한다', () => {
    const parsed = ApprovalSelectionInput.safeParse(
      idcRow({ host_format: 'IP', hosts: ['10.1.2.3'], port: 70000 }),
    );
    expect(parsed.success).toBe(false);
  });

  it('계약에 없는 키를 끼워 넣으면 거부한다 (passthrough 가 아니다)', () => {
    const parsed = ApprovalSelectionInput.safeParse(
      idcRow({ host_format: 'IP', hosts: ['10.1.2.3'], idc_source_ips: ['1.1.1.1'] }),
    );
    expect(parsed.success).toBe(false);
  });

  it('도메인 행은 호스트를 하나만 가진다', () => {
    const parsed = ApprovalSelectionInput.safeParse(
      idcRow({ host_format: 'HOST', hosts: ['a.example.com', 'b.example.com'] }),
    );
    expect(parsed.success).toBe(false);
  });

  it('IP 행은 idc_ips 로, 도메인 행은 idc_host 로 조립된다', async () => {
    const ip = await resolveApprovalInput(1, 'IDC', parse(
      idcRow({ host_format: 'IP', hosts: ['10.1.2.3', '10.1.2.4'] }),
    ));
    expect(ip.ok).toBe(true);
    if (!ip.ok) return;
    expect(ip.value.resources?.[0].metadata).toMatchObject({
      provider: 'IDC',
      idc_host_format: 'IP',
      idc_ips: ['10.1.2.3', '10.1.2.4'],
    });
    expect(ip.value.resources?.[0].metadata).not.toHaveProperty('idc_host');

    const domain = await resolveApprovalInput(1, 'IDC', parse(
      idcRow({ host_format: 'HOST', hosts: ['db.example.com'] }),
    ));
    expect(domain.ok).toBe(true);
    if (!domain.ok) return;
    expect(domain.value.resources?.[0].metadata).toMatchObject({
      idc_host_format: 'HOST',
      idc_host: 'db.example.com',
    });
    expect(domain.value.resources?.[0].metadata).not.toHaveProperty('idc_ips');
  });

  it('IDC 가 아닌 provider 로 IDC 접속 정보를 보내면 거부한다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse(
      idcRow({ host_format: 'IP', hosts: ['10.1.2.3'] }),
    ));

    expect(result.ok).toBe(false);
  });

  it('IDC 행에 접속 정보가 없으면 거부한다', async () => {
    const result = await resolveApprovalInput(1, 'IDC', parse({
      resources: [{ resource_id: 'idc-1', selected: true }],
    }));

    expect(result.ok).toBe(false);
  });
});
