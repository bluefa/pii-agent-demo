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
import { IdcResourceTable } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { IdcFirewallModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcFirewallModal';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { ResourceTableSkeleton } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state-views';

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';

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
      desc: 'BDC망 CX 영역에 PII Agent 수집 모듈과 네트워크 경로를 구성합니다.',
    },
    {
      id: 'bdp',
      title: 'BDC BDP 영역',
      side: 'BDC측 리소스 생성',
      desc: 'BDC망 BDP 영역 리소스를 구성합니다.',
    },
    {
      id: 'firewall',
      title: '방화벽',
      side: '서비스측 확인',
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

          <div className="mt-6">
            {loading && resources.length === 0 ? (
              <ResourceTableSkeleton />
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
