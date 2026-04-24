import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Project } from '@/lib/types';

const { getTargetSourceMock, getCurrentUserMock } = vi.hoisted(() => ({
  getTargetSourceMock: vi.fn(),
  getCurrentUserMock: vi.fn(),
}));

vi.mock('@/lib/bff/client', () => ({
  bff: {
    targetSources: {
      get: getTargetSourceMock,
    },
    users: {
      me: getCurrentUserMock,
    },
  },
}));

vi.mock('@/app/integration/target-sources/[targetSourceId]/_components/ProjectDetail', () => ({
  ProjectDetail: () => null,
}));

vi.mock('@/app/integration/target-sources/[targetSourceId]/_components/common', () => ({
  ErrorState: () => null,
}));

import ProjectDetailPage from '@/app/integration/target-sources/[targetSourceId]/page';

describe('GET /integration/target-sources/[targetSourceId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('current user 조회 없이 프로젝트만 전달한다', async () => {
    const project = { targetSourceId: 321 } as unknown as Project;

    getTargetSourceMock.mockResolvedValue(project);

    const element = await ProjectDetailPage({
      params: Promise.resolve({ targetSourceId: '321' }),
    }) as ReactElement<{
      initialProject: Project;
    }>;

    expect(getTargetSourceMock).toHaveBeenCalledWith(321);
    expect(getCurrentUserMock).not.toHaveBeenCalled();
    expect(element.props).toMatchObject({
      initialProject: project,
    });
    expect(element.props).not.toHaveProperty('initialUser');
    expect(element.props).not.toHaveProperty('initialCredentials');
  });
});
