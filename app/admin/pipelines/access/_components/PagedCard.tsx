'use client';

/**
 * 접근 권한 화면들이 공유하는 페이지드 카드 — 제목 + 건수 배지, 한 줄 설명, 컬럼
 * 머리, 고정 높이 본문(스켈레톤/빈 상태/행), 그리고 카드 바닥에 고정된 페이저.
 *
 * 연동 요청 목록(queue/requests)의 카드 문법을 그대로 옮긴 것이다. 그쪽은 한 파일
 * 안의 지역 컴포넌트라 재사용할 수 없어 여기 한 번 더 두지만, 규칙(항상 그리는 페이저
 * · 로딩 중 건수 숨김 · 스켈레톤이 실제 컬럼 폭을 그림)은 같은 것을 지킨다.
 *
 * `fetcher` 는 반드시 안정된 참조여야 한다(모듈 상수 또는 useCallback) — 매 렌더
 * 새 함수가 들어오면 effect 가 끝없이 다시 돈다.
 */
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { Icon, type IconName } from '@/app/admin/pipelines/_components/icons';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import { ACCESS_PAGE_SIZE, type AccessPage } from '@/app/lib/api/access';

export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);

export interface PagedSection<T> {
  /** 0-based — 페이저와 같은 기준이라 변환이 없다. */
  page: number;
  paged: AccessPage<T> | null;
  loading: boolean;
  error: unknown;
  setPage: (n: number) => void;
  /** 다시 읽기 — 쓰기 직후 목록을 갱신할 때도 쓴다. */
  reload: () => void;
}

export function usePagedSection<T>(
  fetcher: (page: number, opts: { signal: AbortSignal }) => Promise<AccessPage<T>>,
): PagedSection<T> {
  const [page, setPage] = useState(0);
  const [paged, setPaged] = useState<AccessPage<T> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [retry, setRetry] = useState(0);

  useAbortableEffect(
    (signal) => {
      setLoading(true);
      setError(null);
      return fetcher(page, { signal })
        .then((result) => {
          if (signal.aborted) return;
          // 서 있던 페이지가 사라졌으면 마지막 장으로 물러난다. 목록이 짧아지는 길은
          // 넷이다 — 레일에서 다른 서비스로, 검색, 마지막 행 회수, 마지막 행에서 신청.
          // 그냥 두면 배지는 "4건"인데 본문은 빈 상태고 페이저는 없는 페이지를 가리킨다.
          // `loading` 을 켠 채로 두고 다시 읽으므로 그 사이 잘못된 화면이 없다.
          const last = Math.max(result.totalPages - 1, 0);
          if (page > last) {
            setPage(last);
            return;
          }
          setPaged(result);
          setLoading(false);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setError(err);
          setLoading(false);
        });
    },
    [fetcher, page, retry],
  );

  const reload = useCallback(() => setRetry((n) => n + 1), []);
  return { page, paged, loading, error, setPage, reload };
}

/** 카드의 색조 — 건수 배지에만 쓴다. */
export type CardTone = 'primary' | 'danger' | 'muted';

const TONE_BADGE: Record<CardTone, string> = {
  primary: 'bg-[var(--pl-tag-blue-bg)] text-[var(--pl-tag-blue-text)]',
  danger: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]',
  muted: 'bg-[var(--pl-gray-100)] text-[var(--pl-text-medium)]',
};

/** 한 컬럼의 라벨과 셀들이 공유하는 폭 클래스. 라벨이 없으면 꼬리 슬롯(액션/›). */
export interface Column {
  label?: string;
  className: string;
}

export interface PagedCardProps<T> {
  title: string;
  /** 없으면 설명 줄을 그리지 않는다 — 기록 구역처럼 제목만으로 충분한 자리. */
  desc?: string;
  icon: IconName;
  tone: CardTone;
  state: PagedSection<T>;
  /**
   * 머리 행과 스켈레톤을 함께 만든다 — 둘이 실제 행과 어긋날 수 없다.
   *
   * 컬럼 없는 목록(서비스 패널 행처럼 열이 아니라 한 덩어리로 읽는 행)은 생략한다.
   * 그때 머리 행은 그려지지 않고, 스켈레톤 모양은 `skeletonRow` 가 준다.
   */
  columns?: readonly Column[];
  empty: { title: string; caption: string };
  /** 설명 아래·목록 위의 목록 조작 — 지금은 검색창. */
  search?: ReactNode;
  /** 로딩 자리를 통째로 대신한다. 컬럼이 없거나 행이 격자로 흐르는 목록은 기본
   *  스켈레톤(컬럼 폭 막대)이 실제 모양과 어긋나므로 화면이 직접 그린다. */
  skeleton?: ReactNode;
  /** 제목 줄 오른쪽 액션. 주면 건수 배지 대신 이것이 그려진다. */
  action?: ReactNode;
  /**
   * 머리 줄을 통째로 대신한다 — 탭 레일처럼 제목이 카드 밖에서 오는 경우.
   *
   * 제목과 나란히 놓지 않고 대신하는 이유: 탭이 이미 제목이다. 둘 다 그리면 같은
   * 이름이 한 카드에 두 번 적히고, 건수도 배지와 탭에 각각 붙는다.
   * `title` 은 그래도 받는다 — 화면에는 안 보여도 `aria-label` 은 있어야 한다.
   *
   * `null` 은 "머리 줄 없음"이다(생략과 다르다) — 탭이 제목이자 건수까지 이미 말하고
   * 있어서 대신 그릴 것조차 없는 경우.
   */
  head?: ReactNode | null;
  /** 이미 시트 위에 있을 때 — 카드 크롬(테두리·그림자·고정 높이)을 벗는다. */
  bare?: boolean;
  children: (rows: T[]) => ReactNode;
  className?: string;
}

