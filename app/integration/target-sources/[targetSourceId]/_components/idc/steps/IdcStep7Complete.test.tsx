// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/integration/target-sources/[targetSourceId]/_components/common';

// Stub the heavy chrome / fetching children so only IdcStep7Complete's own card renders.
vi.mock('@/app/integration/target-sources/[targetSourceId]/_components/common', () => ({
  ProjectPageMeta: () => null,
  RejectionAlert: () => null,
}));
vi.mock('@/app/components/features/ProcessStatusCard', () => ({
  ProcessStatusCard: () => null,
}));
vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => null,
}));
vi.mock('@/app/components/features/process-status/GuideCard/resolve-step-slot', () => ({
  resolveStepSlot: () => null,
}));
vi.mock('@/app/integration/target-sources/[targetSourceId]/_components/idc/IdcResourceTable', () => ({
  IdcResourceTable: () => null,
}));
vi.mock('@/app/hooks/useIdcResources', () => ({
  useIdcResources: () => ({ state: { status: 'ready', resources: [] } }),
}));
vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ info: vi.fn() }),
}));

import { IdcStep7Complete } from '@/app/integration/target-sources/[targetSourceId]/_components/idc/steps/IdcStep7Complete';

const project: CloudTargetSource = {
  id: 'idc-1',
  targetSourceId: 1020,
  projectCode: 'IDC-025',
  serviceCode: 'SERVICE-A',
  processStatus: ProcessStatus.INSTALLATION_COMPLETE,
  createdAt: '2026-01-20T09:00:00Z',
  updatedAt: '2026-01-25T14:00:00Z',
  name: 'IDC Platform',
  description: 'desc',
  isRejected: false,
  cloudProvider: 'IDC',
};

const identity: ProjectIdentity = {
  cloudProvider: 'IDC',
  monitoringMethod: 'IDC Agent',
  jiraLink: null,
  identifiers: [],
};

describe('IdcStep7Complete subtitle copy', () => {
  it('uses the IDC subtitle variant (no "사용 단어 빈도" cloud clause)', () => {
    render(
      <IdcStep7Complete
        project={project}
        identity={identity}
        providerLabel="IDC Infrastructure"
        action={null}
        onProjectUpdate={() => {}}
      />,
    );
    expect(
      screen.getByText(
        'PII가 사용되어 있을 가능성이 있어요. 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText(/사용 단어 빈도가 표시되며/)).toBeNull();
  });
});
