'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProcessStatus } from '@/lib/types';
import { AppError } from '@/lib/errors';
import { getProject } from '@/app/lib/api';
import {
  getIdcResources,
  updateIdcResources,
  type IdcResourceView,
} from '@/app/lib/api/idc';
import { IDC_EXCL_PRESETS } from '@/lib/constants/idc';
import { bgColors, borderColors, cn, primaryColors, statusColors, textColors } from '@/lib/theme';
import { Button } from '@/app/components/ui/Button';
import { Pagination } from '@/app/components/ui/Pagination';
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
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);

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

    getIdcResources(targetSourceId, { signal: controller.signal })
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
    if (editId) {
      patchRow(editId, {
        kind: result.kind,
        hosts: result.hosts,
        port: result.port,
        databaseTypeLabel: result.databaseTypeLabel,
        databaseTypeWire: result.databaseTypeWire,
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
        databaseTypeWire: result.databaseTypeWire,
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
      await updateIdcResources(targetSourceId, rows);
      await refreshProject();
      // TODO(integration): advance processStatus → WAITING_APPROVAL via the
      // shared approval flow once the IDC approval transition is wired in mock.
      setSubmitOpen(false);
    } catch {
      // surfaced by the mutation layer; keep the modal open
    } finally {
      setSubmitting(false);
    }
  };

  const pagedRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <>
      <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />
      {slotKey && <GuideCardContainer slotKey={slotKey} />}

      <div className={cn('rounded-xl shadow-sm', bgColors.surface)}>
        <div className={cn('flex items-start justify-between gap-4 border-b p-6', borderColors.light)}>
          <div>
            <h2 className={cn('text-[18px] font-bold', textColors.primary)}>연동 대상 DB 입력</h2>
            <p className={cn('mt-1 text-[12px]', textColors.tertiary)}>
              IDC 인프라는 자동 스캔이 지원되지 않아요. 연동할 DB 접속 정보를 직접 입력해주세요.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2.5">
            <Button variant="warnOutline" onClick={() => setLoadOpen(true)} className="inline-flex items-center gap-1.5 text-[13px]">
              <ReloadIcon className="h-3.5 w-3.5" />
              기존 연동 요청 정보 불러오기
            </Button>
            <Button
              variant="soft"
              onClick={() => {
                setEditId(null);
                setFormOpen(true);
              }}
              className="inline-flex items-center gap-1.5 text-[13px]"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              연동 대상 추가
            </Button>
          </div>
        </div>

        <div className="p-6">
          {loading ? (
            <div className={cn('py-12 text-center text-sm', textColors.tertiary)}>연동 대상을 불러오는 중…</div>
          ) : error ? (
            <div className={cn('py-12 text-center text-sm', textColors.tertiary)}>{error}</div>
          ) : rows.length === 0 ? (
            <div className={cn('flex flex-col items-center gap-2 py-14 text-center')}>
              <div className={cn('mb-1 grid h-14 w-14 place-items-center rounded-2xl', bgColors.muted, textColors.tertiary)}>
                <DatabaseIcon className="h-7 w-7" aria-hidden="true" />
              </div>
              <h3 className={cn('text-[15px] font-bold', textColors.secondary)}>연동 대상을 추가해주세요</h3>
              <p className={cn('text-[12.5px]', textColors.tertiary)}>
                &lsquo;연동 대상 추가&rsquo; 버튼으로 IP 또는 Domain 기반의 DB 접속 정보를 등록할 수 있어요
              </p>
            </div>
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
                onPageSizeChange={(next) => {
                  setPageSize(next);
                  setPage(0);
                }}
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
                <Button
                  variant="primary"
                  disabled={liveCount === 0}
                  onClick={() => setSubmitOpen(true)}
                >
                  연동 대상 승인 요청
                </Button>
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
