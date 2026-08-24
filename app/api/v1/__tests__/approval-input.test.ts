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

describe('VM — 표시가 갈래를 고르고, 진위는 BFF 가 막는다', () => {
  it('수기 추가로 표시된 AWS 행은 스캔 목록에 없어도 통과한다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        {
          resource_id: 'i-abc123',
          selected: true,
          manual_ec2: { resource_name: 'ip-10-10-1-24.internal' },
          endpoint: { host: '10.10.1.24', port: 3306, database_type: 'MYSQL' },
        },
      ],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const [row] = result.value.resources ?? [];
    expect(row.resource_name).toBe('ip-10-10-1-24.internal');
    expect(row.resource_type).toBe('AWS_EC2_INSTANCE');
    expect(row.integration_category).toBe('NO_INSTALL_NEEDED');
    expect(row.metadata?.host).toBe('10.10.1.24');
    expect(row.metadata?.port).toBe(3306);
  });

  it('표시가 없으면 스캔 목록에 없는 id 는 여전히 409 다 (오래된 화면 감지)', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: 'i-abc123', selected: true }],
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.status).toBe(409);
  });

  it('AWS 가 아니면 수기 추가 표시를 받아 주지 않는다', async () => {
    const result = await resolveApprovalInput(1, 'GCP', parse({
      resources: [{ resource_id: 'i-abc123', selected: true, manual_ec2: {} }],
    }));

    expect(result.ok).toBe(false);
  });

  it('스캔이 이미 찾은 리소스에 수기 추가 표시를 붙이면 거부한다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: 'db-1', selected: true, manual_ec2: {} }],
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.status).toBe(400);
  });

  it('포트는 범위만 본다 — 벗어나면 스키마가 거부한다', () => {
    const parsed = ApprovalSelectionInput.safeParse({
      resources: [
        { resource_id: 'i-abc', selected: true, manual_ec2: {}, endpoint: { port: 70000 } },
      ],
    });
    expect(parsed.success).toBe(false);
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

  // 좁히기 전에도 통과하던 모양은 계속 통과해야 한다 — 없던 거부를 새로 만들면 그 자리가
  // 곧 false positive 다. 이전 요청 불러오기가 host 없는 행을 `hosts: []` 로 싣는다.
  it('주소가 비어 있어도 통과하고, 주소 키를 붙이지 않는다', async () => {
    const result = await resolveApprovalInput(1, 'IDC', parse(
      idcRow({ host_format: 'IP', hosts: [], port: 1521 }),
    ));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = result.value.resources?.[0].metadata;
    expect(meta).not.toHaveProperty('idc_ips');
    expect(meta?.port).toBe(1521);
  });

  it('도메인 행에 호스트가 여럿이면 첫 개만 싣는다 (옛 매퍼와 같은 생략)', async () => {
    const result = await resolveApprovalInput(1, 'IDC', parse(
      idcRow({ host_format: 'HOST', hosts: ['a.example.com', 'b.example.com'] }),
    ));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources?.[0].metadata?.idc_host).toBe('a.example.com');
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
