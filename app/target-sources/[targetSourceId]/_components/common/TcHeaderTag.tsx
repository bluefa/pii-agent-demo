'use client';

import { useEffect, useState } from 'react';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { fmtRelativeTime } from '@/lib/pipeline/format';
import { fetchLatestTest } from '@/app/hooks/useTestConnectionPolling';
import { useLiveTcJob } from '@/app/hooks/useLiveTcJob';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { foldAgentStatuses } from '@/lib/test-connection-summary';

/**
 * 대상 상세 헤더의 연결 테스트 상태 태그 (P5) — latest_version 한 번 읽기.
 * 실행 기록이 없으면(NOT_FOUND) 아무것도 그리지 않는다. 스스로 폴링하지 않는다 —
 * 라이브 진행은 Step 5 카드의 몫이고, 대신 그 폴링이 발행하는 관찰(useLiveTcJob)을
 * 구독해 같은 화면에서 새 실행이 돌면 헤더도 같은 사실을 말한다.
 */
export const TcHeaderTag = ({ targetSourceId }: { targetSourceId: number }) => {
  const [fetched, setFetched] = useState<TestConnectionVersionResult | null>(null);
  const live = useLiveTcJob(targetSourceId);

  useEffect(() => {
    let active = true;
    void fetchLatestTest(targetSourceId)
      .then((latest) => {
        if (active) setFetched(latest);
      })
      .catch(() => {
        if (active) setFetched(null);
      });
    return () => {
      active = false;
    };
  }, [targetSourceId]);

  // 라이브 관찰은 이 세션의 폴링이 마지막으로 본 값이라 마운트 조회보다 뒤설 수
  // 없다 — 버전이 앞서거나 같으면(같은 실행의 진행→정착 갱신 포함) 라이브가 이긴다.
  const job =
    live &&
    (!fetched || (live.test_connection_version ?? 0) >= (fetched.test_connection_version ?? 0))
      ? live
      : fetched;

  if (!job) return null;

  const status = job.connection_status;
  const tagClass =
    status === 'SUCCESS'
      ? idcStyles.tag.green
      : status === 'FAIL'
        ? idcStyles.tag.red
        : idcStyles.tag.orange;

  let label: string;
  if (status === 'SUCCESS') {
    label = '연결 테스트 성공';
  } else if (status === 'FAIL') {
    const folded = foldAgentStatuses(job.test_connection_agent_results ?? []);
    const failCount = [...folded.values()].filter((s) => s === 'FAIL').length;
    label = failCount > 0 ? `연결 테스트 실패 ${failCount}건` : '연결 테스트 실패';
  } else {
    label = '연결 테스트 진행 중';
  }

  const version = job.test_connection_version;
  const timestamp = job.completed_at ?? job.requested_at;

  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cn(idcStyles.tag.base, tagClass)}>
        {version !== null && version !== undefined ? `#${version} ` : ''}
        {label}
      </span>
      {timestamp && (
        <span className={cn('text-[12px] font-medium', textColors.tertiary)}>
          {fmtRelativeTime(timestamp)}
        </span>
      )}
    </span>
  );
};
