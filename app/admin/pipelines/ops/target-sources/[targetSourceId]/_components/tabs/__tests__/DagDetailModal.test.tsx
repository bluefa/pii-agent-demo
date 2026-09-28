// @vitest-environment jsdom
/**
 * DAG 상세 모달의 Airflow 행 — 네 갈래(시안 E)와 실패에만 서는 푸터.
 *
 * 같은 빈 문자열이 행의 dagName 유무로 두 문장이 되고, 실패만 다시 시도를 갖는다.
 * 주소 원문은 어느 갈래에서도 화면에 서지 않고, 여는 길은 행의 링크 하나다(오너 2026-09-03).
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DagDbRow } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/dagBoard';

vi.mock('next/navigation', () => ({ usePathname: () => '/admin/pipelines/ops/target-sources/1511' }));

const getAirflowHost = vi.fn<(uri: string) => Promise<string>>();
vi.mock('@/app/lib/api/ops', () => ({
  getAirflowHost: (uri: string) => getAirflowHost(uri),
}));

import { DagDetailModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/DagDetailModal';

const URL = 'https://airflow-prod.pii.internal/dags/pii_scan_reviews/grid';

const successDay = (day: string) => ({ day, status: 'SUCCESS', successTime: `${day}T07:40:00+09:00` });
const idleDay = (day: string) => ({ day, status: 'NOT_SCHEDULED', successTime: null });

const row = (dagName: string | null, successDays = 0): DagDbRow => ({
  agentId: 'agent-1',
  resourceId: 'projects/pii-rvw-prod/instances/review-db-1',
  bucket: dagName ? 'succeeded' : 'unscheduled',
  db: {
    databaseUri: 'mysql://10.20.4.31:3306/reviews',
    databaseName: 'reviews',
    schemaName: 'reviews',
    dagName,
    namespace: dagName ? 'composer-prod' : null,
    succeededThisWeek: successDays > 0,
    lastSuccessAt: null,
    days: Array.from({ length: 7 }, (_, i) =>
      i < successDays ? successDay(`2026-08-2${i + 1}`) : idleDay(`2026-08-2${i + 1}`),
    ),
    latestTableCount: successDays > 0 ? 5 : 0,
  },
});

/** 푸터 CTA 는 없다 — 'Airflow에서 열기' 라는 단추가 어느 상태에도 서면 안 된다. */
const openButton = (): HTMLButtonElement | null =>
  Array.from(document.querySelectorAll('button')).find((b) =>
    b.textContent?.includes('Airflow에서 열기'),
  ) ?? null;

beforeEach(() => {
  getAirflowHost.mockReset();
});

describe('DagDetailModal — Airflow 행', () => {
  it('제목 줄에 판정 알약, 문장에 성공 일수 하나, 바닥에 시각 줄 — ScanDetailModal 문법', async () => {
    getAirflowHost.mockResolvedValue(URL);
    render(<DagDetailModal row={row('pii_scan_reviews', 3)} timezone="KST" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('DAG 생성됨')).toBeTruthy());
    const title = document.getElementById('dag-detail-title');
    expect(title?.textContent).toContain('DAG 상세');
    expect(title?.textContent).toContain('최근 7일 성공');
    expect(document.body.textContent).toContain('최근 7일 중 3일 성공했어요.');
    expect(document.body.textContent).toContain('DAG 이름');
    expect(document.body.textContent).toContain('마지막 성공');
    expect(document.body.textContent).toContain('최근 7일 · KST');
    // 옛 라벨은 없다.
    expect(document.body.textContent).not.toContain('현재 상태');
  });

  it('성공한 날이 없으면 수 없이 문장만, 알약은 성공 없음', async () => {
    getAirflowHost.mockResolvedValue(URL);
    render(<DagDetailModal row={row('pii_scan_reviews', 0)} timezone="KST" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('DAG 생성됨')).toBeTruthy());
    expect(document.body.textContent).toContain('최근 7일 성공 기록이 없어요.');
    expect(document.getElementById('dag-detail-title')?.textContent).toContain('성공 없음');
  });

  it('주소가 오면 DAG 생성됨 + 여는 링크, 주소 원문은 없다', async () => {
    getAirflowHost.mockResolvedValue(URL);
    render(<DagDetailModal row={row('pii_scan_reviews')} timezone="KST" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('DAG 생성됨')).toBeTruthy());
    // 여는 길은 행 안의 링크 하나뿐이다 — 푸터 CTA 는 없다(오너 2026-09-03).
    const links = screen.getAllByRole('link', { name: /Airflow에서 열기/ });
    expect(links).toHaveLength(1);
    expect(links[0].getAttribute('href')).toBe(URL);
    expect(links[0].getAttribute('target')).toBe('_blank');
    expect(document.body.textContent).not.toContain(URL);
    expect(openButton()).toBeNull();
    expect(screen.queryByText('다시 시도')).toBeNull();
  });

  it('빈 주소 + 이름 없음 = 아직 생성되지 않음, 푸터 없음', async () => {
    getAirflowHost.mockResolvedValue('');
    render(<DagDetailModal row={row(null)} timezone="KST" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('DAG가 아직 생성되지 않았어요')).toBeTruthy());
    expect(document.body.textContent).toContain('응답에 DAG 이름도 주소도 없어요');
    expect(screen.queryByText('다시 시도')).toBeNull();
    expect(openButton()).toBeNull();
    expect(screen.queryByRole('link', { name: /Airflow에서 열기/ })).toBeNull();
  });

  it('빈 주소 + 이름 있음 = 주소가 없어요, 둘째 줄도 재시도도 없다', async () => {
    getAirflowHost.mockResolvedValue('');
    render(<DagDetailModal row={row('pii_scan_reviews')} timezone="KST" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Airflow 주소가 없어요')).toBeTruthy());
    expect(document.body.textContent).not.toContain('응답에 DAG 이름도 주소도 없어요');
    expect(screen.queryByText('다시 시도')).toBeNull();
    expect(openButton()).toBeNull();
  });

  it('조회 실패 = 확인하지 못했어요 + 다시 시도, 누르면 다시 묻는다', async () => {
    getAirflowHost.mockRejectedValue(new Error('502'));
    render(<DagDetailModal row={row('pii_scan_reviews')} timezone="KST" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('주소를 확인하지 못했어요')).toBeTruthy());
    expect(document.body.textContent).toContain('잠시 후 다시 시도해 주세요.');
    expect(openButton()).toBeNull();
    expect(screen.queryByRole('link', { name: /Airflow에서 열기/ })).toBeNull();
    expect(getAirflowHost).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByText('다시 시도'));
    await waitFor(() => expect(getAirflowHost).toHaveBeenCalledTimes(2));
  });

  it('옛 문구는 어디에도 없다', async () => {
    getAirflowHost.mockResolvedValue('');
    render(<DagDetailModal row={row('pii_scan_reviews')} timezone="KST" onClose={() => {}} />);
    await waitFor(() => expect(screen.getByText('Airflow 주소가 없어요')).toBeTruthy());
    expect(document.body.textContent).not.toContain('DAG 주소 확인 불가');
    expect(document.body.textContent).not.toContain('실행 기록 없음');
  });
});
