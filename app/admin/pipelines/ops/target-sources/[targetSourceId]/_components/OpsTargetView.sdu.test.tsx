// @vitest-environment jsdom
/**
 * SDU 대상의 운영 콘솔 — **여덟 탭이 선다.**
 *
 * 규칙이 두 번 바뀌었다. 처음에는 SDU 가 화면 전체를 안내 한 장으로 바꿨고, 다음에는
 * 마스트헤드만 세우고 탭 줄을 거뒀다. 그 전제("우리가 설치하는 계정")는 SDU 에서 틀렸을
 * 뿐이고, 스캔·Terraform·연결 테스트·Airflow 는 전부 대상 소스에 붙은 오퍼레이션이지
 * 프로바이더에 붙은 것이 아니다(계약 §9). 그래서 이제 아홉 중 여덟이 그대로 온다.
 *
 * 빠지는 것은 「연동 요청 정보」 하나다 — SDU 에는 승인이 없어(§0, 제출이 곧 1 → 4) 그 탭이
 * 그릴 요청 자체가 만들어지지 않는다. 같은 이유로 진행 상태 탭의 「승인 요청 내역」 자리는
 * 담당자가 무엇을 입력했는지가 갖는데, 그것은 카드 **셋**이다(오너 결정) — 정의 · 확인 ·
 * 수신자. 오른쪽 칸(연동 현황)은 서버가 그려 prop 으로 내려
 * 보내므로 여기서는 자리만 재고, 그것이 SDU 에서도 그려지는지는 `StatusCard.server.test.tsx`
 * 가 제 축에서 박는다.
 *
 * 계약이 SDU 를 말하는 자리는 둘이다 — `metadata.is_sdu_type` 과 `cloudProvider` enum 의
 * `SDU`. 한쪽만 보면 그 경로로 오는 대상이 아홉 탭짜리 화면으로 떨어진다.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { OpsTargetView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsTargetView';
import type { SduDefinition, SduUpload } from '@/lib/types/sdu';

const getRawTargetSourceDetail = vi.fn();

vi.mock('@/app/lib/api/pipeline-target', () => ({
  getRawTargetSourceDetail: (...args: unknown[]) => getRawTargetSourceDetail(...args),
}));

// 마스트헤드의 단계 알약이 읽는다 — 이 파일의 단언 대상은 아니지만, 스텁이 없으면
// 뷰의 .catch 가 삼켜 알약이 영영 서지 않는다.
const getProcessStatus = vi.fn(async () => ({ process_status: 'INSTALLED' }));
const getApprovalHistory = vi.fn(async () => ({ content: [], totalPages: 1 }));
// 확정 정보 탭의 남은 두 축 — SDU 에서도 그대로 돈다(§9.3).
const getConfirmedIntegration = vi.fn(async () => ({ resource_infos: [] }));
const getTerraformStatus = vi.fn(async () => ({ overall_state: 'NONE', tasks: [] }));
vi.mock('@/app/lib/api', () => ({
  getProcessStatus: () => getProcessStatus(),
  getApprovalHistory: () => getApprovalHistory(),
  getConfirmedIntegration: () => getConfirmedIntegration(),
  getTerraformStatus: () => getTerraformStatus(),
}));
// 세 번째 축의 조회 — SDU 대상에서는 한 번도 불리면 안 된다. 이 모듈은 조회 말고
// 행 매퍼도 내보내고 승인 요청 상세 모달이 그것을 쓰므로, 통째로 갈지 않고 한 함수만 갈아
// 끼운다 (전부 갈면 그 모달이 마운트되는 순간 undefined 를 부른다).
const getApprovalRequestLatest = vi.fn(async (): Promise<null> => null);
vi.mock('@/app/lib/api/task-queue-requests', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/api/task-queue-requests')>()),
  getApprovalRequestLatest: () => getApprovalRequestLatest(),
}));
// 최신 연결 테스트 실행 — 조건 ② 의 입력. 기본은 「이력 없음」이고, ③ 까지 걸어야 하는
// 테스트만 성공한 실행을 갈아 낀다.
const fetchLatestTest = vi.fn();
vi.mock('@/app/hooks/useTestConnectionPolling', () => ({
  fetchLatestTest: (...args: unknown[]) => fetchLatestTest(...args),
}));
// Now that a verdict is derived, this response is the screen — the route zod-parses it, so {} is the minimal shape.
const getAwsRoleVerification = vi.fn(async (): Promise<Record<string, never>> => ({}));
vi.mock('@/app/lib/api/aws', () => ({
  getAwsRoleVerification: () => getAwsRoleVerification(),
}));
// §10 dag-status — 기본은 픽스처 없음이라 뷰의 .catch 가 받아 헬스만 '확인 실패'로 선다.
// **부르는지 자체가 단언 대상**이라 핸들로 둔다: SDU 는 이 조회가 없으면 조건 ③ 이
// 영영 판정을 못 하고 연동 완료가 잠긴 채로 굳는다.
const getDagStatus = vi.fn();
vi.mock('@/app/lib/api/ops', () => ({
  getTargetJiraTicket: vi.fn(async () => null),
  getDagStatus: (...args: unknown[]) => getDagStatus(...args),
}));
// 연결 테스트 세 응답은 SDU 에서도 돈다 — SDU 도 ProcessStatus 5 에 도착하고(§8) 그 탭을
// 그대로 받는다. 이력이 없다는 뜻의 null 이라 탭 줄의 점은 켜지지 않는다.
const getTestConnectionDetail = vi.fn(async (): Promise<null> => null);
vi.mock('@/app/lib/api/task-queue-tc', () => ({
  getTestConnectionDetail: () => getTestConnectionDetail(),
  getTestConnectionResults: vi.fn(async () => []),
}));
// 인프라 작업 탭이 마운트되려면 둘이 필요하다. 실행 목록은 「아직 아무것도 안 돌았다」로
// 고정한다 — 그래야 게이트를 그리는 빈 카드가 선다. 라우터는 이 뷰가 쓰지 않고 그 탭 안의
// 행 클릭만 쓰므로, 여기서 갈아도 뷰의 URL 정리(위 `?tab=request` 축)는 건드리지 않는다.
vi.mock('@/app/lib/api/pipeline', () => ({
  getLatestPipelineByTarget: vi.fn(async () => null),
  getPipeline: vi.fn(async () => null),
  getTaskDefinitions: vi.fn(async () => []),
  listPipelinesByTarget: vi.fn(async () => ({ content: [], totalPages: 1, totalElements: 0 })),
}));
// 모듈을 통째로 갈면 이 트리의 다른 훅(`usePathname` 등)까지 사라진다 — 한 훅만 덮는다.
vi.mock('next/navigation', async (importOriginal) => ({
  ...(await importOriginal<typeof import('next/navigation')>()),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/app/lib/api/scan', () => ({
  getScanHistory: vi.fn(async () => ({ content: [], totalPages: 1 })),
  getLatestScanJob: vi.fn(async () => null),
  startScan: vi.fn(async () => null),
}));

const DEFINITION: SduDefinition = {
  targets: [
    {
      targetId: 't-1',
      cloud: 'AWS',
      region: 'us',
      uploadIp: '10.20.30.40',
      databaseTypes: ['MySQL', 'Aurora MySQL'],
    },
  ],
  updatedAt: '2026-08-24T05:40:00Z',
};

/**
 * 방화벽은 **「아니오」**(답이 있고 값이 false), 업로드 확인은 **미답**(시각이 없다).
 * 계약 §5 가 가르는 두 상태이고, 화면이 둘을 같은 말로 적으면 저장된 아니오가 새로고침 뒤
 * 미답으로 보인다.
 */
