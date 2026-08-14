'use client';

/**
 * 권한 요청 (/admin/pipelines/access/requests).
 *
 * 카드 두 장이 나란히 선다 — 왼쪽은 손이 가야 하는 요청, 오른쪽은 읽기 전용 전역 이력.
 *
 * 승인 대기와 반려는 카드 두 장이 아니라 한 장 안의 탭이다. 둘은 같은 목록을 상태로
 * 자른 것이고 열도 같아서, 카드로 나눠 두면 같은 행 문법이 조용히 갈라진다(제목·설명·
 * 건수 배지·페이저가 각각 두 벌씩 생긴다). 두 탭의 행은 같은 상세로 가고, 사유 전문은
 * 거기서 읽는다 — 목록은 한 줄 미리보기만 한다.
 *
 * 이력은 표가 아니라 줄로 읽는다. 사실이 일곱이라 전체 폭에서는 표가 맞지만, 반 폭에
 * 서면 늘어나는 네 열에 38px 씩밖에 안 남는다. 열을 지워 사실을 버리는 대신 한 행을
 * 줄로 편다(`accessStyles.feedRow`).
 *
 * 서비스 코드 단위 이력은 여기가 아니라 서비스별 권한 화면이 담당한다(같은 이력을
 * service_code 로 필터해 그 서비스 시트 안에 둔다). 여기 이력은 전역 감사 로그다.
 */
import { useState, type ReactElement, type ReactNode } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';

