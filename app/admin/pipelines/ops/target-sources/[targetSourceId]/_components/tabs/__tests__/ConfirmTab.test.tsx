// @vitest-environment jsdom
/**
 * 확정 정보 탭의 축은 둘이다 — 연동 요청 확인 · 확정 정보.
 *
 * 2026-08-30 오너 지시로 셋째 축(설치 · Terraform)이 이 탭에서 빠졌다. 같은 릴리스에서
 * 인프라 작업 탭이 그 상태를 소유했기 때문이다. 여기 첫 두 테스트가 트립와이어다 —
 * 다음 라운드가 조용히 되돌리지 못하게 밴드 칸 수와 어휘를 함께 잰다.
 *
 * 세 번째·네 번째는 그 반대편을 지킨다: terraform-status 콜 자체는 남았고, 남은 이유가
 * `latest_confirmed_at`(확정 시각) 하나라는 것. 확정 계약(`{ resource_infos }`)에는
 * 시각이 없어서 이 화면의 확정 시각은 그 응답에만 있다.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { ConfirmedIntegrationResponse, TerraformStatusResponse } from '@/app/lib/api';

const getApprovalRequestLatest = vi.fn();
const getConfirmedIntegration = vi.fn();
const getTerraformStatus = vi.fn();

vi.mock('@/app/lib/api/task-queue-requests', async (importOriginal) => {
  // 요청 pane 은 이 모듈의 순수 헬퍼(idcAddressKind 등)를 계속 쓴다 — fetch 만 세운다.
  const mod = await importOriginal<typeof import('@/app/lib/api/task-queue-requests')>();
  return {
    ...mod,
    getApprovalRequestLatest: (...args: unknown[]) => getApprovalRequestLatest(...args),
    getNlbTable: async () => [],
    getNlbIndexMappings: async () => [],
  };
});
vi.mock('@/app/lib/api', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/app/lib/api')>();
  return {
    ...mod,
    getConfirmedIntegration: (...args: unknown[]) => getConfirmedIntegration(...args),
    getTerraformStatus: (...args: unknown[]) => getTerraformStatus(...args),
  };
});

import { ConfirmTab } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ConfirmTab';

const CSP: RawTargetSourceDetail = { cloud_provider: 'AWS' };
/**
 * SDU 대상. `cloud_provider` 는 여전히 'AWS' 다 — 계약이 SDU 를 말하는 자리는 둘이고
 * (`metadata.is_sdu_type` · enum 의 `SDU`), 밑에 깔린 CSP 는 그대로 온다. 이 대상에는
 * 확정 리소스 **쓰기 경로가 없어서**(`resolveWriteProvider`) pane 이 읽기 전용으로 선다.
 */
const SDU: RawTargetSourceDetail = {
  cloud_provider: 'AWS',
  metadata: { is_sdu_type: true },
} as RawTargetSourceDetail;

const confirmedRow = (index: number): ConfirmedIntegrationResponse['resource_infos'][number] => ({
  resource_id: `res-${index}`,
  resource_type: 'RDS',
  database_type: 'mysql',
  database_region: 'ap-northeast-2',
  resource_name: `confirmed-${index}`,
  port: 3306,
  host: `db-${index}.example.internal`,
  oracle_service_id: null,
  network_interface_id: null,
  ip_configuration: null,
  athena_region_resource_id: null,
  credential_id: 'cred-1',
});

/** 확정 시각의 유일한 출처. 08-14 14:00 KST. */
const CONFIRMED_AT = '2026-08-14T05:00:00Z';

const terraformStatus = (): TerraformStatusResponse => ({
  overall_state: 'APPLIED',
  latest_confirmed_at: CONFIRMED_AT,
  checked_at: '2026-08-15T05:00:00Z',
  tasks: [
    {
      terraform_task_name: 'vpc-peering',
      state: 'APPLIED',
      terraform_execution_side: 'PII_AGENT',
    },
  ],
});

/** 기본은 **SDU 가 아닌** 대상이다 — 이 파일의 밴드 단언이 서는 유일한 조건이다. */
const mount = (isSdu = false, processStatus: 'CONNECTED' | 'CONFIRMING' = 'CONNECTED') =>
  render(
    <ConfirmTab
      targetSourceId={1642}
      detail={isSdu ? SDU : CSP}
      processStatus={processStatus}
      isSdu={isSdu}
      onOpenInfra={vi.fn()}
    />,
  );

