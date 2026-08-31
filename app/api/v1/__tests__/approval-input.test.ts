import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/bff/client', () => ({
  bff: { confirm: { getResources: vi.fn() } },
}));

import { ApprovalSelectionInput, resolveApprovalInput } from '@/app/api/_lib/approval-input';
import { bff } from '@/lib/bff/client';
import { IDC_SID_MAXLEN } from '@/lib/constants/idc';

const getResources = vi.mocked(bff.confirm.getResources);

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
    // 요청은 소문자 정규형으로 나간다(lib/types.ts).
    expect(row.metadata?.database_type).toBe('mysql');
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

  it('같은 id 가 두 번 오면 첫 행만 남고 거부하지 않는다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        { resource_id: 'db-1', selected: true },
        { resource_id: 'db-1', selected: false, exclusion_reason: '둘째 행' },
      ],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources).toHaveLength(1);
    expect(result.value.resources?.[0]?.selected).toBe(true);
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

describe('endpoint 는 접속 정보를 사용자가 채우는 행에서만 받는다', () => {
  it('스캔이 찾은 비-VM 행에 endpoint 를 붙여도 스캔 값이 이긴다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        {
          resource_id: 'db-1',
          selected: true,
          endpoint: {
            host: 'attacker.internal',
            port: 1,
            database_type: 'oracle',
            network_interface_id: 'eni-x',
          },
        },
      ],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = result.value.resources?.[0].metadata;
    // RDS 클러스터의 DB 타입은 스캔이 소유한다 — 클라이언트가 덮을 수 없다.
    expect(meta?.database_type).toBe('mysql');
    expect(meta).not.toHaveProperty('host');
    expect(meta).not.toHaveProperty('network_interface_id');
    expect(meta?.port).toBeUndefined();
  });

  it('스캔이 찾은 VM 행에서는 사용자가 채운 접속 정보를 싣는다', async () => {
    getResources.mockResolvedValue({
      resources: [
        {
          resource_id: 'vm-1',
          resource_name: 'vm-one',
          resource_type: 'EC2',
          metadata: { provider: 'AWS', region: 'ap-northeast-2' },
        },
      ],
      total_count: 1,
    });

    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        {
          resource_id: 'vm-1',
          selected: true,
          endpoint: { host: '10.0.0.7', port: 1521, database_type: 'ORACLE' },
        },
      ],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const meta = result.value.resources?.[0].metadata;
    expect(meta?.host).toBe('10.0.0.7');
    expect(meta?.port).toBe(1521);
    expect(meta?.database_type).toBe('ORACLE');
  });
});

describe('false positive 경계 — 폼이 받아 준 값은 서버도 받는다', () => {
  it('제외 사유는 폼 상한(1000자)까지 통과한다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: 'db-1', selected: false, exclusion_reason: '가'.repeat(1000) }],
    }));

    expect(result.ok).toBe(true);
  });

  it('사용자가 적은 사유가 스캔 판정을 이긴다', async () => {
    getResources.mockResolvedValue({
      resources: [{ ...scanned, recommend_fail_reason: '엔진 미지원' }],
      total_count: 1,
    });

    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: 'db-1', selected: false, exclusion_reason: '운영팀 요청' }],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources?.[0].exclusion_reason).toBe('운영팀 요청');
    expect(result.value.resources?.[0].recommend_fail_reason).toBe('엔진 미지원');
  });

  it('이름 없는 수기 EC2 와 포트 0 도 통과한다', () => {
    const parsed = ApprovalSelectionInput.safeParse({
      resources: [
        { resource_id: 'i-abc', selected: true, manual_ec2: {}, endpoint: { port: 0 } },
      ],
    });
    expect(parsed.success).toBe(true);
  });

  // id 없는 와이어 행은 매 제출에 딸려 온다. 거부하면 새로고침해도 같은 와이어를 다시
  // 읽어 영원히 같은 자리에서 막힌다 — 떨궈야 한다.
  it('id 없는 행은 요청을 막지 않고 조용히 빠진다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        { resource_id: '', selected: false },
        { resource_id: 'db-1', selected: true },
      ],
    }));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.resources?.map((r) => r.resource_id)).toEqual(['db-1']);
  });

  // 조작된 본문으로만 도달한다(실 UI 는 매퍼가 먼저 걸러 스키마 400 에서 끝난다).
  // 리소스 0개짜리 승인 요청을 상류에 만들지 않는다.
  it('걸러 내고 나서 한 행도 안 남으면 빈 요청을 상류로 보내지 않는다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: '', selected: true }],
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.status).toBe(400);
  });

  it('id 없는 행이 둘이어도 함께 조용히 빠진다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        { resource_id: '', selected: false },
        { resource_id: '', selected: false },
        { resource_id: 'db-1', selected: true },
      ],
    }));

    expect(result.ok).toBe(true);
  });

  it('스캔 결과가 수천 건이어도 상한에 걸리지 않는다 — 화면은 후보 전부를 싣고 상한이 없다', () => {
    const parsed = ApprovalSelectionInput.safeParse({
      resources: Array.from({ length: 5000 }, (_, i) => ({
        resource_id: `res-${i}`,
        selected: false,
      })),
    });
    expect(parsed.success).toBe(true);
  });

  it('와이어가 준 긴 값(Azure NIC 리소스 id)은 상한에 걸리지 않는다', () => {
    const nic = `/subscriptions/${'0'.repeat(36)}/resourceGroups/${'g'.repeat(90)}/providers/Microsoft.Network/networkInterfaces/${'n'.repeat(80)}`;
    expect(nic.length).toBeGreaterThan(256);
    const parsed = ApprovalSelectionInput.safeParse({
      resources: [{ resource_id: 'vm-1', selected: true, endpoint: { network_interface_id: nic } }],
    });
    expect(parsed.success).toBe(true);
  });

  it('모델에 없는 키는 어느 깊이에서든 같은 거부다 — 새 필드는 모양·리졸버·매퍼를 함께 고친다', () => {
    const row = { resource_id: 'db-1', selected: true };
    const bodies: unknown[] = [
      { resources: [row], extra: 1 },
      { resources: [{ ...row, resource_name: 'x' }] },
      { resources: [{ ...row, endpoint: { host: 'h', subnet_id: 'x' } }] },
      { resources: [{ ...row, manual_ec2: { region: 'x' } }] },
      { resources: [{ ...row, idc: { host_format: 'IP', hosts: ['10.0.0.1'], nlb_index: 1 } }] },
    ];
    for (const body of bodies) {
      const parsed = ApprovalSelectionInput.safeParse(body);
      expect(parsed.success).toBe(false);
      expect(parsed.success ? '' : parsed.error.issues[0]?.message).toMatch(/^Unrecognized key/);
    }
  });
});

