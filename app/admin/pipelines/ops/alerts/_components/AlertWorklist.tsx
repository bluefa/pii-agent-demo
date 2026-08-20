'use client';

/**
 * 운영 알림 worklist — ONE table for the bucket the summary tiles selected.
 *
 * Replaces the 2×2 AlertStageCard grid (decision record:
 * docs/ux/benchmark/ops-alerts-worklist.md). Every row navigates to the same
 * destination — the Target Source ops screen — so the bucket is a filter over
 * one list, not four containers.
 *
 * 정체성은 한 셀에 쌓지 않고 **열로 나눈다** (오너 2026-08-20): Cloud · Target ·
 * 서비스 코드 · 서비스 이름이 각자 열을 갖는다. 대시보드의 `TargetCell` 은 그 화면에서
 * 정체성 열이 진행도·상태·생성시간·경과 사이에 끼어 세 답이 300px 넘게 흩어졌기
 * 때문에 한 셀로 묶은 것인데(theme.ts `dashboard.identity`), 이 표에는 그 사이에
 * 끼어드는 열이 없어 전제가 성립하지 않는다. 대신 값끼리 세로로 줄서므로 Cloud 도
 * 코드도 열 단위로 훑을 수 있다.
 *
 * The card header owns the bucket's description and the refresh action. It
 * deliberately does NOT repeat the bucket's count — the number lives on the
 * tile above, once.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes, type OpsTargetTab } from '@/lib/routes';
import { getAlertTargetSources } from '@/app/lib/api/task-queue';
import type { AlertTargetKind, AlertListRow } from '@/lib/types/task-queue';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { TerraformLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { DashRow, RowAction } from '@/app/admin/pipelines/_dashboard/cells';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { DelayText } from '@/app/admin/pipelines/queue/_components/DelayText';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';

export type AlertStageIcon = IconName | 'terraform';

/** Contract default page size (`/dashboard/target-sources/{kind}` size=10). */
const PAGE_SIZE = 10;

