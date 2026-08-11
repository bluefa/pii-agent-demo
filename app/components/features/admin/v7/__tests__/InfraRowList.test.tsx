// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';
import type { ProjectSummary } from '@/lib/types';
import { InfraRowList } from '@/app/components/features/admin/v7/InfraRowList';

const noop = () => undefined;

const project = (id: number): ProjectSummary => ({
  id: String(id),
  targetSourceId: id,
  projectCode: `SVC-${id}`,
  cloudProvider: 'AWS',
  awsAccountId: `${id}`.padStart(12, '0'),
  isTerraformExecutionGranted: true,
  resourceCount: 0,
  hasDisconnected: false,
  hasNew: false,
  isRejected: false,
});

const list = (projects: ProjectSummary[] | null, loading = false) =>
  render(
    <InfraRowList
      projects={projects}
      error={null}
      loading={loading}
      onRetry={noop}
      onOpenDetail={noop}
      onManageAction={noop}
    />,
  );

describe('InfraRowList — 연동 대상이 0건일 때', () => {
  it('says so in place of the first card', () => {
    const { container } = list([]);
    expect(container.textContent).toContain('등록된 연동 대상이 없습니다');
  });

  /**
   * The regression this replaced: the empty state used to REPLACE the whole
   * component, so the heading, the count and the pager all vanished with it. One
   * account appearing then rebuilt the screen from scratch — the two states read as
   * two different pages rather than one list with nothing in it.
   */
  it('keeps the list frame — heading, count and pager stay', () => {
    const { container } = list([]);
    expect(container.textContent).toContain('연동 대상 계정');
    expect(container.textContent).toContain('0건');
    expect(container.textContent).toContain('1/1 페이지');
  });

  it('draws the slot as an outline, not a card', () => {
    const { container } = list([]);
    // findLast, not find: the scrolling band is the slot's only parent, so it carries
    // the same textContent and comes first in document order.
    const slot = [...container.querySelectorAll('div')].findLast(
      (el) => el.textContent?.trim() === '등록된 연동 대상이 없습니다',
    );
    expect(slot?.className).toContain('border-dashed');
    // 카드가 아니라 카드가 놓일 자리 — 흰 표면을 깔면 빈 카드 한 장으로 읽힌다.
    expect(slot?.className).not.toContain('bg-white');
  });

  it('does not claim emptiness before the answer arrives', () => {
    // null = 아직 모름 → 스켈레톤. 0건이라고 먼저 말해버리면 그게 답이 된다.
    expect(list(null).container.textContent).not.toContain('등록된 연동 대상이 없습니다');
    // 갱신 중 비어 있는 것도 같다 — 확정된 0건이 아니다.
    expect(list([], true).container.textContent).not.toContain('등록된 연동 대상이 없습니다');
  });

  it('shows rows instead of the slot once there are any', () => {
    const { container } = list([project(1)]);
    expect(container.textContent).not.toContain('등록된 연동 대상이 없습니다');
    expect(container.textContent).toContain('1건');
  });
});

vi.mock('@/app/components/features/admin/v7/InfraRow', () => ({
  InfraRow: ({ project: p }: { project: ProjectSummary }) => <div>{p.projectCode}</div>,
}));
