'use client';

/**
 * Test Connection 탭 — 결과 · 확정 정보 · 이력 세 카드의 컨테이너.
 *
 * One shared `reloadKey` is the tab's refresh signal: every write in the tab
 * (재실행 요청 / 연동 승인 / 논리 DB 제외 정책 / Credential 변경) bumps it, because each of them
 * changes at least one other card — a skip-policy save moves the 결과 counts, an
 * approve/reject adds an 이력 row. Each card fetches independently, so a failure in
 * one never blanks the others (the inter-card gap comes from the parent's
 * `opsStyles.content` column).
 */
import { useCallback, useState, type ReactElement } from 'react';
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
      <TcResultCard
        targetSourceId={targetSourceId}
        detail={detail}
        reloadKey={reloadKey}
        onReload={reload}
      />
      <ConfirmedInfoCard targetSourceId={targetSourceId} reloadKey={reloadKey} onReload={reload} />
      <TcHistoryCard targetSourceId={targetSourceId} reloadKey={reloadKey} />
    </>
  );
}
