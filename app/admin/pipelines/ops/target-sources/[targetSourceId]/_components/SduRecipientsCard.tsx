'use client';

/**
 * S3 Access Key 수신자 card — 두 탭이 같은 카드를 쓴다.
 *
 * 스캔 탭에서는 「스캔 권한」 자리다. 그 자리가 묻는 것은 원래 "이 계정을 훑을 자격이
 * 유효한가"인데, SDU 에는 우리가 훑는 계정도 검증할 role 도 없다. 담당자가 제 손으로 S3 에
 * 올린 데이터를 훑을 뿐이라, 같은 자리에 남는 질문은 하나다: **그 버킷의 키를 누가 들고
 * 있는가**(계약 §9). 진행 상태 탭에서는 담당자가 입력한 것 셋 중 한 카드로 선다.
 *
 * 두 자리가 **한 컴포넌트**인 것이 요점이다 — 같은 명부를 두 벌 적으면 두 화면이 언젠가
 * 서로 다른 모양으로 갈라진다.
 *
 * 키를 보내는 화면이 아니다 — 등록된 **명부**다(§6). 발송은 관리자가 메일로 하고, 담당자
 * 화면은 누구 앞으로 갈지만 정한다. 그래서 한 행이 드는 것은 이름과 **주소**다: 보낼 곳은
 * 주소이고, 이름만 적힌 목록으로는 세어 볼 수는 있어도 보낼 수 없다.
 *
 * 담당자가 여럿일 수 있어 **표 + 페이저**다(오너 지시). 스크롤 상자로 가두던 앞 판과 달리
 * 카드 높이가 명부 길이에 아예 흔들리지 않고, 옆 형제(승인 요청 내역 · 연동 현황)와 같은
 * 문법이 된다 — 이 화면에서 목록을 든 카드는 전부 이 모양이다.
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getSduUpload } from '@/app/lib/api/sdu';
import type { SduAccessKeyRecipients } from '@/lib/types/sdu';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { OpsPagination } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/OpsPagination';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/**
 * 형제 두 카드(승인 요청 내역 · 상태 변경 이력)와 같은 수. 한 페이지가 고정이면 카드 높이가
 * 명부 길이와 무관해지고, 그것이 페이저가 사 오는 성질 자체다.
 *
 * 페이징은 **화면 안에서** 한다 — 계약 §5 는 `access_key_recipients.users` 를 한 응답에
 * 통째로 준다. 페이지 파라미터를 지어내면 있지도 않은 엔드포인트를 부르게 된다.
 */
const PAGE_SIZE = 5;

export interface SduRecipientsCardProps {
  targetSourceId: number;
}

