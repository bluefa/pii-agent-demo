'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ProcessStatus } from '@/lib/types';
import type {
  ApprovalHistoryResponse,
  ApprovedIntegrationResponse,
  ConfirmedIntegrationResponse,
  ConfirmResourceItem,
} from '@/app/lib/api';
import {
  getApprovalHistory,
  getApprovedIntegration,
  getConfirmResources,
  getConfirmedIntegration,
} from '@/app/lib/api';
import { getAzureSettings } from '@/app/lib/api/azure';
import type { AzureV1Settings } from '@/lib/types/azure';
import { AppError } from '@/lib/errors';

const EMPTY_CONFIRMED_INTEGRATION: ConfirmedIntegrationResponse = {
  resource_infos: [],
};

const EMPTY_APPROVAL_HISTORY_PAGE: ApprovalHistoryResponse = {
  content: [],
  page: {
    totalElements: 0,
    totalPages: 0,
    number: 0,
    size: 1,
  },
};

const isMissingSnapshotError = (error: unknown): boolean =>
  error instanceof AppError
  && (
    error.code === 'NOT_FOUND'
    || error.code === 'APPROVED_INTEGRATION_NOT_FOUND'
    || error.code === 'CONFIRMED_INTEGRATION_NOT_FOUND'
  );

const getResourceErrorMessage = (error: unknown): string => {
  if (error instanceof AppError && error.isUserFacing) return error.message;
  if (error instanceof Error) return error.message;
  return 'Azure 리소스 정보를 불러오지 못했습니다.';
};

export interface UseAzureProjectDataInput {
  targetSourceId: number;
  tenantId?: string;
  subscriptionId?: string;
  currentStep: ProcessStatus;
  updatedAt: string;
}

export interface AzureProjectData {
  settings: AzureV1Settings | null;
  catalogResources: ConfirmResourceItem[];
  latestApprovalRequest: ApprovalHistoryResponse['content'][number] | null;
  approvedIntegration: ApprovedIntegrationResponse['approved_integration'] | null;
  confirmedIntegration: ConfirmedIntegrationResponse;
  loading: boolean;
  loaded: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export const useAzureProjectData = ({
  targetSourceId,
  tenantId,
  subscriptionId,
  currentStep,
  updatedAt,
}: UseAzureProjectDataInput): AzureProjectData => {
  const [settings, setSettings] = useState<AzureV1Settings | null>(null);
  const [catalogResources, setCatalogResources] = useState<ConfirmResourceItem[]>([]);
  const [latestApprovalRequest, setLatestApprovalRequest] = useState<ApprovalHistoryResponse['content'][number] | null>(null);
  const [approvedIntegration, setApprovedIntegration] = useState<ApprovedIntegrationResponse['approved_integration'] | null>(null);
  const [confirmedIntegration, setConfirmedIntegration] = useState<ConfirmedIntegrationResponse>(EMPTY_CONFIRMED_INTEGRATION);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const needsIdentifierFallback = !tenantId || !subscriptionId;

    setSettings(null);

    if (needsIdentifierFallback) {
      void getAzureSettings(targetSourceId)
        .then((response) => {
          if (cancelled) return;
          setSettings(response);
        })
        .catch(() => {
          if (cancelled) return;
          setSettings(null);
        });
    }

    return () => {
      cancelled = true;
    };
  }, [subscriptionId, targetSourceId, tenantId]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [
        catalogResponse,
        approvalHistoryResponse,
        approvedIntegrationResponse,
        confirmedIntegrationResponse,
      ] = await Promise.all([
        getConfirmResources(targetSourceId),
        getApprovalHistory(targetSourceId, 0, 1).catch((err) => {
          if (isMissingSnapshotError(err)) return EMPTY_APPROVAL_HISTORY_PAGE;
          throw err;
        }),
        getApprovedIntegration(targetSourceId).catch((err) => {
          if (isMissingSnapshotError(err)) {
            return { approved_integration: null } satisfies ApprovedIntegrationResponse;
          }
          throw err;
        }),
        getConfirmedIntegration(targetSourceId).catch((err) => {
          if (isMissingSnapshotError(err)) return EMPTY_CONFIRMED_INTEGRATION;
          throw err;
        }),
      ]);

      setCatalogResources(catalogResponse.resources);
      setLatestApprovalRequest(approvalHistoryResponse.content[0] ?? null);
      setApprovedIntegration(approvedIntegrationResponse.approved_integration);
      setConfirmedIntegration(confirmedIntegrationResponse);
    } catch (err) {
      setError(getResourceErrorMessage(err));
    } finally {
      setLoading(false);
      setLoaded(true);
    }
  }, [targetSourceId]);

  useEffect(() => {
    void refresh();
  }, [refresh, currentStep, updatedAt]);

  return {
    settings,
    catalogResources,
    latestApprovalRequest,
    approvedIntegration,
    confirmedIntegration,
    loading,
    loaded,
    error,
    refresh,
  };
};
