// @vitest-environment jsdom
/**
 * 「연동 대상 정의」 카드의 제 축 (계약 §3).
 *
 * `OpsTargetView.sdu.test.tsx` 가 이 카드가 **그 자리에 서는지**를 재고, 여기서는 카드가
 * 제 응답을 어떻게 접는지를 잰다. 갈래가 셋이고 셋 다 「없다」로 접히기 쉽다: 대상이 없음 ·
 * 대상은 있는데 저장 시각이 없음 · 조회가 거절됨.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { SduDefinitionCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduDefinitionCard';
import type { SduDefinition } from '@/lib/types/sdu';

const getSduDefinition = vi.fn();
vi.mock('@/app/lib/api/sdu', () => ({
  getSduDefinition: (...args: unknown[]) => getSduDefinition(...args),
  getSduUpload: vi.fn(),
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

const draw = (): void => {
  render(<SduDefinitionCard targetSourceId={1100} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  getSduDefinition.mockResolvedValue(DEFINITION);
});

describe('SduDefinitionCard', () => {
  it('정의한 대상을 표로 세운다', async () => {
    draw();

    expect(await screen.findByText('10.20.30.40')).toBeTruthy();
    expect(screen.getByText('MySQL, Aurora MySQL')).toBeTruthy();
    expect(screen.getByText(/마지막 저장/)).toBeTruthy();
  });

  /**
   * 표는 콘솔 문법 셸(`ConsoleTable`)을 통과한다 — 담당자 화면의 방화벽 표와 같은 표라야
   * 두 화면이 같은 제품으로 읽힌다. 셸이 주는 것 중 이 카드가 실제로 기대는 것은 둘이다:
   * `table-fixed`(드래그가 열을 지배할 수 있는 유일한 레이아웃)와, 남는 폭을 `flex` 열 하나가
   * 가져가는 규칙. 평범한 표로 되돌아가면 DB 종류가 고정 열 셋을 밀어낸다.
   */
  it('콘솔 문법 셸을 통과한다 — 네 열, 고정 레이아웃', async () => {
    draw();

    await screen.findByText('10.20.30.40');
    expect(screen.getAllByRole('columnheader').map((el) => el.textContent)).toEqual([
      '클라우드',
      'Region',
      '업로드 IP',
      'DB 종류',
    ]);
    const table = screen.getByRole('table');
    expect(table.className).toContain('table-fixed');
    // `w-full` 은 셸이 **flex 열이 하나라도 있을 때만** 켜는 모드다(`slackSinkKey`) — jsdom
    // 에는 레이아웃이 없으므로 남는 폭을 실제로 가져가는지는 이 스위치로 잰다. flex 를 떼면
    // 표는 열 합만큼만 넓어지고 DB 종류는 바닥에 붙는다(브라우저 실측: 256px → 220px).
    expect(table.className).toContain('w-full');
  });

  it('대상이 없으면 빈 상태다', async () => {
    getSduDefinition.mockResolvedValue({ targets: [], updatedAt: null });
    draw();

    expect(await screen.findByText('등록된 연동 대상이 없습니다.')).toBeTruthy();
    expect(screen.queryByText(/마지막 저장/)).toBeNull();
  });

  /**
   * 첫 저장 전의 `updated_at: null` (계약 §3). 대상은 **있는데** 시각만 없는 상태라,
   * 위의 빈 상태와는 다른 가지다 — `fmtDateTime(null)` 은 `'-'` 를 돌려주므로 그대로
   * 찍으면 「마지막 저장 -」이 되고, 저장된 적 없는 정의가 시각을 잃어버린 정의처럼 읽힌다.
   */
  it('대상은 있는데 저장 시각이 없으면 대시가 아니라 문장으로 말한다', async () => {
    getSduDefinition.mockResolvedValue({ targets: DEFINITION.targets, updatedAt: null });
    draw();

    expect(await screen.findByText('아직 저장된 적이 없습니다.')).toBeTruthy();
    expect(screen.queryByText(/마지막 저장/)).toBeNull();
    expect(screen.queryByText('마지막 저장 -')).toBeNull();
    // 표는 그대로 선다 — 시각이 없다고 정의가 없는 것은 아니다.
    expect(screen.getByText('10.20.30.40')).toBeTruthy();
  });

  it('조회가 거절되면 빈 정의라고 하지 않는다', async () => {
    getSduDefinition.mockRejectedValue(new Error('boom'));
    draw();

    expect(await screen.findByText('연동 대상 정의를 불러오지 못했습니다.')).toBeTruthy();
    expect(screen.queryByText('등록된 연동 대상이 없습니다.')).toBeNull();
  });
});
