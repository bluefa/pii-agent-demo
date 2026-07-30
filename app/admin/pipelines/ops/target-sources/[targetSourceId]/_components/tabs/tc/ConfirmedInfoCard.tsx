'use client';

/**
 * 확정 정보 card — the single per-resource table of this tab.
 *
 * Rows come from the confirmed snapshot (GET …/confirmed-integration, snake
 * passthrough per ADR-019); the 논리 DB 건수 / Connection Status columns are joined
 * in from the latest Test Connection results by `resource_id`. A resource with no
 * matching TC row renders — for those columns; nothing is inferred from the
 * snapshot alone (an installed resource is not a tested one).
 *
 * Per-row controls: Credential 배정 (inline dropdown over GET …/secrets — the
 * contract's credential list) and 논리 DB 관리 (skip policy).
 *
 * An absent snapshot (404 before 연동 확정) is an empty state, not an error; a real
 * fetch failure adds a 다시 시도 affordance to that same empty state so the two are
 * never confused with "확정된 리소스가 0건".
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { isMissingConfirmedIntegrationError } from '@/lib/errors';
import {
  getConfirmedIntegration,
  getSecrets,
  updateResourceCredential,
  type ConfirmedIntegrationResourceItem,
} from '@/app/lib/api';
import type { SecretKey } from '@/lib/types';
import type { TcResultRow } from '@/app/lib/api/task-queue-tc';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { PlSelect } from '@/app/admin/pipelines/_components/PlSelect';
import { Icon } from '@/app/admin/pipelines/_components/icons';
import { usePlToast } from '@/app/admin/pipelines/_components/usePlToast';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  Dash,
  ResourceId,
  TcPill,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { LdbManageModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/LdbManageModal';
import { ldbCount } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/logic';

/** Connection Status cell — only an explicit wire value claims Success/Failed. */
function ConnCell({ row }: { row: TcResultRow | undefined }): ReactElement {
  if (!row) return <Dash />;
  if (row.connectionStatus === 'SUCCESS') return <TcPill tone="ok" label="Success" />;
  if (row.connectionStatus === 'FAILED') return <TcPill tone="err" label="Failed" />;
  return <TcPill tone="off" label="Unknown" />;
}

/** Contract-declared count — absent (no TC row / not a success) renders —, never 0. */
function CountCell({ row, tab }: { row: TcResultRow | undefined; tab: 'inc' | 'exc' }): ReactElement {
  const count = row ? ldbCount(row, tab) : null;
  if (count == null) return <Dash />;
  return <span className="tabular-nums">{count}개</span>;
}

export interface ConfirmedInfoCardProps {
  targetSourceId: number;
  /** Latest Test Connection rows, joined by resource_id. */
  tcResults: readonly TcResultRow[];
  /** Bumped by the tab to refetch after any action anywhere in the tab. */
  reloadKey: number;
  onReload: () => void;
}

