// @vitest-environment jsdom
/**
 * 연동 시점 — every control is a QUERY, and the picker does not fire one until 적용.
 *
 * What is pinned here is what a refactor can quietly lose:
 *   1. the first read carries the contract defaults (CREATED · ALL · createdAt,desc);
 *   2. 기준 and 최초 연동 go to the SERVER — the table never narrows rows itself;
 *   3. a preset inside the picker moves nothing until 적용 is pressed (Cloudscape rule);
 *   4. no header sorts — the order is the server's default (owner, 09-15);
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
  isSduType: false,
  isChinaRegion: false,
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

/** Segment buttons and table cells share words (최초 연동 완료확인 날짜), so every assertion
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
  it('opens on the contract defaults over a 7-day window', async () => {
    await renderView();
    const query = lastQuery();
    // The 최초 연동 filter and sort left the screen (owner, 09-15): the route defaults
    // them to ALL and createdAt,desc.
    expect(query).not.toHaveProperty('installed');
    expect(query).not.toHaveProperty('sort');
    expect(query).toMatchObject({
      axis: 'CREATED',
      page: 0,
      size: 20,
    });
    expect(query.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(query.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(Date.parse(String(query.to)) - Date.parse(String(query.from))).toBe(6 * 86_400_000);
    expect(segment('최근 기간').getByRole('button', { name: '7일' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a quick span applies at once and starts from the first page', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    await waitFor(() => expect(lastQuery().page).toBe(1));

    fireEvent.click(segment('최근 기간').getByRole('button', { name: '21일' }));
    await waitFor(() => expect(lastQuery().page).toBe(0));
    const query = lastQuery();
    expect(Date.parse(String(query.to)) - Date.parse(String(query.from))).toBe(20 * 86_400_000);
    expect(segment('최근 기간').getByRole('button', { name: '21일' }).getAttribute('aria-pressed')).toBe('true');
    expect(segment('최근 기간').getByRole('button', { name: '7일' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('a custom range lights 직접 선택 instead of a quick span', async () => {
    await renderView();
    expect(segment('최근 기간').getByRole('button', { name: '직접 선택' }).getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(screen.getByRole('button', { name: /–/ }));
    fireEvent.click(screen.getByRole('button', { name: '이번 달' }));
    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(lastQuery().from).toMatch(/-01$/));
    const pressed = segment('최근 기간')
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-pressed') === 'true')
      .map((button) => button.textContent);
    // Unless today happens to make 이번 달 exactly one of the quick spans.
    const monthSpan = Math.round((Date.parse(String(lastQuery().to)) - Date.parse(String(lastQuery().from))) / 86_400_000);
    expect(pressed).toEqual([6, 13, 20, 29].includes(monthSpan) ? [`${monthSpan + 1}일`] : ['직접 선택']);
  });

  it('직접 선택 opens the calendar', async () => {
    await renderView();
    fireEvent.click(segment('최근 기간').getByRole('button', { name: '직접 선택' }));
    expect(screen.getByRole('dialog', { name: '기간 선택' })).toBeTruthy();
  });

  it('labels the two groups and carries no 「… 기준 · N건」 caption (owner, 2026-09-15)', async () => {
    await renderView();
    const band = within(screen.getByLabelText('조회 조건'));
    expect(band.getByText('날짜 기준')).toBeTruthy();
    expect(band.getByText('기간')).toBeTruthy();
    expect(screen.queryByText(/기준 · \d+건/)).toBeNull();
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
    // 최초 연동 완료확인 날짜 and 리드타임 both have nothing to say — and say exactly that.
    expect(table().getAllByText('–').length).toBe(2);
  });

  it('sends 기준 to the server', async () => {
    await renderView();
    fireEvent.click(segment('날짜 기준').getByRole('button', { name: '최초 연동 완료확인 날짜' }));
    await waitFor(() => expect(lastQuery().axis).toBe('FIRST_INSTALLED'));
  });

  it('does not re-read until 적용 is pressed', async () => {
    await renderView();
    const opened = getIntegrationTimeline.mock.calls.length;

    fireEvent.click(screen.getByRole('button', { name: /–/ }));
    fireEvent.click(screen.getByRole('button', { name: '최근 14일' }));
    // A preset is a draft: the table still shows the window it was opened with.
    expect(getIntegrationTimeline.mock.calls.length).toBe(opened);

    fireEvent.click(screen.getByRole('button', { name: '적용' }));
    await waitFor(() => expect(getIntegrationTimeline.mock.calls.length).toBeGreaterThan(opened));
    const query = lastQuery();
    expect(Date.parse(String(query.to)) - Date.parse(String(query.from))).toBe(13 * 86_400_000);
  });

  it('shows the provider as a Cloud column, the same tag as the queue table (owner, 2026-09-15)', async () => {
    await renderView();
    expect(table().getByRole('columnheader', { name: 'Cloud' })).toBeTruthy();
    expect(table().getAllByText('AWS').length).toBeGreaterThan(0);
  });

  it('offers no sort — no header is a button (owner, 2026-09-15)', async () => {
    await renderView();
    expect(table().getAllByRole('columnheader').length).toBe(8);
    expect(table().getAllByRole('columnheader').some((th) => th.querySelector('button'))).toBe(false);
    expect(table().getAllByRole('columnheader').some((th) => th.hasAttribute('aria-sort'))).toBe(false);
  });

  it('returns to the first page when the question changes', async () => {
    await renderView();
    fireEvent.click(screen.getByRole('button', { name: /다음/ }));
    await waitFor(() => expect(lastQuery().page).toBe(1));

    fireEvent.click(segment('날짜 기준').getByRole('button', { name: '최초 연동 완료확인 날짜' }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ axis: 'FIRST_INSTALLED', page: 0 }));
  });

  it('downloads the sheet with the filters on screen, without the pager', async () => {
    downloadIntegrationTimelineCsv.mockResolvedValue(new Blob(['id'], { type: 'text/csv' }));
    await renderView();
    fireEvent.click(segment('날짜 기준').getByRole('button', { name: '최초 연동 완료확인 날짜' }));
    await waitFor(() => expect(lastQuery().axis).toBe('FIRST_INSTALLED'));

    fireEvent.click(screen.getByRole('button', { name: 'Excel 내려받기' }));
    await waitFor(() => expect(downloadIntegrationTimelineCsv).toHaveBeenCalled());
    const csvQuery = downloadIntegrationTimelineCsv.mock.calls.at(-1)?.[0] as Record<string, unknown>;
    expect(csvQuery).toMatchObject({ axis: 'FIRST_INSTALLED' });
    expect(csvQuery).not.toHaveProperty('sort');
    expect(csvQuery.page).toBeUndefined();
    expect(csvQuery.size).toBeUndefined();
  });

  it('states a failed read instead of showing an empty table', async () => {
    getIntegrationTimeline.mockRejectedValue(new Error('boom'));
    await renderView();
    await screen.findByText('목록을 불러오지 못했습니다.');
  });
});
