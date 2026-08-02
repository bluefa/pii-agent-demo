'use client';

import { useCallback, useMemo } from 'react';
import {
  borderColors,
  cardStyles,
  cn,
  statusColors,
  textColors,
} from '@/lib/theme';
import { getGcpInstallationStatus } from '@/app/lib/api/gcp';
import {
  buildGcpInstallDetail,
  type GcpInstallDetail,
} from '@/app/components/features/process-status/gcp/install-detail-adapter';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import { InstallStatusDetail } from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import {
  areInstallResourcesSettled,
  type InstallResourceMeta,
  type InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';
import { useInstallationStatus } from '@/app/hooks/useInstallationStatus';
import { useConfirmedIntegration } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { InstallCardHeader } from '@/app/components/features/process-status/install-status-detail/InstallCardHeader';

interface GcpInstallationInlineProps {
  targetSourceId: number;
  onInstallComplete?: () => void;
}

const GCP_STEPS: InstallTableStep[] = [
  {
    id: 'subnet',
    title: '모니터링용 Subnet',
    side: '서비스측 리소스 생성',
    desc: 'Project 내 모니터링용 Subnet (10.30.0.0/22)을 생성합니다.',
  },
  {
    id: 'service',
    title: 'VPC Peering · 권한 위임',
    side: '서비스측 리소스 생성',
    desc: 'VPC Peering / Firewall / Service Account 권한 위임을 구성합니다.',
  },
  {
    id: 'bdc',
    title: 'PII Agent 인스턴스',
    side: 'BDC측 리소스 생성',
    desc: 'PII Agent GCE 인스턴스 + Service Account + IAM Role을 자동 배포합니다.',
  },
];

export const GcpInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: GcpInstallationInlineProps) => {
  const { state: confirmedState, retry: retryConfirmed } = useConfirmedIntegration();

  // Must be stable: useInstallationStatus re-runs its fetch effect whenever
  // getFn's identity changes (see AzureInstallationInline refetch-loop note).
  const getInstallDetail = useCallback(
    (id: number) => getGcpInstallationStatus(id).then(buildGcpInstallDetail),
    [],
  );

  const { status, loading, error, fetchStatus } = useInstallationStatus<GcpInstallDetail>({
    targetSourceId,
    getFn: getInstallDetail,
    // Refresh = re-GET installation-status (POST check-installation REMOVED-no-swagger).
    checkFn: getInstallDetail,
    isComplete: (data) => areInstallResourcesSettled(data.resources),
    onComplete: onInstallComplete,
  });

  const confirmedResources = confirmedState.status === 'ready' ? confirmedState.data : [];
  const meta = useMemo(
    () =>
      new Map<string, InstallResourceMeta>(
        confirmedResources.map((c) => [
          c.resourceId,
          { resourceName: c.resourceName, region: c.region, databaseType: c.databaseType },
        ]),
      ),
    [confirmedResources],
  );

  // 로딩/에러는 카드 안에서 교체한다 — 카드를 조기 반환하면 헤더까지 사라졌다
  // 나타나 스켈레톤의 목적(레이아웃 유지)이 깨진다.
  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <InstallCardHeader />
      <div className={cn(cardStyles.body, 'space-y-3')}>
        {status?.lastCheck.status === 'FAILED' && status.lastCheck.failReason && (
          <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            상태 확인 실패: {status.lastCheck.failReason}
          </div>
        )}
        {confirmedState.status === 'loading' && (
          <div
            className={cn(
              'px-4 py-2 rounded-lg border text-sm',
              borderColors.default,
              textColors.tertiary,
            )}
          >
            리소스 정보 불러오는 중...
          </div>
        )}
        {confirmedState.status === 'error' && (
          <div
            className={cn(
              'px-4 py-2 rounded-lg border text-sm flex items-center justify-between gap-3',
              statusColors.error.bg,
              statusColors.error.border,
              statusColors.error.textDark,
            )}
          >
            <span>리소스 정보 불러오기 실패: {confirmedState.message}</span>
            <button
              type="button"
              onClick={retryConfirmed}
              className={cn('text-xs font-semibold underline', statusColors.error.textDark)}
            >
              재시도
            </button>
          </div>
        )}
        {loading ? (
          <InstallationLoadingView provider="GCP" />
        ) : error ? (
          <InstallationErrorView message={error} onRetry={fetchStatus} />
        ) : status ? (
          <InstallStatusDetail
            lastCheck={status.lastCheck}
            resources={status.resources}
            steps={GCP_STEPS}
            meta={meta}
          />
        ) : null}
      </div>
    </section>
  );
};
