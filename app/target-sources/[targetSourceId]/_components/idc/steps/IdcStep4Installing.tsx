'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
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
  RejectionAlert,
} from '@/app/target-sources/[targetSourceId]/_components/common';
import {
  IdcDbTypeCell,
  IdcEndpointCell,
  IdcKindBadge,
  IdcSourceIpCell,
} from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import { SourceIpHeader } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcResourceTable';
import { IDC_SEARCH_PLACEHOLDER } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/step-copy';
import { IdcFirewallModal } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcFirewallModal';
import type { IdcStepProps } from '@/app/target-sources/[targetSourceId]/_components/idc/types';
import { InstallCardHeader } from '@/app/components/features/process-status/install-status-detail/InstallCardHeader';

const isAbort = (err: unknown): boolean => err instanceof AppError && err.code === 'ABORTED';

const EMPTY_RESOURCES: IdcResourceView[] = [];

/**
 * 이 화면은 Source IP 를 그 정체(누구의 IP인가)로 부른다 — 여기서 사용자가 하는 일은
 * 방화벽에 BDC 를 통과시키는 것이고, 'Source' 는 무엇의 출발지인지 말하지 않는다.
 * 툴팁 설명은 steps 2·3 과 같은 문장을 그대로 쓴다.
 */
const BDC_SOURCE_LABEL = 'BDC측 출발지';
const BdcSourceHeader = () => <SourceIpHeader label={BDC_SOURCE_LABEL} />;

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
        // 화면에 찍히는 값이 아니라 검색 건초더미다 — 정체성 열은 아래 identityColumns 가
        // 접속 주소로 그리므로, 첫 IP 만 담으면 두 번째 IP 로는 검색이 안 된다.
        // (IDC steps 2·3 의 useIdcApprovalTable 과 같은 투영)
        resourceName: r.hosts.join(' '),
        region: null,
        databaseType: r.databaseTypeWire ?? null,
        // IDC has no cloud resource type — the tag never applies here.
        resourceType: null,
      },
    ]),
  );

  // 앞 열: IDC 는 스캔이 붙인 이름이 없고 resource_id 는 내부 NLB 키다(design-spec §8).
  // 행을 식별하는 것은 구분·접속 주소·Port·Database Type 이고, 여기에 이 단계가 시키는
  // 일의 출발지인 Source IP 가 붙는다 — steps 2·3 의 IdcResourceTable(`src`)이 쓰는
  // 그 셀과 그 폭을 그대로 가져온다.
  const identityColumns = useMemo(() => {
    const byId = new Map(resources.map((r) => [r.resourceId, r]));
    // 설치 상태에는 있는데 확정 연동 목록에 없는 행 — 없는 값을 지어내지 않는다.
    // 커링하지 않는다: 함수를 돌려주는 함수는 lint 가 컴포넌트 팩토리로 읽는다.
    const cell = (
      row: { resourceId: string },
      render: (resource: IdcResourceView) => ReactNode,
    ): ReactNode => {
      const resource = byId.get(row.resourceId);
      return resource ? render(resource) : <span className={textColors.tertiary}>—</span>;
    };
    return {
      searchPlaceholder: IDC_SEARCH_PLACEHOLDER,
      // Database Type 열이 IDC 라벨(MSSQL)을 찍으므로 필터 옵션도 같은 글자여야 한다 —
      // 훅의 기본 접근자는 클라우드 라벨 맵이라 같은 값을 SQL Server 라 부른다.
      dbTypeLabel: (row: { resourceId: string }) => byId.get(row.resourceId)?.databaseTypeLabel ?? '',
      columns: [
        {
          // 이 단계가 시키는 일이 "출발지 → 연동 대상 방화벽 오픈"이라, 출발지가 이 표의
          // 주어다 — 맨 왼쪽에 서고 혼자 색을 갖는다. 바로 옆이 도착지(접속 주소)라
          // 한 행이 곧 열어야 할 한 경로로 읽힌다.
          label: BDC_SOURCE_LABEL,
          widthClass: 'w-[150px]',
          head: <BdcSourceHeader />,
          render: (row: { resourceId: string }) =>
            cell(row, (r) =>
              // 이 단계의 모든 행은 확정된 연동 대상이라 출발지가 있어야 한다. 빈 칸은
              // "이 행은 대상이 아니다"라는 다른 단계의 뜻이 되므로 여기선 대시로 말한다.
              r.sourceIps.length > 0 ? (
                <IdcSourceIpCell sourceIps={r.sourceIps} label={BDC_SOURCE_LABEL} emphasis />
              ) : (
                <span className={textColors.tertiary}>—</span>
              ),
            ),
        },
        {
          label: '접속 주소',
          widthClass: 'w-[168px]',
          // 구분(Single/Multi/Domain)은 제 열을 갖지 않는다 — 주소가 몇 개인지를 말하는
          // 값이라 주소 위에 붙어야 읽힌다. 클러스터 태그가 이름 위에 서는 그 스택이다.
          // 끝점이 없는 행은 종류도 없다: 어댑터의 기본값 'SINGLE' 은 아무도 보고하지
          // 않은 모양을 단언한다 (IdcResourceTable 과 같은 가드).
          render: (row: { resourceId: string }) =>
            cell(row, (r) => (
              <span className="flex min-w-0 flex-col items-start gap-1">
                {r.hosts.length > 0 && <IdcKindBadge kind={r.kind} />}
                <IdcEndpointCell resource={r} />
              </span>
            )),
        },
        {
          label: 'Port',
          widthClass: 'w-[80px]',
          // 0 은 "페이로드에 포트가 없다"는 어댑터 값이지 포트가 아니다.
          render: (row: { resourceId: string }) =>
            cell(row, (r) => (
              <span className={cn('font-mono text-[12px]', textColors.secondary)}>
                {r.port || <span className={textColors.tertiary}>—</span>}
              </span>
            )),
        },
        {
          label: 'Database Type',
          widthClass: 'w-[172px]',
          render: (row: { resourceId: string }) => cell(row, (r) => <IdcDbTypeCell resource={r} />),
        },
      ],
    };
  }, [resources]);

  // group 은 **누가 실행하는가**다(AWS/Azure/GCP 와 같은 규칙). IDC 는 두 Terraform
  // 구간을 BDC 가 돌리고, 서비스 측이 하는 일은 방화벽 오픈·확인 하나뿐이다.
  const steps: InstallTableStep[] = [
    {
      id: 'cx',
      title: 'BDC CX 영역',
      side: 'BDC측 리소스 생성',
      group: 'auto',
      desc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
    },
    {
      id: 'bdp',
      title: 'BDC BDP 영역',
      side: 'BDC측 리소스 생성',
      group: 'auto',
      desc: 'BDC측에서 PII Agent 구성을 위한 Terraform 작업을 수행합니다.',
    },
    {
      id: 'firewall',
      title: '방화벽',
      side: '서비스측 확인',
      group: 'todo',
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
            <InstallationLoadingView provider="IDC" grouped />
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
                identityColumns={identityColumns}
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
