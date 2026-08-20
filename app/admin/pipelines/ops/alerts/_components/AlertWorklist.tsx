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
 * 카드와 카드 제목은 없다 (벤치마크 시안 B+C, 2026-08-20). 표 위에 남은 것은 12px
 * 메타 한 줄 — 버킷 이름 · 건수 · 담당 — 이고, 표는 페이지 바닥에 직접 선다.
 * 새로고침 버튼도 없다: 타일과 페이지 링크가 이미 서버에서 화면을 다시 그린다.
 */
import { useTransition, type ReactElement } from 'react';
import { useRouter } from 'next/navigation';
import { cn, pipelineStyles } from '@/lib/theme';
import { passRoutes, type OpsTargetTab } from '@/lib/routes';
import type { AlertTargetKind, AlertListRow } from '@/lib/types/task-queue';
import type { AlertStageIcon } from '@/app/admin/pipelines/ops/alerts/_components/buckets';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { TerraformLogo } from '@/app/admin/pipelines/_components/brandMarks';
import { DashRow, RowAction } from '@/app/admin/pipelines/_dashboard/cells';
import { ProvTag } from '@/app/admin/pipelines/_components/ProvTag';
import { DelayText } from '@/app/admin/pipelines/queue/_components/DelayText';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';

/** Contract default page size (`/dashboard/target-sources/{kind}` size=10). */
const PAGE_SIZE = 10;

const worklist = {
  /**
   * 카드가 없다 (시안 C, 벤치마크 아티팩트 2026-08-20).
   *
   * 타일은 면 없이 페이지 바닥에 서는데 표만 흰 카드 + 그림자였다 — 한 화면에 재질이
   * 둘이라 표가 위와 겉돌았다. 파이프라인 대시보드가 같은 판단을 먼저 했고
   * (`dashboard.bleed`), 거기서도 남긴 것은 표 머리의 2px 룰 하나다.
   *
   * `-mx-5` 는 그 대시보드의 `listBlock` 과 같은 이유다: 셀 패딩이 px-5 라 카드를
   * 벗기면 첫 열이 제목·타일보다 20px 안쪽으로 들어간다. 블록을 그만큼 밖으로 당겨
   * 페이지 그리드에 세우고, 행 hover 틴트는 글자보다 넓게 남는다.
   */
  block: '-mx-5',
  /**
   * 목록 메타 — 카드 제목(16/600) + 설명 문단(14/400) 두 줄이 있던 자리 (시안 B).
   *
   * 두 줄을 지운 이유는 중복이다: 버킷 이름은 바로 위 타일이 선택 상태로 이미 말하고
   * 있었고, 설명 두 문장 중 첫 문장은 그 이름의 되풀이, 두 번째 문장의 유일한 새 정보는
   * 행위자 하나였다. 남는 것은 **이름 · 건수 · 행위자** 세 조각이고, 조각이 넷을 넘으면
   * 다시 문단이 되므로 그것이 상한이다.
   *
   * 건수는 타일에도 있다 — 의도한 중복이다. 표까지 시선이 내려온 뒤에는 "지금 몇 건을
   * 보는 중인가"를 말해 주는 것이 없었고, Cloudscape(표 머리의 counter)와 엔터프라이즈
   * 필터링 분석("목록 위에 결과 수를 보여라")이 같은 자리를 요구한다. 지운 것은
   * 중복이 아니라 **제목 계층**이다.
   *
   * 12px 은 이 표가 이미 쓰는 보조 정보 크기(`d.elapsed`·지연 열)다. 위 타일과는
   * 24px(page.tsx `mt-6`), 아래 표와는 12px — 가까운 쪽이 자기 표다.
   */
  meta: 'flex items-center gap-2 px-5 pb-3 text-[12px] leading-[1.5] text-[var(--pl-text-weak)]',
  /** 14px 글리프 — 라벨 옆에 붙는 마크의 공용 크기(`provTag.glyph`). 20px 은 16px 제목이
   *  곁에 있을 때의 값이었고, 그 제목이 사라졌다. */
  metaIcon: 'flex-none text-[var(--pl-text-medium)]',
  metaLabel: 'font-semibold text-[var(--pl-text-strong)]',
  metaCount: 'font-semibold tabular-nums text-[var(--pl-text-strong)]',
  /** 구분점은 줄의 기본색(weak, 4.97:1)을 그대로 쓴다. faint(2.58:1)로 한 칸 더 내리면
   *  design-guard 의 대비 바닥을 뚫는다 — 글리프라도 글자로 그린 이상 같은 자다. */
  metaSep: 'select-none',
  /**
   * 이름과 설명은 셀 폭까지 쓰고 거기서 자른다 (오너 2026-08-20: "서비스 이름이 충분히
   * 길 수 있어 … 설명이랑 거의 반반 … 길면 짤라서").
   *
   * `max-w-[NNch]` 로 잡던 상한을 버린 이유: ch 상한은 열 폭과 무관해서, 열이 넓어도
   * 거기서 먼저 잘리고 열이 좁아지면 상한 전에 셀이 터진다. 열 폭 자체가 상한이어야
   * 하고, 그러려면 표가 `table-fixed` 여야 한다 — auto layout 은 열 폭을 내용이
   * 정하므로 긴 이름 한 줄이 다른 모든 열을 밀어낸다.
   *
   * 잘린 값은 `title` 로 전문을 남긴다 — 자르는 것은 표의 사정이지 값의 사정이 아니다.
   */
  table: 'w-full table-fixed',
  descText: 'block truncate text-[14px] text-[var(--pl-text-weak)]',
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
  nameText: 'block truncate text-[14px] text-[var(--pl-text-strong)]',
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
  /** 이 버킷을 움직여야 하는 사람. 없는 버킷은 메타 줄에서 조각이 빠진다. */
  owner: string | null;
  /** 이 버킷의 요약 건수 — 메타 줄이 싣는 값이자 스켈레톤 행 수의 근거. */
  count: number;
  icon: AlertStageIcon;
  /** Ops-screen tab a row opens — the one that answers this bucket's need. */
  tab: OpsTargetTab;
  /** 서버가 읽어 온 한 페이지 (`AlertWorklistSection`). 이 컴포넌트는 fetch 하지 않는다. */
  rows: AlertListRow[];
  /** 0-based, 계약과 같은 축. 주소의 1-based 는 page.tsx 에서 한 번 변환된다. */
  page: number;
  totalPages: number;
  /** 실패는 빈 목록이 아니다 — 0건과 "못 읽었다"는 다른 문장을 받는다. */
  failed: boolean;
}