const UPLOAD: SduUpload = {
  submittedAt: '2026-08-24T05:41:00Z',
  regions: ['us'],
  firewall: {
    rows: [
      {
        region: 'us',
        s3Endpoint: 's3.us-east-1.amazonaws.com',
        port: 443,
        destinationIps: ['52.216.0.0/15'],
      },
    ],
    acked: false,
    ackedAt: '2026-08-25T10:40:00Z',
    ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
  },
  accessKeyRecipients: {
    users: [{ id: 'user-3', name: '이영희', email: 'lee@company.com' }],
    updatedAt: '2026-08-24T07:41:00Z',
  },
  commands: { rows: [], acked: false, ackedAt: null, ackedBy: null },
  bdc: { status: 'NOT_STARTED', checkedAt: '2026-08-24T07:50:00Z', completedAt: null },
  invalidation: { addedRegions: [], uploadIpChanged: false },
};

const getSduDefinition = vi.fn(async () => DEFINITION);
const getSduUpload = vi.fn(async () => UPLOAD);
vi.mock('@/app/lib/api/sdu', () => ({
  getSduDefinition: () => getSduDefinition(),
  getSduUpload: () => getSduUpload(),
}));

const detail = (over: Record<string, unknown> = {}) => ({
  target_source_id: 1099,
  service_name: 'SDU',
  service_code: 'SDU',
  cloud_provider: 'AWS',
  metadata: { is_sdu_type: true, aws_account_id: '210987654321', is_china_region: true },
  ...over,
});

