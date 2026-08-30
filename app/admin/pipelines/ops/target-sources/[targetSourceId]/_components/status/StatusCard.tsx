/**
 * 연동 현황 카드 — 진행 상태 탭에서 「상태 변경 이력」이 서 있던 자리.
 *
 * Server Component (docs/api/boundaries.md Pipeline 2). 다섯 행이 읽는 네 건을 여기서
 * 직접 받으므로 **브라우저 요청은 0** 이다. 페이지가 아니라 이 컴포넌트가 fetch 를
 * 갖는 이유는 `Suspense` 경계가 **이 fetch 들만** 감싸야 하기 때문이다 — `page.tsx`
 * 에서 await 하면 마스트헤드와 탭 줄까지 함께 늦는다 (`ops/alerts` 의 `AlertWorklistSection`
 * 과 같은 배치).
 *
 * ⛔ 여기서 throw 하지 않는다. 경계 안에서 던지면 error 로 넘어가 카드가 통째로
 * 사라진다 — 네 조회는 각각 `settle` 되고, 거절된 것만 제 행에서 「조회 실패」라고
 * 말한다 (ADR-008: 하나의 실패가 화면을 내리지 않는다).
 *
 * dag-status(§10) 도 부른다 (오너 2026-08-30 "6단계 상관없이 그냥 조회해"). 응답이 MB 단위라
 * 다섯 조회 중 가장 느릴 수 있고, 그만큼 **이 카드만** 늦는다 — 경계 밖의 셸과 탭 줄은 이미
 * 나가 있다. process-status 는 반대로 **부르지 않는다**: 어느 행도 단계를 말하지 않는다
 * (`statusRows.ts` 규칙 3).
 */
import type { ReactElement, ReactNode } from 'react';

import { bff } from '@/lib/bff/client';
import { BffError } from '@/lib/bff/errors';
import { cn, pipelineStyles } from '@/lib/theme';
import { isSduTarget, normalizeCloudProvider } from '@/lib/types';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  statusRows,
  type RowMark,
  type Settled,
  type StatusRow,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/status/statusRows';
