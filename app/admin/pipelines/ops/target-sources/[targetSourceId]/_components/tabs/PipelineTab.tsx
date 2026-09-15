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
 * There is no start gate (owner 2026-09-11): 작업 시작 is always offered. The one
 * judgement this tab still computes is which type row is live in the modal.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactElement } from 'react';
import { useModal } from '@/app/hooks/useModal';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { InfraStatusHead } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InfraStatusHead';
import { PscSubnetGuide } from '@/app/components/features/process-status/gcp/PscSubnetGuide';
import { usePscSubnetTargets } from '@/app/components/features/process-status/gcp/usePscSubnetTargets';
import { useInstallCheck } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/useInstallCheck';
import { useInstallResourceIdentity } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installIdentity';
import { installStateView } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installState';
import { CURRENT_WORK_ID } from '@/app/admin/pipelines/_detail/TargetPipelineSections';
import type { ServiceWorkNoticeData } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ServiceWorkNotice';
import { PreviewModal } from '@/app/admin/pipelines/_detail/PreviewModal';
import { TargetPipelineSections } from '@/app/admin/pipelines/_detail/TargetPipelineSections';
import { wireProvider } from '@/app/admin/pipelines/_detail/customBuilder';
import { providerKey } from '@/lib/pipeline/format';
import { isSduTarget } from '@/lib/types';
import { pipelineTypeGate } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/gateStage';
import { getTerraformStatus, type TerraformStatusResponse } from '@/app/lib/api';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import type { OpsTargetTabLabel } from '@/lib/routes';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

/**
 * 이 대상의 terraform 작업 카탈로그를 고르는 키.
 *
 * SDU 는 밑에 깔린 CSP 를 이긴다(오너 결정) — 그 계정은 우리가 설치하는 계정이 아니고,
 * SDU 의 작업은 `SDU_BDC_SERVICE_COMMON` · `SDU_BDC_SERVICE` 둘뿐이라 AWS 의 카탈로그를
 * 물려받으면 존재하지 않는 작업 이름을 그린다.
 *
 * 판정은 `isSduTarget` 하나로 한다. 계약이 SDU 를 말하는 자리는 **둘**이고
 * (`metadata.is_sdu_type` · `cloud_provider` enum 의 `SDU`), 플래그만 읽으면 provider
 * 로만 SDU 가 오는 대상이 조용히 밑의 CSP 것을 받는다.
 */
export const pipelineProviderKey = (detail: RawTargetSourceDetail): string =>
  isSduTarget({
    is_sdu_type: detail.metadata?.is_sdu_type,
    cloud_provider: detail.cloud_provider,
  })
    ? 'sdu'
    : providerKey(detail.cloud_provider ?? '');

/**
 * 이 대상의 설치를 **서비스가 직접** 적용하는가 (AWS 수동 설치).
 *
 * 계약이 말하는 것은 그 반대의 허가다 — `grant_service_terraform_execution_permission` 가
 * true 면 BDC 가 서비스 계정에 스크립트를 적용한다(자동). 그래서 판정은 `!== true` 이지
 * `=== false` 가 아니다: 필드가 없는 대상은 허가한 적 없는 대상이므로 수동이다.
 *
 * 두 탭이 같은 답을 읽는다(인프라 작업의 서비스 측 단계 이름 · 연결 테스트의 설치 단계
 * 이름). 한쪽이 반대로 읽으면 같은 대상의 같은 단계가 두 탭에서 다른 이름을 갖는다.
 */
export const isManualInstall = (detail: RawTargetSourceDetail): boolean =>
  detail.metadata?.grant_service_terraform_execution_permission !== true;

export interface PipelineTabProps {
  targetSourceId: number;
  detail: RawTargetSourceDetail;
  /** Which step the target is at — names the stage the gate is waiting on. */
  processStatus: ProcessStatus | null;
  /** Opens another tab of this screen (the head's step link). */
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
  // 어느 작업 유형 행이 모달에서 살아 있는가. 두 사실을 읽지만 답하는
  // 질문이 다르다 — 저쪽은 「작업 시작이 왜 닫혔는가」, 이쪽은 「열렸을 때 무엇을 고를 수
  // 있는가」다. 여기서도 못 읽은 상태(null)는 「없다」가 아니다.
  const typeGate = useMemo(
    () => pipelineTypeGate(processStatus, status?.has_confirmed_infra ?? null),
    [processStatus, status],
  );

  const provider = pipelineProviderKey(detail);
  const orchProvider = wireProvider(provider);
  // 설치 상태는 terraform-status 와 **다른 출처**다 — 우리 쪽 작업 기록이 아니라 CSP 에
  // 실제로 무엇이 서 있는지를 묻는다(installation-status). 머리 카드의 「누구 차례」와
  // 현재 작업 카드의 서비스 측 경고가 같은 스냅샷을 읽는다.
  const manualInstall = isManualInstall(detail);
  const install = useInstallCheck(targetSourceId, provider, manualInstall);
  // The rows under the open step name each resource; the IDC wire has no name, so
  // the address comes from the confirmed integration (the 확정 정보 tab's own read).
  const identity = useInstallResourceIdentity(targetSourceId, provider !== 'sdu');
  // GCP: the subnet commands the service side runs, same rows and same block as the
  // user's step-4 card, so the operator and the owner read one thing.
  const subnetTargets = usePscSubnetTargets(targetSourceId, provider === 'gcp');
  const installView = useMemo(
    () =>
      installStateView({
        provider,
        manualInstall,
        detail: install.detail,
        loading: install.loading,
      }),
    [provider, manualInstall, install.detail, install.loading],
  );
  const goToCurrentWork = useCallback(() => {
    document.getElementById(CURRENT_WORK_ID)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);
  // 판정은 여기서 나고, 그것을 문장으로 만드는 일은
  // 그 문장이 붙는 동작(작업 시작)을 가진 카드가 한다.
  const serviceWork = useMemo<ServiceWorkNoticeData | null>(
    () =>
      install.gate === null
        ? null
        : { result: install.gate, lastCheck: install.lastCheck },
    [install.gate, install.lastCheck],
  );
  // Stable on purpose: `TargetPipelineSections` lists this callback in the deps of the
  // effect that polls the live run, so a fresh function per render would restart that
  // poll (and refetch the pipeline) on every render of this tab.
  const installReload = install.reload;
  const onRunsChanged = useCallback(() => {
    void load();
    installReload();
  }, [load, installReload]);

  return (
    <div>
      <InfraStatusHead
        status={status}
        loading={loading}
        failed={failed}
        processStatus={processStatus}
        onSelectTab={onSelectTab}
        install={installView}
        installLoading={install.loading}
        installLastCheck={install.lastCheck}
        identity={identity}
        idc={provider === 'idc'}
        subnetGuide={subnetTargets.length > 0 ? <PscSubnetGuide targets={subnetTargets} admin /> : undefined}
        onGoToCurrentWork={goToCurrentWork}
      />
      <TargetPipelineSections
        targetSourceId={String(targetSourceId)}
        provider={orchProvider}
        onStart={previewModal.open}
        serviceWork={serviceWork}
        onRunsChanged={onRunsChanged}
        refreshKey={startedKey}
      />

      <PreviewModal
        open={previewModal.isOpen}
        onClose={previewModal.close}
        targetSourceId={String(targetSourceId)}
        provider={orchProvider}
        typeGate={typeGate}
        showToast={toast.show}
        onStarted={() => setStartedKey((k) => k + 1)}
      />
    </div>
  );
}
