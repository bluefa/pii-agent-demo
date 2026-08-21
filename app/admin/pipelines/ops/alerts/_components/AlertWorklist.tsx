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
import { PAGE_SIZE, worklist } from '@/app/admin/pipelines/ops/alerts/_components/worklistStyles';

interface WorklistMetaProps {
  label: string;
  /** 이 버킷을 움직여야 하는 사람. 없는 버킷은 메타 줄에서 조각이 빠진다. */
  owner: string | null;
  /**
   * 이 버킷의 요약 건수 — 메타 줄이 싣는 값이자 스켈레톤 행 수의 근거.
   *
   * null 은 요약을 못 읽었다는 뜻이고, **0 건과 다르다**. 없는 값을 0 으로 적으면
   * 행이 3 줄 그려진 표 위에서 "0건"이라고 말하게 된다. 담당이 없을 때와 같은
   * 처리 — 조각과 그 구분점이 함께 빠진다.
   */
  count: number | null;
  icon: AlertStageIcon;
}

/** 표와 스켈레톤이 같은 메타 줄을 그린다 — 기다리는 동안 줄이 바뀌면 도착할 때 흔들린다. */
function WorklistMeta({ label, owner, count, icon }: WorklistMetaProps): ReactElement {
  const sep = (
    <span className={worklist.metaSep} aria-hidden="true">
      ·
    </span>
  );
  return (
    <p className={worklist.meta}>
      <span className={worklist.metaIcon}>
        {icon === 'terraform' ? <TerraformLogo size={14} /> : <Icon name={icon} size={14} />}
      </span>
      <span className={worklist.metaLabel}>{label}</span>
      {count !== null ? (
        <span>
          <span className={worklist.metaCount}>{count}</span>건
        </span>
      ) : null}
      {owner ? (
        <>
          {sep}
          <span>{owner}</span>
        </>
      ) : null}
    </p>
  );
}

/**
 * 열 스펙은 한 벌만 존재한다 — 표와 스켈레톤이 서로 다른 폭을 들면, 도착하는 순간
 * 열이 뛴다. 스켈레톤이 막으려던 것이 바로 그 흔들림이라 두 벌로 두면 자기 목적을
 * 배신한다.
 *
 * 폭은 백분율로 못박는다(`table-fixed`). 식별·지연 열은 제 값이 들어갈 만큼만 갖고,
 * 남는 폭은 **이름과 설명이 반씩** 나눠 갖는다 (오너 2026-08-20). 두 열은 길이를
 * 예측할 수 없는 유이한 값이라, 한쪽에만 여유를 주면 다른 쪽이 항상 먼저 잘린다.
 * min-w 는 좁은 창에서의 바닥이다 — 백분율만 두면 "8시간 48분"이나 "서비스 코드"
 * 머리글이 제 칸을 넘는다.
 *
 * 열 이름은 이 섹션이 이미 쓰는 것을 그대로 쓴다 — 대시보드 필터, 연동 요청 표,
 * 큐 목록이 모두 `Cloud`/`Target` 이다.
 */
function WorklistHead(): ReactElement {
  return (
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
  );
}

export interface AlertWorklistProps extends WorklistMetaProps {
  kind: AlertTargetKind;
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
      <WorklistMeta label={label} owner={owner} count={count} icon={icon} />

      <table className={worklist.table}>
        <WorklistHead />
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
            rows.map((row, index) => {
              const id = row.targetSourceId;
              const cells = (
                <>
                  <td className={cn(d.cell, 'whitespace-nowrap')}>
                    <ProvTag provider={row.cloudProvider ?? ''} />
                  </td>
                  <td className={d.cell}>
                    <span className={worklist.idValue}>{id ?? '—'}</span>
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
                      // nowrap — 열 폭은 `table-fixed` 가 정하므로 값이 칸보다 길면
                      // 줄바꿈이 먼저 일어난다. 없으면 "1일 8시간" 이 단어 중간에서 끊긴다.
                      <DelayText
                        delaySeconds={row.delaySeconds}
                        className="whitespace-nowrap text-[12px]"
                      />
                    ) : (
                      <span className={d.elapsed}>—</span>
                    )}
                  </td>
                  <td className={d.actionCell}>{id != null ? <RowAction /> : null}</td>
                </>
              );

              // id 없는 행은 열지 않는다. id 는 이 행의 목적지이자 key 인데 계약상
              // null 이 올 수 있고(LOOSE 스키마), 그대로 쓰면 목적지가
              // `/target-sources/null` 이 되고 그런 행이 둘이면 key 까지 부딪친다.
              // 값 자리에는 이미 '—' 를 그리고 있었으니 행 전체가 그 판단을 따라간다:
              // 커서도 화살표도 빼서 누를 수 있는 척하지 않는다. 같은 콘솔의 큐 목록이
              // 같은 자리에서 같은 판단을 한다 (queue/page.tsx).
              return id == null ? (
                <tr key={`no-id:${row.serviceCode ?? ''}:${index}`}>{cells}</tr>
              ) : (
                <DashRow
                  key={id}
                  // 접근명을 명시하지 않으면 `role="button"` 이 여섯 셀을 이어 붙여
                  // 읽는다 — 설명 열은 길이 상한이 없어서 한 행이 수백 자 문장이 된다.
                  // 행을 여는 데 필요한 것은 어느 대상인지 하나뿐이다.
                  label={`${row.serviceName ?? '이름 없음'} (Target ${id}) 상세 열기`}
                  onActivate={() =>
                    router.push(passRoutes.pipelines.ops.targetSource(String(id), tab))
                  }
                >
                  {cells}
                </DashRow>
              );
            })
          )}
        </tbody>
      </table>

      {/* 못 읽은 목록에는 페이저를 달지 않는다. 실패하면 `totalPages` 는 기본값 1 로
          떨어지는데 주소의 page 는 그대로라, `?page=99` 가 깨진 경우 "이전" 이 살아
          있는 1 페이지짜리 페이저가 뜬다 — 누르면 또 다른 잘못된 주소를 민다. 셀 자체가
          없는 상태에서 넘길 페이지도 없다. */}
      {failed ? null : (
        <div className={worklist.footer}>
          <OpsPagination page={page} totalPages={totalPages} onChange={goToPage} always />
        </div>
      )}
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
}: WorklistMetaProps): ReactElement {
  const d = pipelineStyles.dashboard;
  return (
    <section className={worklist.block} aria-busy="true" aria-label={`${label} 대상 목록 불러오는 중`}>
      {/* 메타 줄은 진짜 값을 그린다 — 서버가 이미 라벨·건수·담당을 알고 있고,
          기다리는 동안에도 어느 버킷을 여는 중인지는 읽을 수 있어야 한다. */}
      <WorklistMeta label={label} owner={owner} count={count} icon={icon} />
      <table className={worklist.table}>
        <WorklistHead />
        <tbody className={worklist.body}>
          {/* 건수를 모르면 한 페이지 높이로 잡는다 — 아는 척 1행만 그렸다가 10행이
              도착하면 그 시프트가 스켈레톤이 막으려던 바로 그 흔들림이다. */}
          {Array.from({ length: Math.min(Math.max(count ?? PAGE_SIZE, 1), PAGE_SIZE) }, (_, row) => (
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
