/**
 * 실제 BFF API HTTP 클라이언트.
 * USE_MOCK_DATA=false 일 때 사용된다.
 */
import type { BffClient } from '@/lib/bff/types';
import type { Project, SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import { BffError } from '@/lib/bff/errors';

const BFF_URL = process.env.BFF_API_URL ?? '';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BFF_URL}${path}`, {
    headers: { Accept: 'application/json' },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new BffError(
      res.status,
      (body as { error?: string }).error ?? 'UNKNOWN',
      (body as { message?: string }).message ?? `HTTP ${res.status}`,
    );
  }
  return res.json() as Promise<T>;
}

export const httpBff: BffClient = {
  targetSources: {
    get: async (id) => {
      const data = await get<{ targetSource: Project }>(`/v1/target-sources/${id}`);
      return data.targetSource;
    },

    secrets: async (id) => {
      const data = await get<{
        credentials: Array<{ name: string; databaseType?: string; createdAt: string }>;
      }>(`/v1/target-sources/${id}/secrets`);
      return data.credentials.map((c): SecretKey => ({
        name: c.name,
        createTimeStr: c.createdAt,
      }));
    },
  },

  users: {
    me: async () => {
      const data = await get<{ user: CurrentUser }>('/users/me');
      return data.user;
    },
  },
};