/** What the strip actually drew — the list itself is the assertion target. */
const tabNames = async (): Promise<string[]> => {
  await waitFor(() => expect(screen.getAllByRole('tab').length).toBeGreaterThan(0));
  // 라벨만 본다 — 상태가 걸린 탭은 `.sr-only` 낱말을 뒤에 달고 나온다.
  return screen.getAllByRole('tab').map((el) => (el.textContent ?? '').split(',')[0]);
};

/** 조건 ③ 이 판정을 내릴 수 있는 §10 응답. */
const DAG_HEALTHY = {
  targetSourceId: 1099,
  connectionStatus: 'CONNECTED',
  healthStatus: 'HEALTHY',
  timezone: 'Asia/Seoul',
  agents: [],
};

/** 조건 ① 의 셋이 모두 채워진 §5 응답 — 방화벽·업로드 확인 「예」 + 수신자 1명. */
const UPLOAD_MET: SduUpload = {
  ...UPLOAD,
  firewall: { ...UPLOAD.firewall, acked: true },
  commands: { ...UPLOAD.commands, acked: true, ackedAt: '2026-08-25T11:00:00Z' },
};

beforeEach(() => {
  vi.clearAllMocks();
  // 기본값은 매번 다시 세운다 — `clearAllMocks` 는 호출 기록만 지우고 구현은 남긴다.
  // 한 테스트가 `mockRejectedValue` 로 갈아 끼우면 그 뒤 파일 전체가 그 거절을 물려받는다.
  getDagStatus.mockRejectedValue(new Error('no dag-status fixture'));
  fetchLatestTest.mockResolvedValue(null);
  getSduDefinition.mockResolvedValue(DEFINITION);
  getSduUpload.mockResolvedValue(UPLOAD);
  window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1099');
});

