/**
 * 기존 mock 핸들러(NextResponse 반환)를 BffClient 인터페이스로 래핑한다.
 * mock 비즈니스 로직(인증, 상태 전이, 검증)을 그대로 재사용하면서
 * NextResponse → 순수 데이터로 변환만 수행한다.
 */
import type { NextResponse } from 'next/server';
import type { BffClient } from '@/lib/bff/types';
import type { Project, SecretKey } from '@/lib/types';
import type { CurrentUser } from '@/app/lib/api';
import { BffError } from '@/lib/bff/errors';
import { getProjectIdByTargetSourceId } from '@/lib/mock-data';
import { mockTargetSources } from '@/lib/api-client/mock/target-sources';
import { mockProjects } from '@/lib/api-client/mock/projects';
import { mockUsers } from '@/lib/api-client/mock/users';

function resolveProjectId(targetSourceId: number): string {
  const projectId = getProjectIdByTargetSourceId(targetSourceId);
  if (!projectId) {
    throw new BffError(404, 'NOT_FOUND', `targetSourceId ${targetSourceId}에 해당하는 과제를 찾을 수 없습니다.`);
  }
  return projectId;
}

async function unwrap<T>(response: NextResponse): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    throw new BffError(
      response.status,
      (data as { error?: string }).error ?? 'UNKNOWN',
      (data as { message?: string }).message ?? `HTTP ${response.status}`,
    );
  }
  return data as T;
}

export const mockBff: BffClient = {
  targetSources: {
    get: async (id) => {
      const projectId = resolveProjectId(id);
      const res = await mockTargetSources.get(projectId);
      const data = await unwrap<{ targetSource: Project }>(res);
      return data.targetSource;
    },

    secrets: async (id) => {
      const projectId = resolveProjectId(id);
      const res = await mockProjects.credentials(projectId);
      const data = await unwrap<{
        credentials: Array<{ name: string; databaseType?: string; createdAt: string }>;
      }>(res);
      return data.credentials.map((c): SecretKey => ({
        name: c.name,
        createTimeStr: c.createdAt,
      }));
    },
  },

  users: {
    me: async () => {
      const res = await mockUsers.getMe();
      const data = await unwrap<{ user: CurrentUser }>(res);
      return data.user;
    },
  },
};
