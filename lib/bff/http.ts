/**
 * 실제 BFF API HTTP 클라이언트.
 * USE_MOCK_DATA=false 일 때 사용된다.
 */
import type { BffClient } from '@/lib/bff/types';
import type { SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import { BffError } from '@/lib/bff/errors';
import { toUpstreamInfraApiPath } from '@/lib/infra-api';
import { camelCaseKeys } from '@/lib/object-case';
import { extractTargetSource, type TargetSourceDetailResponse } from '@/lib/target-source-response';

const BFF_URL = process.env.BFF_API_URL ?? '';

interface LegacyErrorPayload {
  error?: string;
  message?: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

async function get<T>(path: string): Promise<T> {
  const fullPath = `${BFF_URL}${toUpstreamInfraApiPath(path)}`;
  console.log(`[BFF] → GET ${fullPath}`);
  const res = await fetch(fullPath, {
    headers: { Accept: 'application/json' },
  });
  console.log(`[BFF] ← GET ${fullPath} (${res.status})`);
  if (!res.ok) {
    const body = await res.json().catch((): LegacyErrorPayload => ({}));
    throw new BffError(
      res.status,
      body.error ?? 'INTERNAL_ERROR',
      body.message ?? `HTTP ${res.status}`,
    );
  }
  const data = await res.json();
  return camelCaseKeys(data) as T;
}

export const httpBff: BffClient = {
  targetSources: {
    get: async (id) => {
      const data = await get<TargetSourceDetailResponse>(`/target-sources/${id}`);
      return extractTargetSource(data);
    },

    secrets: async (id) => {
      const data = await get<Array<{ name: string; createTime: string | null; createTimeStr: string | null }>>(`/target-sources/${id}/secrets`);
      return data.map((c): SecretKey => ({
        name: c.name,
        createTimeStr: c.createTimeStr ?? '',
      }));
    },
  },

  users: {
    me: async () => {
      const data = await get<unknown>('/user/me');
      if (isRecord(data) && isRecord(data.user)) {
        return data.user as unknown as CurrentUser;
      }
      return data as CurrentUser;
    },
  },
};
