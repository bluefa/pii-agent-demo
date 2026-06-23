'use client';

import { ProcessStatus } from '@/lib/types';
import { cardStyles, cn, idcStyles, numericFeatures, textColors } from '@/lib/theme';
import {
  IDC_INSTALL_TASK_STATUS,
  idcInstallStatusLabel,
  type IdcInstallStatus,
  type IdcResourceInstallView,
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
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import { LoadingState } from '@/app/components/ui/state';

/**
 * Aggregate a set of per-resource install statuses into one card bucket:
 * any FAIL → failed; else every status resolved (done bucket) → done; else
 * running. UNKNOWN resolves to the `running` bucket via IDC_INSTALL_TASK_STATUS
 * (it is work-in-progress), so a card with any UNKNOWN/IN_PROGRESS reads running.
 */
const aggregateCardStatus = (statuses: IdcInstallStatus[]): InstallTaskStatus => {
  if (statuses.length === 0) return 'pending';
  const buckets = statuses.map((s) => IDC_INSTALL_TASK_STATUS[s]);
  if (buckets.includes('failed')) return 'failed';
  if (buckets.includes('running')) return 'running';
  return 'done';
};

/**
 * IDC Step 4 — Agent 설치.
 *
 * Two-task install pipeline derived from the new installation-status contract's
 * three per-resource step DTOs (ADR-019):
 *   card 1 "BDC 측 리소스 설치 진행" ← aggregate of cxTerraform + bdpTerraform,
 *   card 2 "방화벽 확인"           ← aggregate of firewallCheck.
 * A per-resource status list surfaces the resource-level `installation_status`
 * (UNKNOWN → "작업중"). Status comes from `useIdcInstallationStatus` (DR-safe).
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

  const resources: IdcResourceInstallView[] = status?.resources ?? [];

  const bdcStatus = aggregateCardStatus(
    resources.flatMap((r) => [r.cxTerraform.status, r.bdpTerraform.status]),
  );
  const firewallStatus = aggregateCardStatus(resources.map((r) => r.firewallCheck.status));

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
          <span className="text-[11.5px] text-[#8B95A1]">
            Provider: <strong className="text-[#191F28]">IDC</strong>
          </span>
        </header>
        <div className={cardStyles.body}>
          {loading && resources.length === 0 ? (
            <LoadingState label="설치 정보를 불러오는 중입니다." />
          ) : (
            <>
              <InstallTaskPipeline items={tasks} columns={2} />

              {resources.length > 0 && (
                <div className={cn('mt-6', idcStyles.table.frame)}>
                  <table className="w-full">
                    <tbody className={idcStyles.table.body}>
                      {resources.map((r) => (
                        <tr key={r.resourceId}>
                          <td
                            className={cn(
                              idcStyles.table.cell,
                              'font-mono text-[12px]',
                              textColors.primary,
                              numericFeatures.tabular,
                            )}
                          >
                            {r.resourceId}
                          </td>
                          <td
                            className={cn(
                              idcStyles.table.cell,
                              'text-right text-[12px]',
                              textColors.secondary,
                            )}
                          >
                            {idcInstallStatusLabel(r.installationStatus)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {status?.lastCheck?.checkedAt && (
                <p className={cn('mt-4 text-[12px]', textColors.tertiary)}>
                  마지막 확인: {new Date(status.lastCheck.checkedAt).toLocaleString('ko-KR')}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      <RejectionAlert project={project} />
    </>
  );
};
