'use client';

import { useEffect, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { cardStyles, cn } from '@/lib/theme';
import {
  getIdcConfirmedResources,
  IDC_INSTALL_TASK_STATUS,
  type IdcInstallStatus,
  type IdcResourceView,
} from '@/app/lib/api/idc';
import { useIdcInstallationStatus } from '@/app/hooks/useIdcInstallationStatus';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  InstallTaskPipeline,
  type InstallTaskPipelineItem,
} from '@/app/components/features/process-status/install-task-pipeline/InstallTaskPipeline';
import type { InstallTaskStatus } from '@/lib/constants/install-task';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import { IdcResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { IdcFirewallModal } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/modals/IdcFirewallModal';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { LoadingState } from '@/app/components/ui/state';

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';

/**
 * Aggregate per-resource install statuses into one card bucket: a FAIL present
 * → failed; else a still-running (IN_PROGRESS/UNKNOWN) present → running; else done.
 * UNKNOWN shares the running bucket via IDC_INSTALL_TASK_STATUS (work-in-progress).
 */
const aggregateCardStatus = (statuses: IdcInstallStatus[]): InstallTaskStatus => {
  if (statuses.length === 0) return 'pending';
  const buckets = statuses.map((s) => IDC_INSTALL_TASK_STATUS[s]);
  if (buckets.includes('failed')) return 'failed';
  if (buckets.includes('running')) return 'running';
  return 'done';
};

/**
 * IDC Step 4 — Agent 설치 (v15 `data-prov-view="idc"`, L6579~6634).
 *
 * Two-task install pipeline (BDC 리소스 설치 + 방화벽 확인) over the live
 * installation status, plus the read-only 연동 대상 목록 (`src`,`fw` columns)
 * and a click-through 방화벽 확인 모달.
 *
 * Data sources (ADR-019, data-layer only — design preserved from origin/main):
 *   - install STATUS ← `useIdcInstallationStatus` (installation-status contract;
 *     UNKNOWN → "작업중"/running bucket), driving the two pipeline cards;
 *   - RESOURCE LIST ← confirmed integration (`getIdcConfirmedResources`), fetched
 *     here with its own AbortController + stale-guard so a target switch cannot
 *     leak rows (§DR). Source IP / firewall columns come from the confirmed rows.
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
  const { status, loading } = useIdcInstallationStatus(targetSourceId);

  const [resources, setResources] = useState<IdcResourceView[]>([]);
  const [firewallOpen, setFirewallOpen] = useState(false);

  // §DR3/DR5 — abort on switch/unmount, discard stale responses, scope by id.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void getIdcConfirmedResources(targetSourceId, { signal: controller.signal })
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

  // The two install cards aggregate the per-resource installation-status steps:
  // BDC ← cxTerraform + bdpTerraform; 방화벽 ← firewallCheck. A backend mid-install
  // reports UNKNOWN, which buckets to "작업중"/running (not done/failed).
  const installResources = status?.resources ?? [];
  const bdcStatus = aggregateCardStatus(
    installResources.flatMap((r) => [r.cxTerraform.status, r.bdpTerraform.status]),
  );
  const firewallStatus = aggregateCardStatus(installResources.map((r) => r.firewallCheck.status));

  // Per-row firewall status for the `fw` column: join the installation-status
  // firewall_check.status to the confirmed-integration rows by resource_id (the
  // confirmed rows carry no firewall field). A row with no install entry falls
  // through to the neutral "BDC측 확인 필요" badge in IdcFirewallBadge.
  const firewallStatusByResource: Record<string, IdcInstallStatus> = Object.fromEntries(
    installResources.map((r) => [r.resourceId, r.firewallCheck.status]),
  );

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
      status: firewallStatus,
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

      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
          <div>
            <h2 className={cardStyles.cardTitle}>Agent 설치</h2>
            <p className={cn('mt-2.5', cardStyles.subtitle)}>
              승인된 인프라에 PII Agent를 배포하기 위한 설치 작업을 진행합니다.
            </p>
          </div>
          {/* v16 L6588 — provider indicator (not a control), short provider name. */}
          <span className="text-[11.5px] text-[#8B95A1]">
            Provider: <strong className="text-[#191F28]">IDC</strong>
          </span>
        </header>
        <div className={cardStyles.body}>
          <InstallTaskPipeline items={tasks} columns={2} />

          <div className="mt-6">
            {loading && resources.length === 0 ? (
              <LoadingState label="설치 정보를 불러오는 중입니다." />
            ) : (
              <IdcResourceTable
                resources={resources}
                cols={['src', 'fw']}
                firewallStatusByResource={firewallStatusByResource}
              />
            )}
          </div>
        </div>
      </section>

      <RejectionAlert project={project} />

      <IdcFirewallModal
        isOpen={firewallOpen}
        onClose={() => setFirewallOpen(false)}
        resources={resources}
        firewallStatusByResource={firewallStatusByResource}
      />
    </>
  );
};
