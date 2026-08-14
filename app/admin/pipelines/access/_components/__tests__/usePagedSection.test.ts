// @vitest-environment jsdom
import { useCallback } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { usePagedSection } from '@/app/admin/pipelines/access/_components/PagedCard';
import { sliceToPage, type AccessPage } from '@/app/lib/api/access';

/**
 * 페이지 번호는 목록보다 오래 산다.
 *
 * 목록이 짧아지는 길은 넷이다 — 레일에서 다른 서비스로(같은 페이지 컴포넌트라 state 가
 * 그대로다), 검색, 마지막 행 회수, 마지막 행에서 신청. 어느 쪽이든 3페이지에 선 채로
 * 한 장짜리 목록을 받으면 카드 머리의 배지는 "4건"을 말하는데 본문은 "없어요"를 그리고,
 * 페이저는 존재하지 않는 페이지를 가리킨다.
 *
 * 이건 서버가 정상 응답을 준 뒤에 벌어지는 일이라 에러도 경고도 없다.
 */
describe('usePagedSection — 사라진 페이지', () => {
  const rows = (n: number): string[] => Array.from({ length: n }, (_, i) => `row-${i}`);

  /**
   * 화면들이 하는 그대로 — `fetcher` 는 useCallback 으로 고정한다. 매 렌더 새 함수를
   * 넘기면 effect 가 끝없이 다시 돈다(훅 주석의 전제이자, 실제 소비자 넷의 모양이다).
   */
  const useFetcher = (total: number) =>
    useCallback(
      async (page: number): Promise<AccessPage<string>> => sliceToPage(rows(total), page, 5),
      [total],
    );

  it('짧아진 목록을 받으면 마지막 장으로 물러난다', async () => {
    const { result, rerender } = renderHook(
      ({ total }: { total: number }) => usePagedSection(useFetcher(total)),
      { initialProps: { total: 12 } },
    );

    // 12건 / 5행 = 3장. 마지막 장으로 간다.
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.paged?.content).toEqual(['row-10', 'row-11']));

    // 목록이 4건으로 줄었다 — 3페이지는 이제 없다.
    rerender({ total: 4 });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.page).toBe(0);
    expect(result.current.paged?.totalElements).toBe(4);
    // 배지가 4건을 말하면 본문에도 4건이 있어야 한다.
    expect(result.current.paged?.content).toHaveLength(4);
  });

  it('목록이 비어도 첫 장으로 돌아온다', async () => {
    const { result, rerender } = renderHook(
      ({ total }: { total: number }) => usePagedSection(useFetcher(total)),
      { initialProps: { total: 12 } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(result.current.page).toBe(2));

    rerender({ total: 0 });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.page).toBe(0);
    expect(result.current.paged?.content).toEqual([]);
  });
});
