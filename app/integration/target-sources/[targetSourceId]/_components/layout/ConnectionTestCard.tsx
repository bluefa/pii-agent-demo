'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cardStyles, cn, idcStyles, textColors } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { useModal } from '@/app/hooks/useModal';
import { useToast } from '@/app/components/ui/toast';
import {
  ConnProgressStrip,
  type ConnProgressState,
} from '@/app/components/features/process-status/ConnProgressStrip';
import { IdcCredSelectCell } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/cells';
import { ResourceIdCell } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/ResourceIdCell';
import { LogicalDbModalLoader } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModalLoader';
import { CloudReqApprovalModal } from '@/app/integration/target-sources/[targetSourceId]/_components/layout/CloudReqApprovalModal';
import type { ConfirmedResource } from '@/lib/types/resources';

/** v16 runConnTest: cells show Running then settle to Success after ~1.8s. */
const TEST_DURATION_MS = 1800;

interface LogicalModalTarget {
  resourceId: string;
  resourceName: string;
}

// Local connection-test row — credential + connection are mutated locally (the
// confirmed list from the BFF is the seed).
interface ConnRow {
  resource: ConfirmedResource;
  credentialId: string;
  connection: 'SUCCESS' | 'PENDING';
}

// Step 5 is definitionally pre-test, so every row opens PENDING and Run Test
// establishes SUCCESS — mirroring IDC step5 (`connection_status ?? 'PENDING'`) and
// v16's idle conn-progress. ConfirmedResource.connectionStatus is a hardcoded
// CONNECTED placeholder shared with the post-test step 6/7 views, so it is not the
// pre-test signal here.
const seedRows = (confirmed: readonly ConfirmedResource[]): ConnRow[] =>
  confirmed.map((resource) => ({
    resource,
    credentialId: resource.credentialId ?? '',
    connection: 'PENDING',
  }));

interface ConnectionTestCardProps {
  confirmed: readonly ConfirmedResource[];
  providerLabel: string;
  /** Refetch the project — advances to step 6 when the process status flips. */
  refreshProject: () => void;
}

/**
 * Cloud Step 5 — 연결 테스트 (v16 `data-prov-view="azure gcp aws"` card). Collapses
 * the former 연동 대상 정보 + 연결 테스트 패널 + 논리 DB 확인 slots into one card that
 * mirrors the IDC step5 layout: conn-progress strip + a single table (cred select +
 * Connection Status + 논리 DB 확인) + a gated 완료 승인 요청 → CloudReqApprovalModal.
 *
 * Run Test is a demo simulation matching the approved IDC sibling: it flips a local
 * `testing` flag for ~1.8s, then settles every credentialed row to SUCCESS.
 * ponytail: skips v16's first-attempt-fail demo + per-row animation; the fail/retest
 * path is exercised by the step6/7 retest flow, not here.
 */
