// @vitest-environment jsdom
/**
 * SDU 대상의 탭 자리에 놓이는 안내 한 장.
 *
 * 전제가 바뀌었다 — 예전에는 이것이 화면 전체라 대상 식별(번호·서비스·중국)과 나가는
 * 길까지 여기서 쟀다. 이제 그 위에 마스트헤드(OpsHeader)가 서서 같은 사실을 말하므로,
 * 이 파일이 지키는 것은 하나만 남는다: 운영자에게 "대상이 없다"가 아니라 "화면이
 * 없다"고 말하는가. 어느 대상에서 이 안내로 갈라지는지, 그리고 마스트헤드가 무엇을
 * 말하는지는 `OpsTargetView.sdu.test.tsx` 가 잰다.
 */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { SduOpsNotice } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/SduOpsNotice';

describe('SduOpsNotice', () => {
  it('운영자에게 "대상이 없다"가 아니라 "화면이 없다"고 말한다', () => {
    render(<SduOpsNotice />);
    // 사용자쪽 문구("아직 지원하지 않는 서비스 타입")를 돌려쓰면 운영자에게 대상이
    // 없다고 말하는 셈이 된다 — 대상은 존재하고 운영된다.
    expect(screen.getByText('운영 화면을 준비하고 있습니다')).toBeTruthy();
    expect(screen.queryByText(/지원하지 않는/)).toBeNull();
  });

  it('왜 탭이 없는지를 적는다', () => {
    render(<SduOpsNotice />);
    expect(screen.getByText(/설치 진행을 전제로 만든/)).toBeTruthy();
  });

  it('머리는 h1 이 아니다 — 이 화면의 h1 은 마스트헤드의 경로 줄이다', () => {
    // 화면 전체였을 때는 여기가 유일한 머리였다. 마스트헤드 아래로 들어온 뒤에도 h1 로
    // 남으면 한 화면에 h1 이 둘이 된다.
    render(<SduOpsNotice />);
    expect(screen.queryByRole('heading', { level: 1 })).toBeNull();
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe(
      '운영 화면을 준비하고 있습니다',
    );
  });

  it('마스트헤드가 말하는 것을 두 번 적지 않는다', () => {
    // 대상 번호·서비스·중국 태그·나가는 길은 전부 마스트헤드로 올라갔다. 여기 남겨
    // 두면 읽는 사람이 같은 사실이 둘인 이유를 찾게 된다.
    const { container } = render(<SduOpsNotice />);
    expect(screen.queryByText(/Target #/)).toBeNull();
    expect(screen.queryByText('중국')).toBeNull();
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
