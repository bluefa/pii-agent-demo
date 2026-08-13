'use client';

/**
 * 내 권한 요청 (/access-requests) — 권한이 없는 서비스를 보고, 사유를 적어 요청하고,
 * 승인·반려 결과를 확인하는 화면.
 *
 * `/admin/**` 밖에 있다. 그 아래였다면 admin 게이트(ADMIN 허용 목록)가 이 화면을 정확히
 * 필요로 하는 사람만 골라 막았을 것이다. 진입점은 계정 카드(UserChip)이고, 화면 자체는
 * 접근 권한 관리자 화면들과 같은 부품·같은 계약을 쓴다.
 *
 * 왼쪽 카드는 "내가 아직 못 가진 서비스"다 — `/user/services/page` 가 전체 서비스와
 * `access_status` 를 주므로, NONE 이거나 REJECTED 인 것만 걸러 낸 것이다. 오른쪽 카드는
 * 결과까지 담은 내 요청 내역이고, 반려 사유는 그 자리에서 읽힌다.
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';

import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { SearchBox } from '@/app/admin/pipelines/_components/SearchBox';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';
import { serviceListStyles as sl } from '@/app/admin/pipelines/_services/styles';
import {
  PagedCard,
  ROWS_PER_PAGE,
  errorMessage,
  usePagedSection,
  type Column,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import { RequestAccessModal } from '@/app/admin/pipelines/access/_components/AccessModals';
import { RequestStatusPill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
  createAccessRequest,
  getMyAccessRequests,
  getUserServices,
  sliceToPage,
  type AccessPage,
  type PermissionRequestDetail,
  type UserServiceRow,
} from '@/app/lib/api/access';

/**
 * 요청 가능한 서비스 = access_status 가 NONE 이거나 REJECTED 인 것.
 *
 * 서버 페이지를 그대로 쓸 수 없어 한 번에 크게 받아 걸러 낸다 — 필터가 화면 쪽에 있으니
 * 서버가 나눠 준 페이지에는 이미 걸러질 행이 섞여 있고, 그대로 그리면 5행짜리 카드에
 * 2행만 남는 페이지가 생긴다. 서비스 수는 목록 화면 하나 분량이라 이 정도가 맞다.
 *
 * 검색어는 서버로 보낸다(코드·이름). 걸러 내는 축이 둘(질의는 서버, 권한 상태는 화면)이라
 * 순서가 중요하다 — 질의로 좁힌 다음 상태로 거르고, 그 결과를 나눈다.
 */
const REQUESTABLE = new Set(['NONE', 'REJECTED']);
const SEARCH_DEBOUNCE_MS = 300;

const fetchMine = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<PermissionRequestDetail>> =>
  getMyAccessRequests(page, { ...opts, size: ROWS_PER_PAGE });

/**
 * 로딩 중 서비스 행 — 타일 · 이름 · 코드 태그의 실제 모양을 그대로 흉내 낸다.
 * 도착했을 때 목록이 튀지 않는 건 이 세 칸의 크기가 진짜 행과 같기 때문이다.
 */
const SERVICE_SKELETON = (
  <div className={a.svcRow} aria-hidden="true">
    <span className={cn(serviceSidebarStyles.tile, a.skeletonBar, 'h-7 w-7')} />
    <span className={cn(a.skeletonBar, 'h-4 flex-1')} />
    <span className={cn(a.skeletonBar, 'h-5 w-[38px]')} />
    <span className={a.tail} />
  </div>
);

const MINE_COLUMNS: readonly Column[] = [
  { label: '서비스', className: a.name },
  { label: '코드', className: a.code },
  { label: '상태', className: a.status },
  { label: '결과 · 사유', className: a.note },
  { label: '요청 일자', className: a.when },
];

