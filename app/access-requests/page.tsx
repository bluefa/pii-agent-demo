'use client';

/**
 * 내 권한 요청 (/access-requests) — 권한이 없는 서비스를 보고, 사유를 적어 요청하고,
 * 승인·반려 결과를 확인하는 화면.
 *
 * `/admin/**` 밖에 있다. 그 아래였다면 admin 게이트(ADMIN 허용 목록)가 이 화면을 정확히
 * 필요로 하는 사람만 골라 막았을 것이다. 진입점은 계정 카드(UserChip)이고, 화면 자체는
 * 접근 권한 관리자 화면들과 같은 부품·같은 계약을 쓴다.
 *
 * 왼쪽 카드는 "내가 아직 못 가진 서비스"다 — `/user/services/page` 는 그 반대(이미
 * 가진 것)만 돌려주므로 요청 화면의 목록이 될 수 없다. 오른쪽 카드는 결과까지 담은 내
 * 요청 내역이고, 반려 사유는 그 자리에서 읽힌다(요청 화면과 결과 화면이 한 모델을 쓴다).
 */
import { useState, type ReactElement } from 'react';
import { cn } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';

import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
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
  getRequestableServices,
  type AccessPage,
  type AccessRequest,
  type RequestableService,
} from '@/app/lib/api/access';

const fetchRequestable = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<RequestableService>> =>
  getRequestableServices(undefined, page, { ...opts, size: ROWS_PER_PAGE });

const fetchMine = (
  page: number,
  opts: { signal: AbortSignal },
): Promise<AccessPage<AccessRequest>> =>
  getMyAccessRequests(page, { ...opts, size: ROWS_PER_PAGE });

const REQUESTABLE_COLUMNS: readonly Column[] = [
  { label: '서비스', className: a.name },
  { label: '코드', className: a.code },
  { className: a.tail },
];

const MINE_COLUMNS: readonly Column[] = [
  { label: '서비스', className: a.name },
  { label: '코드', className: a.code },
  { label: '상태', className: a.status },
  { label: '결과 · 사유', className: a.note },
  { label: '요청 일자', className: a.when },
];

export default function MyAccessRequestsPage(): ReactElement {
  const requestable = usePagedSection(fetchRequestable);
  const mine = usePagedSection(fetchMine);
  const toast = usePlToast();
  /** 요청 모달을 연 서비스 — null 이면 닫혀 있다. */
  const [target, setTarget] = useState<RequestableService | null>(null);

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
          columns={REQUESTABLE_COLUMNS}
          empty={{
            title: '요청할 서비스가 없어요',
            caption: '모든 서비스에 권한이 있거나, 이미 요청해 두었어요',
          }}
        >
          {(rows) =>
            rows.map((row) => (
              <div key={row.serviceCode} role="row" className={a.row}>
                <span role="cell" className={cn(a.name, a.nameStrong)}>
                  {row.serviceName}
                </span>
                <span role="cell" className={cn(a.code, a.mono)}>
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
                <span role="cell" className={a.note} title={row.verdictMessage ?? undefined}>
                  {row.verdictMessage ?? '—'}
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