describe('OpsTargetView — SDU 탭 구성', () => {
  it('SDU 대상은 탭 줄을 받는다 — 여덟 개', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    // 목록 전체를 잰다. 없음만 단언하면 필터가 넓어져도 통과한다.
    expect(await tabNames()).toEqual([
      '진행 상태',
      '스캔',
      '확정 정보',
      '인프라 작업',
      '연결 테스트',
      '관리자 승인',
      'Airflow 확인',
      '연동 초기화',
    ]);
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('빠지는 것은 「연동 요청 정보」 하나다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    expect(await tabNames()).not.toContain('연동 요청 정보');
  });

  it('cloudProvider 가 SDU 로 와도 같다 (플래그가 없어도)', async () => {
    // provider 비교만으로는 절대 못 잡는다 — normalizeCloudProvider('SDU') 는 'AWS' 다.
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ cloud_provider: 'SDU', metadata: { is_sdu_type: false } }),
    );
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    const tabs = await tabNames();
    expect(tabs).toHaveLength(8);
    expect(tabs).not.toContain('연동 요청 정보');
  });

  it('밑에 깔린 CSP 가 IDC 여도 여덟이다 — 두 필터가 겹치지 않는다', async () => {
    // SDU 가 CSP 를 이긴다. 따로 재면 이 대상이 두 필터를 모두 맞아 일곱 탭으로 떨어지고,
    // 스캔 탭이 사라져 수신자 카드가 설 자리를 잃는다.
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ cloud_provider: 'IDC', metadata: { is_sdu_type: true } }),
    );
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    const tabs = await tabNames();
    expect(tabs).toHaveLength(8);
    expect(tabs).toContain('스캔');
    expect(tabs).not.toContain('연동 요청 정보');
  });

  it('?tab=request 로 들어오면 진행 상태가 그려지고 URL 도 따라 정리된다', async () => {
    window.history.replaceState(null, '', '/admin/pipelines/ops/target-sources/1099?tab=request');
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="연동 요청 정보" statusSlot={<div data-testid="status-slot" />} />);

    const status = await screen.findByRole('tab', { name: '진행 상태' });
    await waitFor(() => expect(status.getAttribute('aria-selected')).toBe('true'));
    // 화면만 고치고 URL 을 두면 새로고침·공유가 계속 없는 탭을 가리킨다.
    await waitFor(() => expect(window.location.search).toBe(''));
  });
});

describe('OpsTargetView — SDU 마스트헤드', () => {
  it('경로와 「환경」 셀이 이 대상을 SDU 라고 말한다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    expect(await screen.findByText('#1099')).toBeTruthy();
    // IDC 「환경」 셀과 같은 문법이다 (OpsTargetView.idc.test.tsx) — 한 행이 셋 다 든다:
    // 키(환경) · 값(데이터 직접 업로드) · 태그(SDU).
    const env = await screen.findByText('데이터 직접 업로드');
    expect(env.parentElement?.textContent).toContain('환경');
    expect(env.parentElement?.textContent).toContain('SDU');
  });

  it('밑에 깔린 CSP 계정을 사실처럼 적지 않는다', async () => {
    // 픽스처의 cloud_provider 는 'AWS' 이고 계정 ID 도 있다 — 그 계정은 존재하지만
    // 우리가 설치하는 계정이 아니라, 격자에 적으면 이 화면의 어느 동작도 건드리지
    // 않는 값을 대조 가능한 사실처럼 말하게 된다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    await screen.findByText('#1099');
    expect(screen.queryByText('계정')).toBeNull();
    expect(screen.queryByText('210987654321')).toBeNull();
  });
});

