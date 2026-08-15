'use client';

/**
 * 권한 요청 (/admin/pipelines/access/requests) — 승인 워크벤치.
 *
 * 화면이 목록이 아니라 승인함이다. 왼쪽에서 요청을 고르고 오른쪽에서 사유를 읽고 그
 * 자리에서 승인·반려한다. 전에는 목록이 상세 페이지로 나가는 링크 다섯 줄이었고, 그래서
 * 이 화면의 주어(처리해야 할 요청)가 화면 어디에도 크게 적히지 않았다.
 *
 * 탭 셋이 화면의 목차다 — 승인 대기·반려는 같은 목록을 상태로 자른 것이고 전체 이력은
 * 읽기 전용 기록이다. 셋이 한 자리에 서면 표면이 하나만 남는다(전에는 카드 두 장이
 * 나란히 섰고, 손댈 필요 없는 이력 쪽이 18px 제목과 색면 일곱을 가지고 있었다).
 *
 * 워크벤치 바닥이 캔버스인 이유는 `accessStyles.bench` 에 적혀 있다 — 흰 면끼리는 이
 * 제품에서 서로 안 보인다.
 *
 * 상세 페이지(`requests/[requestId]`)는 그대로 둔다. 알림·딥링크가 오는 자리다.
 */
import { useCallback, useState, type ReactElement, type ReactNode } from 'react';
import { cn, serviceSidebarStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { serviceTileClass } from '@/app/components/features/admin/ServiceSidebar/ServiceRow';

import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { useNavCountsRefresh } from '@/app/admin/pipelines/_components/NavCountsRefresh';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import {
  PagedCard,
  errorMessage,
  usePagedSection,
  type Column,
  type PagedSection,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import {
  ApproveAccessModal,
  RejectAccessModal,
} from '@/app/admin/pipelines/access/_components/AccessModals';
import {
  HistoryTypePill,
  RequestStatusPill,
} from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
  ACCESS_PAGE_SIZE,
  approveAccessRequest,
  getAccessHistory,
  getAccessRequest,
  getAccessRequests,
  rejectAccessRequest,
  type AccessHistoryEntry,
  type AccessPage,
  type PermissionRequestDetail,
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
/**
 * 이력만 한 장에 8줄이다(다른 목록은 5).
 *
 * 이 탭은 고르는 목록이 아니라 읽는 기록이고, 줄 하나가 이벤트 하나라 훑는 단위가
 * 크다 — 5줄이면 승인·반려·부여·회수가 한 장에 다 못 들어와서 무슨 일이 있었는지
 * 보려면 페이저부터 눌러야 했다(오너 지시 2026-08-14). 왼쪽 레일이 없는 탭이라
 * 세로 여유도 여기만 있다.
 */
const HISTORY_PAGE_SIZE = 8;

const fetchHistory = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<AccessHistoryEntry>> =>
  getAccessHistory({}, page, { ...opts, size: HISTORY_PAGE_SIZE });

/**
 * 이력은 열로 읽는다 — 서비스별 권한 시트의 이력 표에 서비스 열 하나만 더한 것이고,
 * 그래서 같은 기록이 두 화면에서 같은 모양이다.
 *
 * 전에는 한 행을 두세 줄로 폈다. 요청 카드와 나란히 서던 때는 그럴 이유가 있었지만
 * (고정 폭만 364px 이라 늘어나는 열에 38px 씩밖에 안 남았다) 지금은 탭 하나를 통째로
 * 쓴다. 그 폭에서 줄로 펴면 등급이 어긋난다 — 12px 구분 pill 아래에 14px 대상·수행자가
 * 오고, 세 줄이 다 같은 x 에서 시작해 pill 자리와 '대상' 라벨 자리가 번갈아 선다.
 * 사실 여섯이 다 같은 모양이면 그건 계층이 아니라 열이다.
 */
const HISTORY_COLUMNS: readonly Column[] = [
  { label: '구분', className: a.status },
  { label: '코드', className: a.code },
  { label: '서비스', className: a.svcCol },
  { label: '대상', className: a.knox },
  { label: '수행자', className: a.knox },
  { label: '사유', className: a.noteWide },
  { label: '일시', className: a.when },
];

type RequestTab = 'pending' | 'rejected' | 'history';

/**
 * 며칠부터 "오래 기다린 요청"인가 — 계약에 SLA 가 없으므로 **우리 값**이다.
 * 넘긴 요청만 잉크가 바뀐다. 전부 바뀌면 아무것도 안 바뀐 것과 같다.
 */
const WAIT_WARN_DAYS = 3;

/** 요청이 기다린 일수. */
function waitedDays(iso: string): number {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 0;
  return Math.max(0, Math.floor((Date.now() - then) / 86_400_000));
}

export default function AccessRequestsPage(): ReactElement {
  const pending = usePagedSection(fetchPending);
  const rejected = usePagedSection(fetchRejected);
  const history = usePagedSection(fetchHistory);
  const toast = usePlToast();
  const refreshNavCounts = useNavCountsRefresh();

  // 세 목록 다 언제나 읽는다 — 안 보이는 탭의 건수를 탭 자신이 말해야 한다. 탭을 옮겨도
  // 다시 읽지 않으므로 진입 호출 수는 카드가 둘이던 때와 같다.
  const [tab, setTab] = useState<RequestTab>('pending');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<PermissionRequestDetail | null>(null);
  const [detailError, setDetailError] = useState<unknown>(null);
  const [detailRetry, setDetailRetry] = useState(0);
  const [modal, setModal] = useState<'approve' | 'reject' | null>(null);

  const list: PagedSection<PermissionRequestRow> = tab === 'rejected' ? rejected : pending;
  const rows = list.paged?.content ?? [];

  // 선택은 목록을 따라간다 — 탭 전환·페이지 이동·처리 후 재조회가 전부 목록을 갈아치우고,
  // 그때 남아 있던 id 는 화면에 없는 요청을 가리킨다. "없으면 첫 줄"이 네 경우를 한 번에
  // 덮고, 목록이 비면 선택도 저절로 빈다.
  const current = rows.find((row) => row.requestId === selectedId) ?? rows[0] ?? null;
  const currentId = current?.requestId ?? null;

  useAbortableEffect(
    (signal) => {
      // 이전 요청의 내용을 먼저 지운다 — 안 지우면 새 요청의 머리 밑에 옛 사유가 남는다.
      setDetail(null);
      setDetailError(null);
      if (currentId == null) return;
      return getAccessRequest(currentId, { signal })
        .then((result) => {
          if (signal.aborted) return;
          setDetail(result);
        })
        .catch((err) => {
          if (signal.aborted) return;
          setDetailError(err);
        });
    },
    [currentId, detailRetry],
  );

  const { reload: reloadPending } = pending;
  const { reload: reloadRejected } = rejected;
  const { reload: reloadHistory } = history;

  const decide = useCallback(
    async (kind: 'approve' | 'reject', text: string): Promise<void> => {
      if (detail == null) return;
      const subject = `${detail.requester.knoxId}의 ${detail.serviceName} 접근 요청`;
      try {
        // 계약이 204 라 응답 본문이 없다 — 문구는 이미 화면이 들고 있는 요청으로 만든다.
        if (kind === 'approve') await approveAccessRequest(detail.requestId, text);
        else await rejectAccessRequest(detail.requestId, text);
        setModal(null);
        toast.show(
          kind === 'approve'
            ? `${subject}을 승인했어요 — 권한이 부여됐어요`
            : `${subject}을 반려했어요`,
        );
        // 처리한 건은 대기에서 빠져 반려·이력으로 옮겨간다. 셋 다 다시 읽고, 나브 배지도
        // 같이 내린다 — 이 화면은 이동을 안 하므로 배지가 스스로 갱신될 기회가 없다.
        setSelectedId(null);
        reloadPending();
        reloadRejected();
        reloadHistory();
        refreshNavCounts();
      } catch (err) {
        // 모달은 열어 둔다 — 실패한 쓰기는 사라지면 안 되고, 사유도 그대로 남아야 한다.
        toast.show(errorMessage(err));
      }
    },
    [detail, toast, reloadPending, reloadRejected, reloadHistory, refreshNavCounts],
  );

  const tabs: readonly { key: RequestTab; label: string; count: number | undefined }[] = [
    { key: 'pending', label: '승인 대기', count: pending.paged?.totalElements },
    { key: 'rejected', label: '반려', count: rejected.paged?.totalElements },
    { key: 'history', label: '전체 이력', count: history.paged?.totalElements },
  ];

  /** 기본 스켈레톤과 모양은 같고 줄 수만 다르다 — 기본은 `ACCESS_PAGE_SIZE`(5) 줄이라
   *  5줄을 그리고 8줄이 도착하면 목록이 튄다. */
  const historySkeleton: ReactNode = (
    <div role="rowgroup" aria-busy="true" aria-label="이력을 불러오는 중">
      {Array.from({ length: HISTORY_PAGE_SIZE }, (_, row) => (
        <div key={row} className={a.row} role="row" aria-hidden="true">
          {HISTORY_COLUMNS.map((col) => (
            <span key={col.label} role="cell" className={cn(col.className, a.skeletonBar)} />
          ))}
        </div>
      ))}
    </div>
  );

  const waiting = pending.paged?.totalElements;
  const subject = detail
    ? `${detail.requester.knoxId}의 ${detail.serviceName} 접근 요청`
    : '요청';

  return (
    <div>
      <h1 className={a.pageTitle}>권한 요청</h1>
      {/* 화면이 먼저 말하는 사실은 "지금 몇 건이 나를 기다리는가"다. 아직 모르는 수는
          쓰지 않는다 — 로딩 중 '0' 은 단언이다. */}
      <p className={a.pageDesc}>
        {waiting == null ? (
          '사용자가 보낸 서비스 접근 권한 요청을 검토하고 승인하거나 반려해요'
        ) : (
          <>
            사용자가 보낸 접근 권한 요청 중 승인을 기다리는 건이 총
            <span className={cn(a.pageTotal, a.pageTotalTone.PENDING)}>{waiting}</span>건 있어요
          </>
        )}
      </p>

      <div className={a.pageTabStrip} role="tablist" aria-label="권한 요청 탭">
        {tabs.map(({ key, label, count }) => {
          const on = key === tab;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setTab(key)}
              className={cn(a.tab, a.tabLg, on ? a.tabActive : a.tabIdle)}
            >
              {label}
              {/* 아직 모르는 수는 쓰지 않는다. */}
              {count != null && <span className={a.tabCount}>{count}</span>}
            </button>
          );
        })}
      </div>

      {tab === 'history' ? (
        <PagedCard
          className="mt-4"
          bare
          // 탭이 이미 "전체 이력 47"이라고 말했다. 머리 줄을 그리면 제목도 건수도 두 번이다.
          head={null}
          title="전체 이력"
          desc="승인·반려는 물론 직접 부여와 해제까지, 권한이 움직인 모든 기록이에요"
          icon="clock"
          tone="muted"
          state={history}
          columns={HISTORY_COLUMNS}
          skeleton={historySkeleton}
          empty={{
            title: '표시할 이력이 없어요',
            caption: '권한이 부여되거나 해제되면 여기에 쌓여요',
          }}
        >
          {(entries) =>
            entries.map((row) => (
              <div key={row.historyId} role="row" className={a.row}>
                <span role="cell" className={a.status}>
                  <HistoryTypePill type={row.type} />
                </span>
                <span role="cell" className={cn(a.code, a.mono)}>{row.serviceCode ?? '—'}</span>
                <span role="cell" className={cn(a.svcCol, a.nameStrong)}>
                  {row.serviceName ?? '—'}
                </span>
                <span role="cell" className={a.knox}>
                  {row.targetUser.knoxId}
                </span>
                <span role="cell" className={a.knox}>
                  {row.actorUser.knoxId}
                </span>
                {/* 잘린 문장은 title 로 전문을 준다 — 열 폭이 사유를 없애면 안 된다. */}
                <span role="cell" className={a.noteWide} title={row.note ?? undefined}>
                  {row.note ?? '—'}
                </span>
                <span role="cell" className={a.when}>
                  {fmtDateTime(row.createdAt)}
                </span>
              </div>
            ))
          }
        </PagedCard>
      ) : (
        <div className={a.bench}>
          {/* 선택 레일 — 카드가 아니라 목록이라 `PagedCard` 를 쓰지 않는다(그쪽은 제목·
              배지·`role=table` 을 함께 들고 온다). 상태 넷은 여기서 직접 그린다. */}
          <div className={a.benchList}>
            <div className={a.benchRows} aria-label={`${tab === 'pending' ? '승인 대기' : '반려'} 요청`}>
              {list.error != null ? (
                <div className={a.state}>
                  <span className="min-w-0 truncate">{errorMessage(list.error)}</span>
                  <PlButton variant="secondary" size="sm" onClick={list.reload}>
                    재시도
                  </PlButton>
                </div>
              ) : list.loading ? (
                Array.from({ length: ACCESS_PAGE_SIZE }, (_, row) => (
                  <div
                    key={row}
                    className={cn(a.benchItem, a.benchItemIdle)}
                    aria-hidden="true"
                    aria-busy="true"
                  >
                    <span className={a.benchSkelTile} />
                    <span className={cn(a.skeletonBar, 'flex-1')} />
                  </div>
                ))
              ) : rows.length === 0 ? (
                <div className={a.empty}>
                  <span className={a.emptyTitle}>
                    {tab === 'pending' ? '승인을 기다리는 요청이 없어요' : '반려한 요청이 없어요'}
                  </span>
                  <span className={a.emptyCaption}>
                    {tab === 'pending'
                      ? '새 접근 권한 요청이 들어오면 여기에 표시돼요'
                      : '반려 처리한 요청이 여기에 모여요'}
                  </span>
                </div>
              ) : (
                rows.map((row) => {
                  const on = row.requestId === currentId;
                  const days = waitedDays(row.requestedAt);
                  return (
                    <button
                      key={row.requestId}
                      type="button"
                      aria-current={on ? 'true' : undefined}
                      onClick={() => setSelectedId(row.requestId)}
                      title={`${row.serviceName} (${row.serviceCode})`}
                      className={cn(a.benchItem, on ? a.benchItemActive : a.benchItemIdle)}
                    >
                      <span
                        className={cn(
                          serviceSidebarStyles.tile,
                          serviceTileClass(row.serviceCode),
                        )}
                        aria-hidden="true"
                      >
                        {row.serviceName.charAt(0).toUpperCase()}
                      </span>
                      <span className={a.benchItemStack}>
                        <span className={on ? a.benchItemNameActive : a.benchItemName}>
                          {row.serviceName}
                        </span>
                        <span className={a.benchItemWho}>{row.requester.email}</span>
                      </span>
                      {/* 대기는 승인 대기 탭에서만 뜻이 있다 — 반려된 요청은 더 안 기다린다. */}
                      {tab === 'pending' && (
                        <span className={days >= WAIT_WARN_DAYS ? a.benchWaitHot : a.benchWait}>
                          {days}일
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
            <div className={a.benchFooter}>
              <OpsPagination
                page={list.page}
                totalPages={Math.max(1, list.paged?.totalPages ?? 1)}
                onChange={list.setPage}
                always
              />
            </div>
          </div>

          <div className={a.benchPane}>
            {detailError != null ? (
              <div className={a.state}>
                <span className="min-w-0 truncate">{errorMessage(detailError)}</span>
                <PlButton
                  variant="secondary"
                  size="sm"
                  onClick={() => setDetailRetry((n) => n + 1)}
                >
                  재시도
                </PlButton>
              </div>
            ) : current == null ? (
              <div className={a.empty}>
                <span className={a.emptyTitle}>고를 요청이 없어요</span>
                <span className={a.emptyCaption}>
                  왼쪽 목록에 요청이 들어오면 여기에서 처리해요
                </span>
              </div>
            ) : detail == null ? (
              <div aria-busy="true" aria-label="요청을 불러오는 중" className="flex flex-col gap-4">
                <span className={cn(a.skeletonBar, 'w-1/2')} />
                <span className={cn(a.skeletonBar, 'w-1/3')} />
                <span className={cn(a.skeletonBar, 'w-full')} />
              </div>
            ) : (
              <>
                {/* 타일은 없다 — 서비스가 제목에서 내려오면서 이 시트에서 서비스는
                    메타가 됐는데, 40px 색면은 제목보다 크고 진한 자리를 계속 차지했다.
                    고른 요청이 무엇인지는 왼쪽 레일의 타일이 이미 말한다. */}
                <div className={a.benchHead}>
                  <div className="min-w-0 flex-1">
                    <h2 className={a.benchTitle}>접근 권한 요청</h2>
                  </div>
                  {/* 대기 경과는 아직 기다리는 요청만의 사실이다. 처리가 끝난 요청은
                      경과가 아니라 판정을 말해야 한다. */}
                  {detail.status === 'PENDING' ? (
                    <span
                      className={
                        waitedDays(detail.requestedAt) >= WAIT_WARN_DAYS
                          ? a.benchWaitHot
                          : a.benchWait
                      }
                    >
                      {waitedDays(detail.requestedAt)}일 대기
                    </span>
                  ) : (
                    <RequestStatusPill status={detail.status} />
                  )}
                </div>

                {/* 사실 셋은 다 같은 급이다 — 제목이 "접근 권한 요청"이라 순서가 곧
                    누구·무엇·언제이고, 크기로 한 번 더 말할 필요가 없다. 서비스도 머리에
                    붙은 메타가 아니라 이 셋 중 하나다(오너 지시 2026-08-14). */}
                <div className={a.benchGrid}>
                  {/* 요청자는 이메일 하나로 쓴다 — Knox ID 는 이메일의 앞부분이라 둘을
                      같이 쓰면 같은 사람을 두 줄로 적는 셈이고, 연락은 이메일로 간다. */}
                  <div className="min-w-0">
                    <div className={a.benchKey}>요청자</div>
                    <div className={cn(a.benchVal, 'truncate')}>{detail.requester.email}</div>
                  </div>
                  <div className="min-w-0">
                    <div className={a.benchKey}>서비스</div>
                    <div className={cn(a.benchVal, 'flex min-w-0 items-center gap-1.5')}>
                      <span className="min-w-0 truncate">{detail.serviceName}</span>
                      <span className={a.codeTag}>{detail.serviceCode}</span>
                    </div>
                  </div>
                  <div className="min-w-0">
                    <div className={a.benchKey}>요청 일시</div>
                    <div className={cn(a.benchVal, 'tabular-nums')}>
                      {fmtDateTime(detail.requestedAt)}
                    </div>
                  </div>
                </div>

                <div className={a.benchSection}>
                  <div className={a.benchLabel}>요청 사유</div>
                  <p className={a.quoteAsk}>{detail.reason}</p>
                </div>

                {detail.status === 'PENDING' ? (
                  // 제목도 설명도 없다 — 버튼 둘이 곧 "승인 결정"이고, 즉시 부여된다는
                  // 것과 반려에 사유가 필요하다는 것은 각 모달이 누를 때 말한다(둘 다
                  // `sub`/`label` 에 있다). 누르기 전에 미리 읽힐 필요가 없는 경고다.
                  <div className={cn(a.benchSection, a.benchDecideActions)}>
                    <PlButton variant="primary" onClick={() => setModal('approve')}>
                      승인
                    </PlButton>
                    <PlButton variant="danger" onClick={() => setModal('reject')}>
                      반려
                    </PlButton>
                  </div>
                ) : (
                  <div className={a.benchSection}>
                    <div className={a.benchLabel}>
                      처리 결과
                      <span className={a.benchLabelMeta}>
                        {detail.processedBy?.knoxId ?? '—'} · {fmtDateTime(detail.processedAt)}
                      </span>
                    </div>
                    <p className={a.quote}>
                      {detail.processedNote ??
                        (detail.status === 'APPROVED' ? '메시지 없이 승인했어요' : '사유가 없어요')}
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <ApproveAccessModal
        open={modal === 'approve'}
        onClose={() => setModal(null)}
        subject={subject}
        onSubmit={(message) => decide('approve', message)}
      />
      <RejectAccessModal
        open={modal === 'reject'}
        onClose={() => setModal(null)}
        subject={subject}
        onSubmit={(reason) => decide('reject', reason)}
      />
    </div>
  );
}
