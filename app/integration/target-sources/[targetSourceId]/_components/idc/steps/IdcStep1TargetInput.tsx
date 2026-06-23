'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { createApprovalRequest, getProject } from '@/app/lib/api';
import {
  getIdcPreviousRequest,
  idcDbTypeWireFromLabel,
  type IdcResourceView,
} from '@/app/lib/api/idc';
import { IDC_EXCL_PRESETS } from '@/lib/constants/idc';
import { bgColors, cardStyles, cn, idcStyles, primaryColors, statusColors, textColors } from '@/lib/theme';
import { Pagination } from '@/app/components/ui/Pagination';
import { usePagination } from '@/app/hooks/usePagination';
import { LoadingState, ErrorState, EmptyState } from '@/app/components/ui/state';
import { DatabaseIcon, ReloadIcon, PlusIcon } from '@/app/components/ui/icons';
import { ProcessStatusCard } from '@/app/components/features/ProcessStatusCard';
import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { resolveStepSlot } from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import {
  ProjectPageMeta,
  RejectionAlert,
} from '@/app/integration/target-sources/[targetSourceId]/_components/common';
import type { IdcStepProps } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/types';
import {
  IdcTargetListTable,
  type IdcStep1Row,
} from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcTargetListTable';
import { IdcExclusionPopover } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcExclusionPopover';
import {
  IdcTargetFormModal,
  type IdcTargetFormResult,
} from '@/app/integration/target-sources/[targetSourceId]/_components/idc/modals/IdcTargetFormModal';
import { IdcLoadRequestModal } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/modals/IdcLoadRequestModal';
import { IdcSubmitModal } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/modals/IdcSubmitModal';
import { IdcExclusionReasonModal } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/modals/IdcExclusionReasonModal';

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const toRow = (view: IdcResourceView): IdcStep1Row => ({
  ...view,
  exclusionCustom: view.excluded && !!view.exclusionReason && !IDC_EXCL_PRESETS.includes(view.exclusionReason as (typeof IDC_EXCL_PRESETS)[number]),
});

const defaultSourceIps = (kind: IdcResourceView['kind']): string[] =>
  kind === 'MULTIPLE_IP' ? ['172.16.0.11', '172.16.0.12'] : ['172.16.0.11'];

interface PopoverState {
  resourceId: string;
  anchor: HTMLElement;
}

/** Step 1 — 연동 대상 DB 입력 (manual). Orchestrates the editable list, exclusion
 *  flow, and the four modals. Working list lives in component state (DR1). */
