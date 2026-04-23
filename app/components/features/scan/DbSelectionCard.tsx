'use client';

import { cardStyles, cn, textColors } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import { Button } from '@/app/components/ui/Button';
import { ScanController } from '@/app/components/features/scan/ScanPanel';
import { ScanEmptyState } from '@/app/components/features/scan/ScanEmptyState';
import { ScanRunningState } from '@/app/components/features/scan/ScanRunningState';
import { ScanErrorState } from '@/app/components/features/scan/ScanErrorState';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import type {
  CloudProvider,
  ProcessStatus,
  Resource,
  SecretKey,
  VmDatabaseConfig,
} from '@/lib/types';

const clockIcon = (
  <svg
    className="w-3 h-3"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const playIcon = (
  <svg
    className="w-3.5 h-3.5"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.2}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

interface DbSelectionCardProps {
  targetSourceId: number;
  cloudProvider: CloudProvider;
  onScanComplete?: () => void;

  resources: Resource[];
  processStatus: ProcessStatus;
  isEditMode?: boolean;
  selectedIds?: string[];
  onSelectionChange?: (ids: string[]) => void;
  credentials?: SecretKey[];
  onCredentialChange?: (resourceId: string, credentialId: string | null) => void;
  expandedVmId?: string | null;
  onVmConfigToggle?: (id: string | null) => void;
  onVmConfigSave?: (resourceId: string, config: VmDatabaseConfig) => void;
  onEditModeChange?: (isEdit: boolean) => void;
}

export const DbSelectionCard = ({
  targetSourceId,
  cloudProvider,
  onScanComplete,
  resources,
  processStatus,
  isEditMode,
  selectedIds,
  onSelectionChange,
  credentials,
  onCredentialChange,
  expandedVmId,
  onVmConfigToggle,
  onVmConfigSave,
  onEditModeChange,
}: DbSelectionCardProps) => (
  <ScanController targetSourceId={targetSourceId} onScanComplete={onScanComplete}>
    {({ state, lastScanAt, progress, starting, canStart, startScan }) => (
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className="flex flex-wrap items-start justify-between gap-3 px-6 py-4 border-b border-gray-100">
          <div className="flex-shrink-0">
            <h2 className="text-[15px] font-semibold text-gray-900 whitespace-nowrap">연동 대상 DB 선택</h2>
            <p className="mt-1 text-xs text-gray-500">
              Infra Scan을 통해 부위 DB 조회 후 Agent 연동 대상 DB를 선택하세요.
            </p>
          </div>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            {lastScanAt && (
              <span className={cn('inline-flex items-center gap-1 text-[11.5px] whitespace-nowrap', textColors.tertiary)}>
                {clockIcon}
                Last Scan: {formatDate(lastScanAt, 'datetime')}
              </span>
            )}
            <Button
              variant="primary"
              disabled={!canStart}
              onClick={startScan}
              className="inline-flex items-center gap-1.5 text-sm py-1.5"
            >
              {starting ? (
                <>
                  <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  시작 중...
                </>
              ) : (
                <>
                  {playIcon}
                  Run Infra Scan
                </>
              )}
            </Button>
          </div>
        </header>

        <div className="px-6 py-6">
          {state === 'EMPTY' && <ScanEmptyState />}
          {state === 'IN_PROGRESS' && <ScanRunningState progress={progress} />}
          {state === 'FAILED' && <ScanErrorState onRetry={startScan} />}
          {state === 'SUCCESS' && (
            <ResourceTable
              resources={resources}
              cloudProvider={cloudProvider}
              processStatus={processStatus}
              isEditMode={isEditMode}
              selectedIds={selectedIds}
              onSelectionChange={onSelectionChange}
              credentials={credentials}
              onCredentialChange={onCredentialChange}
              expandedVmId={expandedVmId}
              onVmConfigToggle={onVmConfigToggle}
              onVmConfigSave={onVmConfigSave}
              onEditModeChange={onEditModeChange}
            />
          )}
        </div>
      </section>
    )}
  </ScanController>
);
