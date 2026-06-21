'use client';

import { useEffect, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { bgColors, borderColors, cn, textColors } from '@/lib/theme';
import { getIdcResources, type IdcResourceView } from '@/app/lib/api/idc';
import { useIdcInstallationStatus } from '@/app/hooks/useIdcInstallationStatus';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  InstallTaskPipeline,
  type InstallTaskPipelineItem,
} from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import type { InstallTaskStatus } from '@/lib/constants/gcp';
import type { IdcTfStatus } from '@/app/lib/api/idc';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { IdcFirewallModal } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/modals/IdcFirewallModal';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { LoadingState } from '@/app/components/ui/state';

/** v15 `bdc_tf` → install-task pill state (L6582 done / L6590 running). */
const BDC_TASK_STATUS: Record<IdcTfStatus, InstallTaskStatus> = {
  COMPLETED: 'done',
  IN_PROGRESS: 'running',
  FAILED: 'failed',
  PENDING: 'pending',
};

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';

/**
 * IDC Step 4 — Agent 설치 (v15 `data-prov-view="idc"`, L6579~6634).
 *
 * Two-task install pipeline (BDC 리소스 설치 + 방화벽 확인) over the live
 * installation status, plus the read-only 연동 대상 목록 (`src`,`fw` columns)
 * and a click-through 방화벽 확인 모달.
 *
 * Status comes from `useIdcInstallationStatus` (already DR3 abort + DR4 reset +
 * DR5 stale-guard). The resource list is fetched here with its own
 * AbortController + stale-guard so a target switch cannot leak rows (§DR).
 */
export const IdcStep4Installing = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const { targetSourceId } = project;
  const slotKey = resolveStepSlot('IDC', ProcessStatus.INSTALLING);
  const { status, loading, refreshing, error, refresh } =
    useIdcInstallationStatus(targetSourceId);

  const [resources, setResources] = useState<IdcResourceView[]>([]);
  const [firewallOpen, setFirewallOpen] = useState(false);

  // §DR3/DR5 — abort on switch/unmount, discard stale responses, scope by id.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void getIdcResources(targetSourceId, { signal: controller.signal })
      .then((data) => {
        if (active) setResources(data);
      })
      .catch((err) => {
        if (isAbort(err) || !active) return;
        if (active) setResources([]);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [targetSourceId]);

  const bdcStatus: InstallTaskStatus = status ? BDC_TASK_STATUS[status.bdcTf] : 'pending';
  const firewallOpened = status?.firewallOpened ?? false;

  // Per-resource Source IP / firewall state is surfaced by installation-status
  // (contract §6 G6), not by /resources. Merge it into the displayed rows so a
  // backend that follows the contract — where /resources omits these fields —
  // still renders Step 4 correctly. In mock both carry the same values, so the
  // demo is unchanged; this only removes the cutover risk.
  const statusById = new Map((status?.resources ?? []).map((r) => [r.resourceId, r]));
  const mergedResources: IdcResourceView[] = resources.map((r) => {
    const s = statusById.get(r.resourceId);
    return s ? { ...r, sourceIps: s.sourceIps, firewallOpen: s.firewallOpen } : r;
  });

  const tasks: InstallTaskPipelineItem[] = [
    {
      key: 'bdc',
      title: 'BDC 측 리소스 설치 진행',
      sub: 'BDC망 내 PII Agent 수집 모듈과 네트워크 경로를 구성하는 단계',
      status: bdcStatus,
    },
    {
      key: 'firewall',
      title: '방화벽 확인',
      sub: 'Source IP → 연동 대상 방화벽 오픈 여부를 점검하는 단계',
      status: firewallOpened ? 'done' : 'running',
      onClick: () => setFirewallOpen(true),
    },
  ];

  return (
    <>
      <ProjectPageMeta
        project={project}
        providerLabel={providerLabel}
        identity={identity}
        action={action}
      />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      {slotKey && <GuideCardContainer slotKey={slotKey} />}

      <div className={cn('rounded-xl shadow-sm overflow-hidden', bgColors.surface)}>
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-center justify-between gap-4">
            <h3 className={cn('text-[15px] font-bold', textColors.primary)}>설치 진행 상태</h3>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              className={cn(
                'text-[12px] font-medium hover:underline disabled:opacity-50 disabled:no-underline',
                textColors.tertiary,
              )}
            >
              {refreshing ? '확인 중…' : '설치 상태 새로고침'}
            </button>
          </div>

          {error ? <p className={cn('text-[12px]', textColors.tertiary)}>{error}</p> : null}

          <InstallTaskPipeline items={tasks} columns={2} />
        </div>

        <div className={cn('border-t', borderColors.default)}>
          {loading && resources.length === 0 ? (
            <LoadingState label="설치 정보를 불러오는 중입니다." />
          ) : (
            <IdcResourceTable resources={mergedResources} cols={['src', 'fw']} />
          )}
        </div>
      </div>

      <RejectionAlert project={project} />

      <IdcFirewallModal
        isOpen={firewallOpen}
        onClose={() => setFirewallOpen(false)}
        resources={mergedResources}
      />
    </>
  );
};