describe('OpsTargetView — SDU 진행 상태 탭', () => {
  it('담당자가 입력한 것이 카드 셋으로 서고 「승인 요청 내역」 은 없다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    // 셋을 다 잰다 — 하나만 단언하면 그룹이 다시 한 카드로 접혀도 통과한다.
    expect(await screen.findByRole('region', { name: '연동 대상 정의' })).toBeTruthy();
    expect(screen.getByRole('region', { name: '담당자 확인' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'S3 Access Key 수신자' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '승인 요청 내역' })).toBeNull();
    // 오른쪽 칸은 그대로 서버가 그린 연동 현황이다 — 다섯 행이 가리키는 탭이 SDU 에도
    // 전부 있으므로 이 카드는 SDU 에서도 제 몫을 한다.
    expect(screen.getByTestId('status-slot')).toBeTruthy();
    // 그 카드들이 읽는 것은 두 응답이다(계약 §3 + §5).
    await waitFor(() => expect(getSduDefinition).toHaveBeenCalled());
    await waitFor(() => expect(getSduUpload).toHaveBeenCalled());
  });

  it('한 조회가 거절돼도 다른 카드는 선다', async () => {
    // 정의만 저장하고 아직 제출하지 않은 대상이 이 모양이다. 카드마다 조회가 하나라
    // 그 독립은 이제 구조가 진다 — 한 실패로 둘 다 접으면 화면은 담당자가 아무것도
    // 입력하지 않았다고 말하게 된다.
    getSduUpload.mockRejectedValue(new Error('not submitted'));
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    expect(await screen.findByText('10.20.30.40')).toBeTruthy();
    expect(await screen.findByText('담당자 확인 정보를 불러오지 못했습니다.')).toBeTruthy();
    expect(await screen.findByText('수신자 정보를 불러오지 못했습니다.')).toBeTruthy();
  });

  it('「아니오」와 「미답」을 같은 말로 적지 않는다', async () => {
    // 계약 §5: `acked: false` 하나로는 둘이 구별되지 않는다. 가르는 것은 `ackedAt` 이다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    const firewall = await screen.findByText('방화벽 결재 확인');
    const firewallValue = firewall.nextElementSibling;
    expect(firewallValue?.textContent).toContain('아니오');
    // 답이 있으면 누가·언제도 같이 선다.
    expect(firewallValue?.textContent).toContain('홍길동');

    const commands = screen.getByText('데이터 업로드 확인');
    expect(commands.nextElementSibling?.textContent).toBe('미답');
  });
});

describe('OpsTargetView — SDU 스캔 탭', () => {
  it('권한 카드가 아니라 수신자 카드가 선다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="스캔" statusSlot={<div data-testid="status-slot" />} />);

    expect(await screen.findByRole('region', { name: 'S3 Access Key 수신자' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: '스캔 권한' })).toBeNull();
    // SDU 에는 검증할 role 이 없다 — 카드가 서지 않으면 그 조회도 돌지 않는다.
    expect(getAwsRoleVerification).not.toHaveBeenCalled();
  });

  it('밑에 깔린 CSP 가 IDC 여도 수신자 카드가 선다', async () => {
    // 탭 줄에서 한 번 이긴 규칙(SDU > CSP)이 탭 **안**에서도 이겨야 한다 — 그 갈래는
    // IDC 를 보고 카드 줄 전체를 건너뛰므로, 지는 순간 명부가 화면에서 사라진다.
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ cloud_provider: 'IDC', metadata: { is_sdu_type: true } }),
    );
    render(<OpsTargetView targetSourceId={1099} initialTab="스캔" statusSlot={<div data-testid="status-slot" />} />);

    expect(await screen.findByRole('region', { name: 'S3 Access Key 수신자' })).toBeTruthy();
  });
});

describe('OpsTargetView — SDU 확정 정보 탭', () => {
  /**
   * 탭이 제 축을 스스로 세우지 않는다 — `normalizeCloudProvider('SDU')` 는 'AWS' 라
   * provider 로는 SDU 가 잡히지 않으므로, 이 화면이 내린 판정이 실제로 내려가는지를
   * 여기서 잰다. 판정 자체는 `tabs/__tests__/ConfirmTab.sdu.test.tsx` 가 진다.
   */
  it('밴드 없이 pane 하나가 서고, 요청 조회도 돌지 않는다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="확정 정보" statusSlot={<div data-testid="status-slot" />} />);

    // pane 이 곧 탭 본문이다.
    expect(await screen.findByText('확정 정보')).toBeTruthy();
    // 한 칸짜리 tablist 도 만들지 않는다 — 누를 때마다 보고 있는 것을 다시 고를 뿐이다.
    expect(screen.queryByRole('tablist', { name: '확정 정보 축' })).toBeNull();
    expect(screen.queryByText('연동 요청 확인 (1,2단계)')).toBeNull();
    // 없는 축에 대해 사실을 말하지 않는다 — 「요청 없음」은 승인이 가능한 대상의 말이다.
    expect(screen.queryByText('요청 없음')).toBeNull();
    expect(getApprovalRequestLatest).not.toHaveBeenCalled();
  });
});

