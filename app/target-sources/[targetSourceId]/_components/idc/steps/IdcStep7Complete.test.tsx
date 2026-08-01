// @vitest-environment jsdom
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProcessStatus, type CloudTargetSource } from '@/lib/types';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common';

// Stub the heavy chrome / fetching children so only IdcStep7Complete's own card renders.
// CardActionBar keeps a passthrough render so the rewind CTAs stay queryable.
vi.mock('@/app/target-sources/[targetSourceId]/_components/common', () => ({
  ProjectPageMeta: () => null,
  RejectionAlert: () => null,
  CardActionBar: ({ hint, children }: { hint?: ReactNode; children: ReactNode }) => (
    <div>
      {hint}
      {children}
    </div>
  ),
}));
vi.mock(
  '@/app/target-sources/[targetSourceId]/_components/idc/IdcConfirmedResourcesPanel',
  () => ({
    IdcConfirmedResourcesPanel: () => null,
  }),
);
vi.mock('@/app/hooks/useIdcResources', () => ({
  useIdcResources: () => ({ state: { status: 'ready', resources: [] } }),
}));
vi.mock('@/app/components/ui/toast', () => ({
  useToast: () => ({ info: vi.fn() }),
}));

import { IdcStep7Complete } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep7Complete';

const project: CloudTargetSource = {
  id: 'idc-1',
  targetSourceId: 1020,
  projectCode: 'IDC-025',
  serviceCode: 'SERVICE-A',
  serviceName: 'Service A',
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
  jiraLink: null,
  identifiers: [],
};

const renderStep = () =>
  render(
    <IdcStep7Complete
      project={project}
      identity={identity}
      providerLabel="IDC Infrastructure"
      action={null}
      onProjectUpdate={() => {}}
    />,
  );

describe('IdcStep7Complete', () => {
  it('renders the step tag, the title and the 연동 완료 badge', () => {
    renderStep();
    expect(screen.getByText('7번째 단계')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 2, name: 'PII 모니터링 모듈 연동' })).toBeTruthy();
    expect(screen.getByText('연동 완료')).toBeTruthy();
  });

  it('uses the IDC guidance variant (no "사용 단어 빈도" cloud clause)', () => {
    renderStep();
    expect(
      screen.getByText(/연동된 리소스에서 PII 사용 가능성을 모니터링하고 있어요/),
    ).toBeTruthy();
    expect(screen.queryByText(/사용 단어 빈도가 표시되며|사용 단어 빈도가 표시돼요/)).toBeNull();
  });

  it('docks both rewind CTAs in the bottom action bar', () => {
    renderStep();
    expect(screen.getByRole('button', { name: /인프라 변경/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /연결 테스트 재실행/ })).toBeTruthy();
    expect(screen.getByText(/1단계, 연결 테스트 재실행은 5단계로 되돌아가/)).toBeTruthy();
  });
});
