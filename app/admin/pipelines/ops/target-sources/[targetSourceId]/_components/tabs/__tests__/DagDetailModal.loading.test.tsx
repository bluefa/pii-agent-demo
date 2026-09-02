// @vitest-environment jsdom
/**
 * DAG 상세 모달의 마지막 줄.
 *
 * 주소 필드에는 이미 제 바가 있었지만 그 아래 행동 블록은 조회가 도는 동안 아예 없었다 —
 * 주소가 도착하는 순간 `mt-5` + 윗줄 + `pt-4` + 버튼 한 줄이 통째로 끼어들어 모달이
 * 그만큼 자란다. 자리는 미리 서 있어야 하고, **어느 버튼이 올지는 말하지 않는다.**
 */
import { act, render, screen } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import type { DagDbRow } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

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
  },
};

const open = () =>
  render(<DagDetailModal row={ROW} timezone="Asia/Seoul" onClose={() => {}} />);

/** 정착본의 행동 줄 — `mt-5` 규칙 위의 오른쪽 정렬 한 칸. */
const actionRow = (container: HTMLElement): Element | null =>
  container.querySelector('.mt-5.justify-end.border-t');

describe('DagDetailModal — 주소 조회 중 마지막 줄', () => {
  // 큐는 테스트마다 비운다 — 앞 테스트가 남긴 resolver 를 집으면 이미 끝난 약속을 흔든다.
  beforeEach(() => {
    h.resolve.length = 0;
    h.reject.length = 0;
  });

  it('주소를 기다리는 동안에도 행동 줄이 자리를 지킨다', async () => {
    const { container } = open();

    const row = actionRow(container);
    expect(row).not.toBeNull();
    // 자국은 md 버튼(h-8)의 모양일 뿐 — 열기인지 다시 시도인지 말하지 않는다.
    expect(row?.querySelector('.animate-pulse')).not.toBeNull();
    expect(row?.textContent).toBe('');

    await act(async () => {
      h.resolve.shift()?.('https://airflow.example/dags/pii_app_daily');
    });

    // 같은 줄이 그대로 서 있고, 그 안의 자국만 진짜 버튼으로 바뀐다.
    expect(actionRow(container)).not.toBeNull();
    expect(screen.getByRole('link', { name: /Airflow에서 열기/ })).toBeTruthy();
    expect(container.querySelectorAll('.animate-pulse')).toHaveLength(0);
  });

  it('조회가 실패해도 같은 줄에서 다시 시도로 바뀐다', async () => {
    const { container } = open();
    expect(actionRow(container)).not.toBeNull();

    await act(async () => {
      h.reject.shift()?.(new Error('boom'));
    });

    expect(actionRow(container)).not.toBeNull();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
  });
});
