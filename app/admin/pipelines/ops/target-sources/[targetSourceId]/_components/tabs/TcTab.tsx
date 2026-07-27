'use client';

/**
 * Test Connection 탭 — [결과 + 이력] 그룹 카드와 확정 정보 카드의 컨테이너.
 * 결과와 이력은 같은 Test Connection 데이터의 두 단면이라 한 카드로 묶는다.
 *
 * One shared `reloadKey` is the tab's refresh signal: every write in the tab
 * (재실행 요청 / 연동 승인 / 논리 DB 제외 정책 / Credential 변경) bumps it, because each of them
 * changes at least one other card — a skip-policy save moves the 결과 counts, an
 * approve/reject adds an 이력 row. Each card fetches independently, so a failure in
 * one never blanks the others (the inter-card gap comes from the parent's
 * `opsStyles.content` column).
 */
import { useCallback, useState, type ReactElement } from 'react';
import { pipelineStyles } from '@/lib/theme';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { TcResultCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcResultCard';
import { ConfirmedInfoCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard';
import { TcHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcHistoryCard';

export interface TcTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function TcTab({ targetSourceId, detail }: TcTabProps): ReactElement {
  const [reloadKey, setReloadKey] = useState(0);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <>
      <section className={pipelineStyles.card.base} aria-label="Test Connection">
        {/* 결과 = main pane, 이력 = side rail (own pagination) — one dataset, two panes. */}
        <div className="grid grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
          <TcResultCard
            targetSourceId={targetSourceId}
            detail={detail}
            reloadKey={reloadKey}
            onReload={reload}
          />
          <div className="min-w-0 border-l border-[var(--pl-border)] pl-6">
            <TcHistoryCard targetSourceId={targetSourceId} reloadKey={reloadKey} />
          </div>
        </div>
      </section>
      <ConfirmedInfoCard targetSourceId={targetSourceId} reloadKey={reloadKey} onReload={reload} />
    </>
  );
}
