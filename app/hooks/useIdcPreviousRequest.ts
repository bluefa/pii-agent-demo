'use client';

import { useEffect, useState } from 'react';
import { AppError } from '@/lib/errors';
import { getIdcPreviousRequest, type IdcResourceView } from '@/app/lib/api/idc';

export interface UseIdcPreviousRequestResult {
  resources: IdcResourceView[];
  loading: boolean;
  error: string | null;
}

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';

const FETCH_ERROR = '기존 연동 정보를 불러오지 못했어요. 잠시 후 다시 시도해주세요.';

/**
 * "기존 연동 요청 정보 불러오기" — fetches the previous integration request for a
 * target source with target-switch safety (docs/reports/idc-v15 §DR):
 *   DR3 — AbortController cancels the in-flight request on close/switch/unmount.
 *   DR5 — a closure-scoped `active` guard (flipped false by the cleanup before
 *         the next run) discards a late response, so a stray API result can
 *         never overwrite another target's rows.
 *
 * The modal mounts fresh per open, so initial state (loading) is correct without
 * a synchronous reset; results are committed only inside the async callbacks.
 */
export function useIdcPreviousRequest(targetSourceId: number): UseIdcPreviousRequestResult {
  const [resources, setResources] = useState<IdcResourceView[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    getIdcPreviousRequest(targetSourceId, { signal: controller.signal })
      .then((data) => {
        if (!active) return; // DR5 — stale response discarded
        setResources(data);
        setLoading(false);
      })
      .catch((err: unknown) => {
        if (!active || isAbort(err)) return; // DR3/DR5
        // 404 는 실패가 아니라 부재다 — 불러올 이전 요청이 없는 타겟소스에 상류가 그렇게
        // 답한다. 이걸 에러 문장으로 그리면 "못 불러왔다"(다시 열면 될지도 모른다)와
        // "불러올 게 없다"(다시 열어도 같다)가 한 화면이 되고, 사용자는 없는 재시도를
        // 찾는다. 빈 결과로 접어 모달의 빈 상태가 그 사실을 말하게 한다.
        if (err instanceof AppError && err.code === 'NOT_FOUND') {
          setResources([]);
          setLoading(false);
          return;
        }
        setError(FETCH_ERROR);
        setLoading(false);
      });

    return () => {
      active = false;
      controller.abort(); // DR3
    };
  }, [targetSourceId]);

  return { resources, loading, error };
}
