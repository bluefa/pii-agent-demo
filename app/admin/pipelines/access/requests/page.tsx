'use client';

/**
 * 권한 요청 (/admin/pipelines/access/requests).
 *
 * 연동 요청 목록과 같은 배치: 손이 가야 하는 두 카드(승인 대기 · 반려)가 위에 나란히,
 * 읽기 전용 이력이 그 아래 전체 폭 한 장. 두 카드의 행은 같은 상세로 가고, 사유 전문은
 * 거기서 읽는다 — 목록은 한 줄 미리보기만 한다.
 *
 * 서비스 코드 단위 이력은 여기가 아니라 서비스별 권한 화면이 담당한다(같은 이력을
 * service_code 로 필터해 그 서비스 시트 안에 둔다). 여기 이력은 전역 감사 로그다.
 */
import type { ReactElement } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import { fmtDateTime } from '@/lib/pipeline/format';

import { Icon } from '@/app/admin/pipelines/_components/icons';
import {
  PagedCard,
  ROWS_PER_PAGE,
  usePagedSection,
  type Column,
} from '@/app/admin/pipelines/access/_components/PagedCard';
import { HistoryTypePill } from '@/app/admin/pipelines/access/_components/AccessPills';
import { accessStyles as a } from '@/app/admin/pipelines/access/_components/accessStyles';
import {
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
): Promise<AccessPage<PermissionRequestRow>> =>
  getAccessRequests('PENDING', page, { ...opts, size: ROWS_PER_PAGE });
const fetchRejected = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<PermissionRequestRow>> =>
  getAccessRequests('REJECTED', page, { ...opts, size: ROWS_PER_PAGE });
const fetchHistory = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<AccessHistoryEntry>> =>
  getAccessHistory({}, page, { ...opts, size: ROWS_PER_PAGE });

/**
 * 두 액션 카드는 같은 골격을 쓴다 — flex-1 컬럼 수까지 같아야 격자 너머로 열이 맞는다.
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

const HISTORY_COLUMNS: readonly Column[] = [
  { label: '구분', className: a.status },
  { label: '서비스', className: a.name },
  { label: '코드', className: a.code },
  { label: '대상', className: a.knox },
  { label: '수행자', className: a.knox },
  // 반려 사유·승인 메시지 — 감사 로그가 "무엇이" 뿐 아니라 "왜"까지 말하게 한다.
  // 늘어나는 두 번째 열이기도 해서 서비스 이름이 남는 폭을 혼자 먹지 않는다.
  { label: '사유', className: a.note },
  { label: '일시', className: a.when },
];

export default function AccessRequestsPage(): ReactElement {
  const pending = usePagedSection(fetchPending);
  const rejected = usePagedSection(fetchRejected);
  const history = usePagedSection(fetchHistory);

  return (
    <div>
      <h1 className={a.pageTitle}>권한 요청</h1>
      <p className={a.pageDesc}>
        사용자가 보낸 서비스 접근 권한 요청을 검토하고 승인하거나 반려해요
      </p>

      <div className={a.grid}>
        <PagedCard
          title="승인 대기"
          desc="행을 눌러 요청 사유를 확인한 뒤 승인하거나 반려해 주세요 — 승인하면 즉시 권한이 부여돼요"
          icon="inbox"
          tone="primary"
          state={pending}
          columns={REQUEST_COLUMNS}
          empty={{
            title: '승인을 기다리는 요청이 없어요',
            caption: '새 접근 권한 요청이 들어오면 여기에 표시돼요',
          }}
        >
          {(rows) =>
            rows.map((row) => (
              <div key={row.requestId} role="row" className={cn(a.row, a.rowLink)}>
                {/* 링크는 첫 셀 안에 둔다 — role=row 는 셀만 자식으로 가져야 한다.
                    absolute inset-0 이라 클릭 면적은 행 전체 그대로다. */}
                <span role="cell" className={a.knox}>
                  <Link
                    href={passRoutes.pipelines.access.request(row.requestId)}
                    aria-label={`${row.requester.knoxId}의 ${row.serviceName} 접근 요청 상세 보기`}
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
          title="반려"
          desc="반려한 요청이에요 — 사유는 계약상 상세에만 있어서, 행을 눌러 확인해요"
          icon="warn-tri"
          tone="danger"
          state={rejected}
          columns={REQUEST_COLUMNS}
          empty={{
            title: '반려한 요청이 없어요',
            caption: '반려 처리한 요청이 여기에 모여요',
          }}
        >
          {(rows) =>
            rows.map((row) => (
              <div key={row.requestId} role="row" className={cn(a.row, a.rowLink)}>
                <span role="cell" className={a.knox}>
                  <Link
                    href={passRoutes.pipelines.access.request(row.requestId)}
                    aria-label={`${row.requester.knoxId}의 ${row.serviceName} 반려 내역 상세 보기`}
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
      </div>

      <PagedCard
        className="mt-6"
        title="전체 이력"
        desc="승인·반려는 물론 직접 부여와 해제까지, 권한이 움직인 모든 기록이에요"
        icon="clock"
        tone="muted"
        state={history}
        columns={HISTORY_COLUMNS}
        empty={{ title: '표시할 이력이 없어요', caption: '권한이 부여되거나 해제되면 여기에 쌓여요' }}
      >
        {(rows) =>
          rows.map((row) => (
            <div key={row.historyId} role="row" className={a.row}>
              <span role="cell" className={a.status}>
                <HistoryTypePill type={row.type} />
              </span>
              <span role="cell" className={a.name}>
                {row.serviceName ?? '—'}
              </span>
              <span role="cell" className={cn(a.code, a.mono)}>
                {row.serviceCode ?? '—'}
              </span>
              <span role="cell" className={a.knox}>
                {row.targetUser.knoxId}
              </span>
              <span role="cell" className={a.knox}>
                {row.actorUser.knoxId}
              </span>
              <span role="cell" className={a.note} title={row.note ?? undefined}>
                {row.note ?? '—'}
              </span>
              <span role="cell" className={a.when}>
                {fmtDateTime(row.createdAt)}
              </span>
            </div>
          ))
        }
      </PagedCard>
    </div>
  );
}
