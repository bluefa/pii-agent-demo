'use client';

/**
 * Guide data hook — GET only, used by the end-user GuideCard display.
 *
 * Spec: docs/reports/guide-cms/spec.md §6.
 */

import { useCallback, useEffect, useState } from 'react';

import { fetchJson } from '@/lib/fetch-json';
import { INTERNAL_INFRA_API_PREFIX } from '@/lib/infra-api';

import type { GuideDetail, GuideName } from '@/lib/types/guide';

const guideUrl = (name: GuideName): string =>
  `${INTERNAL_INFRA_API_PREFIX}/admin/guides/${encodeURIComponent(name)}`;

export interface UseGuideResult {
  data: GuideDetail | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

export const useGuide = (name: GuideName | null): UseGuideResult => {
  const [data, setData] = useState<GuideDetail | null>(null);
  // Start loading=true when a name is provided so the first render shows the
  // skeleton immediately — no blank flash before the mount effect fires.
  const [loading, setLoading] = useState(name !== null);
  const [error, setError] = useState<Error | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    if (!name) {
      setData(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchJson<GuideDetail>(guideUrl(name));
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [name]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return {
    data,
    loading,
    error,
    refresh,
  };
};
