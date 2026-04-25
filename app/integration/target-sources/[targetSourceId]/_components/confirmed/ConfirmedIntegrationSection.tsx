'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ProcessStatus, type CloudProvider } from '@/lib/types';
import { getConfirmedIntegration } from '@/app/lib/api';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';
import { cardStyles, cn, textColors } from '@/lib/theme';
import { AzureInstallationInline } from '@/app/components/features/process-status/azure';
import { AwsInstallationInline } from '@/app/components/features/process-status/aws';
import { GcpInstallationInline } from '@/app/components/features/process-status/gcp';
import { ConnectionTestPanel } from '@/app/components/features/process-status';
import type { ConfirmedResource } from '@/lib/types/resources';
import type { AsyncState } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state';
import { ErrorRow, LoadingRow } from '@/app/integration/target-sources/[targetSourceId]/_components/shared/async-state-views';
import { getConfirmedErrorMessage } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/errors';
import { ConfirmedIntegrationTable } from '@/app/integration/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable';

interface ConfirmedIntegrationSectionProps {
  targetSourceId: number;
  step: ProcessStatus;
  cloudProvider: CloudProvider;
  refreshProject: () => Promise<void>;
}

export const ConfirmedIntegrationSection = ({
  targetSourceId,
  step,
  cloudProvider,
  refreshProject,
}: ConfirmedIntegrationSectionProps) => {
  const [state, setState] = useState<AsyncState<ConfirmedResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);

  // Keep callback identity out of effect deps so a non-memoized caller cannot
  // re-trigger the fetch effect.
  const refreshRef = useRef(refreshProject);
  useEffect(() => {
    refreshRef.current = refreshProject;
  }, [refreshProject]);

  useEffect(() => {
    const controller = new AbortController();

    void getConfirmedIntegration(targetSourceId, { signal: controller.signal })
      .then((response) => {
        setState({ status: 'ready', data: confirmedIntegrationToConfirmed(response) });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (isMissingConfirmedIntegrationError(error)) {
          setState({ status: 'ready', data: [] });
          return;
        }
        setState({ status: 'error', message: getConfirmedErrorMessage(error) });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const handleRetry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  const handleStepChange = useCallback(() => refreshRef.current(), []);

  return (
    <>
      <section className={cn(cardStyles.base, 'overflow-hidden')}>
        <header className={cardStyles.header}>
          <h2 className={cn('text-[15px] font-semibold', textColors.primary)}>
            연동 대상 정보
          </h2>
          <p className={cn('mt-1 text-xs', textColors.tertiary)}>
            관리자 확정된 연동 대상 DB 목록입니다.
          </p>
        </header>
        {state.status === 'loading' ? (
          <LoadingRow message="불러오는 중..." />
        ) : state.status === 'error' ? (
          <ErrorRow message={state.message} onRetry={handleRetry} />
        ) : (
          <ConfirmedIntegrationTable confirmed={state.data} />
        )}
      </section>

      {state.status === 'ready' && (
        <ConfirmedActions
          step={step}
          cloudProvider={cloudProvider}
          confirmed={state.data}
          targetSourceId={targetSourceId}
          refreshProject={handleStepChange}
        />
      )}
    </>
  );
};

interface ConfirmedActionsProps {
  step: ProcessStatus;
  cloudProvider: CloudProvider;
  confirmed: readonly ConfirmedResource[];
  targetSourceId: number;
  refreshProject: () => void;
}

const ConfirmedActions = ({
  step,
  cloudProvider,
  confirmed,
  targetSourceId,
  refreshProject,
}: ConfirmedActionsProps) => {
  if (step === ProcessStatus.INSTALLING) {
    if (cloudProvider === 'Azure') {
      return (
        <AzureInstallationInline
          targetSourceId={targetSourceId}
          confirmed={confirmed}
          onInstallComplete={refreshProject}
        />
      );
    }
    if (cloudProvider === 'AWS') {
      return (
        <AwsInstallationInline
          targetSourceId={targetSourceId}
          onInstallComplete={refreshProject}
        />
      );
    }
    return (
      <GcpInstallationInline
        targetSourceId={targetSourceId}
        onInstallComplete={refreshProject}
      />
    );
  }
  if (
    step === ProcessStatus.WAITING_CONNECTION_TEST
    || step === ProcessStatus.CONNECTION_VERIFIED
    || step === ProcessStatus.INSTALLATION_COMPLETE
  ) {
    return (
      <ConnectionTestPanel
        targetSourceId={targetSourceId}
        confirmed={confirmed}
        onResourceUpdate={refreshProject}
      />
    );
  }
  return null;
};
