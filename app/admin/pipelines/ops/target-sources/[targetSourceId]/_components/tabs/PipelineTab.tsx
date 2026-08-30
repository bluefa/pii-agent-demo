'use client';

/**
 * 인프라 작업 tab — InfraStatusHead (what the tab is, and what is applied) over
 * TargetPipelineSections (the run that changes it, + the archive). This tab is
 * the ONLY home for the sections since the standalone /admin/pipelines/targets/{id}
 * route was removed.
 *
 * The terraform-status fetch lives here rather than inside the head because two
 * things read the same response: the head renders it, and the start CTA is gated
 * on `has_confirmed_infra`. It is also refetched when a run reaches a terminal
 * state — previously the status card only loaded on mount, so a pipeline could
 * finish below a card still showing its pre-run snapshot.
 *
 * The start-pipeline modal is owned here too, though nothing in the head opens it
 * (owner call: 작업 시작 belongs to the 현재 작업 card, never to the head — see
 * docs/ux/benchmark/ops-infra-tab.md). Both entrances live in the run cards —
 * EmptyPipelineCard's 작업 시작 and the 최근 작업 card's 새 작업 시작 — and this is
 * simply the one place that owns their shared modal.
 *
 * When 확정 정보 is missing this tab does NOT state it twice. The head just reads
 * 미확정, and the ONE sentence about why 작업 시작 is closed — plus the one move
 * that opens it — is computed here by `gateStage` and handed to the 현재 작업
 * card, which is where the closed action lives.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useModal } from '@/app/hooks/useModal';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { InfraStatusHead } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InfraStatusHead';
import { PreviewModal } from '@/app/admin/pipelines/_detail/PreviewModal';
import { TargetPipelineSections } from '@/app/admin/pipelines/_detail/TargetPipelineSections';
import { wireProvider } from '@/app/admin/pipelines/_detail/customBuilder';
import { providerKey } from '@/lib/pipeline/format';
import { gateStage } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';
import { getTerraformStatus, type TerraformStatusResponse } from '@/app/lib/api';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import type { OpsTargetTabLabel } from '@/lib/routes';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

export interface PipelineTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** Which step the target is at — names the stage the gate is waiting on. */
  processStatus: ProcessStatus | null;
  /** Opens another tab of this screen — the gate's next step (승인 / 확정 정보). */
  onSelectTab: (tab: OpsTargetTabLabel) => void;
}

export function PipelineTab({
  targetSourceId,
  detail,
  processStatus,
  onSelectTab,
}: PipelineTabProps): ReactElement {
  const [status, setStatus] = useState<TerraformStatusResponse | null>(null);
  // Bumped when a run is created from the modal: starting a job no longer leaves
  // this tab for the run's 현황 page (owner), so the sections have to pick the new
  // run up in place.
  const [startedKey, setStartedKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const toast = usePlToast();
  // R21 §A1 — the type choice happens INSIDE the modal, so there is no payload to ride.
  const previewModal = useModal();

  // Latest-request-wins (ApprovalHistoryCard pattern): a response for a previous
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
  const startGate = useMemo(
    () =>
      status != null && !status.has_confirmed_infra
        ? gateStage(processStatus, targetSourceId)
        : null,
    [status, processStatus, targetSourceId],
  );

  // An SDU account is surfaced as SDU regardless of its underlying CSP
  // (metadata.is_sdu_type wins over cloud_provider — owner call).
  const provider = detail.metadata?.is_sdu_type ? 'sdu' : providerKey(detail.cloud_provider ?? '');
  const orchProvider = wireProvider(provider);

  return (
    <div>
      <InfraStatusHead
        status={status}
        loading={loading}
        failed={failed}
        processStatus={processStatus}
        onSelectTab={onSelectTab}
      />
      <TargetPipelineSections
        targetSourceId={String(targetSourceId)}
        provider={orchProvider}
        onStart={previewModal.open}
        startGate={startGate}
        onSelectTab={onSelectTab}
        onRunsChanged={load}
        refreshKey={startedKey}
      />

      <PreviewModal
        open={previewModal.isOpen}
        onClose={previewModal.close}
        targetSourceId={String(targetSourceId)}
        provider={orchProvider}
        showToast={toast.show}
        onStarted={() => setStartedKey((k) => k + 1)}
      />
    </div>
  );
}
