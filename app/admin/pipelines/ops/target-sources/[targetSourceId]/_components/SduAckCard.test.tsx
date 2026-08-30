// @vitest-environment jsdom
/**
 * 「담당자 확인」 카드의 제 축 (계약 §5).
 *
 * 뷰를 통과하는 경로로는 닿지 않는 것이 둘이다:
 *
 *  1. **무효화 배지**(§3.1). 원인이 둘(Region 추가 · 업로드 IP 변경)이고 서로 다른 문장을
 *     쓰며, **동시에 참일 수 있다** — 계약이 `added_regions` 는 합집합으로,
 *     `upload_ip_changed` 는 OR 로 쌓으라고 못박은 자리다. 한 저장이 지운 답의 이유가
 *     사라지면 관리자는 설명 없이 비어 있는 확인 줄을 본다.
 *  2. **답과 출처의 경계**. 값(예/아니오)과 그 답을 남긴 사람·시각은 다른 사실이라,
 *     글자 흐름에서도 갈라져야 한다 — 여백만으로 가르면 텍스트는 「예홍길동」이 된다.
 */
import { render, screen, waitFor } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SduAckCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduAckCard';
import type { SduUpload } from '@/lib/types/sdu';

const getSduUpload = vi.fn();
const putSduBdcCompletion = vi.fn();
vi.mock('@/app/lib/api/sdu', () => ({
  getSduDefinition: vi.fn(),
  getSduUpload: (...args: unknown[]) => getSduUpload(...args),
  putSduBdcCompletion: (...args: unknown[]) => putSduBdcCompletion(...args),
}));

// 완료 모달이 여는 순간 읽는 둘 — 「연동 현황」 카드가 서버에서 하는 조회라 브라우저에는
// 값이 없다. 기본은 「아직 아무것도 안 돌았다」이고, 케이스가 필요하면 갈아 끼운다.
const getLatestScanJob = vi.fn();
vi.mock('@/app/lib/api/scan', () => ({
  getLatestScanJob: (...args: unknown[]) => getLatestScanJob(...args),
}));
const getTerraformStatus = vi.fn();
vi.mock('@/app/lib/api', () => ({
  getTerraformStatus: (...args: unknown[]) => getTerraformStatus(...args),
}));

const upload = (over: Partial<SduUpload> = {}): SduUpload => ({
  submittedAt: '2026-08-24T05:41:00Z',
  regions: ['us'],
  firewall: {
    rows: [],
    acked: false,
    ackedAt: '2026-08-25T10:40:00Z',
    ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
  },
  accessKeyRecipients: {
    users: [{ id: 'user-3', name: '이영희', email: 'lee@company.com' }],
    updatedAt: '2026-08-24T07:41:00Z',
  },
  commands: { rows: [], acked: false, ackedAt: null, ackedBy: null },
  bdc: { status: 'NOT_STARTED', checkedAt: '2026-08-24T07:50:00Z', completedAt: null, completedBy: null },
  invalidation: { addedRegions: [], uploadIpChanged: false },
  ...over,
});

const onBdcChanged = vi.fn();

const draw = (): void => {
  render(<SduAckCard targetSourceId={1100} onBdcChanged={onBdcChanged} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  getSduUpload.mockResolvedValue(upload());
  putSduBdcCompletion.mockResolvedValue(undefined);
  getLatestScanJob.mockResolvedValue({
    scan_status: 'SUCCESS',
    updated_at: '2026-08-29T05:00:00Z',
    resource_count_by_resource_type: { RDS: 41 },
  });
  getTerraformStatus.mockResolvedValue({
    has_confirmed_infra: true,
    latest_confirmed_at: '2026-08-29T06:00:00Z',
    checked_at: '2026-08-30T00:00:00Z',
    tasks: [
      { terraform_task_name: 'SDU_BDC_SERVICE_COMMON', state: 'APPLIED' },
      { terraform_task_name: 'SDU_BDC_SERVICE', state: 'NEVER_APPLIED' },
    ],
  });
});

