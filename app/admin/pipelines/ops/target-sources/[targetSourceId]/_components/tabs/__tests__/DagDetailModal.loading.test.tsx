// @vitest-environment jsdom
/**
 * DAG 상세 모달의 Airflow 행 — 주소 조회가 도는 동안.
 *
 * 행의 값 칸은 조회 중 제 바를 세우고, 답이 오면 그 자리에서 링크(또는 다시 시도)로 바뀐다 —
 * 모달이 자라거나 줄지 않는다. 푸터의 행동 줄은 없다 (오너 2026-09-03: 여는 길은 행의 링크
 * 하나) — 그래서 지킬 자리도 행 하나뿐이다.
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { DagDbRow } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/target-sources/1642' }));

const h = vi.hoisted(() => ({
  resolve: [] as Array<(url: string) => void>,
  reject: [] as Array<(err: Error) => void>,
}));

vi.mock('@/app/lib/api/ops', () => ({
  getAirflowHost: vi.fn(
    () =>
      new Promise<string>((resolve, reject) => {
        h.resolve.push(resolve);
        h.reject.push(reject);
      }),
  ),
}));

import { DagDetailModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DagDetailModal';

const ROW: DagDbRow = {
  agentId: 'agent-1',
  resourceId: 'res-1',
  bucket: 'succeeded',
  db: {
    databaseUri: 'mysql-01.internal:3306',
    databaseName: 'app',
    schemaName: null,
    dagName: 'pii_app_daily',
    namespace: 'pass',
    succeededThisWeek: true,
    lastSuccessAt: '2026-08-31T20:00:00Z',
    days: Array.from({ length: 7 }, (_, i) => ({
      day: `2026-08-2${i + 3}`,
      status: 'SUCCESS',
      successTime: '2026-08-31T20:00:00Z',
    })),
    latestTableCount: 3,
  },
};

const open = () =>
  render(<DagDetailModal row={ROW} timezone="Asia/Seoul" onClose={() => {}} />);

describe('DagDetailModal — 주소 조회 중 Airflow 행', () => {
  // 큐는 테스트마다 비운다 — 앞 테스트가 남긴 resolver 를 집으면 이미 끝난 약속을 흔든다.
  beforeEach(() => {
    h.resolve.length = 0;
    h.reject.length = 0;
  });

  it('주소를 기다리는 동안 값 칸은 자국이고, 답이 오면 그 자리가 링크가 된다', async () => {
    const { container } = open();

    // 자국 하나 — 어느 답이 올지는 말하지 않는다. 푸터는 없다.
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);
    expect(container.querySelector('.mt-5.justify-end.border-t')).toBeNull();
    expect(screen.queryByRole('link', { name: /Airflow에서 열기/ })).toBeNull();

    await act(async () => {
      h.resolve.shift()?.('https://airflow.example/dags/pii_app_daily');
    });

    expect(screen.getByRole('link', { name: /Airflow에서 열기/ })).toBeTruthy();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
    expect(container.querySelector('.mt-5.justify-end.border-t')).toBeNull();
  });

  it('조회가 실패하면 같은 행에서 다시 시도로 바뀐다', async () => {
    const { container } = open();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(1);

    await act(async () => {
      h.reject.shift()?.(new Error('boom'));
    });

    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });
});