describe('OpsTargetView — SDU 인프라 작업 탭', () => {
  /**
   * 작업 시작 게이트의 마지막 갈래. 다른 대상에서 그 문장은 「확정 정보 탭에서 확정하면」
   * 이라는 **지시**인데, SDU 에는 확정 정보를 넣는 쓰기 경로가 계약에 없어 그 탭이 읽기
   * 전용이다 — 보내 봐야 누를 것이 없다. 문장 자체는 `gateStage.test.ts` 가 재고, 여기서는
   * 판정이 실제로 그 탭까지 내려가는지를 본다.
   */
  it('확정 대기는 지시가 아니라 기다림으로 말하고, 갈 곳을 주지 않는다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="인프라 작업" statusSlot={<div data-testid="status-slot" />} />);

    // `GateSentence` 가 「작업 시작」을 굵게 하려고 문장을 쪼갠다 — 이어 붙인 텍스트로 잰다.
    await waitFor(() =>
      expect(document.body.textContent).toContain('확정되면 여기서 작업 시작이 열립니다'),
    );
    expect(document.body.textContent).not.toContain('확정 정보 탭에서 확정하면');
    expect(screen.queryByRole('button', { name: /확정 정보 탭으로/ })).toBeNull();
  });
});

describe('OpsTargetView — SDU 연동 초기화 탭', () => {
  /**
   * 되돌릴 수 없는 동작의 마지막 확인이라, **무엇이 사라지는가**를 대상 종류가 정한다
   * (계약 §8). 문장 자체는 `DangerTab.test.tsx` 가 전수로 재고, 여기서는 그 판정이
   * 실제로 내려가는지만 본다 — 탭이 제 손으로 다시 세우면 provider 로는 SDU 를 못 찾는다.
   */
  it('SDU 의 초기화 안내가 선다 — 정의는 남는다고 말한다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="연동 초기화" statusSlot={<div data-testid="status-slot" />} />);

    expect(await screen.findByText(/연동 대상 정의는 남습니다/)).toBeTruthy();
    expect(screen.queryByText(/연동 대상 DB 선택부터 다시 진행합니다/)).toBeNull();
  });
});

describe('OpsTargetView — SDU 가 아닌 대상', () => {
  const nonSdu = () =>
    detail({
      target_source_id: 1006,
      service_name: 'AWS',
      service_code: 'aws',
      metadata: { is_sdu_type: false, aws_account_id: '451814760281' },
    });

  it('아홉 탭 그대로다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(nonSdu());
    render(<OpsTargetView targetSourceId={1006} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    const tabs = await tabNames();
    expect(tabs).toHaveLength(9);
    expect(tabs).toContain('연동 요청 정보');
  });

  it('진행 상태는 「승인 요청 내역」 을, 스캔은 권한 카드를 유지한다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(nonSdu());
    const { unmount } = render(<OpsTargetView targetSourceId={1006} initialTab="진행 상태" statusSlot={<div data-testid="status-slot" />} />);

    expect(await screen.findByRole('region', { name: '승인 요청 내역' })).toBeTruthy();
    // SDU 의 카드 셋은 어느 하나도 서지 않는다.
    expect(screen.queryByRole('region', { name: '연동 대상 정의' })).toBeNull();
    expect(screen.queryByRole('region', { name: '담당자 확인' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'S3 Access Key 수신자' })).toBeNull();
    unmount();

    render(<OpsTargetView targetSourceId={1006} initialTab="스캔" statusSlot={<div data-testid="status-slot" />} />);
    expect(await screen.findByRole('region', { name: '스캔 권한' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'S3 Access Key 수신자' })).toBeNull();
  });
});

