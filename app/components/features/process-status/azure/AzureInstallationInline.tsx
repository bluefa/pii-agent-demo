'use client';

import { useCallback, useMemo } from 'react';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { InstallStatusDetail } from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import {
  areInstallResourcesSettled,
  type InstallResourceMeta,
  type InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';
import { getAzureInstallationStatus } from '@/app/lib/api/azure';
import {
  buildAzureInstallDetail,
  type AzureInstallDetail,
} from '@/app/components/features/process-status/azure/install-detail-adapter';
import {
  INSTALL_POLL_INTERVAL_MS,
  useInstallationStatus,
} from '@/app/hooks/useInstallationStatus';
import { cardStyles, statusColors, cn } from '@/lib/theme';
import type { ConfirmedResource } from '@/lib/types/resources';
import { InstallCardHeader } from '@/app/components/features/process-status/install-status-detail/InstallCardHeader';
import { LastCheckStamp } from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';
import { useLocale } from '@/app/components/LocaleProvider';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';

interface AzureInstallationInlineProps {
  targetSourceId: number;
  confirmed: readonly ConfirmedResource[];
  /** 확정 연동 목록이 아직 로딩 중 — 스켈레톤을 유지한다. */
  confirmedLoading?: boolean;
  onInstallComplete?: () => void;
}

/**
 * 설치가 실제로 흐르는 순서: 서비스 측이 VM Subnet 을 만들고 → VM Terraform 을
 * 적용하면 → BDC 측 Terraform 이 돌고 → 마지막으로 서비스 측이 Private Endpoint
 * 연결을 승인한다.
 *
 * 제목은 계약 필드가 말하는 만큼만 쓴다. 이전 제목("VM Load Balancer",
 * "PII Agent VM · KeyVault")은 v16 프로토타입의 부연 문장에서 승격된 것으로,
 * `azure_virtual_machine_terraform_apply` / `bdc_side_terraform_apply` 어디에도
 * 그 리소스들을 지목하는 근거가 없다 — swagger 에 필드 description 자체가 없다.
 *
 * group 은 **누가 실행하는가**다(AWS 와 같은 규칙). 위 흐름 설명이 곧 근거다 —
 * 서비스 측이 Subnet 을 만들고, VM Terraform 을 적용하고, 마지막에 PE 를 승인한다.
 * BDC 가 도는 구간은 bdc 하나뿐이다. side 는 그룹 머리글이 대신 말하므로 그룹
 * 레일에서는 항목마다 다시 찍지 않는다.
 */
type AzureCopy = (typeof INSTALL_COPY)['ko'];

const azureSteps = (t: AzureCopy): InstallTableStep[] => [
  {
    id: 'vmSubnet',
    title: t.azure.vmSubnetTitle,
    side: t.side.serviceResource,
    group: 'todo',
    desc: t.azure.vmSubnetDesc,
  },
  {
    id: 'vmApply',
    title: t.azure.vmApplyTitle,
    side: t.side.serviceResource,
    group: 'todo',
    desc: t.azure.vmApplyDesc,
  },
  {
    id: 'bdc',
    title: t.azure.bdcTitle,
    side: t.side.bdcResource,
    group: 'auto',
    desc: t.azure.bdcDesc,
  },
  {
    id: 'pe',
    title: t.azure.peTitle,
    side: t.side.serviceApproval,
    group: 'todo',
    serviceAction: t.azure.peAction,
    desc: t.azure.peDesc,
  },
];

export const AzureInstallationInline = ({
  targetSourceId,
  confirmed,
  confirmedLoading = false,
  onInstallComplete,
}: AzureInstallationInlineProps) => {
  const { locale } = useLocale();
  const copy = INSTALL_COPY[locale];
  const steps = useMemo(() => azureSteps(copy), [copy]);

  // Must be stable: useInstallationStatus re-runs its fetch effect whenever
  // getFn's identity changes. An inline (unmemoized) getFn made the mount-only
  // fetch effect re-run every render → unbounded refetch loop, most visibly a
  // tight loop of retries when the endpoint keeps returning 500 (nothing
  // unmounts the component to break the cycle).
  //
  // `copy.azure` is a frozen module constant, so the dependency only changes when
  // the reader switches language — which is exactly when the PE pill labels the
  // adapter bakes in have to be rebuilt.
  const getStatus = useCallback(
    (id: number) =>
      getAzureInstallationStatus(id).then((wire) => buildAzureInstallDetail(wire, copy.azure)),
    [copy.azure],
  );
  const { status, loading, error, fetchStatus } =
    useInstallationStatus<AzureInstallDetail>({
      targetSourceId,
      getFn: getStatus,
      // Refresh = re-GET installation-status (POST check-installation REMOVED-no-swagger).
      checkFn: getStatus,
      pollIntervalMs: INSTALL_POLL_INTERVAL_MS,
      isComplete: (data) => areInstallResourcesSettled(data.resources),
      onComplete: onInstallComplete,
    });

  const meta = useMemo(
    () =>
      new Map<string, InstallResourceMeta>(
        confirmed.map((c) => [
          c.resourceId,
          {
            resourceName: c.resourceName,
            region: c.region,
            databaseType: c.databaseType,
            resourceType: c.type,
          },
        ]),
      ),
    [confirmed],
  );

  // 로딩/에러는 카드 안에서 교체한다 — 카드를 조기 반환하면 헤더까지 사라졌다
  // 나타나 스켈레톤의 목적(레이아웃 유지)이 깨진다.
  const hasSyncFailure = status?.lastCheck.status === 'FAILED';

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <InstallCardHeader action={status && <LastCheckStamp lastCheck={status.lastCheck} />} />
      <div className={cn(cardStyles.body, 'space-y-3')}>
        {hasSyncFailure && status && (
          <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            {copy.inline.statusCheckFailed(
              status.lastCheck.failReason ?? copy.inline.statusCheckFailedFallback,
            )}
          </div>
        )}
        {/* 에러가 먼저다 — confirmedLoading 이 OR 로 붙은 뒤로는 순서가 의미를 갖는다.
            설치 상태가 실패했는데 확정 연동이 아직이면, 로딩을 먼저 재는 순간 에러와
            재시도 버튼이 확정 연동 뒤에 숨는다(그 확정 연동마저 실패하면 카드가
            통째로 사라져 사용자는 이유도 재시도도 못 본다). */}
        {error ? (
          <InstallationErrorView message={error} onRetry={fetchStatus} />
        ) : loading || confirmedLoading ? (
          <InstallationLoadingView provider="Azure" grouped />
        ) : status ? (
          <InstallStatusDetail
            lastCheck={status.lastCheck}
            resources={status.resources}
            steps={steps}
            meta={meta}
          />
        ) : null}
      </div>
    </section>
  );
};
