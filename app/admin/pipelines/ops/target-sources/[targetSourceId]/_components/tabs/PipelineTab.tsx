'use client';

/**
 * 인프라 작업 tab — InfraStatusHead (what the infrastructure IS) over
 * TargetPipelineSections (the run that changes it, + paged history). This tab is
 * the ONLY home for the sections since the standalone /admin/pipelines/targets/{id}
 * route was removed.
 *
 * The terraform-status fetch lives here rather than inside the head because two
 * things read the same response: the head renders it, and the start CTA is gated
 * on `has_confirmed_infra`. It is also refetched when a run reaches a terminal
 * state — previously the status card only loaded on mount, so a pipeline could
 * finish below a card still showing its pre-run snapshot.
 */
import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { InfraStatusHead } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InfraStatusHead';
import { TargetPipelineSections } from '@/app/admin/pipelines/_detail/TargetPipelineSections';
import { getTerraformStatus, type TerraformStatusResponse } from '@/app/lib/api';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

export interface PipelineTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** Moves to the 연동 요청 정보 tab — the gate banner's next step. */
  onOpenRequest: () => void;
}

export function PipelineTab({
  targetSourceId,
  detail,
  onOpenRequest,
}: PipelineTabProps): ReactElement {
  const [status, setStatus] = useState<TerraformStatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  // Latest-request-wins (StatusHistoryCard pattern): a response for a previous
  // target source must not commit over the current one.
  const loadSeq = useRef(0);
  const load = useCallback(async (): Promise<void> => {
    const seq = ++loadSeq.current;
    setFailed(false);
    try {
      const data = await getTerraformStatus(targetSourceId);
      if (seq !== loadSeq.current) return;
      setStatus(data);
    } catch {
      if (seq !== loadSeq.current) return;
      setFailed(true);
    } finally {
      if (seq === loadSeq.current) setLoading(false);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  // Only a KNOWN false blocks. An unknown status (still loading, or the lookup
  // failed) allows: this gate is operator guidance, not enforcement — the server
  // has to reject an unconfirmed start on its own — and a transient lookup
  // failure must not strand an operator with legitimate work to do.
  const startBlockedReason =
    status != null && !status.has_confirmed_infra
      ? '확정된 연동 정보가 없어 시작할 수 없습니다.'
      : null;

  return (
    <div>
      <InfraStatusHead
        status={status}
        loading={loading}
        failed={failed}
        onOpenRequest={onOpenRequest}
      />
      <TargetPipelineSections
        targetSourceId={String(targetSourceId)}
        raw={detail}
        firstSectionClassName="mt-6"
        startBlockedReason={startBlockedReason}
        onRunsChanged={load}
      />
    </div>
  );
}
