'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Resource } from '@/lib/types';

interface UseProjectResourcesOptions {
  loadResources: () => Promise<Resource[]>;
  getErrorMessage: (error: unknown) => string;
  onLoaded?: (resources: Resource[]) => void;
}

export interface UseProjectResourcesResult {
  resources: Resource[];
  loading: boolean;
  error: string | null;
  reload: () => void;
}

export function useProjectResources({
  loadResources,
  getErrorMessage,
  onLoaded,
}: UseProjectResourcesOptions): UseProjectResourcesResult {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const reload = useCallback(() => setRetryNonce((n) => n + 1), []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await loadResources();
        if (cancelled) return;
        setResources(data);
        onLoaded?.(data);
      } catch (err) {
        if (cancelled) return;
        setError(getErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadResources, getErrorMessage, onLoaded, retryNonce]);

  return { resources, loading, error, reload };
}