export default function MyAccessRequestsPage(): ReactElement {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const fetchRequestable = useCallback(
    async (page: number, opts: { signal: AbortSignal }): Promise<AccessPage<UserServiceRow>> => {
      const all = await getUserServices(debounced || undefined, 0, { ...opts, size: 200 });
      return sliceToPage(
        all.content.filter((row) => REQUESTABLE.has(row.accessStatus)),
        page,
        ROWS_PER_PAGE,
      );
    },
    [debounced],
  );

  const requestable = usePagedSection(fetchRequestable);
  const mine = usePagedSection(fetchMine);
  const toast = usePlToast();
  /** 요청 모달을 연 서비스 — null 이면 닫혀 있다. */
  const [target, setTarget] = useState<UserServiceRow | null>(null);

  // 검색어가 바뀌면 첫 장으로. 3장짜리 목록의 3페이지에서 검색해 한 장만 남으면
  // 있지도 않은 페이지를 그리게 된다.
  const { setPage: setRequestablePage } = requestable;
  useEffect(() => {
    setRequestablePage(0);
  }, [debounced, setRequestablePage]);

  const submit = async (reason: string): Promise<void> => {
    if (!target) return;
    try {
      await createAccessRequest(target.serviceCode, reason);
      toast.show(`${target.serviceName} 접근 권한을 요청했어요`);
      setTarget(null);
      // 요청한 서비스는 후보에서 빠지고 내역에 나타난다 — 둘 다 다시 읽는다.
      requestable.reload();
      mine.reload();
    } catch (err) {
      toast.show(errorMessage(err));
    }
  };

  return (
    <div>
      <h1 className={a.pageTitle}>내 권한 요청</h1>
      <p className={a.pageDesc}>
        권한이 없는 서비스에 접근을 요청하고, 승인·반려 결과를 확인해요
      </p>

      <div className={a.grid}>
        <PagedCard
          title="요청할 수 있는 서비스"
          desc="아직 접근 권한이 없는 서비스예요 — 사유를 적어 요청하면 관리자가 검토해요"
          icon="compass"
          tone="primary"
          state={requestable}
          search={
            <SearchBox
              wrapClassName="block w-full"
              placeholder="서비스 코드/이름 검색"
              aria-label="서비스 코드/이름 검색"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          }
          skeletonRow={SERVICE_SKELETON}
          empty={
            debounced
              ? {
                  title: '검색 결과가 없어요',
                  caption: '이미 권한이 있거나 요청해 둔 서비스는 여기 나오지 않아요',
                }
              : {
                  title: '요청할 서비스가 없어요',
                  caption: '모든 서비스에 권한이 있거나, 이미 요청해 두었어요',
                }
          }
        >
          {/* 서비스는 `/services` 레일과 같은 모양으로 읽힌다 — 타일 · 이름 · 코드 태그.
              고를 수 있는 목록이 아니라 요청할 목록이라 행 자체는 버튼이 아니고, 행 끝의
              [요청] 만 누를 수 있다. */}
          {(rows) =>
            rows.map((row) => (
              <div key={row.serviceCode} role="row" className={a.svcRow}>
                <span
                  className={cn(serviceSidebarStyles.tile, serviceTileClass(row.serviceCode))}
                  aria-hidden="true"
                >
                  {row.serviceName.charAt(0).toUpperCase()}
                </span>
                <span role="cell" className={cn(sl.name, sl.nameIdle)}>
                  {row.serviceName}
                </span>
                <span role="cell" className={sl.code}>
                  {row.serviceCode}
                </span>
                <span role="cell" className={a.tail}>
                  <PlButton variant="secondary" size="sm" onClick={() => setTarget(row)}>
                    요청
                  </PlButton>
                </span>
              </div>
            ))
          }
        </PagedCard>

        <PagedCard
          title="내 요청 내역"
          desc="요청한 건의 처리 상태예요 — 반려된 건은 사유를 확인하고 다시 요청할 수 있어요"
          icon="clock"
          tone="muted"
          state={mine}
          columns={MINE_COLUMNS}
          empty={{
            title: '요청한 내역이 없어요',
            caption: '왼쪽에서 서비스를 골라 접근 권한을 요청해 보세요',
          }}
        >
          {(rows) =>
            rows.map((row) => (
              <div key={row.requestId} role="row" className={a.row}>
                <span role="cell" className={cn(a.name, a.nameStrong)}>
                  {row.serviceName}
                </span>
                <span role="cell" className={cn(a.code, a.mono)}>
                  {row.serviceCode}
                </span>
                <span role="cell" className={a.status}>
                  <RequestStatusPill status={row.status} />
                </span>
                <span role="cell" className={a.note} title={row.processedNote ?? undefined}>
                  {row.processedNote ?? '—'}
                </span>
                <span role="cell" className={a.when}>
                  {fmtDateTime(row.requestedAt)}
                </span>
              </div>
            ))
          }
        </PagedCard>
      </div>

      <RequestAccessModal
        open={target != null}
        onClose={() => setTarget(null)}
        serviceCode={target?.serviceCode ?? ''}
        serviceName={target?.serviceName ?? ''}
        onSubmit={submit}
      />
    </div>
  );
}