const worklist = {
  /** Same surface the stage cards wore (r12 · border-strong · shadow-md). */
  card: 'bg-[var(--pl-bg-card)] border border-[var(--pl-border-strong)] rounded-[12px] shadow-[var(--pl-shadow-md)] overflow-hidden',
  /** No bottom border of its own — the table's 2px header rule is the divider. */
  header: 'flex items-start gap-3 px-5 pt-4 pb-3',
  /** 2px down-nudge centers the 20px glyph on the 24px title line. */
  titleIcon: 'mt-0.5 flex-none text-[var(--pl-text-medium)]',
  titleWrap: 'min-w-0 flex-1',
  /** Card-head standard (16/600/strong); the description is one tier below
   *  (14/400/weak) so title and helper text never read as one run-on line. */
  titleText: 'text-[16px] font-semibold leading-[1.5] text-[var(--pl-text-strong)]',
  desc: 'mt-0.5 text-[14px] leading-[1.5] text-[var(--pl-text-weak)]',
  descText: 'block max-w-[52ch] truncate text-[14px] text-[var(--pl-text-weak)]',
  /**
   * 값 계층 — 한 행에서 네 값이 순서를 갖도록 **채널을 나눠서** 준다 (오너 2026-08-20:
   * "값 계층이 없다"). 처음에는 Target 과 코드가 둘 다 14/600 strong 이고 이름과 설명이
   * 둘 다 14/400 medium 이라, 굵은 값 둘과 회색 값 둘이 서로 같은 등급으로 읽혔다.
   *
   *   Target  14/600 strong  — 이 행이 여는 키. 행에서 유일한 600.
   *   이름    14/400 strong  — 사람이 행을 알아보는 이름. 무게 대신 색이 올라선다.
   *   코드    14/500 medium mono — 같은 크기지만 무게·색이 한 칸씩 내려온 식별자.
   *   설명    14/400 weak    — 행을 고르는 근거. 크기는 같고 색만 물러난다.
   *
   * 크기를 한 값도 줄이지 않는 이유는 열마다 헤더가 이미 그것이 무엇인지 말하기
   * 때문이다 — 여기서 필요한 것은 "무엇인지"가 아니라 "먼저 읽을 것"의 순서다.
   */
  idValue:
    'text-[14px] font-semibold tabular-nums text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] transition-colors group-hover:text-[var(--pl-info-text)]',
  codeText: 'text-[14px] font-medium text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]',
  nameText: 'block max-w-[22ch] truncate text-[14px] text-[var(--pl-text-strong)]',
  /**
   * 머리 (오너 2026-08-20: "표면·구분선이 약하다").
   *
   * gray-50 밴드를 먼저 대 봤고 브라우저에서 재 보니 흰 카드 위 **1.05:1** 이었다 —
   * DOM 에는 있고 눈에는 없는 면이다(대시보드가 같은 이유로 밴드를 뺐다). 흰 면 위에서
   * 듣는 레버는 fill 이 아니라 stroke 라, 머리는 2px `--pl-text-strong` 룰이 계속
   * 맡고 라벨만 weak(4.97:1) → medium(10.01:1) 로 올린다. 열 이름이 값보다 흐리면
   * 표를 읽기 전에 열을 세는 일부터 어려워진다.
   */
  th: 'h-[34px] px-5 text-left whitespace-nowrap text-[12px] font-semibold uppercase tracking-[0.03em] text-[var(--pl-text-medium)] border-b-2 border-[var(--pl-text-strong)]',
  /** 행 구분선 — gray-100 은 흰 행 위에서 1.06:1 이라 DOM 에만 있었다. gray-200 은
   *  1.24:1(실측) 로, 카드 테두리(border-strong 1.41:1)보다는 조용하면서 실제로 보인다. */
  body: 'divide-y divide-[var(--pl-gray-200)]',
  state: 'px-5 py-12 text-center text-[12px] text-[var(--pl-text-weak)]',
  /** Skeleton bar — opsStyles.skeleton grammar at one text line's height. */
  skeletonBar: 'block h-3.5 animate-pulse rounded-[6px] bg-[var(--pl-gray-100)]',
  footer: 'px-5 py-3',
} as const;

export interface AlertWorklistProps {
  kind: AlertTargetKind;
  label: string;
  description: string;
  icon: AlertStageIcon;
  /** Ops-screen tab a row opens — the one that answers this bucket's need. */
  tab: OpsTargetTab;
  /** The bucket's summary count — sizes the loading skeleton to the real
   *  footprint so the card doesn't collapse when the rows arrive. */
  count: number;
  /** Bumped by the parent when the header refresh re-reads the summary. */
  reloadKey: number;
  /** Refresh both this list and the parent's summary/nav counts. */
  onRefresh: () => void;
}