import { Icon } from '@/app/admin/pipelines/_components/icons';
import {
  PagedCard,
  usePagedSection,
  type Column,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import { HistoryTypePill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
  ACCESS_PAGE_SIZE,
  getAccessHistory,
  getAccessRequests,
  type AccessHistoryEntry,
  type AccessPage,
  type PermissionRequestRow,
} from '@/app/lib/api/access';

// 모듈 상수 fetcher — deps 가 렌더마다 흔들리지 않게(useAbortableEffect 재실행 방지).
const fetchPending = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<PermissionRequestRow>> => getAccessRequests('PENDING', page, opts);
const fetchRejected = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<PermissionRequestRow>> => getAccessRequests('REJECTED', page, opts);
const fetchHistory = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<AccessHistoryEntry>> => getAccessHistory({}, page, opts);

/**
 * 두 탭은 같은 골격을 쓴다 — 같은 목록을 상태로 자른 것이라 열도 행도 하나뿐이다.
 *
 * 사유 열이 없다: `PermissionRequestRow` 가 `reason` 도 `status` 도 싣지 않는다(갭 B3).
 * 사유는 상세에만 있어서, 목록에 미리보기를 그리려면 행마다 상세를 부르는 N+1 이 된다.
 * 계약에 세 필드(`reason`·`status`·`processed_at`)가 붙으면 이 열은 되살아난다.
 */
const REQUEST_COLUMNS: readonly Column[] = [
  { label: '요청자', className: a.knox },
  { label: '서비스', className: a.name },
  { label: '코드', className: a.code },
  { label: '요청 일자', className: a.when },
  { className: a.chev },
];

type RequestTab = 'pending' | 'rejected';
const REQUEST_TABS = ['pending', 'rejected'] as const;

/** 탭마다 다른 건 문구뿐이다. */
const TAB_COPY: Record<
  RequestTab,
  { label: string; desc: string; what: string; empty: { title: string; caption: string } }
> = {
  pending: {
    label: '승인 대기',
    desc: '행을 눌러 요청 사유를 확인한 뒤 승인하거나 반려해 주세요 — 승인하면 즉시 권한이 부여돼요',
    what: '접근 요청',
    empty: {
      title: '승인을 기다리는 요청이 없어요',
      caption: '새 접근 권한 요청이 들어오면 여기에 표시돼요',
    },
  },
  rejected: {
    label: '반려',
    desc: '반려한 요청이에요 — 사유는 계약상 상세에만 있어서, 행을 눌러 확인해요',
    what: '반려 내역',
    empty: {
      title: '반려한 요청이 없어요',
      caption: '반려 처리한 요청이 여기에 모여요',
    },
  },
};

export default function AccessRequestsPage(): ReactElement {
  const pending = usePagedSection(fetchPending);
  const rejected = usePagedSection(fetchRejected);
  const history = usePagedSection(fetchHistory);

  // 두 목록 다 언제나 읽는다 — 안 보이는 탭의 건수를 탭 자신이 말해야 한다. 탭을 옮겨도
  // 다시 읽지 않으므로 호출 수는 카드가 둘이던 때와 같다.
  const [tab, setTab] = useState<RequestTab>('pending');
  const active = tab === 'pending' ? pending : rejected;
  const copy = TAB_COPY[tab];

  const tabStrip = (
    <div className={a.tabStrip} role="tablist" aria-label="권한 요청 탭">
      {REQUEST_TABS.map((key) => {
        const on = key === tab;
        const count = (key === 'pending' ? pending : rejected).paged?.totalElements;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => setTab(key)}
            className={cn(a.tab, on ? a.tabActive : a.tabIdle)}
          >
            {TAB_COPY[key].label}
            {/* 아직 모르는 수는 쓰지 않는다 — 로딩 중 '0' 은 단언이다. */}
            {count != null && <span className={a.tabCount}>{count}</span>}
          </button>
        );
      })}
    </div>
  );

  /** 이력 스켈레톤 — 열이 없어 기본(컬럼 폭 막대)이 실제 행 모양과 어긋난다. */
  const historySkeleton: ReactNode = (
    <div role="rowgroup" aria-busy="true" aria-label="이력을 불러오는 중" className="mt-3">
      {Array.from({ length: ACCESS_PAGE_SIZE }, (_, row) => (
        <div key={row} className={a.feedRow} role="row" aria-hidden="true">
          <span className={cn(a.skeletonBar, 'w-1/2')} />
          <span className={cn(a.skeletonBar, 'w-2/3')} />
        </div>
      ))}
    </div>
  );

  return (
    <div>
      <h1 className={a.pageTitle}>권한 요청</h1>
      <p className={a.pageDesc}>
        사용자가 보낸 서비스 접근 권한 요청을 검토하고 승인하거나 반려해요
      </p>

      <div className={a.grid}>
        <PagedCard
          head={tabStrip}
          title={copy.label}
          desc={copy.desc}
          icon="inbox"
          tone="primary"
          state={active}
          columns={REQUEST_COLUMNS}
          empty={copy.empty}
        >
          {(rows) =>
            rows.map((row) => (
              <div key={row.requestId} role="row" className={cn(a.row, a.rowLink)}>
                {/* 링크는 첫 셀 안에 둔다 — role=row 는 셀만 자식으로 가져야 한다.
                    absolute inset-0 이라 클릭 면적은 행 전체 그대로다. */}
                <span role="cell" className={a.knox}>
                  <Link
                    href={passRoutes.pipelines.access.request(row.requestId)}
                    aria-label={`${row.requester.knoxId}의 ${row.serviceName} ${copy.what} 상세 보기`}
                    className="absolute inset-0"
                  />
                  {row.requester.knoxId}
                </span>
                <span role="cell" className={a.name}>
                  {row.serviceName}
                </span>
                <span role="cell" className={cn(a.code, a.mono)}>
                  {row.serviceCode}
                </span>
                <span role="cell" className={a.when}>
                  {fmtDateTime(row.requestedAt)}
                </span>
                <span role="cell" className={a.chev}>
                  <Icon name="arrow-up-right" size="sm" />
                </span>
              </div>
            ))
          }
        </PagedCard>

        <PagedCard
          title="전체 이력"
          desc="승인·반려는 물론 직접 부여와 해제까지, 권한이 움직인 모든 기록이에요"
          icon="clock"
          tone="muted"
          state={history}
          skeleton={historySkeleton}
          empty={{ title: '표시할 이력이 없어요', caption: '권한이 부여되거나 해제되면 여기에 쌓여요' }}
        >
          {(rows) => (
            // 목록을 설명에서 떼어 놓는 자리 — 열이 있는 카드에서는 머리 행(mt-3)이
            // 하던 일이다. 피드엔 머리 행이 없으니 여기서 같은 간격을 준다.
            <div role="rowgroup" className="mt-3">
              {rows.map((row) => (
                <div key={row.historyId} role="row" className={a.feedRow}>
                  <span role="cell" className={a.feedHead}>
                    <HistoryTypePill type={row.type} />
                    <span className={a.feedIdent}>
                      <span className={a.feedSvc}>{row.serviceName ?? '—'}</span>
                      {row.serviceCode != null && (
                        <span className={cn(a.mono, 'flex-none')}>{row.serviceCode}</span>
                      )}
                    </span>
                    <span className={a.feedWhen}>{fmtDateTime(row.createdAt)}</span>
                  </span>
                  <span role="cell" className={a.feedFacts}>
                    <span>
                      <span className={a.feedLabel}>대상</span>
                      <span className={a.feedWho}>{row.targetUser.knoxId}</span>
                    </span>
                    <span>
                      <span className={a.feedLabel}>수행자</span>
                      <span className={a.feedWho}>{row.actorUser.knoxId}</span>
                    </span>
                  </span>
                  {/* 사유는 있을 때만 — 없는 값에 '—' 를 찍으면 줄만 늘고 뜻은 안 는다.
                      그래서 할 말이 있는 행(주로 반려)만 세 줄이 되고, 읽을 행이 먼저
                      눈에 든다. */}
                  {row.note != null && (
                    <span role="cell" className={a.feedNote} title={row.note}>
                      {row.note}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </PagedCard>
      </div>
    </div>
  );
}