export function PagedCard<T>({
  title,
  desc,
  icon,
  tone,
  state,
  columns = [],
  empty,
  search,
  skeleton,
  action,
  head,
  bare,
  children,
  className,
}: PagedCardProps<T>): ReactElement {
  const { paged, loading, error, page, setPage, reload } = state;
  const rows = paged?.content ?? [];
  /** 열이 없는 목록도 상태 행은 한 칸을 차지한다 — colspan 0 은 셀이 없다는 뜻이다. */
  const colSpan = Math.max(1, columns.length);

  return (
    <section className={cn(bare ? a.section : a.card, className)} aria-label={title}>
      {/* `??` 가 아니라 undefined 검사인 이유: `null` 은 "머리 줄을 그리지 말라"는 값이고,
          `??` 로 받으면 그 뜻이 기본 머리 줄로 되돌아간다. */}
      {head === undefined ? (
        <div className={a.head}>
          <div className={a.titleWrap}>
            <Icon name={icon} size={20} className={a.titleIcon} />
            <h2 className={a.title}>{title}</h2>
          </div>
          {action != null ? (
            <div className={a.headAction}>{action}</div>
          ) : (
            // 로딩 중에는 숨긴다 — 스켈레톤 옆의 '0건'은 아직 모르는 수를 단언하는 것.
            paged != null && (
              <span className={cn(a.badge, TONE_BADGE[tone])}>
                {paged.totalElements.toLocaleString()}건
              </span>
            )
          )}
        </div>
      ) : (
        head
      )}
      {desc != null && <p className={a.desc}>{desc}</p>}
      {search != null && <div className={a.search}>{search}</div>}

      {/* 행은 flex div 라 표 의미를 명시적으로 선언한다 — 스크린리더가 "이메일:
          hong@company.com" 으로 읽는다. 메시지 상태들도 표 안의 행으로 남는다. */}
      <div role="table" aria-label={`${title} 목록`}>
        {columns.length > 0 && (
          <div className={a.headRow} role="row">
            {columns.map((col, index) => (
              <span
                key={col.label ?? `tail-${index}`}
                role="columnheader"
                className={col.className}
              >
                {col.label}
              </span>
            ))}
          </div>
        )}
        {error != null ? (
          <div role="row">
            <div role="cell" aria-colspan={colSpan} className={a.state}>
              <span className="min-w-0 truncate">{errorMessage(error)}</span>
              <PlButton variant="secondary" size="sm" onClick={reload}>
                재시도
              </PlButton>
            </div>
          </div>
        ) : loading ? (
          skeleton ?? (
            <div role="rowgroup" aria-busy="true" aria-label="목록을 불러오는 중">
              {Array.from({ length: ACCESS_PAGE_SIZE }, (_, row) => (
                <div key={row} className={a.row} role="row" aria-hidden="true">
                  {columns.map((col, index) => (
                    <span
                      key={col.label ?? `tail-${index}`}
                      role="cell"
                      className={cn(col.className, col.label != null && a.skeletonBar)}
                    />
                  ))}
                </div>
              ))}
            </div>
          )
        ) : rows.length === 0 ? (
          <div role="row">
            <div role="cell" aria-colspan={colSpan} className={a.empty}>
              <span className={a.emptyTitle}>{empty.title}</span>
              <span className={a.emptyCaption}>{empty.caption}</span>
            </div>
          </div>
        ) : (
          children(rows)
        )}
      </div>

      <div className={a.footer}>
        <OpsPagination
          page={page}
          totalPages={Math.max(1, paged?.totalPages ?? 1)}
          onChange={setPage}
          always
        />
      </div>
    </section>
  );
}
