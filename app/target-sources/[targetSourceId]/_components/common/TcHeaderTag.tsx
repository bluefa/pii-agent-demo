'use client';

import { useEffect, useState } from 'react';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { fmtRelativeTime } from '@/lib/pipeline/format';
import { fetchLatestTest } from '@/app/hooks/useTestConnectionPolling';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { foldAgentStatuses } from '@/lib/test-connection-summary';

/**
 * 대상 상세 헤더의 연결 테스트 상태 태그 (P5) — latest_version 한 번 읽기.
 * 실행 기록이 없으면(NOT_FOUND) 아무것도 그리지 않는다. 폴링하지 않는다 —
 * 라이브 진행은 Step 5 카드의 몫이고, 헤더는 "마지막 실행이 언제 어떤 판정이었나"만
 * 말한다.
 */
export const TcHeaderTag = ({ targetSourceId }: { targetSourceId: number }) => {
  const [job, setJob] = useState<TestConnectionVersionResult | null>(null);

  useEffect(() => {
    let active = true;
    void fetchLatestTest(targetSourceId)
      .then((latest) => {
        if (active) setJob(latest);
      })
      .catch(() => {
        if (active) setJob(null);
      });
    return () => {
      active = false;
    };
  }, [targetSourceId]);

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
