'use client';

/**
 * Test Connection 탭 — 결과 카드(이력 확인 header CTA 포함)와 확정 정보 카드의 컨테이너.
 * 이력은 우상단 secondary CTA가 여는 modal로 이동 — 결과 테이블이 카드 전폭을 쓴다.
 *
 * One shared `reloadKey` is the tab's refresh signal: every write in the tab
 * (재실행 요청 / 연동 승인 / 논리 DB 제외 정책 / Credential 변경) bumps it, because each of them
 * changes at least one other card. The history modal mounts per open, so it
 * always fetches the fresh trail and needs no reload plumbing.
 */
import { useCallback, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { TcResultCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcResultCard';
import { ConfirmedInfoCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/ConfirmedInfoCard';
import { TcHistoryModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcHistoryModal';

export interface TcTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
}

export function TcTab({ targetSourceId, detail }: TcTabProps): ReactElement {
  const [reloadKey, setReloadKey] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return (
    <>
      <section className={cn(pipelineStyles.card.base, 'relative')} aria-label="Test Connection">
        {/* Aligned with the card title (card.base = px-6 pt-5). */}
        <div className="absolute top-4 right-6">
          <PlButton variant="secondary" size="sm" onClick={() => setHistoryOpen(true)}>
            이력 확인
          </PlButton>
        </div>
        <TcResultCard
          targetSourceId={targetSourceId}
          detail={detail}
          reloadKey={reloadKey}
          onReload={reload}
        />
      </section>
      <ConfirmedInfoCard targetSourceId={targetSourceId} reloadKey={reloadKey} onReload={reload} />
      {historyOpen && (
        <TcHistoryModal targetSourceId={targetSourceId} onClose={() => setHistoryOpen(false)} />
      )}
    </>
  );
}
