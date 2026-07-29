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

interface AzureInstallationInlineProps {
  targetSourceId: number;
  confirmed: readonly ConfirmedResource[];
  onInstallComplete?: () => void;
}

const AZURE_STEPS: InstallTableStep[] = [
  {
    id: 'pe',
    title: '서비스 측 Private Endpoint 승인',
    side: '서비스측',
    desc: 'BDC가 요청한 Private Endpoint 연결을 Azure Portal에서 승인하는 단계입니다.',
  },
  {
    id: 'vmSubnet',
    title: '서비스 측 VM Subnet 생성',
    side: '서비스측',
    desc: 'VM 연동용 Subnet을 생성합니다. VM이 아닌 리소스는 해당 없음으로 표시됩니다.',
  },
  {
    id: 'vmApply',
    title: '서비스 측 VM 리소스 생성',
    side: '서비스측',
    desc: 'VM용 Load Balancer 등 서비스 측 리소스를 Terraform으로 적용합니다.',
  },
  {
    id: 'bdc',
    title: 'BDC 측 리소스 생성',
    side: 'BDC측 · 자동',
    desc: 'PII Agent VM, IAM Role, KeyVault 연결을 자동 배포합니다.',
  },
];

export const AzureInstallationInline = ({
  targetSourceId,
  confirmed,
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

  if (loading) return <InstallationLoadingView provider="Azure" />;
  if (error) return <InstallationErrorView message={error} onRetry={fetchStatus} />;
  if (!status) return null;

  const hasSyncFailure = status.lastCheck.status === 'FAILED';

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cardStyles.cardTitle}>Agent 설치</h2>
          <p className={cn('mt-2.5', cardStyles.subtitle)}>
            승인된 인프라에 PII Agent를 배포하기 위한 설치 작업을 진행합니다.
          </p>
        </div>
        {/* v16 L6606 — provider indicator (not a control), short provider name. */}
        <span className={cardStyles.providerTag}>
          Provider: <strong className={cardStyles.providerTagName}>Azure</strong>
        </span>
      </header>
      <div className={cn(cardStyles.body, 'space-y-3')}>
        {hasSyncFailure && (
          <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            상태 확인 실패: {status.lastCheck.failReason ?? '최근 설치 상태 확인에 실패했습니다.'}
          </div>
        )}
        <InstallStatusDetail
          lastCheck={status.lastCheck}
          resources={status.resources}
          steps={AZURE_STEPS}
          meta={meta}
        />
      </div>
    </section>
  );
};
