'use client';

/**
 * Guide CMS — data hook for the admin editor.
 *
 * Spec: docs/reports/guide-cms/spec.md §6.
 *
 * Wraps `fetchJson` for the GET path and `useApiMutation` for PUT so
 * the component never writes try/catch or manual stringify. `fetchJson`
 * auto-serialises the body (lib/fetch-json.ts:140-149), so callers pass
 * the raw `GuideUpdateInput` object; serialising here would
 * double-encode the payload.
 */

import { useCallback, useEffect, useState } from 'react';

import { useApiMutation } from '@/app/hooks/useApiMutation';
import { fetchJson } from '@/lib/fetch-json';
import { INTERNAL_INFRA_API_PREFIX } from '@/lib/infra-api';

import type { GuideDetail, GuideName, GuideUpdateInput } from '@/lib/types/guide';

const guideUrl = (name: GuideName): string =>
  `${INTERNAL_INFRA_API_PREFIX}/admin/guides/${encodeURIComponent(name)}`;

export interface UseGuideResult {
  data: GuideDetail | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
  save: (input: GuideUpdateInput) => Promise<GuideDetail | undefined>;
  saving: boolean;
}

export const useGuide = (name: GuideName | null): UseGuideResult => {
  const [data, setData] = useState<GuideDetail | null>(null);
  const [loading, setLoading] = useState(false);
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

  const saveMutation = useApiMutation<GuideUpdateInput, GuideDetail>(
    async (body) => {
      if (!name) throw new Error('No guide selected');
      // body is passed as an object — fetchJson serialises it. Calling
      // JSON.stringify here would double-encode the payload.
      return fetchJson<GuideDetail>(guideUrl(name), { method: 'PUT', body });
    },
    { onSuccess: (result) => setData(result) },
  );

  return {
    data,
    loading,
    error,
    refresh,
    save: saveMutation.mutate,
    saving: saveMutation.loading,
  };
};
