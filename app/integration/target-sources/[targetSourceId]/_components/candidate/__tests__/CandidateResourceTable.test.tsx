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

  it('renders the 스캔 상태 column with 신규/변경 tags reflecting scanStatus', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[
          candidateFixture({ id: 'c-new', resourceId: 'res-new', scanStatus: 'NEW_SCAN' }),
          candidateFixture({ id: 'c-changed', resourceId: 'res-changed', scanStatus: 'UNCHANGED' }),
        ]}
      />,
    );
    expect(screen.getByRole('columnheader', { name: '스캔 상태' })).toBeTruthy();
    expect(screen.getByText('신규')).toBeTruthy();
    expect(screen.getByText('변경')).toBeTruthy();
  });

  it('renders — in the 스캔 상태 cell when scanStatus is absent', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[candidateFixture({ scanStatus: undefined })]}
      />,
    );
    expect(screen.queryByText('신규')).toBeNull();
    expect(screen.queryByText('변경')).toBeNull();
  });

  it('renders a hover-revealed CopyButton on each Resource ID cell', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[candidateFixture({ resourceId: 'res-1' })]}
      />,
    );
    const button = screen.getByRole('button', { name: 'Resource ID 복사' });
    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('group-hover/resid:opacity-100');
  });

  it('does not render a pagination row, and shows every candidate (v16 cloud step-1 has no pager)', () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      candidateFixture({ id: `c-${i}`, resourceId: `res-${i}` }),
    );
    render(<CandidateResourceTable {...defaultProps} candidates={many} />);
    // No page-size selector → no pagination row at all.
    expect(screen.queryByLabelText('페이지당 표시 건수')).toBeNull();
    // All 12 rows render (no 10-per-page slicing).
    expect(screen.getAllByRole('button', { name: 'Resource ID 복사' })).toHaveLength(12);
    // Count + approve footer stays intact.
    expect(screen.getByRole('button', { name: '연동 대상 승인 요청' })).toBeTruthy();
  });
});
