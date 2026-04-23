import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project, SecretKey } from '@/lib/types';

const { getTargetSourceMock, getSecretsMock, getCurrentUserMock } = vi.hoisted(() => ({
  getTargetSourceMock: vi.fn(),
  getSecretsMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@/lib/bff/client', () => ({
  bff: {
    targetSources: {
      get: getTargetSourceMock,
      secrets: getSecretsMock,
    },
    users: {
      me: getCurrentUserMock,
    },
  },
}));

vi.mock('@/app/projects/[targetSourceId]/ProjectDetail', () => ({
  ProjectDetail: () => null,
}));

vi.mock('@/app/projects/[targetSourceId]/common', () => ({
  ErrorState: () => null,
}));

import ProjectDetailPage from '@/app/integration/projects/[targetSourceId]/page';

describe('GET /integration/projects/[targetSourceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('current user 조회 없이 프로젝트와 credential만 전달한다', async () => {
    const project = { targetSourceId: 321 } as unknown as Project;
    const credentials = [] as SecretKey[];

    getTargetSourceMock.mockResolvedValue(project);
    getSecretsMock.mockResolvedValue(credentials);

    const element = await ProjectDetailPage({
      params: Promise.resolve({ targetSourceId: '321' }),
    }) as ReactElement<{
      initialProject: Project;
      initialCredentials: SecretKey[];
    }>;

    expect(getTargetSourceMock).toHaveBeenCalledWith(321);
    expect(getSecretsMock).toHaveBeenCalledWith(321);
    expect(getCurrentUserMock).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({
      initialProject: project,
      initialCredentials: credentials,
    });
    expect(element.props).not.toHaveProperty('initialUser');
  });
});
