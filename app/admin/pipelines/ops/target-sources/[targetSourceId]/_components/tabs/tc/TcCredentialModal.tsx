'use client';

/**
 * Database Credential 목록 modal — opened from 확정 정보, where credentials are
 * assigned.
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

export interface TcCredentialModalProps {
  secrets: readonly SecretKey[];
  rows: readonly ConfirmedIntegrationResourceItem[];
  /** GET …/secrets 실패 (확정 정보 404 는 실패가 아니다). */
  failed: boolean;
  onClose: () => void;
}

export function TcCredentialModal({
  secrets,
  rows,
  failed,
  onClose,
}: TcCredentialModalProps): ReactElement {
  const entries = credentialEntries(secrets, rows);
  const unusedCount = entries.filter((entry) => !entry.missing && entry.assignedCount === 0).length;
  const { table } = opsStyles;

  return (
    <ModalShell open onClose={onClose} variant="task" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        Database Credential
      </h3>
      <p className={pipelineStyles.modal.desc}>
        확정 리소스에 배정하는 DB 접속 자격 증명입니다. 배정은 확정 정보 표에서 변경합니다.
      </p>

      {failed ? (
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
              <thead>
                <tr>
                  <th className={table.headCell}>이름</th>
                  <th className={cn(table.headCell, 'w-[150px]')}>생성</th>
                  <th className={cn(table.headCell, 'w-[90px] text-right')}>배정</th>
                </tr>
              </thead>
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
                    <td className={cn(table.cell, 'whitespace-nowrap tabular-nums text-[13px]')}>
                      {entry.createdAt ? fmtDateTime(entry.createdAt) : <Dash />}
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
