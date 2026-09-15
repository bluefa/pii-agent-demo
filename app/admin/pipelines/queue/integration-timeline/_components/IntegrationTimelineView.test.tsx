// @vitest-environment jsdom
/**
 * 연동 시점 — every control is a QUERY, and the picker does not fire one until 적용.
 *
 * What is pinned here is what a refactor can quietly lose:
 *   1. the first read carries the contract defaults (CREATED · ALL · createdAt,desc);
 *   2. 기준 and 최초 연동 go to the SERVER — the table never narrows rows itself;
 *   3. a preset inside the picker moves nothing until 적용 is pressed (Cloudscape rule);
 *   4. a header click re-asks with a server sort and flips on the second click;
 *   5. changing what is asked for returns to the first page.
 */
import { render, screen, waitFor, within } from '@testing-library/react';
import { fireEvent } from '@testing-library/dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IntegrationTimelineRow, Paged } from '@/lib/types/task-queue';

const getIntegrationTimeline = vi.fn();
const downloadIntegrationTimelineCsv = vi.fn();

vi.mock('@/app/lib/api/task-queue-timeline', () => ({
  getIntegrationTimeline: (...args: unknown[]) => getIntegrationTimeline(...args),
  downloadIntegrationTimelineCsv: (...args: unknown[]) => downloadIntegrationTimelineCsv(...args),
}));

import { IntegrationTimelineView } from '@/app/admin/pipelines/queue/integration-timeline/_components/IntegrationTimelineView';

const row = (over: Partial<IntegrationTimelineRow> = {}): IntegrationTimelineRow => ({
  targetSourceId: 4130,
  serviceCode: 'SVC-PAY',
  serviceName: '결제 정산',
  cloudProvider: 'AWS',
  confirmStatus: 'CONFIRMED',
  createdAt: '2026-07-02T10:12:00+09:00',
  piiAgentFirstInstalledAt: '2026-07-11T16:40:00+09:00',
  leadTimeSeconds: 800_880,
  ...over,
});

const paged = (content: IntegrationTimelineRow[]): Paged<IntegrationTimelineRow> => ({
  content,
  totalElements: 41,
  totalPages: 3,
  number: 0,
  size: 20,
  first: true,
  last: false,
  numberOfElements: content.length,
  empty: content.length === 0,
});

/** Segment buttons and table cells share words (완료 · 최초 연동일), so every assertion
 *  names the control it is about rather than searching the whole screen. */
const segment = (name: string) => within(screen.getByRole('group', { name }));
const table = () => within(screen.getByRole('table'));

/** The query of the most recent read. */
const lastQuery = (): Record<string, unknown> =>
  getIntegrationTimeline.mock.calls.at(-1)?.[0] as Record<string, unknown>;

beforeEach(() => {
  vi.clearAllMocks();
  getIntegrationTimeline.mockResolvedValue(paged([row()]));
});

const renderView = async () => {
  render(<IntegrationTimelineView />);
  await waitFor(() => expect(getIntegrationTimeline).toHaveBeenCalled());
};

describe('IntegrationTimelineView', () => {
  it('opens on the contract defaults over a 90-day window', async () => {
    await renderView();
    const query = lastQuery();
    expect(query).toMatchObject({
      axis: 'CREATED',
      installed: 'ALL',
      sort: 'createdAt,desc',
      page: 0,
      size: 20,
    });
    expect(query.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('renders the row as the server wrote it', async () => {
    await renderView();
    await screen.findByText('결제 정산');
    // The day is the server's, not a re-zoned one, and the duration is its seconds.
    expect(table().getByText('2026-07-02')).toBeTruthy();
    expect(table().getByText('2026-07-11')).toBeTruthy();
    expect(table().getByText('9일 6시간')).toBeTruthy();
    expect(table().getByText('완료')).toBeTruthy();
  });

  it('says one fact for a target that never finished', async () => {
    getIntegrationTimeline.mockResolvedValue(
      paged([row({ piiAgentFirstInstalledAt: null, leadTimeSeconds: null })]),
    );
    await renderView();
    await screen.findByText('결제 정산');
    expect(table().getByText('미완료')).toBeTruthy();
    // 최초 연동일 and 리드타임 both have nothing to say — and say exactly that.
    expect(table().getAllByText('–').length).toBe(2);
  });

  it('sends 기준 to the server', async () => {
    await renderView();
    fireEvent.click(segment('기간 기준').getByRole('button', { name: '최초 연동일' }));
    await waitFor(() => expect(lastQuery().axis).toBe('FIRST_INSTALLED'));
  });

  it('sends 최초 연동 여부 to the server', async () => {
    await renderView();
    fireEvent.click(segment('최초 연동 여부').getByRole('button', { name: '미완료' }));
    await waitFor(() => expect(lastQuery().installed).toBe('NO'));
  });

  it('does not re-read until 적용 is pressed', async () => {
    await renderView();
    const opened = getIntegrationTimeline.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /–/ }));
    fireEvent.click(screen.getByRole('button', { name: '최근 7일' }));
    // A preset is a draft: the table still shows the window it was opened with.
    expect(getIntegrationTimeline.mock.calls.length).toBe(opened);

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(getIntegrationTimeline.mock.calls.length).toBeGreaterThan(opened));
    const query = lastQuery();
    expect(Date.parse(String(query.to)) - Date.parse(String(query.from))).toBe(6 * 86_400_000);
  });

  it('sorts on the server and flips on the second click', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: /리드타임/ }));
    await waitFor(() => expect(lastQuery().sort).toBe('leadTimeSeconds,desc'));
    fireEvent.click(screen.getByRole('button', { name: /리드타임/ }));
    await waitFor(() => expect(lastQuery().sort).toBe('leadTimeSeconds,asc'));
  });

  it('returns to the first page when the question changes', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    await waitFor(() => expect(lastQuery().page).toBe(1));

    fireEvent.click(segment('최초 연동 여부').getByRole('button', { name: '완료' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ installed: 'YES', page: 0 }));
  });

  it('downloads the CSV with the filters on screen, without the pager', async () => {
    downloadIntegrationTimelineCsv.mockResolvedValue(new Blob(['id'], { type: 'text/csv' }));
    await renderView();
    fireEvent.click(segment('최초 연동 여부').getByRole('button', { name: '미완료' }));
    await waitFor(() => expect(lastQuery().installed).toBe('NO'));

    fireEvent.click(screen.getByRole('button', { name: 'CSV 내려받기' }));
    await waitFor(() => expect(downloadIntegrationTimelineCsv).toHaveBeenCalled());
    const csvQuery = downloadIntegrationTimelineCsv.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(csvQuery).toMatchObject({ axis: 'CREATED', installed: 'NO', sort: 'createdAt,desc' });
    expect(csvQuery.page).toBeUndefined();
    expect(csvQuery.size).toBeUndefined();
  });

  it('states a failed read instead of showing an empty table', async () => {
    getIntegrationTimeline.mockRejectedValue(new Error('boom'));
    await renderView();
    await screen.findByText('목록을 불러오지 못했습니다.');
  });
});