describe('RDS 멤버 선택 — 고를 수는 있어도 지어낼 수는 없다', () => {
  it('후보 목록에 없는 인스턴스를 고르면 409 다 — 목록이 갱신된 것이지 입력이 틀린 게 아니다', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [
        { resource_id: 'db-1', selected: true, selected_rds_instance_resource_id: 'inst-없음' },
      ],
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.status).toBe(409);
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

  // `normalizeCloudProvider` 는 별칭 표에 없는 값을 'AWS' 로 떨어뜨리고, 화면은 그
  // 정규화된 값으로 EC2 수기 추가 입구를 연다. 서버가 원문을 그대로 비교하면 SDU 대상은
  // 버튼을 보고 행을 만든 뒤 제출에서만 409 를 받는다 — 새로고침해도 같은 자리다.
  it('화면이 AWS 로 그리는 대상이면 서버도 AWS 갈래로 받는다 (SDU)', async () => {
    const result = await resolveApprovalInput(1, 'SDU', parse({
      resources: [{ resource_id: 'i-abc123', selected: true, manual_ec2: {} }],
    }));

    expect(result.ok).toBe(true);
  });

  it('대문자·공백이 섞여도 같은 갈래로 간다', async () => {
    const result = await resolveApprovalInput(1, ' aws ', parse({
      resources: [{ resource_id: 'i-abc123', selected: true, manual_ec2: {} }],
    }));

    expect(result.ok).toBe(true);
  });

  it('재스캔이 같은 인스턴스를 후보로 올렸으면 409 다 (오래된 화면)', async () => {
    const result = await resolveApprovalInput(1, 'AWS', parse({
      resources: [{ resource_id: 'db-1', selected: true, manual_ec2: {} }],
    }));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.failure.status).toBe(409);
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

  it('IDC 행에 수기 추가 EC2 표시를 붙이면 거부한다', async () => {
    const result = await resolveApprovalInput(1, 'IDC', parse({
      resources: [
        {
          resource_id: 'idc-1',
          selected: true,
          idc: { host_format: 'IP', hosts: ['10.1.2.3'] },
          manual_ec2: {},
        },
      ],
    }));

    expect(result.ok).toBe(false);
  });

  it('IDC 행에 접속 정보가 없으면 거부한다', async () => {
    const result = await resolveApprovalInput(1, 'IDC', parse({
      resources: [{ resource_id: 'idc-1', selected: true }],
    }));

    expect(result.ok).toBe(false);
  });

  it('Oracle SID 상한은 모달 input 과 같은 상수다', () => {
    const at = (n: number) => ApprovalSelectionInput.safeParse({
      resources: [{
        resource_id: 'r',
        selected: true,
        idc: { host_format: 'IP', hosts: ['10.0.0.1'], oracle_service_id: 's'.repeat(n) },
      }],
    }).success;
    expect(at(IDC_SID_MAXLEN)).toBe(true);
    expect(at(IDC_SID_MAXLEN + 1)).toBe(false);
  });
});