export function AlertWorklist({
  kind,
  label,
  description,
  icon,
  tab,
  count,
  reloadKey,
  onRefresh,
}: AlertWorklistProps): ReactElement {
  const router = useRouter();
  const [rows, setRows] = useState<AlertListRow[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [failed, setFailed] = useState(false);
  const [page, setPage] = useState(0);

  const loadKey = `${page}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const list = await getAlertTargetSources(kind, page, PAGE_SIZE, {
          signal: controller.signal,
        });
        if (controller.signal.aborted) return;
        setRows(list.content);
        setTotalPages(Math.max(1, list.totalPages));
        setFailed(false);
      } catch {
        if (controller.signal.aborted) return;
        setRows([]);
        setFailed(true);
      }
      if (!controller.signal.aborted) setLoadedKey(loadKey);
    })();
    return () => controller.abort();
  }, [kind, page, loadKey]);

  const d = pipelineStyles.dashboard;

  return (
    <section className={worklist.card} aria-label={`${label} 대상 목록`}>
      <div className={worklist.header}>
        <span className={worklist.titleIcon}>
          {icon === 'terraform' ? <TerraformLogo size={20} /> : <Icon name={icon} size={20} />}
        </span>
        <div className={worklist.titleWrap}>
          <h2 className={worklist.titleText}>{label}</h2>
          <p className={worklist.desc}>{description}</p>
        </div>
        <PlButton variant="outline" size="sm" onClick={onRefresh} className="flex-none gap-1.5">
          <Icon name="refresh" size="md" />
          새로고침
        </PlButton>
      </div>

      <table className={d.table}>
        <thead>
          <tr>
            {/* 식별 열은 제 내용만큼만(`w-px` + nowrap), 남는 폭은 설명이 전부
                가져간다(`w-full`). auto layout 은 여유 폭을 열마다 고르게 나눠 주므로,
                그대로 두면 네 자리 숫자 한 개짜리 열이 245px 를 차지하고 값들이
                서로 멀어진다 — 열로 나눈 이유가 그때 사라진다. */}
            {/* 열 이름은 이 섹션이 이미 쓰는 것을 그대로 쓴다 — 대시보드 필터,
                연동 요청 표, 큐 목록이 모두 `Cloud`/`Target` 이다. */}
            <th className={cn(worklist.th, 'w-px')}>Cloud</th>
            <th className={cn(worklist.th, 'w-px')}>Target</th>
            <th className={cn(worklist.th, 'w-px')}>서비스 코드</th>
            <th className={cn(worklist.th, 'w-px')}>서비스 이름</th>
            <th className={cn(worklist.th, 'w-full')}>설명</th>
            <th className={cn(worklist.th, 'w-px')}>지연</th>
            <th className={cn(worklist.th, 'w-px')} />
          </tr>
        </thead>
        <tbody className={worklist.body}>
          {failed ? (
            <tr>
              <td colSpan={7} className={worklist.state}>
                목록을 불러오지 못했습니다.
              </td>
            </tr>
          ) : loading ? (
            // Skeleton in the real column widths AND the real row count (the
            // tile already knows it), so nothing shifts on arrival.
            Array.from({ length: Math.min(Math.max(count, 1), PAGE_SIZE) }, (_, row) => (
              <tr key={row} aria-hidden="true">
                {Array.from({ length: 6 }, (_, col) => (
                  <td key={col} className={d.cell}>
                    <span className={worklist.skeletonBar} />
                  </td>
                ))}
                <td className={d.actionCell} />
              </tr>
            ))
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={7} className={worklist.state}>
                해당 단계의 대상이 없습니다.
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <DashRow
                key={row.targetSourceId}
                onActivate={() =>
                  router.push(passRoutes.pipelines.ops.targetSource(String(row.targetSourceId), tab))
                }
              >
                <td className={cn(d.cell, 'whitespace-nowrap')}>
                  <ProvTag provider={row.cloudProvider ?? ''} />
                </td>
                <td className={d.cell}>
                  <span className={worklist.idValue}>{row.targetSourceId ?? '—'}</span>
                </td>
                <td className={cn(d.cell, 'whitespace-nowrap')}>
                  <span className={worklist.codeText}>{row.serviceCode ?? '—'}</span>
                </td>
                <td className={d.cell}>
                  <span className={worklist.nameText} title={row.serviceName ?? undefined}>
                    {row.serviceName ?? '—'}
                  </span>
                </td>
                <td className={d.cell}>
                  <span className={worklist.descText} title={row.description ?? undefined}>
                    {row.description ?? '—'}
                  </span>
                </td>
                <td className={d.cell}>
                  {row.delaySeconds != null ? (
                    // nowrap — the auto table layout sizes the column to the
                    // duration; without it "1일 8시간" breaks mid-word.
                    <DelayText
                      delaySeconds={row.delaySeconds}
                      className="whitespace-nowrap text-[12px]"
                    />
                  ) : (
                    <span className={d.elapsed}>—</span>
                  )}
                </td>
                <td className={d.actionCell}>
                  <RowAction />
                </td>
              </DashRow>
            ))
          )}
        </tbody>
      </table>

      <div className={worklist.footer}>
        <OpsPagination page={page} totalPages={totalPages} onChange={setPage} always />
      </div>
    </section>
  );
}
