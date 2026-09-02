// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LogicalDbCountCell } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbCountCell';

/**
 * 이 칸의 두 부재는 같은 것이 아니다. `—` 는 **정착한 사실**이다 — 이번 회차가 답했고,
 * 이 행에 대해서는 말한 것이 없다. `loading` 은 이번 회차의 수를 아직 모른다는 뜻이고,
 * 그 사이에 `—` 를 찍으면 곧 뒤집힐 판정을 미리 단언하게 된다. 옆 칸의 `TcStatusTag` 가
 * 같은 자리에서 이미 긋는 구분이다.
 */
describe('LogicalDbCountCell — loading 은 — 가 아니다', () => {
  it('draws a skeleton instead of a number while this round is unknown', () => {
    const { container } = render(<LogicalDbCountCell count={8} label="논리 DB" loading />);

    expect(container.querySelectorAll('.animate-pulse').length).toBe(1);
    // 수도 `개` 도 `—` 도 없다 — textContent 로 잡는다. `8개` 는 수와 단위가 두 노드라
    // getByText('8') 로는 잡히지 않아, 그 질의는 스켈레톤이 없어도 통과한다.
    expect(container.textContent).toBe('');
  });

  it('draws a skeleton instead of — when there is no count either', () => {
    const { container } = render(<LogicalDbCountCell count={null} label="논리 DB" loading />);

    expect(container.querySelectorAll('.animate-pulse').length).toBe(1);
    expect(screen.queryByText('—')).toBeNull();
    // 읽어 줄 것이 없다 — 자리를 지키는 막대이지 내용이 아니다.
    expect(container.querySelector('.animate-pulse')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('says — again once the round has answered with nothing for this row', () => {
    const { container } = render(<LogicalDbCountCell count={null} label="논리 DB" />);

    expect(container.querySelectorAll('.animate-pulse').length).toBe(0);
    expect(screen.getByText('—')).toBeTruthy();
  });
});