describe('ConfirmTab 밴드', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApprovalRequestLatest.mockResolvedValue({
      request: {
        requestId: 12,
        status: 'APPROVED',
        requestedBy: 'ops',
        requestedAt: '2026-08-10T05:00:00Z',
      },
      resources: [],
      verdict: { status: 'APPROVED', processedBy: 'admin', processedAt: '2026-08-11T05:00:00Z' },
    });
    getConfirmedIntegration.mockResolvedValue({
      resource_infos: [confirmedRow(0), confirmedRow(1)],
    });
    getTerraformStatus.mockResolvedValue(terraformStatus());
  });

  it('축은 둘이다 — 설치 (Terraform) 칸은 없다', async () => {
    mount();

    const band = await screen.findByRole('tablist', { name: '확정 정보 축' });
    expect(within(band).getAllByRole('tab')).toHaveLength(2);
    expect(within(band).getByRole('tab', { name: /연동 요청 확인/ })).toBeTruthy();
    expect(within(band).getByRole('tab', { name: /확정 정보/ })).toBeTruthy();
    expect(within(band).queryByRole('tab', { name: /설치/ })).toBeNull();
  });

  it('Terraform 어휘가 화면 어디에도 없다', async () => {
    const { container } = mount();

    await screen.findByRole('tablist', { name: '확정 정보 축' });
    // 응답에는 overall_state·task 가 실려 있는데도 — 그 축은 인프라 작업 탭이 소유한다.
    expect(container.textContent).not.toContain('Terraform');
    expect(screen.queryByText('vpc-peering')).toBeNull();
  });

  it('확정 시각이 확정 정보 칸과 pane 에 닿는다 — 이 콜이 남은 유일한 이유', async () => {
    mount();

    const band = await screen.findByRole('tablist', { name: '확정 정보 축' });
    expect(within(band).getByRole('tab', { name: /확정 정보/ }).textContent).toContain(
      '리소스 2건 · 08-14',
    );
    // 기본 선택 칸은 확정 정보다 — pane 머리가 같은 시각을 전체 형태로 다시 말한다.
    expect(screen.getByText(/리소스 2건 · 2026-08-14 14:00 등록/)).toBeTruthy();
    expect(getTerraformStatus).toHaveBeenCalledWith(1642);
  });

  it('terraform 조회가 실패하면 배너 대신 그 칸이 무엇이 없는지 말한다', async () => {
    getTerraformStatus.mockRejectedValue(new Error('boom'));
    mount();

    const band = await screen.findByRole('tablist', { name: '확정 정보 축' });
    const confirmCell = within(band).getByRole('tab', { name: /확정 정보/ });
    // 잃는 것은 날짜 한 칸이라 배너를 올리지 않는다.
    expect(confirmCell.textContent).toContain('리소스 2건');
    expect(screen.queryByText('일부 정보를 불러오지 못했습니다.')).toBeNull();
    // 그렇다고 침묵하지도 않는다 — `리소스 2건` 만 남으면 "시각 없는 확정"과 구분이 안 된다.
    expect(confirmCell.textContent).toContain('확정 시각 불러오지 못함');
  });

  /**
   * 확정 pane 머리의 문은 둘이다 — 입력과 삭제. 삭제가 편집기 안의 모드였을 때는 지우려는
   * 사람이 편집기를 먼저 열어야 했다. 그 배치로 돌아가면 이 단언들이 먼저 깨진다.
   *
   * 등록이 있는 동안 입력 문은 자리를 지키되 잠긴다 — 고쳐 쓰는 길은 없고 지운 뒤 다시
   * 넣는다(오너 2026-09-03). 잠금은 native `disabled` 가 아니라 `aria-disabled` 다:
   * 사유 툴팁이 hover 로도 포커스로도 닿아야 하는데 native disabled 는 둘 다 끊는다.
   */
  it('확정이 있으면 두 문이 서고, 입력 문은 잠긴 채로 선다', async () => {
    mount();

    const del = await screen.findByRole('button', { name: '확정 정보 삭제' });
    expect(del.getAttribute('aria-disabled')).toBeNull();

    // 「수정」이라는 낱말은 이 머리줄에서 사라졌다.
    expect(screen.queryByRole('button', { name: '확정 정보 수정' })).toBeNull();
    const input = screen.getByRole('button', { name: '확정 정보 입력' });
    expect(input.getAttribute('aria-disabled')).toBe('true');
  });

  it('확정이 없으면 지울 것도 없다 — 열린 입력 문 하나뿐이다', async () => {
    getConfirmedIntegration.mockResolvedValue({ resource_infos: [] });
    mount();

    const input = await screen.findByRole('button', { name: '확정 정보 입력' });
    expect(input.getAttribute('aria-disabled')).toBeNull();
    expect(screen.queryByRole('button', { name: '확정 정보 삭제' })).toBeNull();
  });

  it('요청 조회가 실패하면 오류 배너를 올린다', async () => {
    getApprovalRequestLatest.mockRejectedValue(new Error('boom'));
    mount();

    expect(await screen.findByText('일부 정보를 불러오지 못했습니다.')).toBeTruthy();
  });
});

