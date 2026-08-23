// @vitest-environment jsdom
import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AppError } from '@/lib/errors';

const { getIdcPreviousRequest } = vi.hoisted(() => ({ getIdcPreviousRequest: vi.fn() }));
vi.mock('@/app/lib/api/idc', () => ({ getIdcPreviousRequest }));

import { useIdcPreviousRequest } from '@/app/hooks/useIdcPreviousRequest';
import type { IdcResourceView } from '@/app/lib/api/idc';

const appError = (code: 'NOT_FOUND' | 'INTERNAL_ERROR', status: number) =>
  new AppError({ status, code, message: 'x', retriable: false });

/**
 * 불러오기 모달의 읽기. 여기서 갈라야 하는 것은 "못 불러왔다"와 "불러올 게 없다"다 —
 * 상류는 이전 요청이 없는 타겟소스에 404 로 답하고, 그건 실패가 아니라 부재다.
 */
describe('useIdcPreviousRequest', () => {
  it('404는 에러가 아니라 빈 결과다', async () => {
    getIdcPreviousRequest.mockRejectedValue(appError('NOT_FOUND', 404));

    const { result } = renderHook(() => useIdcPreviousRequest(1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeNull();
    expect(result.current.resources).toEqual([]);
  });

  // 대조군 — 다른 실패는 여전히 에러다. 이게 같이 접히면 위 테스트는 "전부 빈 결과로
  // 만든다"를 확인한 것에 지나지 않는다.
  it('그 밖의 실패는 에러로 남는다', async () => {
    getIdcPreviousRequest.mockRejectedValue(appError('INTERNAL_ERROR', 500));

    const { result } = renderHook(() => useIdcPreviousRequest(1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBeTruthy();
  });

  it('성공하면 행을 그대로 넘긴다', async () => {
    const resources = [{ resourceId: 'r1' }] as unknown as IdcResourceView[];
    getIdcPreviousRequest.mockResolvedValue(resources);

    const { result } = renderHook(() => useIdcPreviousRequest(1));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.resources).toEqual(resources);
  });
});
