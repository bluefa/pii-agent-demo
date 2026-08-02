'use client';

/**
 * Database Credential card — the credential list as a first-class object,
 * mirroring the scan tab's 스캔 권한 card (verdict beside the title, the payload
 * in a bordered box that absorbs the row's slack, metadata on the floor).
 *
 * Until now a credential only existed inside the 확정 정보 배정 dropdown, so
 * "which credentials does this target have, and is any of them unused" could not
 * be answered without opening every row's picker.
 *
 * The list is `GET …/secrets`; 배정 건수 is joined from the confirmed snapshot by
 * `credential_id`. A credential assigned to a resource but absent from the list
 * is listed too, marked 목록에 없음 — the assignment is real even when the
 * credential is not in the current list, and hiding it is what made stale
 * assignments look healthy.
 */
import type { ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import type { SecretKey } from '@/lib/types';
import type { ConfirmedIntegrationResourceItem } from '@/app/lib/api';
import { PlEmptyState } from '@/app/admin/pipelines/_components/PlEmptyState';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { TimeField } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/scanShared';
import { TC_TONE_FILL } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';

/** One list row: a contract credential, or an assignment the list no longer carries. */
export interface CredentialEntry {
  name: string;
  /** create_time_str — absent for an entry reconstructed from an assignment. */
  createdAt: string | null;
  /** 확정 리소스 중 이 credential 을 쓰는 건수. */
  assignedCount: number;
  /** GET …/secrets 응답에 없는 이름 (배정에서만 발견). */
  missing: boolean;
}

/**
 * secrets ∪ (배정에만 존재하는 이름). Sorted: 목록에 없는 것 먼저 (조치가 필요한 쪽),
 * 그다음 배정 많은 순, 마지막으로 이름순.
 */
export function credentialEntries(
  secrets: readonly SecretKey[],
  rows: readonly ConfirmedIntegrationResourceItem[],
): CredentialEntry[] {
  const assigned = new Map<string, number>();
  for (const row of rows) {
    if (row.credential_id) assigned.set(row.credential_id, (assigned.get(row.credential_id) ?? 0) + 1);
  }
  const known = new Set(secrets.map((secret) => secret.name));
  const entries: CredentialEntry[] = secrets.map((secret) => ({
    name: secret.name,
    createdAt: secret.createTimeStr || null,
    assignedCount: assigned.get(secret.name) ?? 0,
    missing: false,
  }));
  for (const [name, count] of assigned) {
    if (!known.has(name)) entries.push({ name, createdAt: null, assignedCount: count, missing: true });
  }
  return entries.sort(
    (a, b) =>
      Number(b.missing) - Number(a.missing)
      || b.assignedCount - a.assignedCount
      || a.name.localeCompare(b.name),
  );
}

export interface TcCredentialCardProps {
  secrets: readonly SecretKey[];
  rows: readonly ConfirmedIntegrationResourceItem[];
  loading: boolean;
  /** GET …/secrets 실패 (확정 정보 404 는 실패가 아니다). */
  failed: boolean;
}

export function TcCredentialCard({
  secrets,
  rows,
  loading,
  failed,
}: TcCredentialCardProps): ReactElement {
  const entries = credentialEntries(secrets, rows);
  const unusedCount = entries.filter((entry) => !entry.missing && entry.assignedCount === 0).length;
  // create_time_str 이 있는 것 중 가장 최근 — 목록의 신선도를 바닥 줄에서 답한다.
  const latestCreatedAt = entries
    .map((entry) => entry.createdAt)
    .filter((value): value is string => value != null)
    .sort()
    .at(-1);

  return (
    // flex-col — mt-auto pins the bottom row so the floor lines up with the sibling card.
    <section
      className={cn(pipelineStyles.card.base, 'flex flex-col')}
      aria-label="Database Credential"
    >
      <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
        <Icon name="shield" size={18} className="text-[var(--pl-primary)]" />
        Database Credential
        {!loading && (
          <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, TC_TONE_FILL.off)}>
            {entries.length}개
          </span>
        )}
      </h2>
      <p className={opsStyles.cardDesc}>확정 리소스에 배정하는 DB 접속 자격 증명입니다.</p>

      {loading ? (
        <div className="mt-4 flex min-h-0 flex-1 flex-col" aria-busy>
          <div className={cn(opsStyles.skeleton, 'min-h-[176px] flex-1')} aria-hidden="true" />
          <div className={cn(opsStyles.skeleton, 'mt-4 h-4 w-44 flex-none')} aria-hidden="true" />
        </div>
      ) : failed ? (
        <p className={cn(pipelineStyles.text.meta, 'mt-4')}>
          Credential 목록을 불러오지 못했습니다.
        </p>
      ) : entries.length === 0 ? (
        <PlEmptyState icon="shield" message="등록된 Credential이 없습니다." className="mt-2" />
      ) : (
        <>
          {/* flex-1 — when the sibling card is taller, the list box absorbs the slack
              instead of leaving a bare white gap under it (scan tab precedent). */}
          <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--pl-gray-100)] bg-[var(--pl-bg-inner)]">
            <ul className="min-h-0 flex-1 overflow-y-auto">
              {entries.map((entry) => (
                <li
                  key={entry.name}
                  className="flex items-center justify-between gap-3 border-b border-[var(--pl-gray-100)] px-3.5 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-medium text-[var(--pl-text-strong)]">
                        {entry.name}
                      </span>
                      {entry.missing && (
                        <span className={cn(opsStyles.statusTag, TC_TONE_FILL.warn, 'flex-none')}>
                          목록에 없음
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[12px] tabular-nums text-[var(--pl-text-faint)]">
                      {entry.createdAt ? `생성 ${fmtDateTime(entry.createdAt)}` : '생성 정보 없음'}
                    </p>
                  </div>
                  {/* 배정 0 은 "쓰이지 않는 자격 증명" — 지워지지 않게 faint 로 남긴다. */}
                  <span
                    className={cn(
                      'flex-none whitespace-nowrap text-[13px] font-medium tabular-nums',
                      entry.assignedCount === 0
                        ? 'text-[var(--pl-text-faint)]'
                        : 'text-[var(--pl-text-medium)]',
                    )}
                  >
                    배정 {entry.assignedCount}건
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="mt-auto">
            <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
              <TimeField label="미배정">{`${unusedCount}개`}</TimeField>
              {latestCreatedAt && (
                <TimeField label="최근 등록">{fmtDateTime(latestCreatedAt)}</TimeField>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