export const IdcStep1TargetInput = ({
  project,
  identity,
  providerLabel,
  action,
  onProjectUpdate,
}: IdcStepProps) => {
  const targetSourceId = project.targetSourceId;
  const slotKey = resolveStepSlot('IDC', ProcessStatus.WAITING_TARGET_CONFIRMATION);

  const [rows, setRows] = useState<IdcStep1Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { page, pageSize, setPage, setPageSize, pageItems: pagedRows } = usePagination(rows, {
    initialPageSize: PAGE_SIZE_OPTIONS[0],
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [loadOpen, setLoadOpen] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [popover, setPopover] = useState<PopoverState | null>(null);

  const tmpIdRef = useRef(0);
  const currentIdRef = useRef(targetSourceId);
  currentIdRef.current = targetSourceId;

  // Seed the working list from the server (DR3 abort + DR4 reset + DR5 stale-guard).
  useEffect(() => {
    const controller = new AbortController();
    const requestedId = targetSourceId;
    setLoading(true);
    setRows([]);
    setError(null);

    getIdcPreviousRequest(targetSourceId, { signal: controller.signal })
      .then((views) => {
        if (requestedId !== currentIdRef.current) return;
        setRows(views.map(toRow));
      })
      .catch((err: unknown) => {
        if (err instanceof AppError && err.code === 'ABORTED') return;
        if (requestedId !== currentIdRef.current) return;
        setError('연동 대상을 불러오지 못했어요. 잠시 후 다시 시도해주세요.');
      })
      .finally(() => {
        if (requestedId === currentIdRef.current) setLoading(false);
      });

    return () => controller.abort();
  }, [targetSourceId]);

  const refreshProject = useCallback(async () => {
    const updated = await getProject(targetSourceId);
    onProjectUpdate(updated);
  }, [onProjectUpdate, targetSourceId]);

  const editingRow = editId ? rows.find((r) => r.resourceId === editId) ?? null : null;
  const popoverRow = popover ? rows.find((r) => r.resourceId === popover.resourceId) ?? null : null;

  const total = rows.length;
  const excludedCount = rows.filter((r) => r.excluded).length;
  const liveCount = total - excludedCount;

  const patchRow = useCallback((resourceId: string, patch: Partial<IdcStep1Row>) => {
    setRows((prev) => prev.map((r) => (r.resourceId === resourceId ? { ...r, ...patch } : r)));
  }, []);

  const handleFormSubmit = (result: IdcTargetFormResult) => {
    // Derive the wire enum at the container boundary (ADR-017 §2, migration #2) —
    // the form (⑧) emits only the domain label. The label is always a valid
    // IDC_DB_TYPES option, so this resolves; guard keeps it type-safe.
    const databaseTypeWire = idcDbTypeWireFromLabel(result.databaseTypeLabel);
    if (!databaseTypeWire) return;
    if (editId) {
      patchRow(editId, {
        kind: result.kind,
        hosts: result.hosts,
        port: result.port,
        databaseTypeLabel: result.databaseTypeLabel,
        databaseTypeWire,
        oracleSid: result.oracleSid,
      });
    } else {
      const newRow: IdcStep1Row = {
        resourceId: `idc-tmp-${tmpIdRef.current++}`,
        persisted: false,
        kind: result.kind,
        hosts: result.hosts,
        port: result.port,
        databaseTypeLabel: result.databaseTypeLabel,
        databaseTypeWire,
        oracleSid: result.oracleSid,
        credentialId: undefined,
        sourceIps: defaultSourceIps(result.kind),
        firewallOpen: false,
        connection: 'PENDING',
        health: 'HEALTHY',
        done: '—',
        excluded: false,
        exclusionReason: undefined,
        exclusionCustom: false,
      };
      setRows((prev) => [...prev, newRow]);
    }
    setFormOpen(false);
    setEditId(null);
  };

  const handleToggle = (resourceId: string, checked: boolean, anchor: HTMLElement) => {
    if (checked) {
      // re-check → clear exclusion, back to integration target
      patchRow(resourceId, { excluded: false, exclusionReason: undefined, exclusionCustom: false });
    } else {
      // uncheck → require a reason; the row stays a target until one is picked
      setPopover({ resourceId, anchor });
    }
  };

  const handlePickPreset = (reason: string) => {
    if (!popover) return;
    patchRow(popover.resourceId, { excluded: true, exclusionReason: reason, exclusionCustom: false });
    setPopover(null);
  };

  const handlePickCustom = () => {
    if (!popover) return;
    setReasonFor(popover.resourceId);
    setPopover(null);
  };

  const handleSaveReason = (reason: string) => {
    if (!reasonFor) return;
    patchRow(reasonFor, { excluded: true, exclusionReason: reason, exclusionCustom: true });
    setReasonFor(null);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      // Step 1 is manual input held in UI state — there is no IDC `/resources`
      // PUT in the contract; submission rides createApprovalRequest, which routes
      // every submission to WAITING_APPROVAL (Step 2, 승인 대기) for manual admin
      // approval — same as cloud providers (auto-approval is disabled in the demo).
      const resourceInputs = rows.map((r) =>
        r.excluded
          ? {
              resource_id: r.resourceId,
              selected: false as const,
              ...(r.exclusionReason ? { exclusion_reason: r.exclusionReason } : {}),
            }
          : { resource_id: r.resourceId, selected: true as const },
      );
      await createApprovalRequest(targetSourceId, { resource_inputs: resourceInputs });
      await refreshProject();
      setSubmitOpen(false);
    } catch {
      // surfaced by the mutation layer; keep the modal open
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      {slotKey && <GuideCardContainer slotKey={slotKey} />}

      <div className={cn('rounded-xl shadow-sm', bgColors.surface)}>
        <div className={cn(cardStyles.header, 'flex items-start justify-between gap-4')}>
          <div>
            <h2 className={cardStyles.cardTitle}>연동 대상 DB 입력</h2>
            <p className={cn('mt-1', cardStyles.subtitle)}>
              IDC 인프라는 자동 스캔이 지원되지 않아요. 연동할 DB 접속 정보를 직접 입력해주세요.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <button type="button" onClick={() => setLoadOpen(true)} className={idcStyles.triggerBtn.warnOutline}>
              <ReloadIcon className="h-3.5 w-3.5" />
              기존 연동 요청 정보 불러오기
            </button>
            <button
              type="button"
              onClick={() => {
                setEditId(null);
                setFormOpen(true);
              }}
              className={idcStyles.triggerBtn.soft}
            >
              <PlusIcon className="h-3.5 w-3.5" />
              연동 대상 추가
            </button>
          </div>
        </div>

        <div className={cardStyles.body}>
          {loading ? (
            <LoadingState label="연동 대상을 불러오는 중…" />
          ) : error ? (
            <ErrorState message={error} />
          ) : rows.length === 0 ? (
            <EmptyState
              variant="block"
              icon={<DatabaseIcon className="h-7 w-7" aria-hidden="true" />}
              title="연동 대상을 추가해주세요"
              description="‘연동 대상 추가’ 버튼으로 IP 또는 Domain 기반의 DB 접속 정보를 등록할 수 있어요"
            />
          ) : (
            <>
              <IdcTargetListTable
                rows={pagedRows}
                onToggle={handleToggle}
                onReasonChipClick={(resourceId, anchor) => setPopover({ resourceId, anchor })}
                onEdit={(resourceId) => {
                  setEditId(resourceId);
                  setFormOpen(true);
                }}
                onDelete={(resourceId) => setRows((prev) => prev.filter((r) => r.resourceId !== resourceId))}
              />
              <Pagination
                page={page}
                pageSize={pageSize}
                totalCount={total}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
              />
              <div className="mt-4 flex items-center justify-between">
                <span className={cn('text-[12px]', textColors.tertiary)}>
                  총 <strong className={textColors.primary}>{total}</strong>건 · 연동{' '}
                  <strong className={primaryColors.text}>{liveCount}</strong>건
                  {excludedCount > 0 && (
                    <>
                      {' '}· 제외 <strong className={statusColors.error.textDark}>{excludedCount}</strong>건
                    </>
                  )}
                </span>
                <button
                  type="button"
                  disabled={liveCount === 0}
                  onClick={() => setSubmitOpen(true)}
                  className={idcStyles.triggerBtn.primary}
                >
                  연동 대상 승인 요청
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <RejectionAlert project={project} />

      {formOpen && (
        <IdcTargetFormModal
          isOpen
          initial={
            editingRow
              ? {
                  kind: editingRow.kind,
                  hosts: editingRow.hosts,
                  port: editingRow.port,
                  databaseTypeLabel: editingRow.databaseTypeLabel,
                  oracleSid: editingRow.oracleSid,
                }
              : undefined
          }
          onSubmit={handleFormSubmit}
          onClose={() => {
            setFormOpen(false);
            setEditId(null);
          }}
        />
      )}

      {loadOpen && (
        <IdcLoadRequestModal
          isOpen
          targetSourceId={targetSourceId}
          onConfirm={(resources) => {
            setRows(resources.map(toRow));
            setPage(0);
            setLoadOpen(false);
          }}
          onClose={() => setLoadOpen(false)}
        />
      )}

      <IdcSubmitModal
        isOpen={submitOpen}
        total={total}
        live={liveCount}
        excluded={excludedCount}
        submitting={submitting}
        onSubmit={handleSubmit}
        onClose={() => setSubmitOpen(false)}
      />

      {reasonFor !== null && (
        <IdcExclusionReasonModal
          isOpen
          initialReason={rows.find((r) => r.resourceId === reasonFor)?.exclusionReason}
          onSave={handleSaveReason}
          onClose={() => setReasonFor(null)}
        />
      )}

      {popover && popoverRow && (
        <IdcExclusionPopover
          anchor={popover.anchor}
          selectedPreset={popoverRow.exclusionCustom ? undefined : popoverRow.exclusionReason}
          customActive={popoverRow.exclusionCustom}
          onPickPreset={handlePickPreset}
          onPickCustom={handlePickCustom}
          onDismiss={() => setPopover(null)}
        />
      )}
    </>
  );
};
