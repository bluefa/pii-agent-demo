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
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { cardStyles, statusColors, cn } from '@/lib/theme';
import type { ConfirmedResource } from '@/lib/types/resources';
import { InstallCardHeader } from '@/app/components/features/process-status/install-status-detail/InstallCardHeader';

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
 */
const AZURE_STEPS: InstallTableStep[] = [
  {
    id: 'vmSubnet',
    title: 'VM Subnet 생성',
    side: '서비스측 리소스 생성',
    desc: 'VM 연동용 Subnet을 생성합니다. VM이 아닌 리소스는 해당 없음으로 표시됩니다.',
  },
  {
    id: 'vmApply',
    title: 'VM Terraform 적용',
    side: '서비스측 리소스 생성',
    desc: 'VM 연동에 필요한 서비스 측 리소스를 Terraform으로 적용합니다.',
  },
  {
    id: 'bdc',
    title: 'BDC측 Terraform 적용',
    side: 'BDC측 리소스 생성',
    desc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
  },
  {
    id: 'pe',
    title: 'Private Endpoint 승인',
    side: '서비스측 승인',
    serviceAction: 'Azure Portal에서 BDC가 요청한 Private Endpoint 연결을 승인해 주세요.',
    desc: 'BDC가 요청한 Private Endpoint 연결을 Azure Portal에서 승인하는 단계입니다.',
  },
];

export const AzureInstallationInline = ({
  targetSourceId,
  confirmed,
  confirmedLoading = false,
  onInstallComplete,
}: AzureInstallationInlineProps) => {
  // Must be stable: useInstallationStatus re-runs its fetch effect whenever
  // getFn's identity changes. An inline (unmemoized) getFn made the mount-only
  // fetch effect re-run every render → unbounded refetch loop, most visibly a
  // tight loop of retries when the endpoint keeps returning 500 (nothing
  // unmounts the component to break the cycle).
  const getStatus = useCallback(
    (id: number) => getAzureInstallationStatus(id).then(buildAzureInstallDetail),
    [],
  );
  const { status, loading, error, fetchStatus } =
    useInstallationStatus<AzureInstallDetail>({
      targetSourceId,
      getFn: getStatus,
      // Refresh = re-GET installation-status (POST check-installation REMOVED-no-swagger).
      checkFn: getStatus,
      isComplete: (data) => areInstallResourcesSettled(data.resources),
      onComplete: onInstallComplete,
    });

  const meta = useMemo(
    () =>
      new Map<string, InstallResourceMeta>(
        confirmed.map((c) => [
          c.resourceId,
          { resourceName: c.resourceName, region: c.region, databaseType: c.databaseType },
        ]),
      ),
    [confirmed],
  );

  // 로딩/에러는 카드 안에서 교체한다 — 카드를 조기 반환하면 헤더까지 사라졌다
  // 나타나 스켈레톤의 목적(레이아웃 유지)이 깨진다.
  const hasSyncFailure = status?.lastCheck.status === 'FAILED';

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <InstallCardHeader />
      <div className={cn(cardStyles.body, 'space-y-3')}>
        {hasSyncFailure && status && (
          <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            상태 확인 실패: {status.lastCheck.failReason ?? '최근 설치 상태 확인에 실패했습니다.'}
          </div>
        )}
        {loading || confirmedLoading ? (
          <InstallationLoadingView provider="Azure" />
        ) : error ? (
          <InstallationErrorView message={error} onRetry={fetchStatus} />
        ) : status ? (
          <InstallStatusDetail
            lastCheck={status.lastCheck}
            resources={status.resources}
            steps={AZURE_STEPS}
            meta={meta}
          />
        ) : null}
      </div>
    </section>
  );
};