/**
 * SDU 에는 밴드가 없다.
 *
 * 승인 단계가 없어(계약 §0, 제출이 곧 1 → 4) 요청이 만들어지지 않으므로 그 축은 비어 있는
 * 것이 아니라 **존재하지 않는다**. 남는 한 축을 위해 밴드를 세우면 누를 때마다 이미 보고
 * 있는 것을 다시 고르는 tablist 가 되고, 그것은 열리지 않는 버튼과 같은 결함이다. pane 이
 * 제 머리(제목 · 건수 · 시각)를 이미 가지고 있어 잃는 사실도 없다.
 *
 * 축을 거두는 일은 조회를 건너뛰는 일이기도 해서 두 파생값이 함께 걸린다: `booting` 이
 * 요청 상태를 읽고(로딩으로 두면 탭이 영영 스켈레톤), 실패 배너도 그 상태를 읽는다
 * (부르지 않은 조회는 실패가 아니다).
 */
describe('ConfirmTab — SDU 에는 밴드가 없다', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getApprovalRequestLatest.mockResolvedValue(null);
    getConfirmedIntegration.mockResolvedValue({
      resource_infos: [confirmedRow(0), confirmedRow(1)],
    });
    getTerraformStatus.mockResolvedValue(terraformStatus());
  });

  it('밴드도 칸도 없고, pane 이 곧 탭 본문이다', async () => {
    mount(true);

    // pane 은 선다.
    expect(await screen.findByText('확정 정보')).toBeTruthy();
    // 밴드는 서지 않는다 — 한 칸짜리 tablist 도 만들지 않는다.
    expect(screen.queryByRole('tablist', { name: '확정 정보 축' })).toBeNull();
    expect(screen.queryByRole('tab')).toBeNull();
    expect(screen.queryByText('연동 요청 확인 (1,2단계)')).toBeNull();
    // 없는 축에 대해 사실을 말하지 않는다 — 「요청 없음」은 승인이 가능한 대상의 말이다.
    expect(screen.queryByText('요청 없음')).toBeNull();
  });

  it('없는 축을 부르지 않는다', async () => {
    mount(true);

    await screen.findByText('확정 정보');
    expect(getApprovalRequestLatest).not.toHaveBeenCalled();
    expect(getConfirmedIntegration).toHaveBeenCalled();
  });

  it('부르지 않은 조회가 로딩으로도 실패로도 읽히지 않는다', async () => {
    mount(true);

    await waitFor(() => expect(screen.queryByText('불러오는 중')).toBeNull());
    expect(screen.queryByText('일부 정보를 불러오지 못했습니다.')).toBeNull();
  });

  it('판정 문장이 승인을 입에 담지 않는다', async () => {
    // 설치 전 · 확정 0건 — 판정이 요청 축을 읽는 유일한 갈래다(설치가 끝나면 다른 모든
    // 입력을 이긴다).
    getConfirmedIntegration.mockResolvedValue({ resource_infos: [] });
    mount(true, 'CONFIRMING');

    expect(await screen.findByText('확정 정보가 필요합니다')).toBeTruthy();
    // 기본 문장(「승인된 리소스를 기준으로…」)도, 빈 pane 의 안내도 이 대상에서는 거짓이다.
    expect(screen.queryByText(/승인된 리소스를 기준으로/)).toBeNull();
    expect(screen.queryByText(/아직 승인 요청이 없습니다/)).toBeNull();
  });

  /**
   * 밴드가 나르던 사실 하나가 pane 으로 옮겨 왔다. 확정은 읽혔는데 `latest_confirmed_at`
   * 만 없는 상태를 pane 머리가 그냥 생략하면 「시각 없는 확정」과 구별되지 않는다 —
   * `리소스 2건` 만 남은 프레임이 정확히 그 모양이다.
   */
  it('확정 시각만 못 읽었을 때 pane 이 그 자리에서 말한다', async () => {
    getTerraformStatus.mockRejectedValue(new Error('boom'));
    mount(true);

    // 건수는 그대로 서고, 빈 날짜 자리가 왜 비었는지를 그 옆에서 말한다.
    expect(await screen.findByText('리소스 2건 · 확정 시각 불러오지 못함')).toBeTruthy();
    // 그리고 이 실패는 탭 전체의 배너를 올리지 않는다(잃는 것이 날짜 한 칸이다).
    expect(screen.queryByText('일부 정보를 불러오지 못했습니다.')).toBeNull();
  });

  /**
   * 스켈레톤은 정착 프레임의 컨테이너를 그대로 쓴다 — 그래서 **없는 머리도 그리면 안 된다.**
   * 그리면 도착하는 순간 pane 이 밴드 높이만큼 위로 뛴다.
   */
  it('도착 전에도 밴드 자리를 잡아 두지 않는다', async () => {
    // 영영 안 오는 응답 — `booting` 프레임을 붙잡아 둔다.
    getConfirmedIntegration.mockReturnValue(new Promise(() => {}));
    const { container } = mount(true);

    expect(await screen.findByText('불러오는 중')).toBeTruthy();
    // `styles.band` 의 트랙 클래스. 이 프레임에서 그것을 쓰는 것은 밴드뿐이다.
    expect(container.querySelector('.grid-cols-2')).toBeNull();
  });

  /**
   * 같은 인스턴스가 다른 대상을 받는 경로(라우트 파라미터만 바뀐다). 요청 칸을 고른 채로
   * 축이 빠지면 고른 칸은 화면에 없고, 아무 pane 도 조건을 맞추지 못해 셸 안이 통째로 빈다.
   */
  it('요청 칸을 고른 채 SDU 로 바뀌어도 pane 은 선다', async () => {
    const { rerender } = mount(false);

    fireEvent.click(await screen.findByRole('tab', { name: /연동 요청 확인/ }));
    // 이 describe 의 픽스처는 요청이 없는 대상이라 RequestPane 은 제 빈 상태로 선다 —
    // 그 문장이 이 pane 이 화면에 있다는 표시다.
    expect(await screen.findByText('승인 요청 이력이 없습니다.')).toBeTruthy();

    rerender(
      <ConfirmTab
        targetSourceId={1642}
        detail={SDU}
        processStatus="CONNECTED"
        isSdu
        onOpenInfra={vi.fn()}
      />,
    );

    expect(await screen.findByText('확정 정보')).toBeTruthy();
    expect(screen.queryByRole('tablist', { name: '확정 정보 축' })).toBeNull();
    expect(screen.queryByText('승인 요청 이력이 없습니다.')).toBeNull();
  });

  it('밴드가 서는 대상에서는 pane 이 그 말을 되풀이하지 않는다', async () => {
    // 그 대상에서는 확정 칸이 이미 말한다 — pane 이 또 적으면 같은 사실이 두 벌이 된다.
    getTerraformStatus.mockRejectedValue(new Error('boom'));
    mount(false);

    const band = await screen.findByRole('tablist', { name: '확정 정보 축' });
    expect(within(band).getByText(/확정 시각 불러오지 못함/)).toBeTruthy();
    expect(screen.getAllByText(/확정 시각 불러오지 못함/)).toHaveLength(1);
  });
});
