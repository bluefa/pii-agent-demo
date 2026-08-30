// @vitest-environment jsdom
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getTested = vi.fn();
const getExcluded = vi.fn();
const updateExcluded = vi.fn();

vi.mock('@/app/lib/api/logical-db', () => ({
  getTestedLogicalDatabases: (...args: unknown[]) => getTested(...args),
  getExcludedLogicalDatabases: (...args: unknown[]) => getExcluded(...args),
  updateExcludedLogicalDatabases: (...args: unknown[]) => updateExcluded(...args),
}));

import { LogicalDbModalLoader } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import type {
  ExcludedLogicalDatabase,
  TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';

const TESTED: TestedLogicalDatabase[] = [{ databaseName: 'live', type: 'DATABASE' }];
const EXCLUDED: ExcludedLogicalDatabase[] = [
  { databaseName: 'legacy', skipReason: 'TEMP', type: 'DATABASE' },
];

const PARTIAL_NOTICE =
  '최근 연결 테스트의 논리 DB 조회가 안 되나, 논리 DB 제외 목록은 편집하고 수정할 수 있어요.';

const renderLoader = (props: { manualEntry?: boolean; onSaved?: () => void } = {}) =>
  render(
    <LogicalDbModalLoader
      open
      targetSourceId={1020}
      resourceId="srv-1"
      resourceName="pg-cluster-prod-01"
      completedAt={null}
      scope="latest"
      manualEntry={props.manualEntry}
      onSaved={props.onSaved ?? vi.fn()}
      onClose={vi.fn()}
    />,
  );

const rowOf = (name: string): HTMLElement => {
  const row = screen.getByTitle(name).closest('tr');
  if (!row) throw new Error(`row not found for ${name}`);
  return row as HTMLElement;
};

describe('LogicalDbModalLoader', () => {
  beforeEach(() => {
    getTested.mockReset().mockResolvedValue(TESTED);
    getExcluded.mockReset().mockResolvedValue(EXCLUDED);
    updateExcluded.mockReset().mockResolvedValue(EXCLUDED);
  });

  it('a failed TESTED fetch still opens the table, with a notice, and 저장 stays reachable', async () => {
    getTested.mockRejectedValue(new Error('boom'));
    renderLoader();

    expect(await screen.findByText(PARTIAL_NOTICE)).toBeTruthy();
    // The policy is the whole table now — and it is still editable.
    const row = rowOf('legacy');
    fireEvent.click(within(row).getByRole('button', { name: '복원' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(updateExcluded).toHaveBeenCalled());
    expect(updateExcluded.mock.calls[0][2]).toEqual([]);
  });

  // ⛔ The mirror case is NOT symmetric: the PUT replaces the whole policy, so a policy we
  // could not read must never be saved over.
  it('a failed EXCLUDED fetch offers a retry and no table at all', async () => {
    getExcluded.mockRejectedValue(new Error('boom'));
    renderLoader();

    expect(await screen.findByText('논리 DB 정보를 불러오지 못했습니다.')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
    expect(screen.queryByText(PARTIAL_NOTICE)).toBeNull();
  });

  /**
   * ⛔ THE TRAP. `draftToExcludedItems` drops any id it has no row for, so serializing the
   * save from the FETCHED list instead of the rendered one makes a hand-typed exclusion
   * disappear into a silently-shorter PUT body.
   */
  it('a hand-typed row survives into the PUT body', async () => {
    renderLoader({ manualEntry: true });
    await screen.findByTitle('live');

    fireEvent.change(screen.getByLabelText('Database 이름'), { target: { value: 'shadow' } });
    fireEvent.change(screen.getByLabelText('Schema 이름 (선택)'), { target: { value: 'audit' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    await waitFor(() => expect(updateExcluded).toHaveBeenCalled());
    expect(updateExcluded.mock.calls[0][2]).toEqual([
      { databaseName: 'legacy', type: 'DATABASE', skipReason: 'TEMP' },
      { databaseName: 'shadow', schemaName: 'audit', type: 'SCHEMA', skipReason: 'TEMP' },
    ]);
  });

  /**
   * ⛔ THE OTHER TRAP. `null` from the client means the PUT landed and only the refresh
   * failed. Reported as an error, the frame would say `서버의 제외 정책은 그대로예요.` about
   * a change the server kept — and the user would make it a second time.
   */
  it('a saved write whose read-back failed is never called unchanged', async () => {
    updateExcluded.mockResolvedValue(null);
    const onSaved = vi.fn();
    renderLoader({ onSaved });
    await screen.findByTitle('live');

    fireEvent.click(within(rowOf('legacy')).getByRole('button', { name: '복원' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('저장은 됐지만 목록을 다시 읽지 못했어요')).toBeTruthy();
    expect(screen.getByText('제외 설정은 저장됐어요. 최신 목록은 모달을 다시 열면 보여요.')).toBeTruthy();
    expect(screen.queryByText('서버의 제외 정책은 그대로예요.')).toBeNull();
    expect(screen.queryByText('제외 설정을 저장하지 못했어요')).toBeNull();
    // 저장한 것으로 다시 누를 길은 없다 — 그 버튼이 곧 두 번 쓰기다.
    expect(screen.queryByRole('button', { name: '다시 저장하기' })).toBeNull();

    // 닫으면 부모는 새로고침한다 — 낡은 쪽은 저 화면이다.
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(onSaved).toHaveBeenCalledTimes(1);
  });

  it('a rejecting PUT still says the policy is unchanged', async () => {
    updateExcluded.mockRejectedValue(new Error('boom'));
    renderLoader();
    await screen.findByTitle('live');

    fireEvent.click(within(rowOf('legacy')).getByRole('button', { name: '복원' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));

    expect(await screen.findByText('제외 설정을 저장하지 못했어요')).toBeTruthy();
    expect(screen.getByText('서버의 제외 정책은 그대로예요.')).toBeTruthy();
  });

  /**
   * ⛔ 손으로 적은 schema 의 DATABASE 부모는 트리의 자리표시자일 뿐 `allRows` 에 없었다.
   * 그 그룹 행을 제외하면 자식 id 는 지워지고, 부모 id 는 행이 없어 `listStagedChanges` 와
   * `draftToExcludedItems` 양쪽에서 사라진다 — 표는 `제외 · 저장 전` 이라고 하는데 푸터는
   * `변경 없음` 이 되고 저장이 잠긴다.
   */
  it('손으로 더한 schema 의 DB 전체를 제외해도 그 제외가 살아남는다', async () => {
    renderLoader({ manualEntry: true });
    await screen.findByTitle('live');

    fireEvent.change(screen.getByLabelText('Database 이름'), { target: { value: 'shadow' } });
    fireEvent.change(screen.getByLabelText('Schema 이름 (선택)'), { target: { value: 'audit' } });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));

    // 이제 DB 전체를 제외한다 — 그룹 머리의 제외.
    fireEvent.click(within(rowOf('shadow')).getByRole('button', { name: '제외' }));
    fireEvent.click(screen.getByRole('button', { name: '제외 (저장 전에 추가)' }));

    // 자식의 제외는 부모가 흡수한다 — 한 건이지만, 그 한 건이 반드시 남아야 한다.
    expect(screen.getByText(/저장 전 변경 1건/)).toBeTruthy();
    const save = screen.getByRole('button', { name: '저장' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);
    fireEvent.click(save);

    await waitFor(() => expect(updateExcluded).toHaveBeenCalled());
    expect(updateExcluded.mock.calls[0][2]).toEqual([
      { databaseName: 'legacy', type: 'DATABASE', skipReason: 'TEMP' },
      { databaseName: 'shadow', type: 'DATABASE', skipReason: 'STG' },
    ]);
  });

  /** 로딩 셸과 준비된 모달은 한 폭이다 — 열 때마다 상자가 넓어지면 그 자체가 움직임이다. */
  it('the loading shell is already the width the table will need', () => {
    getTested.mockReturnValue(new Promise(() => {}));
    getExcluded.mockReturnValue(new Promise(() => {}));
    renderLoader();
    expect(screen.getByRole('dialog').className).toContain('max-w-[920px]');
  });

  it('the requester screen gets no 제외 추가 toolbar', async () => {
    renderLoader();
    await screen.findByTitle('live');
    expect(screen.queryByLabelText('Database 이름')).toBeNull();
  });
});
