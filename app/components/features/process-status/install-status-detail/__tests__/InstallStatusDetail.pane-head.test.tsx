// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { InstallStatusDetail } from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import { TABLE_TAG_PILL } from '@/app/components/features/process-status/install-task-pipeline/table-styles';
import type {
  InstallDetailResource,
  InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';

/**
 * 머리 우측의 채운 알약은 하나뿐이라는 규칙을 고정한다.
 *
 * 주체(서비스측 / BDC측)와 집계(진행중·완료·실패…)가 둘 다 알약이던 동안 두 칩의
 * computed style 은 채움·잉크·크기·패딩·반경까지 같았다. 색으로 가를 수도 없다 —
 * 집계는 다섯 계열을 돌므로 주체에 어떤 색을 줘도 어느 상태에선 부딪힌다. 그래서
 * 채널을 바꿨고(칩 → 글자), 이 결정은 픽셀만 보면 조용히 되돌아온다.
 */

const cell = (status: InstallDetailResource['rollup']['status']) => ({ status, guide: null });

const steps: InstallTableStep[] = [
  {
    id: 'service',
    title: '서비스 측 구성',
    side: '서비스측 리소스 생성',
    desc: '서비스 측 리소스를 구성합니다.',
  },
  {
    id: 'bdc',
    title: 'BDC 구성',
    side: 'BDC측 리소스 생성',
    desc: 'BDC 측 리소스를 구성합니다.',
  },
];

const resources: InstallDetailResource[] = [
  {
    resourceId: 'r-1',
    resourceName: null,
    rollup: cell('COMPLETED'),
    cells: { service: cell('COMPLETED'), bdc: cell('COMPLETED') },
  },
  {
    resourceId: 'r-2',
    resourceName: null,
    rollup: cell('FAIL'),
    cells: { service: cell('FAIL'), bdc: cell('COMPLETED') },
  },
];

/**
 * 컴포넌트가 실제로 내보내는 알약 클래스 묶음을 그대로 판정에 쓴다 — 토큰이 바뀌면
 * 이 테스트도 같이 따라간다. 셀렉터 문자열 대신 classList 로 보는 이유는 램프 클래스에
 * `[12px]` 같은 대괄호가 섞여 있어 CSS 셀렉터로 쓰려면 이스케이프가 필요하기 때문이다.
 */
const PILL_CLASSES = TABLE_TAG_PILL.split(' ');

const sitsInPill = (el: HTMLElement): boolean => {
  let node: HTMLElement | null = el;
  while (node) {
    if (PILL_CLASSES.every((cls) => node?.classList.contains(cls))) return true;
    node = node.parentElement;
  }
  return false;
};

const renderDetail = () =>
  render(
    <InstallStatusDetail
      lastCheck={{ status: 'SUCCESS', checkedAt: '2026-07-29T14:02:00Z' }}
      resources={resources}
      steps={steps}
      meta={new Map()}
    />,
  );

describe('InstallStatusDetail — pane 머리의 주체와 집계', () => {
  it('주체는 글자로, 집계만 채운 알약으로 — 머리에서 변하는 값 하나만 칩을 갖는다', () => {
    renderDetail();
    const nav = screen.getByRole('navigation', { name: '설치 단계' });
    fireEvent.click(within(nav).getByRole('button', { name: /서비스 측 구성/ }));

    // 주체는 pane 머리에도 레일에도 있지만, 어느 쪽에서도 알약을 입지 않는다.
    const owners = screen.getAllByText('서비스측');
    expect(owners.length).toBeGreaterThanOrEqual(2);
    for (const owner of owners) {
      expect(sitsInPill(owner)).toBe(false);
    }

    // 집계는 여전히 알약 안에 있다 — 이 머리에서 칩을 갖는 것은 이 값뿐이다.
    const verdict = screen.getByText('실패 1/2');
    expect(sitsInPill(verdict)).toBe(true);
  });
});
