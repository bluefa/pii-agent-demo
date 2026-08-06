'use client';

import { useEffect, useState } from 'react';
import { AppError } from '@/lib/errors';
import { bgColors, borderColors, cardStyles, cn, statusColors, textColors } from '@/lib/theme';
import {
  getIdcConfirmedResources,
  type IdcInstallStatus,
  type IdcResourceView,
} from '@/app/lib/api/idc';
import { useIdcInstallationStatus } from '@/app/hooks/useIdcInstallationStatus';
import { InstallStatusDetail } from '@/app/components/features/process-status/install-status-detail/InstallStatusDetail';
import { InstallationLoadingView } from '@/app/components/features/process-status/shared/InstallationLoadingView';
import { InstallationErrorView } from '@/app/components/features/process-status/shared/InstallationErrorView';
import {
  normalizeInstallStepValue,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallResourceMeta,
  type InstallTableStep,
} from '@/app/components/features/process-status/install-status-detail/model';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import { IdcFirewallModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcFirewallModal';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { InstallCardHeader } from '@/app/components/features/process-status/install-status-detail/InstallCardHeader';

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';

const EMPTY_RESOURCES: IdcResourceView[] = [];

// IDC lastCheck status is the shared install enum; the generic detail wants the
// 3-value LastCheckInfo bucket.
const toInstallLastCheck = (
  lastCheck: { status: IdcInstallStatus; checkedAt?: string; failReason?: string } | undefined,
): InstallLastCheck => ({
  status:
    lastCheck?.status === 'FAIL' || lastCheck?.status === 'FAILED'
      ? 'FAILED'
      : lastCheck?.status === 'COMPLETED' || lastCheck?.status === 'SUCCESS'
        ? 'SUCCESS'
        : 'IN_PROGRESS',
  ...(lastCheck?.checkedAt && { checkedAt: lastCheck.checkedAt }),
  ...(lastCheck?.failReason && { failReason: lastCheck.failReason }),
});

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
}: IdcStepProps) => {
  const { targetSourceId } = project;
  const { status, error, refresh } = useIdcInstallationStatus(targetSourceId);

  // Rows carry the id they were fetched for, so "loading" is `id mismatch` —
  // no separate flag to reset on switch (a setState in the effect would cascade).
  const [loaded, setLoaded] = useState<{ id: number; rows: IdcResourceView[] } | null>(null);
  const [firewallOpen, setFirewallOpen] = useState(false);

  const resourcesLoading = loaded?.id !== targetSourceId;
  const resources = loaded?.id === targetSourceId ? loaded.rows : EMPTY_RESOURCES;

  // §DR3/DR5 — abort on switch/unmount, discard stale responses, scope by id.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    void getIdcConfirmedResources(targetSourceId, { signal: controller.signal })
      .then((data) => {
        if (active) setLoaded({ id: targetSourceId, rows: data });
      })
      .catch((err) => {
        if (isAbort(err) || !active) return;
        setLoaded({ id: targetSourceId, rows: [] });
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [targetSourceId]);

  const installResources = status?.resources ?? [];

  // Per-row firewall status for the `fw` column: join the installation-status
  // firewall_check.status to the confirmed-integration rows by resource_id (the
  // confirmed rows carry no firewall field). A row with no install entry falls
  // through to the neutral "BDC측 확인 필요" badge in IdcFirewallBadge.
  const firewallStatusByResource: Record<string, IdcInstallStatus> = Object.fromEntries(
    installResources.map((r) => [r.resourceId, r.firewallCheck.status]),
  );

  // Master-detail model: per-resource cells for the three IDC steps. A backend
  // mid-install reports UNKNOWN, which renders as "확인 중" (never done/failed).
  const detailResources: InstallDetailResource[] = installResources.map((r) => ({
    resourceId: r.resourceId,
    resourceName: null,
    rollup: { status: normalizeInstallStepValue(r.installationStatus), guide: null },
    cells: {
      cx: { status: normalizeInstallStepValue(r.cxTerraform.status), guide: r.cxTerraform.guide ?? null },
      bdp: { status: normalizeInstallStepValue(r.bdpTerraform.status), guide: r.bdpTerraform.guide ?? null },
      firewall: { status: normalizeInstallStepValue(r.firewallCheck.status), guide: r.firewallCheck.guide ?? null },
    },
  }));

  // Region은 IDC 계약에 없음(정상); DB Type은 확정 연동 리소스에서 join.
  const detailMeta = new Map<string, InstallResourceMeta>(
    resources.map((r) => [
      r.resourceId,
      {
        resourceName: r.hosts[0] ?? null,
        region: null,
        databaseType: r.databaseTypeWire ?? null,
      },
    ]),
  );

  const steps: InstallTableStep[] = [
    {
      id: 'cx',
      title: 'BDC CX 영역',
      side: 'BDC측 리소스 생성',
      desc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
    },
    {
      id: 'bdp',
      title: 'BDC BDP 영역',
      side: 'BDC측 리소스 생성',
      desc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
    },
    {
      id: 'firewall',
      title: '방화벽',
      side: '서비스측 확인',
      serviceAction: 'Source IP에서 연동 대상으로의 방화벽을 오픈한 뒤 확인해 주세요.',
      desc: 'Source IP → 연동 대상 방화벽 오픈 여부를 점검하는 단계입니다.',
      action: (
        <button
          type="button"
          onClick={() => setFirewallOpen(true)}
          className={cn(
            'text-xs font-bold px-3 py-1.5 rounded-lg border',
            borderColors.default,
            textColors.secondary,
            bgColors.mutedHover,
          )}
        >
          방화벽 확인
        </button>
      ),
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

      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <InstallCardHeader />
        <div className={cardStyles.body}>
          {/* 두 조회(설치 상태 + 확정 연동)가 모두 도착할 때까지 스켈레톤을 유지한다.
              빈 배열을 그대로 그리면 "전체 리소스 0 · 대기 0/0"에 방화벽 조치 배너까지
              붙어, 아직 모르는 것을 확정된 사실로 말하게 된다.

              게이트는 훅의 loading 이 아니라 `status` 유무로 판정한다 — 재시도는
              loading 이 아니라 refreshing 을 세우므로(useIdcInstallationStatus.refresh),
              loading 으로 재면 재시도하는 동안 바로 그 거짓 화면으로 되돌아간다.
              status 는 대상 전환 시 훅이 비우므로(DR4) "그릴 데이터 없음"과 동치다.

              에러가 먼저다 — 실패한 조회를 아직 안 온 다른 조회 뒤에 숨기면
              스켈레톤이 영영 돌아간다. */}
          {error ? (
            <InstallationErrorView message={error} onRetry={refresh} />
          ) : !status || resourcesLoading ? (
            <InstallationLoadingView provider="IDC" railRows={steps.length + 1} />
          ) : (
            <>
              {status?.lastCheck?.status === 'FAIL' && status.lastCheck.failReason && (
                <div className={cn('mb-3 px-4 py-2 rounded-lg border text-sm', statusColors.error.bg, statusColors.error.border, statusColors.error.textDark)}>
                  상태 확인 실패: {status.lastCheck.failReason}
                </div>
              )}
              <InstallStatusDetail
                lastCheck={toInstallLastCheck(status?.lastCheck)}
                resources={detailResources}
                steps={steps}
                meta={detailMeta}
              />
            </>
          )}
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