describe('SduAckCard — 답과 출처', () => {
  it('「아니오」와 「미답」을 같은 말로 적지 않는다', async () => {
    // 계약 §5: `acked: false` 하나로는 둘이 구별되지 않는다. 가르는 것은 `ackedAt` 이다.
    draw();

    const firewall = await screen.findByText('방화벽 결재 확인');
    expect(firewall.nextElementSibling?.textContent).toContain('아니오');
    expect(firewall.nextElementSibling?.textContent).toContain('홍길동');
    expect(screen.getByText('데이터 업로드 확인').nextElementSibling?.textContent).toBe('미답');
  });

  it('답과 출처가 한 낱말로 붙지 않는다', async () => {
    getSduUpload.mockResolvedValue(
      upload({
        firewall: {
          rows: [],
          acked: true,
          ackedAt: '2026-08-25T10:40:00Z',
          ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
        },
      }),
    );
    draw();

    const value = (await screen.findByText('방화벽 결재 확인')).nextElementSibling;
    // 여백은 눈에만 있다 — 낭독과 복사가 읽는 것은 이 문자열이다.
    expect(value?.textContent).not.toContain('예홍길동');
    expect(value?.textContent).toContain('예 · 홍길동');
  });

  it('미답에는 붙일 사람도 시각도 없다 — 구분자도 서지 않는다', async () => {
    draw();

    await screen.findByText('방화벽 결재 확인');
    expect(screen.getByText('데이터 업로드 확인').nextElementSibling?.textContent).toBe('미답');
  });
});

describe('SduAckCard — 무효화 배지 (§3.1)', () => {
  it('Region 추가는 두 확인이 초기화됐다고 말한다', async () => {
    getSduUpload.mockResolvedValue(
      upload({ invalidation: { addedRegions: ['eu'], uploadIpChanged: false } }),
    );
    draw();

    const note = await screen.findByText(/Region 추가/);
    expect(note.textContent).toContain('EU');
    expect(note.textContent).toContain('방화벽 결재 확인과 데이터 업로드 확인이 초기화됐습니다');
    // 업로드 IP 문장은 서지 않는다 — 그 저장이 한 일이 아니다.
    expect(screen.queryByText(/업로드 IP 변경/)).toBeNull();
  });

  it('업로드 IP 변경은 방화벽만 초기화한다 — 업로드 확인은 살아남는다', async () => {
    getSduUpload.mockResolvedValue(
      upload({ invalidation: { addedRegions: [], uploadIpChanged: true } }),
    );
    draw();

    const note = await screen.findByText(/업로드 IP 변경/);
    expect(note.textContent).toContain('방화벽 결재 확인이 초기화됐습니다');
    expect(screen.queryByText(/Region 추가/)).toBeNull();
  });

  it('둘 다 참이면 두 문장이 함께 선다 — 저장이 여러 번이면 안내는 쌓인다', async () => {
    getSduUpload.mockResolvedValue(
      upload({ invalidation: { addedRegions: ['asia', 'eu'], uploadIpChanged: true } }),
    );
    draw();

    // 정규 순서로 선다 (asia → eu).
    const regions = await screen.findByText(/Region 추가/);
    expect(regions.textContent).toContain('Asia, EU');
    expect(screen.getByText(/업로드 IP 변경/)).toBeTruthy();
  });

  it('무효화가 없으면 배지도 없다', async () => {
    draw();

    await screen.findByText('방화벽 결재 확인');
    expect(screen.queryByText(/초기화됐습니다/)).toBeNull();
  });
});

describe('SduAckCard — 조회 실패', () => {
  it('거절되면 미답이 아니라 모른다고 말한다', async () => {
    // 정의만 저장하고 아직 제출하지 않은 대상이 이 모양이다.
    getSduUpload.mockRejectedValue(new Error('not submitted'));
    draw();

    expect(await screen.findByText('담당자 확인 정보를 불러오지 못했습니다.')).toBeTruthy();
    expect(screen.queryByText('미답')).toBeNull();
  });
});

/**
 * 2026-08-30 델타 — BDC 구축 완료는 **관리자의 단언**이다.
 *
 * 이 카드가 그 자리를 갖는 이유는 완료의 전제가 바로 위의 두 확인이기 때문이고, 그래서
 * 여기서 지켜야 할 것이 셋이다:
 *
 *  1. **문은 하나만 열린다.** 완료 전에는 완료 CTA, 완료 뒤에는 되돌리기 CTA — 둘이 함께
 *     서면 관리자는 어느 것이 현재 상태인지 버튼으로는 알 수 없다.
 *  2. **콘솔이 못 읽은 것은 체크로 위장하지 않는다.** Glue 는 판정 대신 못 읽는다는 한 줄을
 *     쓰고, 확인의 주체는 세 체크박스를 찍는 관리자다.
 *  3. **쓰기 뒤에는 다시 읽는다.** `bdc.status` 도 단계도 서버가 정하므로, 화면이 손으로
 *     세우면 400 뒤에도 완료가 그려진다.
 */
