'use client';

/**
 * 확정 정보 card — the single per-resource table of this tab.
 *
 * Rows come from the confirmed snapshot (GET …/confirmed-integration, snake
 * passthrough per ADR-019). Two joins by `resource_id` fill the trailing columns,
 * each from the endpoint whose contract actually declares it —
 *   Connection Status  latest_version.test_connection_agent_results[] (verdicts)
 *   논리 DB 건수        latest-results (logical_database_count / excluded_…)
 * A resource neither reports on renders — for those columns; nothing is inferred
 * from the snapshot alone (an installed resource is not a tested one).
 *
 * Per-row controls: Credential 배정 (searchable combobox over GET …/secrets — the
 * contract's credential list, whose card sits at the top of the tab) and
 * 논리 DB 관리 (skip policy).
 *
 * Rows/secrets are fetched by TcTab and passed in, because the credential card
 * needs the same two datasets to answer "이 자격 증명이 몇 건에 배정됐나".
 *
 * An absent snapshot (404 before 연동 확정) is an empty state, not an error; a real
 * fetch failure adds a 다시 시도 affordance to that same empty state so the two are
 * never confused with "확정된 리소스가 0건".
 */
import { useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import {
  updateResourceCredential,
  type ConfirmedIntegrationResourceItem,
} from '@/app/lib/api';
import type { SecretKey } from '@/lib/types';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { IdentifierTip, Tooltip } from '@/app/components/ui/Tooltip';
import { ResourceIdCell } from '@/app/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  TcPill,
  TC_TONE_FILL,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { LdbManageModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/LdbManageModal';
import { TcCredentialModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/TcCredentialModal';
import { CredentialAssignModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/CredentialAssignModal';
import {
  credentialEntries,
  ldbCount,
  type TcVerdict,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/**
 * 연결 상태 cell — the run's own verdict for this resource, or — if it had none.
 * 네 값 중 하나만 한국어였다(Success / Failed / 진행 중 / Unknown): 같은 열이 같은 질문에
 * 두 언어로 답하고 있었으므로, 사용자 화면 Step 5 가 쓰는 말로 맞춘다.
 */
function ConnCell({ verdict }: { verdict: TcVerdict | undefined }): ReactElement {
  if (!verdict) return <Dash />;
  if (verdict === 'SUCCESS') return <TcPill tone="ok" label="성공" />;
  if (verdict === 'FAIL') return <TcPill tone="err" label="실패" />;
  if (verdict === 'RUNNING') return <TcPill tone="warn" label="진행 중" />;
  return <TcPill tone="off" label="알 수 없음" />;
}

/**
 * Contract-declared count — absent (no TC row / not a success) renders —, never 0.
 * A non-zero count opens the 논리 DB 관리 modal, so it renders as the underlined
 * in-cell link the app uses at Step 6/7 (LogicalDbCountCell): the underline
 * carries the affordance, which lets the row drop its trailing 관리 link entirely.
 * A reported 0 has nothing to open and stays plain text.
 */
function CountCell({
  row,
  tab,
  verdict,
  onOpen,
}: {
  row: TcResultRow | undefined;
  tab: 'inc' | 'exc';
  verdict: TcVerdict | undefined;
  onOpen: () => void;
}): ReactElement {
  const count = ldbCount(row, tab, verdict);
  if (count == null) return <Dash />;
  if (count === 0) return <span className={opsStyles.countZero}>0개</span>;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${tab === 'inc' ? '연동 대상' : '연동 제외'} 논리 DB ${count}개 보기`}
      className={opsStyles.countLink}
    >
      {count}
      <span className="text-[12px] font-medium">개</span>
    </button>
  );
}

/**
 * Resource Name — the Step 1·2·3 resource-table grammar (CandidateResourceRow):
 * one line always, mono, and the full value in the tip, which only appears when
 * the text is actually cut. A native `title` was not it — no delay control, no
 * styling, and it fires on values that already fit.
 */
function ResourceNameCell({ value }: { value: string | null }): ReactElement {
  if (!value) return <Dash />;
  return (
    <Tooltip
      content={<IdentifierTip label="Resource Name" value={value} />}
      variant="value"
      size="md"
      triggerClassName="min-w-0 max-w-[200px] block"
      truncatedOnly
    >
      <span className="block truncate font-mono text-[13px]">{value}</span>
    </Tooltip>
  );
}

export interface ConfirmedInfoCardProps {
  targetSourceId: number;
  /** Confirmed snapshot resources (fetched by TcTab). */
  rows: readonly ConfirmedIntegrationResourceItem[];
  /** Contract credential list (fetched by TcTab). */
  secrets: readonly SecretKey[];
  /** 논리 DB 건수 rows (latest-results), joined by resource_id. */
  tcResults: readonly TcResultRow[];
  /** 리소스별 연결 판정 (latest_version), joined by resource_id. */
  verdicts: ReadonlyMap<string, TcVerdict>;
  /** First tab load still in flight. */
  loading: boolean;
  /** Real snapshot fetch failure — a 404 "not confirmed yet" is not one. */
  failed: boolean;
  /** GET …/secrets failed — the credential modal says so instead of showing "0개". */
  secretsFailed: boolean;
  onReload: () => void;
}

export function ConfirmedInfoCard({
  targetSourceId,
  rows,
  secrets,
  tcResults,
  verdicts,
  loading,
  failed,
  secretsFailed,
  onReload,
}: ConfirmedInfoCardProps): ReactElement {
  const toast = usePlToast();
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ldbRow, setLdbRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  const [credRow, setCredRow] = useState<ConfirmedIntegrationResourceItem | null>(null);
  const [credentialsOpen, setCredentialsOpen] = useState(false);

  const tcByResourceId = new Map(tcResults.map((row) => [row.resourceId, row]));

  // 생성 시각 + 배정 건수 ride along in the assign modal: with 20+ credentials the
  // name alone rarely settles "which one is this", and those are the only other
  // facts available (SecretResponse + the confirmed snapshot join).
  const entries = credentialEntries(secrets, rows);
  const knownCredential = new Set(secrets.map((secret) => secret.name));

  const assignCredential = async (
    row: ConfirmedIntegrationResourceItem,
    credentialId: string,
  ): Promise<void> => {
    setSavingId(row.resource_id);
    try {
      await updateResourceCredential(targetSourceId, row.resource_id, credentialId || null);
      toast.show(credentialId ? 'Credential을 변경했습니다.' : 'Credential 연결을 해제했습니다.');
      setCredRow(null);
      onReload();
    } catch {
      // The modal stays open on failure so the choice is not lost.
      toast.show('Credential 변경에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const { table } = opsStyles;

  return (
    <section className={pipelineStyles.card.base} aria-label="확정 정보">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="install" size={18} className="text-[var(--pl-primary)]" />
            확정 정보
          </h2>
          {/* The cell affordance only appears on hover/focus, so the card says up
              front that the column is editable — otherwise the table reads as a
              read-only report and nobody hovers it. Primary color marks the one
              action in this sentence, not the whole sentence. */}
          <p className={opsStyles.cardDesc}>
            연동이 확정된 리소스별 연결 결과입니다. 순서는 연동 요청(Step 2) 표와 같으며,{' '}
            <b className="font-semibold text-[var(--pl-primary)]">
              Credential 값을 클릭하면 배정을 수정
            </b>
            할 수 있습니다.
          </p>
        </div>
        {/* The credential list is a lookup, not a status — it opens from here,
            where credentials are actually assigned. */}
        <PlButton variant="secondary" className="flex-none" onClick={() => setCredentialsOpen(true)}>
          Credential 목록
        </PlButton>
      </div>

      {loading ? (
        <div className="mt-3" aria-busy>
          {Array.from({ length: 4 }, (_, index) => (
            <div
              key={index}
              className={cn(opsStyles.skeleton, 'mt-2 h-10 first:mt-0')}
              aria-hidden="true"
            />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <span className={pipelineStyles.empty.icon}>
            <Icon name="install" size="xl" />
          </span>
          <p>확정된 연동 정보가 없습니다.</p>
          {failed && (
            <PlButton variant="secondary" size="sm" className="mt-3" onClick={onReload}>
              다시 시도
            </PlButton>
          )}
        </div>
      ) : (
        <>
          <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
            <table className={table.base}>
              <thead>
                <tr>
                  <th className={table.headCell}>Database Type</th>
                  <th className={table.headCell}>Resource ID</th>
                  <th className={table.headCell}>Resource Name</th>
                  <th className={table.headCell}>연동 대상 논리 DB</th>
                  <th className={table.headCell}>연동 제외 논리 DB</th>
                  <th className={table.headCell}>연결 상태</th>
                  <th className={table.headCell}>Credential</th>
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {rows.map((row, index) => {
                  const tc = tcByResourceId.get(row.resource_id);
                  const verdict = verdicts.get(row.resource_id);
                  return (
                    <tr key={`${row.resource_id}-${index}`} className={table.rowHover}>
                      <td className={cn(table.cell, 'whitespace-nowrap')}>
                        {/* wire 는 소문자 원문(mysql·athena) — 사용자 화면과 같은 표기.
                            타입은 상태가 아니라 분류라 칩(색면)을 쓰지 않는다. */}
                        {row.database_type ? getDatabaseShortLabel(row.database_type) : <Dash />}
                      </td>
                      <td className={table.cell}>
                        {/* Step 1·2·3 grammar: truncated to `Prefix…` like the name
                            column, tip on hover, copy button on row hover. */}
                        {row.resource_id ? (
                          <ResourceIdCell
                            value={row.resource_id}
                            label="Resource ID"
                            maxWidthClass="max-w-[200px]"
                          />
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className={table.cell}>
                        <ResourceNameCell value={row.resource_name || null} />
                      </td>
                      <td className={table.cell}>
                        <CountCell row={tc} tab="inc" verdict={verdict} onOpen={() => setLdbRow(row)} />
                      </td>
                      <td className={table.cell}>
                        <CountCell row={tc} tab="exc" verdict={verdict} onOpen={() => setLdbRow(row)} />
                      </td>
                      <td className={table.cell}>
                        <ConnCell verdict={verdict} />
                      </td>
                      <td className={table.cell}>
                        {/* Credential is addressed by resource id — no id, no assignment. */}
                        {row.resource_id ? (
                          <div className="w-[190px]">
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-label={`${row.resource_name || row.resource_id} Credential 수정 — 현재 ${row.credential_id || '연결 안 함'}`}
                              disabled={savingId === row.resource_id}
                              onClick={() => setCredRow(row)}
                              className={opsStyles.cellAction}
                            >
                              <span
                                className={
                                  row.credential_id
                                    ? opsStyles.cellActionValue
                                    : opsStyles.cellActionEmpty
                                }
                              >
                                {row.credential_id || '연결 안 함'}
                              </span>
                              {/* aria-hidden — the button's own label already says it edits. */}
                              <span aria-hidden className={opsStyles.cellActionHint}>
                                수정
                              </span>
                            </button>
                            {/* An assignment the list no longer carries is stated, not
                                quietly folded in as one more selectable option. */}
                            {row.credential_id && !knownCredential.has(row.credential_id) && (
                              <span
                                className={cn(opsStyles.statusTag, TC_TONE_FILL.warn, 'mt-1 block w-fit')}
                              >
                                목록에 없음
                              </span>
                            )}
                          </div>
                        ) : (
                          <Dash />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={cn(pipelineStyles.text.meta, 'mt-3.5')}>
            연결 상태는 최근 연결 테스트가 리소스별로 보고한 판정이고, 논리 DB 건수는 그중
            성공한 리소스에만 표기합니다. 실행 결과가 없거나 성공하지 않은 리소스는 —(값 없음)으로
            두며, 임의로 성공 처리하지 않습니다. 논리 DB 건수를 누르면 대상·제외 정책을 관리할 수
            있습니다.
          </p>
        </>
      )}

      {credRow && (
        <CredentialAssignModal
          key={`cred-${credRow.resource_id}`}
          resourceLabel={credRow.resource_name || credRow.resource_id}
          value={credRow.credential_id ?? ''}
          entries={entries}
          saving={savingId === credRow.resource_id}
          onSubmit={(next) => void assignCredential(credRow, next)}
          onClose={() => setCredRow(null)}
        />
      )}

      {credentialsOpen && (
        <TcCredentialModal
          secrets={secrets}
          rows={rows}
          failed={secretsFailed}
          onClose={() => setCredentialsOpen(false)}
        />
      )}

      {ldbRow && (
        <LdbManageModal
          key={`ldb-${ldbRow.resource_id}`}
          targetSourceId={targetSourceId}
          resourceId={ldbRow.resource_id}
          resourceLabel={ldbRow.resource_name || ldbRow.resource_id}
          databaseType={ldbRow.database_type}
          onClose={() => setLdbRow(null)}
          onSaved={onReload}
        />
      )}
    </section>
  );
}
