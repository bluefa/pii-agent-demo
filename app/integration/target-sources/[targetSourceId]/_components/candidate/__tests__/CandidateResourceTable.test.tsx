// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { CandidateResource } from '@/lib/types/resources';
import { CandidateResourceTable } from '@/app/integration/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable';

const candidateFixture = (overrides: Partial<CandidateResource> = {}): CandidateResource =>
  ({
    id: 'c-1',
    resourceId: 'res-1',
    type: 'RDS',
    databaseType: 'MYSQL',
    integrationCategory: 'TARGET',
    behaviorKey: 'default',
    metadata: {
      provider: 'AWS',
      resourceType: 'RDS',
      region: 'ap-northeast-2',
    },
    ...overrides,
  }) satisfies CandidateResource;

const defaultProps = {
  candidates: [candidateFixture()],
  selectedIds: new Set<string>(),
  drafts: { endpointDrafts: {} },
  expandedResourceId: null,
  readonly: false,
  approvalSubmitting: false,
  onToggleSelected: () => {},
  onExpandToggle: () => {},
  onEndpointSave: () => {},
  onRequestApproval: () => {},
};

describe('CandidateResourceTable', () => {
  it('renders column headers matching the prototype', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    expect(screen.getByRole('columnheader', { name: 'Database Type' })).toBeTruthy();
    expect(screen.getByRole('columnheader', { name: 'Resource Name' })).toBeTruthy();
  });

  it('does not render the 스캔 이력 column (dropped per prototype)', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    expect(screen.queryByRole('columnheader', { name: '스캔 이력' })).toBeNull();
  });

  it('renders a hover-revealed CopyButton on each Resource ID cell', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[candidateFixture({ resourceId: 'res-1' })]}
      />,
    );
    const button = screen.getByRole('button', { name: 'res-1 복사' });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover:opacity-100');
  });
});
