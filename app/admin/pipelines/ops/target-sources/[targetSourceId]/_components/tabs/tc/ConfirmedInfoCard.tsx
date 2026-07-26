'use client';

/**
 * 확정 정보 card — the resources actually installed for this target source
 * (GET …/confirmed-integration, snake passthrough per ADR-019). Each row is the
 * operator's entry point for the two per-resource controls: 논리 DB 관리 (skip
 * policy) and Credential 변경.
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
  type ConfirmedIntegrationResourceItem,
} from '@/app/lib/api';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import { Dash } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/bits';
import { LdbManageModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/LdbManageModal';
import { CredentialModal } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/CredentialModal';

type ModalState =
  | { kind: 'ldb'; row: ConfirmedIntegrationResourceItem }
  | { kind: 'credential'; row: ConfirmedIntegrationResourceItem }
  | null;

/** Endpoint label — host:port for cloud, the IDC host/IP fields otherwise. */
const endpointOf = (row: ConfirmedIntegrationResourceItem): string | null => {
  const host = row.host ?? row.idc_host ?? row.idc_ips?.[0] ?? null;
  if (!host) return null;
  return row.port == null ? host : `${host}:${row.port}`;
};

export interface ConfirmedInfoCardProps {
  targetSourceId: number;
  /** Bumped by the tab to refetch after any action anywhere in the tab. */
  reloadKey: number;
  onReload: () => void;
}

export function ConfirmedInfoCard({
  targetSourceId,
  reloadKey,
  onReload,
}: ConfirmedInfoCardProps): ReactElement {
  const [rows, setRows] = useState<ConfirmedIntegrationResourceItem[]>([]);
  const [failed, setFailed] = useState(false);
  const [modal, setModal] = useState<ModalState>(null);

  const loadKey = `${targetSourceId}:${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== loadKey;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await getConfirmedIntegration(targetSourceId);
        if (cancelled) return;
        setRows(data.resource_infos ?? []);
        setFailed(false);
      } catch (error) {
        if (cancelled) return;
        setRows([]);
        // The route encodes "not confirmed yet" as a 404 problem — empty state, not failure.
        setFailed(!isMissingConfirmedIntegrationError(error));
      }
      if (!cancelled) setLoadedKey(loadKey);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, loadKey]);

  const { table } = opsStyles;

  return (
    <section className={pipelineStyles.card.base} aria-label="확정 정보">
      <h2 className={opsStyles.cardTitle}>확정 정보</h2>
      <p className={opsStyles.cardDesc}>연동이 확정된 리소스의 접속 정보 · Credential · 논리 DB 정책</p>

      {loading ? (
        <div className="min-h-[160px]" aria-busy />
      ) : rows.length === 0 ? (
        <div className={cn(pipelineStyles.empty.base, 'mt-2')}>
          <p>확정된 연동 정보가 없습니다.</p>
          {failed && (
            <PlButton variant="secondary" size="sm" className="mt-3" onClick={onReload}>
              다시 시도
            </PlButton>
          )}
        </div>
      ) : (
        <div className={cn(pipelineStyles.card.tableWrap, 'mt-3')}>
          <table className={table.base}>
            <thead>
              <tr>
                <th className={table.headCell}>Database Type</th>
                <th className={table.headCell}>Resource ID</th>
                <th className={table.headCell}>Resource Name</th>
                <th className={table.headCell}>Host:Port</th>
                <th className={table.headCell}>Credential</th>
                <th className={table.headCell} aria-label="관리" />
              </tr>
            </thead>
            <tbody className="[&>tr:last-child>td]:border-b-0">
              {rows.map((row, index) => {
                const endpoint = endpointOf(row);
                return (
                  <tr key={`${row.resource_id}-${index}`} className={table.rowHover}>
                    <td className={table.cell}>
                      {row.database_type ? (
                        <span className={cn(tqStyles.tag.base, tqStyles.tag.blue)}>
                          {row.database_type}
                        </span>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className={cn(table.cell, pipelineStyles.text.mono, 'break-all')}>
                      {row.resource_id || '—'}
                    </td>
                    <td className={table.cell}>{row.resource_name || <Dash />}</td>
                    <td className={table.cell}>
                      {endpoint ? (
                        <span className={tqStyles.appTable.tdMono}>{endpoint}</span>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className={table.cell}>
                      {row.credential_id ? (
                        <span className={tqStyles.appTable.tdMono}>{row.credential_id}</span>
                      ) : (
                        <Dash />
                      )}
                    </td>
                    <td className={cn(table.cell, 'text-right whitespace-nowrap')}>
                      {/* Both controls address the resource by id — no id, no actions. */}
                      {row.resource_id ? (
                        <span className="inline-flex items-center gap-3">
                          <button
                            type="button"
                            className={opsStyles.detailLink}
                            onClick={() => setModal({ kind: 'ldb', row })}
                          >
                            논리 DB 관리
                          </button>
                          <button
                            type="button"
                            className={opsStyles.detailLink}
                            onClick={() => setModal({ kind: 'credential', row })}
                          >
                            Credential 변경
                          </button>
                        </span>
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
      )}

      {modal?.kind === 'ldb' && (
        <LdbManageModal
          key={`ldb-${modal.row.resource_id}`}
          targetSourceId={targetSourceId}
          resourceId={modal.row.resource_id}
          resourceLabel={endpointOf(modal.row) ?? modal.row.resource_id}
          databaseType={modal.row.database_type}
          onClose={() => setModal(null)}
          onSaved={onReload}
        />
      )}
      {modal?.kind === 'credential' && (
        <CredentialModal
          key={`cred-${modal.row.resource_id}`}
          targetSourceId={targetSourceId}
          resourceId={modal.row.resource_id}
          currentCredentialId={modal.row.credential_id}
          onClose={() => setModal(null)}
          onSaved={onReload}
        />
      )}
    </section>
  );
}
