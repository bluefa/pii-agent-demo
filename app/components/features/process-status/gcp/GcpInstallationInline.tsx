'use client';

import { useCallback, useMemo, type ReactNode } from 'react';
import {
  borderColors,
  cardStyles,
  cn,
  primaryColors,
  statusColors,
  textColors,
  textStyles,
} from '@/lib/theme';
import { InfoCircleIcon } from '@/app/components/ui/icons/InfoCircleIcon';
import { getGcpInstallationStatus } from '@/app/lib/api/gcp';
import { PscSubnetGuide } from '@/app/components/features/process-status/gcp/PscSubnetGuide';
import { usePscSubnetTargets } from '@/app/components/features/process-status/gcp/usePscSubnetTargets';
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
import {
  INSTALL_POLL_INTERVAL_MS,
  useInstallationStatus,
} from '@/app/hooks/useInstallationStatus';
import { useConfirmedIntegration } from '@/app/target-sources/[targetSourceId]/_components/data/ConfirmedIntegrationDataProvider';
import { InstallCardHeader } from '@/app/components/features/process-status/install-status-detail/InstallCardHeader';
import { LastCheckStamp } from '@/app/components/features/process-status/install-status-detail/LastCheckStamp';
import { useLocale } from '@/app/components/LocaleProvider';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';

interface GcpInstallationInlineProps {
  targetSourceId: number;
  onInstallComplete?: () => void;
}

/**
 * 제목은 계약 필드(`service_side_subnet_creation` / `service_side_terraform_apply` /
 * `bdc_side_terraform_apply`)가 말하는 만큼만 쓴다. 이전 제목들("모니터링용 Subnet",
 * "VPC Peering · 권한 위임", "PII Agent 인스턴스")과 그 설명에 있던 대역
 * (10.30.0.0/22)·Peering·Service Account·GCE 인스턴스는 계약 어디에도 없었다.
 * 특히 CIDR 은 실제와 다르면 사용자가 잘못된 대역으로 방화벽을 여는 값이라 빼둔다.
 *
 * subnet 단계만은 오너 확인으로 무엇을 만드는지 알고 있다 — PSC 용 Subnet, 리전당 하나.
 *
 * group 은 side 가 아니라 **누가 실행하는가**다. GCP 는 계약에 실행 주체 근거가 없어
 * 오너 판단으로 정했다: Subnet 생성만 서비스 측이 하고, 'service_side_terraform_apply'
 * 는 AWS 자동 설치와 같이 BDC 가 서비스 프로젝트에 대신 적용한다. 그래서 side 는
 * '서비스측'인데 group 은 'auto' 다 — AWS 의 service 단계와 같은 형태의 어긋남이다.
 */
type GcpCopy = (typeof INSTALL_COPY)['ko'];

const gcpSteps = (t: GcpCopy, subnetGuide?: ReactNode): InstallTableStep[] => [
  {
    id: 'subnet',
    title: t.gcp.subnetTitle,
    side: t.side.serviceResource,
    group: 'todo',
    desc: (
      <span className={cn('inline-flex items-start gap-2 rounded-lg px-3 py-2', primaryColors.bgLight, textStyles.body, textColors.secondary)}>
        <InfoCircleIcon className={cn('mt-0.5 h-4 w-4 flex-none', primaryColors.textOnLight)} />
        <span>{t.gcp.subnetDesc}</span>
      </span>
    ),
    guide: subnetGuide,
  },
  {
    id: 'service',
    title: t.gcp.serviceTitle,
    side: t.side.serviceResource,
    group: 'auto',
    desc: t.gcp.serviceDesc,
  },
  {
    id: 'bdc',
    title: t.gcp.bdcTitle,
    side: t.side.bdcResource,
    group: 'auto',
    desc: t.gcp.bdcDesc,
  },
];

export const GcpInstallationInline = ({
  targetSourceId,
  onInstallComplete,
}: GcpInstallationInlineProps) => {
  const { locale } = useLocale();
  const copy = INSTALL_COPY[locale];
  const t = copy.inline;
  const subnetTargets = usePscSubnetTargets(targetSourceId);
  const steps = useMemo(
    () =>
      gcpSteps(copy, subnetTargets.length > 0 ? <PscSubnetGuide targets={subnetTargets} /> : undefined),
    [copy, subnetTargets],
  );
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
    pollIntervalMs: INSTALL_POLL_INTERVAL_MS,
    isComplete: (data) => areInstallResourcesSettled(data.resources),
    onComplete: onInstallComplete,
  });

  const confirmedResources = confirmedState.status === 'ready' ? confirmedState.data : [];
  const meta = useMemo(
    () =>
      new Map<string, InstallResourceMeta>(
        confirmedResources.map((c) => [
          c.resourceId,
          {
            resourceName: c.resourceName,
            region: c.region,
            databaseType: c.databaseType,
            resourceType: c.type,
          },
        ]),
      ),
    [confirmedResources],
  );

  // 로딩/에러는 카드 안에서 교체한다 — 카드를 조기 반환하면 헤더까지 사라졌다
  // 나타나 스켈레톤의 목적(레이아웃 유지)이 깨진다.
  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <InstallCardHeader action={status && <LastCheckStamp lastCheck={status.lastCheck} />} />
      <div className={cn(cardStyles.body, 'space-y-3')}>
        {status?.lastCheck.status === 'FAILED' && status.lastCheck.failReason && (
          <div className={cn('px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
            {t.statusCheckFailed(status.lastCheck.failReason)}
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
            {t.confirmedLoadingEllipsis}
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
            <span>{t.confirmedError(confirmedState.message)}</span>
            <button
              type="button"
              onClick={retryConfirmed}
              className={cn('text-xs font-semibold underline', statusColors.error.textDark)}
            >
              {t.confirmedRetry}
            </button>
          </div>
        )}
        {loading ? (
          <InstallationLoadingView provider="GCP" grouped />
        ) : error ? (
          <InstallationErrorView message={error} onRetry={fetchStatus} />
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