describe('SduAckCard — BDC 구축 완료 단언 (델타 §1·§3)', () => {
  /** 두 확인 「예」 + 수신자 1명 — 서버가 단언을 받아 주는 최소 상태 (델타 §4). */
  const assertable = (): SduUpload =>
    upload({
      firewall: {
        rows: [],
        acked: true,
        ackedAt: '2026-08-25T10:40:00Z',
        ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
      },
      commands: {
        rows: [],
        acked: true,
        ackedAt: '2026-08-26T09:00:00Z',
        ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
      },
      bdc: { status: 'IN_PROGRESS', checkedAt: '2026-08-30T00:00:00Z', completedAt: null, completedBy: null },
    });

  /** 모달을 여는 케이스가 쓰는 채비 — CTA 는 전제를 갖춰야 눌린다. */
  const openModal = async (): Promise<void> => {
    getSduUpload.mockResolvedValue(assertable());
    draw();
    fireEvent.click(await screen.findByRole('button', { name: 'BDC 구축 완료 처리' }));
  };

  const completed = (): SduUpload =>
    upload({
      firewall: {
        rows: [],
        acked: true,
        ackedAt: '2026-08-25T10:40:00Z',
        ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
      },
      commands: {
        rows: [],
        acked: true,
        ackedAt: '2026-08-26T09:00:00Z',
        ackedBy: { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
      },
      bdc: {
        status: 'COMPLETED',
        checkedAt: '2026-08-30T00:00:00Z',
        completedAt: '2026-08-29T08:00:00Z',
        completedBy: { id: 'admin-1', name: '관리자', email: 'admin@company.com' },
      },
    });

  it('완료 전에는 완료 CTA 만, 완료 뒤에는 되돌리기 CTA 만 선다', async () => {
    getSduUpload.mockResolvedValue(assertable());
    draw();
    expect(await screen.findByRole('button', { name: 'BDC 구축 완료 처리' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '구축 완료 되돌리기' })).toBeNull();

    getSduUpload.mockResolvedValue(completed());
    render(<SduAckCard targetSourceId={1101} onBdcChanged={onBdcChanged} />);
    expect(await screen.findByRole('button', { name: '구축 완료 되돌리기' })).toBeTruthy();
  });

  it('전제를 못 갖추면 CTA 가 잠기고, 무엇을 기다려야 하는지 말한다', async () => {
    // 기본 픽스처는 방화벽 「아니오」 · 업로드 미답이다 — 시작조차 못 한 BDC 다 (델타 §4).
    draw();

    const cta = (await screen.findByRole('button', {
      name: 'BDC 구축 완료 처리',
    })) as HTMLButtonElement;
    expect(cta.disabled).toBe(true);
    // ⛔ 이유 없는 비활성 버튼은 이 저장소가 반복해서 지적해 온 결함이다.
    expect(screen.getByText(/처리할 수 있어요/).textContent).toContain('S3 Access Key 수신자');

    // 눌러도 모달은 서지 않는다 — 잠긴 버튼이 잠긴 것처럼 굴어야 한다.
    fireEvent.click(cta);
    expect(screen.queryByText('세 가지를 모두 확인하셨나요?')).toBeNull();
  });

  it('전제를 갖추면 잠금과 이유가 함께 사라진다', async () => {
    getSduUpload.mockResolvedValue(assertable());
    draw();

    const cta = (await screen.findByRole('button', {
      name: 'BDC 구축 완료 처리',
    })) as HTMLButtonElement;
    expect(cta.disabled).toBe(false);
    expect(screen.queryByText(/처리할 수 있어요/)).toBeNull();
  });

  it('세 항목을 다 체크해야 완료 처리가 열린다', async () => {
    await openModal();

    await screen.findByText('세 가지를 모두 확인하셨나요?');
    const commit = screen.getByRole('button', { name: '완료 처리' }) as HTMLButtonElement;
    expect(commit.disabled).toBe(true);

    const boxes = screen.getAllByRole('checkbox');
    expect(boxes).toHaveLength(3);
    fireEvent.click(boxes[0]);
    fireEvent.click(boxes[1]);
    // 둘로는 아직 열리지 않는다 — 「세 가지 모두」가 이 게이트의 전부다.
    expect(commit.disabled).toBe(true);

    fireEvent.click(boxes[2]);
    expect(commit.disabled).toBe(false);

    // 6단계다 — SDU 는 5를 건너뛴다 (오너 2026-08-30 2차).
    expect(screen.getByText(/6단계\(연결 확인 완료\)로 넘어갑니다/)).toBeTruthy();

    fireEvent.click(commit);
    await waitFor(() => expect(putSduBdcCompletion).toHaveBeenCalledWith(1100, true));
    // 단언이 무엇이 됐는지는 서버가 안다 — 카드도 뷰도 다시 읽는다.
    await waitFor(() => expect(onBdcChanged).toHaveBeenCalled());
    expect(getSduUpload.mock.calls.length).toBeGreaterThan(1);
  });

  it('콘솔이 모르는 항목은 판정 대신 못 읽는다고 말한다', async () => {
    await openModal();

    const glue = await screen.findByText('Glue 설정 확인');
    expect(glue.parentElement?.nextElementSibling?.textContent).toContain(
      '이 콘솔이 확인할 수 없는 항목입니다',
    );
  });

  it('나머지 둘은 「연동 현황」 카드와 같은 낱말을 쓴다', async () => {
    await openModal();

    const scan = await screen.findByText('Scan & 확정');
    await waitFor(() => {
      const line = scan.parentElement?.nextElementSibling?.textContent ?? '';
      expect(line).toContain('성공');
      expect(line).toContain('리소스 41개');
      expect(line).toContain('확정됨');
    });

    const terraform = screen.getByText('Terraform 동작');
    const line = terraform.parentElement?.nextElementSibling?.textContent ?? '';
    // 작업 **이름**과 각자의 적용 상태다 — 집계 하나로 접으면 어느 쪽이 걸렸는지 사라진다.
    expect(line).toContain('SDU_BDC_SERVICE_COMMON 적용 완료');
    expect(line).toContain('SDU_BDC_SERVICE 미적용');
  });

  it('조회가 거절된 항목은 판정 잉크를 얻지 못한다 — 못 읽은 것은 초록이 아니다', async () => {
    getTerraformStatus.mockRejectedValue(new Error('rejected'));
    await openModal();

    const terraform = await screen.findByText('Terraform 동작');
    const line = terraform.parentElement?.nextElementSibling as HTMLElement;
    await waitFor(() => expect(line.textContent).toBe('조회 실패'));
    // `STATE_INK.ok` 은 strong 이다 — 모르는 것이 그 잉크를 쓰면 읽은 것처럼 보인다.
    expect(line.className).toContain('text-[var(--pl-text-weak)]');
    expect(line.className).not.toContain('text-[var(--pl-text-strong)]');
  });

  it('단언한 사람이 두 확인과 같은 문법으로 선다 — 저자 없는 사실로 읽히지 않는다', async () => {
    // 파생값이던 시절에는 저자가 없었다. 단언에는 있고(델타 §2), 한 카드 안에서 세 줄 중
    // 둘만 사람을 말하면 셋째 줄만 출처가 없는 것처럼 보인다.
    getSduUpload.mockResolvedValue(completed());
    draw();

    const value = (await screen.findByText('BDC 구축')).nextElementSibling;
    expect(value?.textContent).toContain('구축 완료 · 관리자');
    expect(value?.textContent).not.toContain('구축 완료관리자');
    // 사람과 시각 **사이**의 구분자도 글자 흐름 안에 있어야 한다 — 여백만으로 가르면
    // 낭독과 복사가 「관리자2026…」 한 낱말을 읽는다 (`AckValue` 와 같은 규칙).
    expect(value?.textContent).toMatch(/관리자 · \d/);
  });

  it('되돌리기는 클릭 한 번으로 나가지 않는다 — 제 확인창을 갖는다', async () => {
    getSduUpload.mockResolvedValue(completed());
    draw();

    fireEvent.click(await screen.findByRole('button', { name: '구축 완료 되돌리기' }));
    expect(putSduBdcCompletion).not.toHaveBeenCalled();

    // 단계는 남는다고 말한다 — 함께 되돌아간다고 믿으면 눌러야 할 때 누르지 않는다.
    expect(screen.getByText('BDC 구축 상태만 되돌아가고, 진행 단계는 그대로 남습니다.')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    await waitFor(() => expect(putSduBdcCompletion).toHaveBeenCalledWith(1100, false));
    await waitFor(() => expect(onBdcChanged).toHaveBeenCalled());
  });
});
