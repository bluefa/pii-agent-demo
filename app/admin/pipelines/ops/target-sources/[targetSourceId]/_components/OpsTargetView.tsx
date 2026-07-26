'use client';

/**
 * Target Source 운영 상세 (Figma pYCA7zTWcZysYOpYykuYAN 4:2) — header + tab
 * shell + 진행 상태 tab. Other tabs are visible but disabled until their
 * contents ship (design/pipeline/ops-target-source-app-plan.md §1).
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getRawTargetSourceDetail, type RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import { getProcessStatus } from '@/app/lib/api';
import { getAwsRoleVerification, type AwsRoleVerification } from '@/app/lib/api/aws';
import { getCollaborationChannel, type CollaborationChannel } from '@/app/lib/api/ops';
import type { ProcessStatus } from '@/app/admin/pipelines/queue/_components/StepStack';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsHeader } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsHeader';
import { ProcessCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ProcessCard';
import { ApprovalHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ApprovalHistoryCard';
import { StatusHistoryCard } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/StatusHistoryCard';
import { InstallModeModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/InstallModeModal';
import { RoleVerifyModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RoleVerifyModal';
import { RoleEditModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/RoleEditModal';
import { ChannelModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/ChannelModal';
import { type RoleKind } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/roleMeta';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

const TABS = ['진행 상태', '스캔', '연동 요청 정보', '파이프라인', 'Test Connection'] as const;

type ModalState =
  | { type: 'mode' }
  | { type: 'verify'; kind: RoleKind }
  | { type: 'edit'; kind: RoleKind }
  | { type: 'channel' }
  | null;

export interface OpsTargetViewProps {
  targetSourceId: number;
}

export function OpsTargetView({ targetSourceId }: OpsTargetViewProps): ReactElement {
  const [detail, setDetail] = useState<RawTargetSourceDetail | null>(null);
  const [detailFailed, setDetailFailed] = useState(false);
  const [processStatus, setProcessStatus] = useState<ProcessStatus | null>(null);
  const [roles, setRoles] = useState<Partial<Record<RoleKind, AwsRoleVerification | null>>>({});
  const [grantTfExecution, setGrantTfExecution] = useState(false);
  const [channel, setChannel] = useState<CollaborationChannel | null>(null);
  const [modal, setModal] = useState<ModalState>(null);

  const [reloadKey, setReloadKey] = useState(0);
  const retry = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let loaded: RawTargetSourceDetail;
      try {
        loaded = await getRawTargetSourceDetail(targetSourceId);
      } catch {
        if (!cancelled) {
          setDetail(null);
          setDetailFailed(true);
        }
        return;
      }
      if (cancelled) return;
      setDetailFailed(false);
      setDetail(loaded);
      setGrantTfExecution(loaded.metadata?.grant_service_terraform_execution_permission === true);

      // Secondary loads are independent and best-effort — each block renders its
      // own fallback, so one failure must not blank the page.
      void getProcessStatus(targetSourceId)
        .then((status) => !cancelled && setProcessStatus(status.process_status as ProcessStatus))
        .catch(() => !cancelled && setProcessStatus(null));
      void getCollaborationChannel(targetSourceId)
        .then((loadedChannel) => !cancelled && setChannel(loadedChannel))
        .catch(() => !cancelled && setChannel(null));
      if (loaded.cloud_provider === 'AWS') {
        (['scan', 'execution'] as const).forEach((kind) => {
          void getAwsRoleVerification(targetSourceId, kind)
            .then((verification) => !cancelled && setRoles((prev) => ({ ...prev, [kind]: verification })))
            .catch(() => !cancelled && setRoles((prev) => ({ ...prev, [kind]: null })));
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, reloadKey]);

  if (detailFailed) {
    return (
      <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)}>
        <p>Target Source #{targetSourceId} 정보를 불러오지 못했습니다.</p>
        <PlButton variant="secondary" className="mt-3" onClick={retry}>
          다시 시도
        </PlButton>
      </div>
    );
  }

  if (!detail) {
    return (
      <div className={cn(pipelineStyles.empty.base, pipelineStyles.empty.center)} aria-busy>
        불러오는 중…
      </div>
    );
  }

  const isAws = detail.cloud_provider === 'AWS';
  const meta = detail.metadata ?? {};
  const accountId = meta.aws_account_id ?? '';
  const isChina = meta.is_china_region === true;
  const regionLabel = isChina ? 'China' : 'Global';
  const activeRole = modal && (modal.type === 'verify' || modal.type === 'edit') ? modal.kind : null;

  return (
    <div>
      <div className={opsStyles.headCard}>
        <OpsHeader
          targetSourceId={targetSourceId}
          detail={detail}
          processStatus={processStatus}
          isAws={isAws}
          roles={roles}
          grantTfExecution={grantTfExecution}
          channel={channel}
          onOpenMode={() => setModal({ type: 'mode' })}
          onOpenVerify={(kind) => setModal({ type: 'verify', kind })}
          onOpenEdit={(kind) => setModal({ type: 'edit', kind })}
          onOpenChannel={() => setModal({ type: 'channel' })}
        />
        <div className={opsStyles.tabStrip} role="tablist" aria-label="Target Source 운영 탭">
          {TABS.map((tab, index) => {
            const active = index === 0;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={!active}
                title={active ? undefined : '준비 중'}
                className={cn(
                  opsStyles.tab,
                  active ? opsStyles.tabActive : opsStyles.tabDisabled,
                )}
              >
                {tab}
                {active && <span className={opsStyles.tabIndicator} aria-hidden />}
              </button>
            );
          })}
        </div>
      </div>

      <div className={opsStyles.content}>
        {processStatus ? (
          <ProcessCard status={processStatus} />
        ) : (
          <section className={pipelineStyles.card.base} aria-label="현재 Process">
            <h2 className={opsStyles.cardTitle}>현재 Process</h2>
            <p className={cn(pipelineStyles.text.meta, 'mt-3')}>상태 정보를 불러오지 못했습니다.</p>
          </section>
        )}
        <div className={opsStyles.cardsRow}>
          <ApprovalHistoryCard targetSourceId={targetSourceId} />
          <StatusHistoryCard targetSourceId={targetSourceId} />
        </div>
      </div>

      <InstallModeModal
        open={modal?.type === 'mode'}
        onClose={() => setModal(null)}
        targetSourceId={targetSourceId}
        currentGrant={grantTfExecution}
        onSaved={setGrantTfExecution}
      />
      {activeRole && modal?.type === 'verify' && (
        <RoleVerifyModal
          open
          onClose={() => setModal(null)}
          targetSourceId={targetSourceId}
          kind={activeRole}
          verification={roles[activeRole] ?? null}
          serviceName={detail.service_name ?? '-'}
          serviceCode={detail.service_code ?? '-'}
          regionLabel={regionLabel}
          onRefreshed={(kind, verification) =>
            setRoles((prev) => ({ ...prev, [kind]: verification }))
          }
          onEdit={(kind) => setModal({ type: 'edit', kind })}
        />
      )}
      {activeRole && modal?.type === 'edit' && (
        <RoleEditModal
          open
          onClose={() => setModal(null)}
          targetSourceId={targetSourceId}
          kind={activeRole}
          currentArn={roles[activeRole]?.role_arn ?? undefined}
          accountId={accountId}
          isChinaRegion={isChina}
          regionLabel={regionLabel}
          onSaved={(kind, roleArn) =>
            // A fresh ARN starts unverified — surface IN_PROGRESS until the next verify.
            setRoles((prev) => ({
              ...prev,
              [kind]: { status: 'IN_PROGRESS', role_arn: roleArn },
            }))
          }
        />
      )}
      <ChannelModal
        open={modal?.type === 'channel'}
        onClose={() => setModal(null)}
        targetSourceId={targetSourceId}
        channel={channel}
        onSaved={setChannel}
      />
    </div>
  );
}