export function SduRecipientsCard({ targetSourceId }: SduRecipientsCardProps): ReactElement {
  const [recipients, setRecipients] = useState<SduAccessKeyRecipients | null>(null);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [page, setPage] = useState(0);

  useAbortableEffect(
    (signal) => {
      setLoaded(false);
      setFailed(false);
      // 대상이 바뀌면 페이지도 처음으로 — 페이지 번호는 목록보다 오래 산다.
      setPage(0);
      return getSduUpload(targetSourceId, { signal })
        .then((upload) => {
          if (signal.aborted) return;
          setRecipients(upload.accessKeyRecipients);
          setLoaded(true);
        })
        .catch(() => {
          // 취소는 실패가 아니다 — 대상이 바뀔 때마다 오류 문구가 스쳐 간다.
          if (signal.aborted) return;
          setFailed(true);
          setLoaded(true);
        });
    },
    [targetSourceId],
  );

  const { table } = opsStyles;
  const users = recipients?.users ?? [];
  // 빈 명부에서도 페이저는 한 페이지를 말한다(형제 카드와 같은 `always`) — 사라지는 바닥은
  // 두 카드의 높이를 데이터에 따라 다르게 만든다.
  const totalPages = Math.max(1, Math.ceil(users.length / PAGE_SIZE));
  const rows = users.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  // 정착본과 스켈레톤이 **한 머리**를 쓴다 — 두 벌로 적으면 열이 바뀌는 날 한쪽만 따라가고,
  // 스켈레톤은 조용히 이 표의 자국이 아니게 된다.
  const head = (
    <thead>
      <tr>
        <th className={cn(table.headCell, 'w-[132px]')}>이름</th>
        <th className={table.headCell}>이메일</th>
      </tr>
    </thead>
  );

  return (
    <section className={cn(pipelineStyles.card.base, opsStyles.pagedCard)} aria-label="S3 Access Key 수신자">
      {/* 수는 제목이 진다 — 페이지에 다섯 명이 보인다고 다섯 명인 것이 아니다. 접근명
          (`aria-label`)은 수 없이 고정이다: 카드의 이름이 데이터를 따라 흔들리면 이 카드를
          부르는 쪽이 매번 다른 이름을 찾아야 한다. */}
      <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
        S3 Access Key 수신자
        {users.length > 0 && (
          <span className="text-[14px] font-medium text-[var(--pl-text-weak)]">{users.length}명</span>
        )}
      </h2>
      <p className={opsStyles.cardDesc}>담당자가 등록한 키 수신자 명부입니다.</p>

      {/* Fixed body slot — see opsStyles.pagedCardBody. */}
      <div className={opsStyles.pagedCardBody}>
        {!loaded ? (
          /* 정착본 표의 자국. 머리글 둘은 고정 문자열이라 실물로 그리고(`StatusCardSkeleton`
             과 같은 규칙) 값 자리만 바가 대신한다.
             높이는 **실측**이다 — 형제 「승인 요청 내역」이 같은 `opsStyles.table` 을 쓰고,
             브라우저가 그 표의 머리를 37.3px, 본문 행을 46.0px 로 보고한다. 머리는 같은
             클래스가 그대로 내고, 본문 행에서 py-3(24)과 헤어라인(1)을 빼면 남는 21px 가
             14px 글줄이다. 그래서 바가 h-[21px] 다 — h-5 로 두면 행이 45.1px 로 선다.
             ⛔ 「마지막 등록」 줄은 그리지 않는다 — 그 줄이 서는지 자체가 지금 오는 값이다
             (`recipients.updatedAt` 이 없으면 정착본에도 없다). */
          <div className={pipelineStyles.card.tableWrap} aria-busy>
            <span className="sr-only">불러오는 중</span>
            <table className={table.base}>
              {head}
              <tbody className="[&>tr:last-child>td]:border-b-0" aria-hidden>
                {Array.from({ length: 3 }, (_, index) => (
                  <tr key={index}>
                    <td className={cn(table.cell, 'w-[132px]')}>
                      <span className={cn(opsStyles.skeletonBar, 'block h-[21px] w-[72px]')} />
                    </td>
                    <td className={table.cell}>
                      <span className={cn(opsStyles.skeletonBar, 'block h-[21px] w-[196px]')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : failed ? (
          <p className={pipelineStyles.empty.base}>수신자 정보를 불러오지 못했습니다.</p>
        ) : users.length === 0 ? (
          <PlEmptyState icon="inbox" message="등록된 수신자가 없습니다." />
        ) : (
          <>
            <div className={pipelineStyles.card.tableWrap}>
              <table className={table.base}>
                {head}
                <tbody className="[&>tr:last-child>td]:border-b-0">
                  {rows.map((user) => (
                    <tr key={user.id}>
                      <td className={cn(table.cell, 'whitespace-nowrap font-medium')}>{user.name}</td>
                      {/* 주소는 이 표의 신원이라 잘리지 않는다 — 긴 주소는 셀 안에서 접힌다. */}
                      <td className={cn(table.cell, 'break-all')}>{user.email}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {/* 시각이 없으면 줄을 그리지 않는다 — 한 번도 등록된 적 없는 명부에 '-' 를 붙이면
                날짜를 잃어버린 명부처럼 읽힌다 (형제 절의 「마지막 저장」과 같은 규칙). */}
            {recipients?.updatedAt && (
              <p className={cn(pipelineStyles.text.meta, 'mt-2')}>
                마지막 등록 {fmtDateTime(recipients.updatedAt)}
              </p>
            )}
          </>
        )}
      </div>

      <OpsPagination page={page} totalPages={totalPages} onChange={setPage} always />
    </section>
  );
}
