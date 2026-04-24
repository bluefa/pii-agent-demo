'use client';

import { useEffect, useState } from 'react';
import { getApprovedIntegration } from '@/app/lib/api';
import type { ApprovedIntegrationResourceItem } from '@/app/lib/api';
import type { Resource, CloudProvider, ProcessStatus, DatabaseType, VmDatabaseType } from '@/lib/types';
import { ResourceTable } from '@/app/components/features/ResourceTable';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { isMissingApprovedIntegrationError } from '@/lib/errors';
import { cn, getButtonClass, statusColors, textColors, cardStyles } from '@/lib/theme';

interface ResourceTransitionPanelProps {
  targetSourceId: number;
  cloudProvider: CloudProvider;
  processStatus: ProcessStatus;
}

const VM_DATABASE_TYPES: VmDatabaseType[] = ['MYSQL', 'POSTGRESQL', 'MSSQL', 'MONGODB', 'ORACLE'];

const isVmDatabaseType = (databaseType: DatabaseType): databaseType is VmDatabaseType =>
  VM_DATABASE_TYPES.includes(databaseType as VmDatabaseType);

const approvedSnapshotToResources = (
  items: ApprovedIntegrationResourceItem[],
): Resource[] =>
  items.map((item) => {
    const endpoint = item.endpoint_config;
    const databaseType: DatabaseType = (endpoint?.db_type ?? 'MYSQL') as DatabaseType;
    const isAzureVm =
      item.resource_type === 'AZURE_VM'
      && endpoint
      && isVmDatabaseType(databaseType);
    return {
      id: item.resource_id,
      resourceId: item.resource_id,
      type: item.resource_type,
      databaseType,
      connectionStatus: 'CONNECTED' as const,
      isSelected: true,
      integrationCategory: 'TARGET' as const,
      selectedCredentialId: item.credential_id ?? undefined,
      vmDatabaseConfig: isAzureVm && endpoint
        ? {
            databaseType: endpoint.db_type,
            port: endpoint.port,
            ...(endpoint.host ? { host: endpoint.host } : {}),
            ...(endpoint.oracleServiceId ? { oracleServiceId: endpoint.oracleServiceId } : {}),
            ...(endpoint.selectedNicId ? { selectedNicId: endpoint.selectedNicId } : {}),
          }
        : undefined,
    };
  });

type FetchState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; resources: Resource[] };

export const ResourceTransitionPanel = ({
  targetSourceId,
  cloudProvider,
  processStatus,
}: ResourceTransitionPanelProps) => {
  const [state, setState] = useState<FetchState>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getApprovedIntegration(targetSourceId)
      .then((response) => {
        if (cancelled) return;
        const infos = response.approved_integration?.resource_infos ?? [];
        setState({ status: 'ready', resources: approvedSnapshotToResources(infos) });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (isMissingApprovedIntegrationError(error)) {
          // 스냅샷 미생성은 정상 — 빈 목록으로 처리.
          setState({ status: 'ready', resources: [] });
          return;
        }
        const message = error instanceof Error
          ? error.message
          : '반영 중인 리소스 목록을 불러오지 못했습니다.';
        setState({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, retryNonce]);

  const handleRetry = () => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  };

  const resources = state.status === 'ready' ? state.resources : [];

  return (
    <div className={cn(cardStyles.base, 'overflow-hidden')}>
      <div className="px-6 pt-6">
        <h2 className={cn('text-lg font-semibold', textColors.primary)}>Cloud 리소스</h2>
      </div>

      <div className={cn('mx-6 mt-4 px-4 py-2 flex items-center gap-2 rounded-t-lg', statusColors.info.bg)}>
        <svg className={cn('w-4 h-4', statusColors.info.textDark)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        <span className={cn('text-sm font-medium', statusColors.info.textDark)}>
          연동 대상 리소스 ({resources.length}개)
        </span>
      </div>

      {state.status === 'loading' ? (
        <div className="px-6 py-12 flex items-center justify-center gap-3">
          <LoadingSpinner />
          <span className={cn('text-sm', textColors.tertiary)}>반영 중인 리소스 목록을 불러오는 중입니다.</span>
        </div>
      ) : state.status === 'error' ? (
        <div className={cn('px-6 py-6 space-y-3', statusColors.error.bg)}>
          <p className={cn('text-sm font-medium', statusColors.error.textDark)}>{state.message}</p>
          <button onClick={handleRetry} className={getButtonClass('secondary', 'sm')}>
            다시 시도
          </button>
        </div>
      ) : (
        <ResourceTable
          resources={resources}
          cloudProvider={cloudProvider}
          processStatus={processStatus}
        />
      )}
    </div>
  );
};