export function ConfirmedInfoCard({
  targetSourceId,
  tcResults,
  reloadKey,
  onReload,
}: ConfirmedInfoCardProps): ReactElement {
  const toast = usePlToast();
  const [rows, setRows] = useState<ConfirmedIntegrationResourceItem[]>([]);
  const [secrets, setSecrets] = useState<SecretKey[]>([]);
  const [failed, setFailed] = useState(false);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [ldbRow, setLdbRow] = useState<ConfirmedIntegrationResourceItem | null>(null);

  const loadKey = `${targetSourceId}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // The credential list is best-effort: losing it must not blank the table,
      // it only leaves the dropdown with the currently assigned value.
      const [confirmed, secretList] = await Promise.allSettled([
        getConfirmedIntegration(targetSourceId),
        getSecrets(targetSourceId),
      ]);
      if (cancelled) return;
      if (confirmed.status === 'fulfilled') {
        setRows(confirmed.value.resource_infos ?? []);
        setFailed(false);
      } else {
        setRows([]);
        // The route encodes "not confirmed yet" as a 404 problem — empty state, not failure.
        setFailed(!isMissingConfirmedIntegrationError(confirmed.reason));
      }
      setSecrets(secretList.status === 'fulfilled' ? secretList.value : []);
      setLoadedKey(loadKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, loadKey]);

  const tcByResourceId = new Map(tcResults.map((row) => [row.resourceId, row]));

  const assignCredential = async (
    row: ConfirmedIntegrationResourceItem,
    credentialId: string,
  ): Promise<void> => {
    setSavingId(row.resource_id);
    try {
      await updateResourceCredential(targetSourceId, row.resource_id, credentialId || null);
      toast.show(credentialId ? 'Credential을 변경했습니다.' : 'Credential 연결을 해제했습니다.');
      onReload();
    } catch {
      toast.show('Credential 변경에 실패했습니다.');
    } finally {
      setSavingId(null);
    }
  };

  const { table } = opsStyles;

  return (
    <section className={pipelineStyles.card.base} aria-label="확정 정보">
      <h2 className={opsStyles.cardTitle}>확정 정보</h2>
      <p className={opsStyles.cardDesc}>
        연동이 확정된 리소스와 최근 Test Connection 결과 · Credential · 논리 DB 정책
      </p>

      {loading ? (
        <div className="min-h-[160px]" aria-busy />
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
                  <th className={table.headCell}>Connection Status</th>
                  <th className={table.headCell}>Credential</th>
                  <th className={table.headCell} aria-label="관리" />
                </tr>
              </thead>
              <tbody className="[&>tr:last-child>td]:border-b-0">
                {rows.map((row, index) => {
                  const tc = tcByResourceId.get(row.resource_id);
                  return (
                    <tr key={`${row.resource_id}-${index}`} className={table.rowHover}>
                      <td className={table.cell}>
                        {row.database_type ? (
                          <span className={cn(tqStyles.tag.base, tqStyles.tag.blue)}>
                            {/* wire 는 소문자 원문(mysql·athena) — 사용자 화면과 같은 표기. */}
                            {getDatabaseShortLabel(row.database_type)}
                          </span>
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className={table.cell}>
                        <ResourceId value={row.resource_id} />
                      </td>
                      <td className={table.cell}>{row.resource_name || <Dash />}</td>
                      <td className={table.cell}>
                        <CountCell row={tc} tab="inc" />
                      </td>
                      <td className={table.cell}>
                        <CountCell row={tc} tab="exc" />
                      </td>
                      <td className={table.cell}>
                        <ConnCell row={tc} />
                      </td>
                      <td className={table.cell}>
                        {/* Credential is addressed by resource id — no id, no assignment. */}
                        {row.resource_id ? (
                          <PlSelect
                            aria-label="Credential"
                            className="min-w-[150px]"
                            value={row.credential_id ?? ''}
                            disabled={savingId === row.resource_id}
                            onChange={(event) => void assignCredential(row, event.target.value)}
                          >
                            <option value="">연결 안 함</option>
                            {/* The assigned value may predate the list — keep it selectable. */}
                            {row.credential_id &&
                              !secrets.some((secret) => secret.name === row.credential_id) && (
                                <option value={row.credential_id}>{row.credential_id}</option>
                              )}
                            {secrets.map((secret) => (
                              <option key={secret.name} value={secret.name}>
                                {secret.name}
                              </option>
                            ))}
                          </PlSelect>
                        ) : (
                          <Dash />
                        )}
                      </td>
                      <td className={cn(table.cell, 'text-right whitespace-nowrap')}>
                        {row.resource_id ? (
                          <button
                            type="button"
                            className={opsStyles.detailLink}
                            onClick={() => setLdbRow(row)}
                          >
                            논리 DB 관리
                          </button>
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
            논리 DB 건수와 Connection Status는 최근 Test Connection 결과에서 가져옵니다. 해당 결과가
            없거나 성공하지 않은 리소스는 —(값 없음)으로 표기하며, 임의로 성공 처리하지 않습니다.
          </p>
        </>
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
