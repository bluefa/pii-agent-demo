'use client';

import { useEffect, useState } from 'react';
import { cn, idcStyles, textColors } from '@/lib/theme';
import { fmtRelativeTime } from '@/lib/pipeline/format';
import { fetchLatestTest } from '@/app/hooks/useTestConnectionPolling';
import type { TestConnectionVersionResult } from '@/app/lib/api';
import { foldAgentStatuses } from '@/lib/test-connection-summary';

interface TcHeaderTagProps {
  targetSourceId: number;
  /**
   * Step 5 가 폴링 중인 최신 실행. `undefined` = 폴링 없는 화면(스텝 1~4·6·7) —
   * 이 태그가 latest_version 을 1회 조회한다. 값이 오면(null 포함) 그것이 진실의
   * 전부다: null 은 "실행 없음(NOT_FOUND)"이므로 무표시. 모듈 스토어로 잇지 않는
   * 이유는 DR1/DR7(모듈 레벨 fetch 결과 보관 금지) — prop 이 곧 최신 관찰이다.
   */
  liveJob?: TestConnectionVersionResult | null;
}

/**
 * 대상 상세 헤더의 연결 테스트 상태 태그 (P5). 실행 기록이 없으면 아무것도 그리지
 * 않는다. 스스로 폴링하지 않는다 — Step 5 화면에서는 카드의 폴링이 liveJob 으로
 * 같은 사실을 내려 주고, 그 외 스텝에서는 마지막 실행을 1회 조회해 보여준다.
 */
export const TcHeaderTag = ({ targetSourceId, liveJob }: TcHeaderTagProps) => {
  const [fetched, setFetched] = useState<TestConnectionVersionResult | null>(null);
  const controlled = liveJob !== undefined;

  useEffect(() => {
    if (controlled) return;
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
  }, [controlled, targetSourceId]);

  const job = controlled ? liveJob : fetched;

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
