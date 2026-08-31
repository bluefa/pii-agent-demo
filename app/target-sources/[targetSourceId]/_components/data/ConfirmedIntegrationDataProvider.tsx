'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState, type FC, type ReactNode } from 'react';
import { getConfirmedIntegration } from '@/app/lib/api';
import { AppError, isMissingConfirmedIntegrationError } from '@/lib/errors';
import { confirmedIntegrationToConfirmed } from '@/lib/resource-catalog';
import { getConfirmedErrorMessage } from '@/app/target-sources/[targetSourceId]/_components/confirmed/errors';
import { useLocale } from '@/app/components/LocaleProvider';
import type { AsyncState } from '@/app/target-sources/[targetSourceId]/_components/shared/async-state';
import type { ConfirmedResource } from '@/lib/types/resources';

export interface ConfirmedIntegrationContextValue {
  targetSourceId: number;
  state: AsyncState<readonly ConfirmedResource[]>;
  retry: () => void;
}

const ConfirmedIntegrationContext = createContext<ConfirmedIntegrationContextValue | null>(null);

interface ProviderProps {
  targetSourceId: number;
  children: ReactNode;
}

// Manual useEffect (not useAbortableEffect) because retry must drive a fresh
// fetch via a nonce dep while preserving abort + branch-on-error semantics.
export const ConfirmedIntegrationDataProvider: FC<ProviderProps> = ({ targetSourceId, children }) => {
  const [state, setState] = useState<AsyncState<readonly ConfirmedResource[]>>({ status: 'loading' });
  const [retryNonce, setRetryNonce] = useState(0);
  const { locale } = useLocale();
  // Held in a ref, not read from the closure: the language only decides how a failure
  // READS, so putting it in the effect's deps would refetch the whole integration
  // every time the reader flips the toggle.
  const localeRef = useRef(locale);
  useEffect(() => {
    localeRef.current = locale;
  }, [locale]);
  const [activeId, setActiveId] = useState(targetSourceId);

  // Reset to loading during render on id change — React idiom for derived state
  // (calling setState inside the fetch effect would trigger a cascading render).
  if (targetSourceId !== activeId) {
    setActiveId(targetSourceId);
    setState({ status: 'loading' });
  }

  useEffect(() => {
    const controller = new AbortController();

    void getConfirmedIntegration(targetSourceId, { signal: controller.signal })
      .then((response) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', data: confirmedIntegrationToConfirmed(response) });
      })
      .catch((error: unknown) => {
        if (error instanceof AppError && error.code === 'ABORTED') return;
        if (controller.signal.aborted) return;
        if (isMissingConfirmedIntegrationError(error)) {
          setState({ status: 'ready', data: [] });
          return;
        }
        setState({ status: 'error', message: getConfirmedErrorMessage(error, localeRef.current) });
      });

    return () => controller.abort();
  }, [targetSourceId, retryNonce]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setRetryNonce((n) => n + 1);
  }, []);

  return (
    <ConfirmedIntegrationContext.Provider value={{ targetSourceId, state, retry }}>
      {children}
    </ConfirmedIntegrationContext.Provider>
  );
};

export const useConfirmedIntegration = (): ConfirmedIntegrationContextValue => {
  const value = useContext(ConfirmedIntegrationContext);
  if (!value) {
    throw new Error('useConfirmedIntegration must be used within ConfirmedIntegrationDataProvider');
  }
  return value;
};
