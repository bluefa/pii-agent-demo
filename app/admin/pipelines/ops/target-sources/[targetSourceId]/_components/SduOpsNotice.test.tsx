// @vitest-environment jsdom
/**
 * SDU 대상의 운영 상세는 탭 화면이 아니라 안내 한 장이다.
 *
 * 여기서 지키는 것은 두 가지다:
 *   1. 게이트가 계약이 SDU 를 말하는 두 자리를 모두 본다 — `metadata.is_sdu_type` 과
 *      `cloudProvider` enum 의 `SDU`. 한쪽만 보면 그 경로로 오는 대상이 탭 화면으로
 *      떨어지고, 거기서 각 탭이 제 요청을 쏘고 나서야 할 말이 없다는 걸 알게 된다.
 *   2. 안내가 대상 식별(번호·서비스·중국)을 남긴다. 화면이 없다는 말만 남기면
 *      운영자가 자기가 어느 대상을 열었는지를 잃는다.
 */
import { render, screen, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { SduOpsNotice } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduOpsNotice';

const renderNotice = (over: Partial<Parameters<typeof SduOpsNotice>[0]> = {}) =>
  render(
    <SduOpsNotice
      targetSourceId={1099}
      serviceName="SDU"
      serviceCode="SDU"
      isChinaRegion={false}
      {...over}
    />,
  );

describe('SduOpsNotice', () => {
  it('운영자에게 "대상이 없다"가 아니라 "화면이 없다"고 말한다', () => {
    renderNotice();
    // 사용자쪽 문구("아직 지원하지 않는 서비스 타입")를 돌려쓰면 운영자에게 대상이
    // 없다고 말하는 셈이 된다 — 대상은 존재하고 운영된다.
    expect(screen.getByText('운영 화면을 준비하고 있습니다')).toBeTruthy();
    expect(screen.queryByText(/지원하지 않는/)).toBeNull();
  });

  it('대상 번호를 남긴다', () => {
    renderNotice({ targetSourceId: 4242 });
    expect(screen.getByText('Target #4242')).toBeTruthy();
  });

  it('중국 대상이면 화면이 없어도 그 사실은 말한다', () => {
    renderNotice({ isChinaRegion: true });
    expect(screen.getByText('중국')).toBeTruthy();
  });

  it('글로벌 대상에는 중국 칩을 달지 않는다', () => {
    renderNotice({ isChinaRegion: false });
    expect(screen.queryByText('중국')).toBeNull();
  });

  it('서비스 이름과 코드가 같으면 한 번만 적는다', () => {
    // SDU 서비스가 이름·코드 모두 "SDU" 다 — 같은 글자를 두 칩에 나눠 찍으면
    // 읽는 사람이 둘인 이유를 찾게 된다.
    const { container } = renderNotice({ serviceName: 'SDU', serviceCode: 'SDU' });
    const chips = [...container.querySelectorAll('span')].filter(
      (s) => s.textContent === 'SDU',
    );
    expect(chips).toHaveLength(1);
  });

  it('서비스 이름과 코드가 다르면 둘 다 적는다', () => {
    renderNotice({ serviceName: '주문서비스', serviceCode: 'ORD' });
    const chip = screen.getByText(/주문서비스/);
    expect(within(chip).queryByText('ORD')).toBeNull();
    expect(chip.textContent).toBe('주문서비스 · ORD');
  });
});
