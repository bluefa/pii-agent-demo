// @vitest-environment jsdom
/**
 * 「S3 Access Key 수신자」 카드의 제 축.
 *
 * 스캔 탭에서 권한 카드가 서던 자리다 — SDU 에는 검증할 role 이 없고(데이터는 담당자가
 * 올린다), 남는 질문은 그 버킷의 키를 누가 들고 있는가 하나다(계약 §9).
 *
 * 진행 상태 탭에서도 같은 카드가 선다(오너 결정) — 한 명부를 두 벌 그리지 않는다.
 *
 * 뷰를 통과하는 경로가 닿지 않는 네 갈래를 여기서 잰다: 비어 있음 · 조회 실패 · 시각이
 * 없는 명부 · **긴 명부**. 앞의 셋은 「없다」로 접히기 쉬운데 서로 다른 사실이고, 넷째는
 * 담당자가 여럿일 때 카드가 옆 칸을 밀어내던 자리다.
 */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SduRecipientsCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduRecipientsCard';
import type { SduUpload } from '@/lib/types/sdu';

const getSduUpload = vi.fn();
vi.mock('@/app/lib/api/sdu', () => ({
  getSduUpload: (...args: unknown[]) => getSduUpload(...args),
}));

const upload = (over: Partial<SduUpload['accessKeyRecipients']> = {}): SduUpload => ({
  submittedAt: '2026-08-24T05:41:00Z',
  regions: ['us'],
  firewall: { rows: [], acked: true, ackedAt: '2026-08-25T10:40:00Z', ackedBy: null },
  accessKeyRecipients: {
    users: [
      { id: 'user-1', name: '홍길동', email: 'hong@company.com' },
      { id: 'user-5', name: '이영희', email: 'lee@company.com' },
    ],
    updatedAt: '2026-08-24T07:41:00Z',
    ...over,
  },
  commands: { rows: [], acked: true, ackedAt: '2026-08-25T11:00:00Z', ackedBy: null },
  bdc: { status: 'IN_PROGRESS', checkedAt: '2026-08-24T07:50:00Z', completedAt: null },
  invalidation: { addedRegions: [], uploadIpChanged: false },
});

const draw = (): void => {
  render(<SduRecipientsCard targetSourceId={1100} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  getSduUpload.mockResolvedValue(upload());
});

describe('SduRecipientsCard', () => {
  it('등록된 사람을 이름과 메일로 세운다', async () => {
    draw();

    expect(await screen.findByText('홍길동')).toBeTruthy();
    expect(screen.getByText('hong@company.com')).toBeTruthy();
    expect(screen.getByText('이영희')).toBeTruthy();
    expect(screen.getByText('lee@company.com')).toBeTruthy();
    expect(screen.getByText(/2026-08-24/)).toBeTruthy();
  });

  it('아무도 없으면 빈 상태다 — 조회 실패와 다른 말을 쓴다', async () => {
    getSduUpload.mockResolvedValue(upload({ users: [], updatedAt: null }));
    draw();

    expect(await screen.findByText('등록된 수신자가 없습니다.')).toBeTruthy();
    expect(screen.queryByText(/불러오지 못했습니다/)).toBeNull();
  });

  it('조회가 거절되면 모른다고 말한다 — 빈 명부라고 하지 않는다', async () => {
    getSduUpload.mockRejectedValue(new Error('boom'));
    draw();

    expect(await screen.findByText('수신자 정보를 불러오지 못했습니다.')).toBeTruthy();
    expect(screen.queryByText('등록된 수신자가 없습니다.')).toBeNull();
  });

  it('시각이 없으면 그 줄을 그리지 않는다 — 없는 날짜에 대시를 찍지 않는다', async () => {
    getSduUpload.mockResolvedValue(upload({ updatedAt: null }));
    draw();

    // 명부는 그대로 서고,
    expect(await screen.findByText('홍길동')).toBeTruthy();
    // 마지막 등록 줄만 빠진다.
    expect(screen.queryByText('마지막 등록')).toBeNull();
  });

  it('총원은 제목이 진다 — 끝까지 스크롤해야 아는 수는 말하지 않은 수다', async () => {
    draw();

    const title = await screen.findByRole('heading', { name: /S3 Access Key 수신자/ });
    expect(title.textContent).toContain('2명');
  });

  it('아무도 없으면 제목에 수를 달지 않는다 — 「0명」과 빈 상태를 겹쳐 말하지 않는다', async () => {
    getSduUpload.mockResolvedValue(upload({ users: [], updatedAt: null }));
    draw();

    await screen.findByText('등록된 수신자가 없습니다.');
    expect(screen.getByRole('heading', { name: /S3 Access Key 수신자/ }).textContent).not.toContain(
      '명',
    );
  });
});

describe('SduRecipientsCard — 명부가 길 때', () => {
  const many = Array.from({ length: 15 }, (_, index) => ({
    id: `user-${index}`,
    name: `담당자${index}`,
    email: `owner${index}@company.com`,
  }));

  const rowNames = (): string[] =>
    screen.getAllByRole('row').slice(1).map((row) => row.firstElementChild?.textContent ?? '');

  /**
   * 담당자는 여럿일 수 있다. 카드가 명부 길이만큼 자라면 옆 칸을 넘기고, 진행 상태의 두 칸
   * 행이 행이기를 그만둔다. 페이저가 사 오는 성질은 **높이가 데이터에 흔들리지 않는 것**이라,
   * 여기서 재는 것도 "다 보이는가"가 아니라 "한 페이지가 고정인가"다.
   */
  it('한 페이지는 다섯 행이고, 명부가 길어져도 그대로다', async () => {
    getSduUpload.mockResolvedValue(upload({ users: many }));
    draw();

    await screen.findByText('담당자0');
    expect(rowNames()).toEqual(['담당자0', '담당자1', '담당자2', '담당자3', '담당자4']);
    // 고정 본문 슬롯 — 페이지를 넘겨도 카드가 다시 재지 않는다.
    expect(document.querySelector('section')?.innerHTML).toContain('min-h-[266px]');
  });

  it('페이지를 넘기면 행이 바뀐다 — 감춘 사람은 없다', async () => {
    getSduUpload.mockResolvedValue(upload({ users: many }));
    draw();

    await screen.findByText('담당자0');
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(rowNames()).toEqual(['담당자5', '담당자6', '담당자7', '담당자8', '담당자9']);
    // 주소도 함께 온다 — 이 표가 있는 이유가 주소다.
    expect(screen.getByText('owner5@company.com')).toBeTruthy();

    // 마지막 페이지까지 가면 열다섯째가 손에 잡힌다. 디스클로저도 모달도 없이, 페이징으로.
    fireEvent.click(screen.getByRole('button', { name: '다음 페이지' }));
    expect(screen.getByText('owner14@company.com')).toBeTruthy();
  });

  it('제목의 수는 총원이다 — 한 페이지에 보이는 수가 아니다', async () => {
    getSduUpload.mockResolvedValue(upload({ users: many }));
    draw();

    await screen.findByText('담당자0');
    const title = screen.getByRole('heading', { name: /S3 Access Key 수신자/ });
    expect(title.textContent).toContain('15명');
    expect(title.textContent).not.toContain('5명 ');
  });

  it('한 페이지도 안 되는 명부에도 페이저는 선다', async () => {
    // 형제 카드와 같은 `always` — 바닥이 사라지면 두 카드의 높이가 데이터에 따라 갈린다.
    draw();

    await screen.findByText('홍길동');
    expect(screen.getByRole('navigation', { name: '페이지' })).toBeTruthy();
  });
});