import {
  StatusRetryButton,
  TabLink,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/status/StatusRowActions';
import { OPS_TAB_SLUGS } from '@/lib/routes';

const TITLE = '연동 현황';
const DESC = '각 단계가 마지막으로 남긴 결과입니다.';

/**
 * 스켈레톤이 그릴 다섯 행 — 이름과 목적지는 데이터가 아니라 고정 문자열이라
 * 기다리는 동안에도 실물로 선다. 순서는 `statusRows` 와 같아야 한다.
 */
const SKELETON_ROWS = [
  { name: OPS_TAB_SLUGS.scan, tab: OPS_TAB_SLUGS.scan },
  { name: OPS_TAB_SLUGS.tc, tab: OPS_TAB_SLUGS.tc },
  { name: OPS_TAB_SLUGS.infra, tab: OPS_TAB_SLUGS.infra },
  { name: OPS_TAB_SLUGS.confirm, tab: OPS_TAB_SLUGS.confirm },
  { name: 'Airflow', tab: OPS_TAB_SLUGS.airflow },
] as const;

const MARK: Record<RowMark, { icon: IconName; ink: string; spin?: true }> = {
  ok: { icon: 'check-circle', ink: 'text-[var(--pl-ok-text)]' },
  err: { icon: 'x-circle', ink: 'text-[var(--pl-err-text)]' },
  warn: { icon: 'warn-tri', ink: 'text-[var(--pl-warn-text)]' },
  run: { icon: 'loader', ink: 'text-[var(--pl-text-weak)]', spin: true },
  idle: { icon: 'clock', ink: 'text-[var(--pl-text-weak)]' },
  unknown: { icon: 'ban', ink: 'text-[var(--pl-text-weak)]' },
};

/** 판정만 색을 갖는다 — 면은 물들이지 않는다 (`InfraStatusHead` 판례). */
const VALUE_INK: Record<RowMark, string> = {
  ok: 'text-[var(--pl-text-strong)]',
  err: 'text-[var(--pl-err-text)]',
  warn: 'text-[var(--pl-warn-text)]',
  run: 'text-[var(--pl-text-medium)]',
  idle: 'text-[var(--pl-text-weak)]',
  unknown: 'text-[var(--pl-text-weak)]',
};

/** 카드 껍데기 — 정착본과 스켈레톤이 **같은** 프레임을 쓴다. 근사치는 리플로우다. */
function CardFrame({ children, busy }: { children: ReactNode; busy?: true }): ReactElement {
  return (
    <section className={cn(pipelineStyles.card.base, 'flex flex-col')} aria-label={TITLE}>
      <h2 className={opsStyles.cardTitle}>{TITLE}</h2>
      <p className={opsStyles.cardDesc}>{DESC}</p>
      <dl className="mt-3.5" {...(busy ? { 'aria-busy': true } : {})}>
        {children}
      </dl>
    </section>
  );
}

/** 한 행의 격자 — 이름 열은 고정폭이라 다섯 값이 한 줄에서 시작한다. */
const ROW =
  'grid grid-cols-[minmax(0,116px)_minmax(0,1fr)] items-center gap-3 border-b border-[var(--pl-border)] py-2.5 last:border-b-0';
const NAME = 'truncate text-[14px] font-semibold text-[var(--pl-text-strong)]';

function Row({ row }: { row: StatusRow }): ReactElement {
  const mark = MARK[row.mark];
  return (
    <div className={ROW}>
      <dt className="flex min-w-0 items-center gap-2">
        {/* 회전은 **감싼 span** 이 진다 — `Icon` 은 className 을 svg 에 그대로 얹는데,
            svg 에 걸린 애니메이션은 렌더러에 따라 죽는다 (sit-recurring-checks #1). */}
        <span
          className={cn('flex-none', mark.ink, mark.spin && 'animate-spin motion-reduce:animate-none')}
        >
          <Icon name={mark.icon} size="md" />
        </span>
        <span className={NAME}>{row.name}</span>
      </dt>
      <dd className="flex min-w-0 items-center justify-between gap-3">
        <span className="flex min-w-0 items-baseline gap-2">
          <span className={cn('truncate text-[14px]', VALUE_INK[row.mark])}>{row.value}</span>
          {row.sub && (
            <span className="truncate text-[12px] tabular-nums text-[var(--pl-text-weak)]">{row.sub}</span>
          )}
          {row.failed && <StatusRetryButton label={row.name} />}
        </span>
        <TabLink tab={row.tab} />
      </dd>
    </div>
  );
}

/**
 * `Suspense` fallback. 이름·링크·제목은 **실물로** 그린다 — 서버가 이미 아는 고정
 * 문자열이라 회색으로 덮을 이유가 없고, 그래야 "아직 안 온 표"가 아니라 "값만 아직
 * 없는 표"가 된다 (`AlertWorklistSkeleton` 과 같은 규칙).
 *
 * ponytail: IDC 대상은 정착하면서 스캔 행 하나가 빠져 40px 줄어든다. 그걸 막으려면
 * 스켈레톤을 그리기 전에 대상 상세를 한 번 받아야 하는데, 그 대기가 셸을 늦춘다 —
 * 소수 대상의 한 행 수축이 전 대상의 늦은 첫 바이트보다 싸다.
 */
export function StatusCardSkeleton(): ReactElement {
  return (
    <CardFrame busy>
      <span className="sr-only">연동 현황을 불러오는 중</span>
      {SKELETON_ROWS.map((row) => (
        <div key={row.name} className={ROW}>
          <dt className="flex min-w-0 items-center gap-2">
            {/* 16px — 정착본의 아이콘과 같은 크기라 이름의 x 가 움직이지 않는다. */}
            <span className={cn(pipelineStyles.skeletonBar, 'h-4 w-4 flex-none rounded-full')} aria-hidden />
            <span className={NAME}>{row.name}</span>
          </dt>
          <dd className="flex min-w-0 items-center justify-between gap-3">
            {/* 14px — `leading` 이 아니라 정착본 값의 글자 높이. 행 높이는 이름이 잡는다. */}
            <span className={cn(pipelineStyles.skeletonBar, 'h-[14px] w-[104px] rounded')} aria-hidden />
            <TabLink tab={row.tab} />
          </dd>
        </div>
      ))}
    </CardFrame>
  );
}

/** 조회 하나의 결말. 404 는 **없음**이고 그 밖의 거절만 실패다 (`fetchLatestTest` 규칙). */
async function settle<T>(what: string, run: Promise<T>): Promise<Settled<T | null>> {
  try {
    return { ok: true, value: await run };
  } catch (err) {
    if (err instanceof BffError && err.status === 404) return { ok: true, value: null };
    console.warn(`[ops/status] ${what} 조회 실패 — 그 행만 모른다고 그린다`, err);
    return { ok: false };
  }
}

export async function StatusCard({
  targetSourceId,
}: {
  targetSourceId: number;
}): Promise<ReactElement | null> {
  /**
   * 대상 상세가 **먼저** 온다. 한 홉을 직렬로 더 쓰는 대신 두 가지를 산다.
   *
   * 1. SDU 는 이 카드를 아예 그리지 않는다(`SduOpsNotice` 가 본문을 통째로 대신한다).
   *    슬롯은 prop 이라 서버에서는 어느 탭이든 렌더되므로, 여기서 갈라 두지 않으면 화면에
   *    나오지도 않을 카드를 위해 네 건 — 그중 하나가 MB 급 §10 — 을 쏜다.
   * 2. 스캔 행의 존재 여부(IDC)가 여기서 나온다. terraform-status 의 `cloud_provider`
   *    로 재느라 그 조회가 거절되면 IDC 대상에 스캔 행이 서던 자리였다 — 탭 줄은 그 탭을
   *    숨기고 있으므로 그 행의 「상세보기」는 눌러도 아무 일이 없는 죽은 버튼이 된다.
   */
  const detail = await settle('target-source', bff.targetSources.get(targetSourceId));
  const meta = detail.ok ? detail.value : null;
  if (
    meta
    && isSduTarget({ is_sdu_type: meta.metadata?.is_sdu_type, cloud_provider: meta.cloud_provider })
  ) {
    return null;
  }

  const [scan, tc, terraform, dag] = await Promise.all([
    settle('scan-history', bff.scan.getHistory(targetSourceId, { page: 0, size: 1 })),
    settle('test-connection-latest', bff.confirm.getTestConnectionLatest(targetSourceId)),
    settle('terraform-status', bff.confirm.getTerraformStatus(targetSourceId)),
    settle('dag-status', bff.ops.getDagStatus(targetSourceId)),
  ]);

  // 상세를 못 읽었을 때만 terraform-status 의 같은 필드로 물러선다 — 둘 다 거절되면
  // 어차피 모든 행이 「조회 실패」라, 그 상태에서 행 하나가 더 서는 것은 최악이 아니다.
  const provider = meta?.cloud_provider ?? (terraform.ok ? terraform.value?.cloud_provider : null);
  const isIdc = normalizeCloudProvider(provider) === 'IDC';

  const rows = statusRows({
    scan: scan.ok ? { ok: true, value: scan.value?.content?.[0] ?? null } : { ok: false },
    tc,
    // terraform 은 404 를 '없음'으로 접을 자리가 없다 — 값이 없으면 두 행이 모르는 것이다.
    terraform: terraform.ok && terraform.value != null ? { ok: true, value: terraform.value } : { ok: false },
    dag,
    isIdc,
  });

  return (
    <CardFrame>
      {rows.map((row) => (
        <Row key={row.name} row={row} />
      ))}
    </CardFrame>
  );
}