export const ConnectionTestCard = ({
  confirmed,
  providerLabel,
  refreshProject,
}: ConnectionTestCardProps) => {
  const [rows, setRows] = useState<ConnRow[]>(() => seedRows(confirmed));
  const [testing, setTesting] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);
  const testTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logicalModal = useModal<LogicalModalTarget>();
  const toast = useToast();

  // Re-seed when the confirmed list changes (provider retry / target switch).
  useEffect(() => {
    setRows(seedRows(confirmed));
  }, [confirmed]);

  useEffect(
    () => () => {
      if (testTimerRef.current) clearTimeout(testTimerRef.current);
    },
    [],
  );

  const runTest = useCallback(() => {
    if (testing) return;
    setTesting(true);
    testTimerRef.current = setTimeout(() => {
      testTimerRef.current = null;
      setTesting(false);
      setRows((prev) =>
        prev.map((row) => (row.credentialId ? { ...row, connection: 'SUCCESS' } : row)),
      );
    }, TEST_DURATION_MS);
  }, [testing]);

  // v16 onCloudCredChange: clearing/altering a credential invalidates the prior test.
  const handleCredChange = useCallback((resourceId: string, cred: string) => {
    setRows((prev) =>
      prev.map((row) =>
        row.resource.resourceId === resourceId
          ? { ...row, credentialId: cred, connection: 'PENDING' }
          : row,
      ),
    );
  }, []);

  const handleSave = useCallback(() => {
    toast.info('논리 DB 정보 저장은 BFF 연동 후 활성화됩니다.');
    logicalModal.close();
  }, [logicalModal, toast]);

  const handleSubmitApproval = useCallback(() => {
    setApprovalOpen(false);
    refreshProject();
  }, [refreshProject]);

  const total = rows.length;
  // Run Test gate (v16 updateConnRunBtn): every row must have a credential selected.
  const allCredsSet = total > 0 && rows.every((r) => r.credentialId);
  const okCount = rows.filter((r) => r.credentialId && r.connection === 'SUCCESS').length;
  const pendingCount = total - okCount;
  const progressPct = total > 0 ? Math.round((okCount / total) * 100) : 0;
  const progressState: ConnProgressState = testing
    ? 'running'
    : total > 0 && pendingCount === 0
      ? 'success'
      : 'idle';
  const progressLabel = testing
    ? '연결 테스트 진행 중 — 각 대상의 Connection Status를 확인하고 있어요'
    : progressState === 'success'
      ? '연결 테스트 완료 — 모든 대상이 연결되었어요'
      : '연결 테스트 대기 중 — Run Test를 실행해 주세요';

  return (
    <section className={cn(cardStyles.base, 'overflow-hidden')}>
      <header className={cn(cardStyles.header, 'flex items-center justify-between')}>
        <div>
          <h2 className={cardStyles.cardTitle}>연결 테스트</h2>
          <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
            DB 접근 정보 사전 등록 및 보안 통신/방화벽 ACL, Agent 연결 여부를 점검합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={runTest}
          disabled={testing || !allCredsSet}
          className={idcStyles.triggerBtn.primary}
        >
          {testing ? (
            '연결 테스트 진행 중...'
          ) : (
            <>
              <svg
                className="w-[13px] h-[13px]"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2.2}
              >
                <polygon points="5 3 19 12 5 21 5 3" />
              </svg>
              Run Test
            </>
          )}
        </button>
      </header>
      <div className={cn(cardStyles.body, 'space-y-4')}>
        <ConnProgressStrip
          state={progressState}
          label={progressLabel}
          ok={okCount}
          fail={0}
          pending={pendingCount}
          pct={progressPct}
        />
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className={idcStyles.table.header}>
              <tr>
                <th className={idcStyles.table.headerCell}>Database Type</th>
                <th className={idcStyles.table.headerCell}>Resource ID</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Region</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[180px]')}>Resource Name</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>DB Credential</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Connection Status</th>
                <th className={cn(idcStyles.table.headerCell, 'w-[100px]')}>논리 DB 확인</th>
              </tr>
            </thead>
            <tbody className={idcStyles.table.body}>
              {rows.map((row) => {
                const { resource } = row;
                const connected = !!row.credentialId && row.connection === 'SUCCESS';
                return (
                  <tr key={resource.resourceId} className={idcStyles.table.row}>
                    <td className={idcStyles.table.cell}>
                      {resource.databaseType ? (
                        <span className={cn(idcStyles.tag.base, idcStyles.tag.blue)}>
                          {getDatabaseShortLabel(resource.databaseType)}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className={idcStyles.table.cell}>
                      <ResourceIdCell value={resource.resourceId} label="Resource ID" />
                    </td>
                    <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                      {resource.region ?? '-'}
                    </td>
                    <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                      {resource.resourceName ?? '-'}
                    </td>
                    <td className={idcStyles.table.cell}>
                      <IdcCredSelectCell
                        value={row.credentialId}
                        onChange={(cred) => handleCredChange(resource.resourceId, cred)}
                      />
                    </td>
                    <td className={idcStyles.table.cell}>
                      {!row.credentialId ? (
                        <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>자격 증명 필요</span>
                      ) : connected ? (
                        <span className={cn(idcStyles.tag.base, idcStyles.tag.green)}>Success</span>
                      ) : (
                        <span className={cn(idcStyles.tag.base, idcStyles.tag.orange)}>Pending</span>
                      )}
                    </td>
                    <td className={idcStyles.table.cell}>
                      <button
                        type="button"
                        disabled={!connected}
                        onClick={() =>
                          logicalModal.open({
                            resourceId: resource.resourceId,
                            resourceName: resource.resourceName ?? resource.resourceId,
                          })
                        }
                        className={idcStyles.triggerBtn.ghostSm}
                      >
                        설정
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between mt-4">
          <p className={cn('text-[12px]', textColors.tertiary)}>
            ※ 모든 DB의 Connection Status가 Success이고 논리 DB 확인 설정이 완료되어야 다음 단계로 진행할 수
            있어요.
          </p>
          <button
            type="button"
            onClick={() => setApprovalOpen(true)}
            disabled={testing}
            className={idcStyles.triggerBtn.primary}
          >
            완료 승인 요청
          </button>
        </div>
        <CloudReqApprovalModal
          isOpen={approvalOpen}
          onClose={() => setApprovalOpen(false)}
          resources={confirmed}
          providerLabel={providerLabel}
          onSubmit={handleSubmitApproval}
        />
        {logicalModal.data && (
          <LogicalDbModalLoader
            open={logicalModal.isOpen}
            resourceId={logicalModal.data.resourceId}
            resourceName={logicalModal.data.resourceName}
            onSave={handleSave}
            onClose={logicalModal.close}
          />
        )}
      </div>
    </section>
  );
};
