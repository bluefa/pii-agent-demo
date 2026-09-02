'use client';

/**
 * Database Credential 목록 modal — opened from the 연결 테스트 card's header link,
 * beside the table where credentials are assigned.
 *
 * A modal rather than a card: the list answers a lookup ("이 대상이 어떤 자격
 * 증명을 갖고 있나 / 안 쓰이는 건 뭔가") that the operator asks occasionally, not a
 * status they read every visit. As a card it took half the tab's top row to say
 * something that is usually "3개, 전부 배정됨".
 *
 * The list is `GET …/secrets`; 배정 건수 is joined from the confirmed snapshot by
 * `credential_id`. A credential assigned to a resource but absent from the list
 * is shown too, marked 목록에 없음 and sorted first — the assignment is real even
 * when the credential is not in the current list, and hiding it is what made
 * stale assignments look healthy.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import type { SecretKey } from '@/lib/types';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TC_TONE_FILL,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { credentialEntries } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

const TITLE_ID = 'ops-tc-credentials-title';

/** 대기 프레임의 행 자국 — 이름 폭만 다르다. 몇 개인지는 지금 오는 값이라, 이 모달이
 *  흔히 그리는 규모(6)로 세운다. */
const SKELETON_NAME_WIDTHS = [148, 196, 132, 172, 156, 120];
/**
 * 값 한 칸의 자국. 높이는 정착본이 그 자리에 그리는 줄 상자다 — 표의 칸은 14px
 * (줄 상자 19.59px, 브라우저 실측 → `h-5`, `ResourceSectionSkeleton` 과 같은 반올림),
 * 바닥 줄은 12px (16.8px → `h-[17px]`). 바닥 줄에 20px 을 두면 그 문단이 3.2px 높아져
 * 닫기 단추가 내려앉는다.
 */
const BAR = cn(opsStyles.skeletonBar, 'block h-5');
const FOOT_BAR = cn(opsStyles.skeletonBar, 'block h-[17px]');

export interface TcCredentialModalProps {
  secrets: readonly SecretKey[];
  rows: readonly ConfirmedIntegrationResourceItem[];
  /**
   * 목록 조회가 아직 정착하지 않았다. 이 모달을 여는 CTA 는 TC **상태** 조회에 걸려
   * 있어서, 상태가 먼저 도착하면 목록이 오기 전에 열린다 — 그 창에서 `secrets` 는
   * 빈 배열이고, 그것을 「등록된 Credential이 없습니다」로 그리면 화면이 없는 사실을
   * 단언한다.
   */
  loading: boolean;
  /** GET …/secrets 실패 (확정 정보 404 는 실패가 아니다). */
  failed: boolean;
  onClose: () => void;
}

export function TcCredentialModal({
  secrets,
  rows,
  loading,
  failed,
  onClose,
}: TcCredentialModalProps): ReactElement {
  const entries = credentialEntries(secrets, rows);
  const unusedCount = entries.filter((entry) => !entry.missing && entry.assignedCount === 0).length;
  const { table } = opsStyles;

  // 정착본과 대기 프레임이 머리를 **하나** 쓴다 — 두 벌로 적으면 열이 바뀔 때 한쪽만
  // 따라가고, 그 순간 자국은 이 표의 자국이 아니게 된다 (`ApprovalHistoryCard` 의 규칙).
  const HEAD = (
    <thead>
      <tr>
        <th className={table.headCell}>이름</th>
        <th className={cn(table.headCell, 'w-[150px]')}>최종 수정</th>
        <th className={cn(table.headCell, 'w-[90px] text-right')}>배정</th>
      </tr>
    </thead>
  );

  return (
    <ModalShell open onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        Database Credential
      </h3>
      <p className={pipelineStyles.modal.desc}>
        확정 리소스에 배정하는 DB 접속 자격 증명입니다. 배정은 연결 테스트 표에서 변경합니다.
      </p>

      {loading ? (
        /* 정착본의 그 자국 — 320px 스크롤 칸에 세 열이 실물 이름으로 서고 값만 막대다
           (`ApprovalHistoryCard` 의 로딩 갈래와 같은 규칙). 바닥 줄의 두 수도 막대다:
           0 으로 그리면 아직 세지 않은 것을 「0개」라고 말한다.
           높이는 정착본의 클래스에서 온다 — `table.cell` 의 py-3(24) + 14px 줄 상자,
           머리는 `table.headCell` 이 그대로 서므로 실측이 필요 없다. */
        <div aria-busy>
          <span className="sr-only">불러오는 중</span>
          <div className="h-[320px] overflow-hidden">
            <table className={table.base}>
              {HEAD}
              <tbody className="[&>tr:last-child>td]:border-b-0" aria-hidden>
                {SKELETON_NAME_WIDTHS.map((width, index) => (
                  <tr key={index}>
                    <td className={table.cell}>
                      <span className={cn(BAR, 'rounded')} style={{ width }} />
                    </td>
                    <td className={cn(table.cell, 'w-[150px]')}>
                      <span className={cn(BAR, 'w-[124px] rounded')} />
                    </td>
                    <td className={cn(table.cell, 'w-[90px]')}>
                      <span className={cn(BAR, 'ml-auto w-[36px] rounded')} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={cn(pipelineStyles.text.meta, 'mt-3 flex items-center gap-1.5')}>
            <span className={cn(FOOT_BAR, 'w-[52px] rounded')} aria-hidden />
            <span aria-hidden>·</span>
            <span className={cn(FOOT_BAR, 'w-[68px] rounded')} aria-hidden />
          </p>
        </div>
      ) : failed ? (
        <p className={cn(pipelineStyles.empty.base, 'mt-2')}>
          Credential 목록을 불러오지 못했습니다.
        </p>
      ) : entries.length === 0 ? (
        <PlEmptyState icon="shield" message="등록된 Credential이 없습니다." className="mt-2" />
      ) : (
        <>
          {/* The resource table's grammar — plain header, hairline rows, no box and
              no bold. A credential is a row of data here, not a card. Fixed height
              so 3 credentials occupy the same modal as 30. */}
          <div className="h-[320px] overflow-y-auto">
            <table className={table.base}>
              {HEAD}
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {entries.map((entry) => (
                  <tr key={entry.name} className={table.rowHover}>
                    <td className={table.cell}>
                      <span className="truncate">{entry.name}</span>
                      {entry.missing && (
                        <span className={cn(opsStyles.statusTag, TC_TONE_FILL.warn, 'ml-1.5')}>
                          목록에 없음
                        </span>
                      )}
                    </td>
                    <td className={cn(table.cell, 'whitespace-nowrap tabular-nums text-[14px]')}>
                      {entry.updatedAt ? fmtDateTime(entry.updatedAt) : <Dash />}
                    </td>
                    {/* 배정 0 은 "쓰이지 않는 자격 증명" — 지워지지 않게 faint 로 남긴다. */}
                    <td
                      className={cn(
                        table.cell,
                        'text-right tabular-nums',
                        entry.assignedCount === 0 && 'text-[var(--pl-text-faint)]',
                      )}
                    >
                      {entry.assignedCount}건
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={cn(pipelineStyles.text.meta, 'mt-3')}>
            총 {entries.length}개 · 미배정 {unusedCount}개
          </p>
        </>
      )}

      <div className={pipelineStyles.modal.foot}>
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