/**
 * 표 — 서버가 넘긴 한 페이지를 그리기만 한다.
 *
 * 클라이언트인 이유는 둘뿐이다: 행 클릭 이동, 페이지 이동(주소 갱신).
 * 데이터는 props 로 들어오므로 이 파일에는 fetch 도 로딩 state 도 없다 — 로딩은
 * 상위 `Suspense` 의 일이 됐다(`AlertWorklistSkeleton`).
 */
export function AlertWorklist({
  kind,
  label,
  owner,
  count,
  icon,
  tab,
  rows,
  page,
  totalPages,
  failed,
}: AlertWorklistProps): ReactElement {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const goToPage = (next: number) => {
    startTransition(() => {
      // 1-based 주소 (page.tsx 의 변환과 짝). 첫 페이지는 파라미터를 아예 빼서
      // 기본 주소가 `?page=1` 로 지저분해지지 않게 한다.
      const query = next > 0 ? `?kind=${kind}&page=${next + 1}` : `?kind=${kind}`;
      router.push(`${passRoutes.pipelines.ops.alerts}${query}`);
    });
  };

  const d = pipelineStyles.dashboard;

  return (
    <section className={worklist.block} aria-label={`${label} 대상 목록`}>
      <p className={worklist.meta}>
        <span className={worklist.metaIcon}>
          {icon === 'terraform' ? <TerraformLogo size={14} /> : <Icon name={icon} size={14} />}
        </span>
        <span className={worklist.metaLabel}>{label}</span>
        <span>
          <span className={worklist.metaCount}>{count}</span>건
        </span>
        {owner ? (
          <>
            <span className={worklist.metaSep} aria-hidden="true">
              ·
            </span>
            <span>{owner}</span>
          </>
        ) : null}
      </p>

      <table className={worklist.table}>
        <thead>
          <tr>
            {/* 열 폭은 백분율로 못박는다(`table-fixed`). 식별·지연 열은 제 값이
                들어갈 만큼만 갖고, 남는 폭은 **이름과 설명이 반씩** 나눠 갖는다
                (오너 2026-08-20). 두 열은 길이를 예측할 수 없는 유이한 값이라,
                한쪽에만 여유를 주면 다른 쪽이 항상 먼저 잘린다.
                min-w 는 좁은 창에서의 바닥이다 — 백분율만 두면 "8시간 48분"이나
                "서비스 코드" 머리글이 제 칸을 넘는다.
                열 이름은 이 섹션이 이미 쓰는 것을 그대로 쓴다 — 대시보드 필터,
                연동 요청 표, 큐 목록이 모두 `Cloud`/`Target` 이다. */}
            <th className={cn(worklist.th, 'w-[9%] min-w-[96px]')}>Cloud</th>
            <th className={cn(worklist.th, 'w-[9%] min-w-[96px]')}>Target</th>
            <th className={cn(worklist.th, 'w-[10%] min-w-[104px]')}>서비스 코드</th>
            <th className={cn(worklist.th, 'w-[28%]')}>서비스 이름</th>
            <th className={cn(worklist.th, 'w-[28%]')}>설명</th>
            <th className={cn(worklist.th, 'w-[10%] min-w-[104px]')}>지연</th>
            <th className={cn(worklist.th, 'w-[6%] min-w-[64px]')} />
          </tr>
        </thead>
        <tbody className={worklist.body}>
          {failed ? (
            <tr>
              <td colSpan={7} className={worklist.state}>
                목록을 불러오지 못했습니다.
              </td>
            </tr>
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
        <OpsPagination page={page} totalPages={totalPages} onChange={goToPage} always />
      </div>
    </section>
  );
}

/**
 * 로딩 자리 — 상위 `Suspense` 의 fallback. 서버가 다음 버킷·페이지를 읽는 동안
 * 카드와 표의 골격은 그대로 서 있고 행만 회색 막대가 된다.
 *
 * 행 수를 타일의 건수로 잡는 이유는 예전 클라이언트 로딩과 같다 — 도착했을 때
 * 카드 높이가 뛰지 않아야 한다. 머리글(라벨·설명)은 서버가 이미 알고 있으므로
 * 스켈레톤에서도 진짜 문장을 그린다: 기다리는 동안에도 어느 버킷을 여는 중인지는
 * 읽을 수 있어야 한다.
 */
export function AlertWorklistSkeleton({
  label,
  owner,
  icon,
  count,
}: {
  label: string;
  owner: string | null;
  icon: AlertStageIcon;
  count: number;
}): ReactElement {
  const d = pipelineStyles.dashboard;
  return (
    <section className={worklist.block} aria-busy="true" aria-label={`${label} 대상 목록 불러오는 중`}>
      {/* 메타 줄은 진짜 값을 그린다 — 서버가 이미 라벨·건수·담당을 알고 있고,
          기다리는 동안에도 어느 버킷을 여는 중인지는 읽을 수 있어야 한다. */}
      <p className={worklist.meta}>
        <span className={worklist.metaIcon}>
          {icon === 'terraform' ? <TerraformLogo size={14} /> : <Icon name={icon} size={14} />}
        </span>
        <span className={worklist.metaLabel}>{label}</span>
        <span>
          <span className={worklist.metaCount}>{count}</span>건
        </span>
        {owner ? (
          <>
            <span className={worklist.metaSep} aria-hidden="true">
              ·
            </span>
            <span>{owner}</span>
          </>
        ) : null}
      </p>
      <table className={worklist.table}>
        <thead>
          <tr>
            <th className={cn(worklist.th, 'w-[9%] min-w-[96px]')}>Cloud</th>
            <th className={cn(worklist.th, 'w-[9%] min-w-[96px]')}>Target</th>
            <th className={cn(worklist.th, 'w-[10%] min-w-[104px]')}>서비스 코드</th>
            <th className={cn(worklist.th, 'w-[28%]')}>서비스 이름</th>
            <th className={cn(worklist.th, 'w-[28%]')}>설명</th>
            <th className={cn(worklist.th, 'w-[10%] min-w-[104px]')}>지연</th>
            <th className={cn(worklist.th, 'w-[6%] min-w-[64px]')} />
          </tr>
        </thead>
        <tbody className={worklist.body}>
          {Array.from({ length: Math.min(Math.max(count, 1), PAGE_SIZE) }, (_, row) => (
            <tr key={row} aria-hidden="true">
              {Array.from({ length: 6 }, (_, col) => (
                <td key={col} className={d.cell}>
                  <span className={worklist.skeletonBar} />
                </td>
              ))}
              <td className={d.actionCell} />
            </tr>
          ))}
        </tbody>
      </table>
      <div className={worklist.footer} />
    </section>
  );
}