describe('OpsTargetView — SDU 관리자 승인 탭', () => {
  /**
   * SDU 담당자는 5단계 완료 승인 요청을 누르는 화면 자체를 걷지 않는다. 조건 ① 이 그것을
   * 기다리면 CTA 는 영원히 잠겨 SDU 대상이 7단계에 닿지 못한다 — 탭을 세우고도 막다른
   * 길인 셈이라, 계약 §9.1 이 정한 대체(방화벽 · 업로드 · 수신자)가 여기 걸려 있는지를
   * 화면에서 확인한다.
   */
  it('조건 ① 이 담당자 확인 셋을 읽고, 근거 행이 누가·언제까지 말한다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="관리자 승인" statusSlot={<div data-testid="status-slot" />} />);

    // 요건문이 SDU 의 것으로 선다 — 있지도 않은 버튼을 기다리게 만들지 않는다.
    expect(await screen.findByText('담당자 확인과 수신자 등록이 완료되어야 합니다')).toBeTruthy();
    expect(screen.queryByText('연결 테스트 완료 승인을 요청해야 합니다')).toBeNull();

    // 근거 행 셋 — 확인 둘은 답 + 누가 · 언제, 수신자는 수.
    const firewall = await screen.findByText('방화벽 결재 확인');
    expect(firewall.nextElementSibling?.textContent).toContain('아니오');
    expect(firewall.nextElementSibling?.textContent).toContain('홍길동');
    // 저장된 「아니오」가 미답으로 읽히면 근거 행이 없는 사실을 말한다.
    expect(firewall.nextElementSibling?.textContent).not.toContain('미답');

    const commands = screen.getByText('데이터 업로드 확인');
    expect(commands.nextElementSibling?.textContent).toBe('미답');

    expect(screen.getByText('S3 Access Key 수신자').nextElementSibling?.textContent).toBe('1명');
  });

  it('세 확인이 다 서면 조건 ① 이 충족된다 — 완료 승인 요청은 끝내 오지 않는다', async () => {
    getSduUpload.mockResolvedValueOnce({
      ...UPLOAD,
      firewall: { ...UPLOAD.firewall, acked: true },
      commands: { ...UPLOAD.commands, acked: true, ackedAt: '2026-08-25T11:00:00Z' },
    });
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="관리자 승인" statusSlot={<div data-testid="status-slot" />} />);

    // ✓ 충족 — tcStatus 는 이 파일 내내 null 이다.
    await waitFor(() => expect(screen.getAllByTitle('충족').length).toBeGreaterThan(0));
  });

  /**
   * 조건 ③ 도 ① 과 같은 막다른 길을 갖고 있었다.
   *
   * §10 dag-status 는 응답이 MB 단위라 **읽을 사람이 생겼을 때만** 부른다. 그 "독자"의
   * 조건이 `TEST_CONNECTION_COMPLETED` 하나였는데, 그것은 SDU 담당자가 누를 수 없는
   * 버튼이다(§0) — 조회가 영영 돌지 않으니 헬스는 `loading` 에 멈추고, ①·② 를 통과한
   * 대상에서도 머리는 「헬스 확인 중」, 연동 완료는 잠긴 채였다.
   *
   * 늦춤 자체는 옳아서 지킨다 — 바뀐 것은 독자를 알아보는 방법뿐이다. 그래서 이 축은
   * 둘을 함께 잰다: SDU 에서는 **승인 탭을 연 것만으로** 조회가 돌고, SDU 가 아닌
   * 대상에서는 여전히 돌지 않는다.
   */
  it('승인 탭을 열면 헬스를 조회한다 — Airflow 탭을 먼저 들르지 않아도', async () => {
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="관리자 승인" statusSlot={<div data-testid="status-slot" />} />);

    await waitFor(() => expect(getDagStatus).toHaveBeenCalled());
    // 조회가 끝났으므로 머리는 「확인 중」에 머물지 않는다 — 이 픽스처는 거절이라 '확인
    // 실패'다. 어느 쪽이든 판정을 내렸다는 것이 요점이고, 잠긴 채 굳지 않는다는 뜻이다.
    await waitFor(() =>
      expect(screen.queryByText('모니터링 상태를 확인하고 있어요.')).toBeNull(),
    );
  });

  it('세 조건이 다 서면 연동 완료가 열린다', async () => {
    getSduUpload.mockResolvedValueOnce(UPLOAD_MET);
    fetchLatestTest.mockResolvedValue({ connection_status: 'SUCCESS' });
    getDagStatus.mockResolvedValue(DAG_HEALTHY);
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="관리자 승인" statusSlot={<div data-testid="status-slot" />} />);

    // 머리가 셋을 다 통과했다고 말하고, CTA 가 실제로 눌린다.
    expect(await screen.findByText('세 조건이 모두 충족됐어요 — 설치를 완료 처리할 수 있어요.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '연동 완료' }).hasAttribute('disabled')).toBe(false);

    // 그리고 카드 ③ 이 머리와 같은 말을 한다 — 예전에는 이 상태에서도 카드만 미점검이었다.
    const gate3 = within(screen.getByRole('region', { name: '승인 조건 3' }));
    expect(gate3.getByTitle('충족')).toBeTruthy();
    expect(gate3.queryByText('완료 승인 후 점검합니다')).toBeNull();
  });

  it('조건 ① 이 아직이면 카드 ③ 은 담당자 확인을 가리킨다 — 완료 승인이 아니라', async () => {
    // 기본 픽스처는 방화벽 「아니오」 — ① 미충족이다. 이 자리의 문장이 「완료 승인 후」면
    // SDU 관리자는 아무도 누를 수 없는 버튼을 기다리게 된다.
    getRawTargetSourceDetail.mockResolvedValue(detail());
    render(<OpsTargetView targetSourceId={1099} initialTab="관리자 승인" statusSlot={<div data-testid="status-slot" />} />);

    const gate3 = within(await screen.findByRole('region', { name: '승인 조건 3' }));
    expect(await gate3.findByText('담당자 확인 후 점검합니다')).toBeTruthy();
    expect(gate3.queryByText('완료 승인 후 점검합니다')).toBeNull();
  });

  it('SDU 가 아닌 대상의 조건 ① 은 그대로 완료 승인 요청이다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ target_source_id: 1006, metadata: { is_sdu_type: false } }),
    );
    render(<OpsTargetView targetSourceId={1006} initialTab="관리자 승인" statusSlot={<div data-testid="status-slot" />} />);

    expect(await screen.findByText('연결 테스트 완료 승인을 요청해야 합니다')).toBeTruthy();
    expect(screen.queryByText('방화벽 결재 확인')).toBeNull();
    // 그 대상에서는 §5 를 부르지도 않는다 — 다른 대상에게 이 응답은 404 다.
    expect(getSduUpload).not.toHaveBeenCalled();
  });

  it('SDU 가 아닌 대상의 초기화 안내는 그대로다', async () => {
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ target_source_id: 1006, metadata: { is_sdu_type: false } }),
    );
    render(<OpsTargetView targetSourceId={1006} initialTab="연동 초기화" statusSlot={<div data-testid="status-slot" />} />);

    expect(await screen.findByText(/연동 대상 DB 선택부터 다시 진행합니다/)).toBeTruthy();
    expect(screen.queryByText(/연동 대상 정의는 남습니다/)).toBeNull();
  });

  it('SDU 가 아닌 대상의 헬스 조회는 그대로 미뤄진다', async () => {
    // 늦춤이 사라지면 안 된다 — §10 응답은 MB 단위라, 완료 승인 전의 대상에서 승인 탭을
    // 여는 것만으로 받아 오면 이 화면이 그만큼 늦는다.
    getRawTargetSourceDetail.mockResolvedValue(
      detail({ target_source_id: 1006, metadata: { is_sdu_type: false } }),
    );
    render(<OpsTargetView targetSourceId={1006} initialTab="관리자 승인" statusSlot={<div data-testid="status-slot" />} />);

    const gate3 = within(await screen.findByRole('region', { name: '승인 조건 3' }));
    expect(await gate3.findByText('완료 승인 후 점검합니다')).toBeTruthy();
    expect(getDagStatus).not.toHaveBeenCalled();
  });
});
