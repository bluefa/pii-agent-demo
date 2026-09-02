// @vitest-environment jsdom
/**
 * 논리 DB 목록 모달의 대기 프레임.
 *
 * 두 패널이 각각 280px 상자 한가운데의 「불러오는 중…」 한 줄로 열렸고, 머리의 `N개`
 * 자리는 빈 문자열이었다 — 목록이 도착하면 그 자리가 통째로 뒤집히고, 개수는 없던
 * 글자가 생기며 머리 오른쪽이 움직인다.
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type {
  ExcludedLogicalDatabase,
  TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';

const h = vi.hoisted(() => ({
  tested: [] as Array<(rows: TestedLogicalDatabase[]) => void>,
  excluded: [] as Array<(rows: ExcludedLogicalDatabase[]) => void>,
}));

vi.mock('@/app/lib/api/logical-db', () => ({
  getTestedLogicalDatabases: vi.fn(
    () => new Promise<TestedLogicalDatabase[]>((resolve) => h.tested.push(resolve)),
  ),
  getExcludedLogicalDatabases: vi.fn(
    () => new Promise<ExcludedLogicalDatabase[]>((resolve) => h.excluded.push(resolve)),
  ),
}));

import { LdbViewModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/LdbViewModal';

const open = () =>
  render(
    <LdbViewModal
      targetSourceId={2103}
      resourceId="res-1"
      resourceLabel="mysql-01.internal"
      databaseType="MYSQL"
      onClose={() => {}}
    />,
  );

const settle = async (): Promise<void> => {
  await act(async () => {
    h.tested.shift()?.([{ databaseName: 'app', type: 'DATABASE' }]);
    h.excluded.shift()?.([{ databaseName: 'stg_app', skipReason: 'STG', type: 'DATABASE' }]);
  });
};

const panelHeads = (container: HTMLElement): Element[] =>
  Array.from(container.querySelectorAll('.min-h-\\[280px\\]')).map(
    (panel) => panel.firstElementChild!,
  );

describe('LdbViewModal — 대기 프레임', () => {
  beforeEach(() => {
    h.tested.length = 0;
    h.excluded.length = 0;
  });

  it('두 목록을 기다리는 동안 행의 자국을 그린다 — 안내 문장이 아니라', async () => {
    const { container } = open();

    // 패널 제목은 이 모달이 이미 아는 고정 문자열이라 실물로 선다.
    expect(screen.getByText('연동 대상 논리 DB')).toBeTruthy();
    expect(screen.getByText('연동 제외 논리 DB')).toBeTruthy();
    // 한 줄짜리 안내는 목록의 자국이 아니다.
    expect(screen.queryByText('불러오는 중…')).toBeNull();
    // 패널마다 다섯 줄 × (이름 + 표지) 바, 그리고 머리의 개수 바 둘.
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(22);

    await settle();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  it('개수 자리는 비어 있지 않고 바로 선다', async () => {
    const { container } = open();

    // 빈 문자열이면 개수가 도착할 때 머리 오른쪽에 없던 글자가 생긴다.
    const heads = panelHeads(container);
    expect(heads).toHaveLength(2);
    for (const head of heads) {
      expect(head.querySelector('.animate-pulse')).not.toBeNull();
    }

    await settle();
    expect(panelHeads(container).map((head) => head.textContent)).toEqual([
      '연동 대상 논리 DB1개',
      '연동 제외 논리 DB1개',
    ]);
  });
});
