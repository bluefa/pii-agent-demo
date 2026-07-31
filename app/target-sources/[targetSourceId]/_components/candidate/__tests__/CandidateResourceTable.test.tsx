// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import type { CandidateResource } from '@/lib/types/resources';
import { CandidateResourceTable } from '@/app/target-sources/[targetSourceId]/_components/candidate/CandidateResourceTable';

const candidateFixture = (overrides: Partial<CandidateResource> = {}): CandidateResource =>
  ({
    id: 'c-1',
    resourceId: 'res-1',
    resourceName: 'res-1',
    type: 'RDS',
    databaseType: 'MYSQL',
    integrationCategory: 'TARGET',
    behaviorKey: 'default',
    selected: false,
    exclusionReason: null,
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
  exclusionReasons: {},
  drafts: { endpointDrafts: {} },
  expandedResourceId: null,
  readonly: false,
  actions: {
    toggleSelected: () => {},
    reasonChipClick: () => {},
    expandToggle: () => {},
    endpointSave: () => {},
  },
};

describe('CandidateResourceTable', () => {
  it('renders the step-2·3 column order: identity → attributes → scan diff → reason', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    const headers = screen.getAllByRole('columnheader').map((th) => th.textContent);
    expect(headers).toEqual([
      '', // checkbox column
      'Resource Name',
      'Resource ID',
      'Database Type',
      'Region',
      '스캔 상태',
      '제외 사유',
    ]);
  });

  it('does not render the 스캔 이력 column (dropped per prototype)', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    expect(screen.queryByRole('columnheader', { name: '스캔 이력' })).toBeNull();
  });

  // The checkbox IS the verdict — the 대상/비대상 badge column and the always-empty
  // 연동 완료 여부 column were deleted in the step-2·3 grammar port.
  it('renders no verdict badge column and no 연동 완료 여부 column', () => {
    render(<CandidateResourceTable {...defaultProps} />);
    expect(screen.queryByRole('columnheader', { name: '연동 대상 여부' })).toBeNull();
    expect(screen.queryByRole('columnheader', { name: '연동 완료 여부' })).toBeNull();
    expect(screen.queryByText('대상')).toBeNull();
  });

  // Unchecked rows rest one tier dimmer (#6B7280 on the row tint, AA with margin);
  // checked rows keep full contrast. Mirrors WaitingApprovalTable's excluded-row rule.
  it('dims unselected-row text and keeps selected rows at full contrast', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[
          candidateFixture({ id: 'c-sel', resourceId: 'res-sel' }),
          candidateFixture({ id: 'c-exc', resourceId: 'res-exc' }),
        ]}
        selectedIds={new Set(['c-sel'])}
      />,
    );
    const rows = screen.getAllByRole('row').slice(1);
    const selectedCells = rows[0].querySelectorAll('td');
    const excludedCells = rows[1].querySelectorAll('td');
    // Name cell is index 1 (after the checkbox cell).
    expect(selectedCells[1].className).not.toContain('text-[#6B7280]');
    expect(excludedCells[1].className).toContain('text-[#6B7280]');
    expect(excludedCells[3].className).toContain('text-[#6B7280]');
    expect(excludedCells[4].className).toContain('text-[#6B7280]');
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

  // A server-seeded unselected TARGET without a reason must expose a direct entry
  // point to the reason picker — approval is blocked until a reason exists.
  it('renders a 사유 입력 entry point for an unselected TARGET without a reason', () => {
    const reasonChipClick = vi.fn();
    render(
      <CandidateResourceTable
        {...defaultProps}
        actions={{ ...defaultProps.actions, reasonChipClick }}
      />,
    );
    const entry = screen.getByRole('button', { name: '제외 사유 입력' });
    fireEvent.click(entry);
    expect(reasonChipClick).toHaveBeenCalledWith('c-1', expect.any(HTMLElement));
  });

  it('does not render the 사유 입력 entry point for selected or non-TARGET rows', () => {
    render(
      <CandidateResourceTable
        {...defaultProps}
        candidates={[
          candidateFixture({ id: 'c-sel', resourceId: 'res-sel' }),
          candidateFixture({ id: 'c-inel', resourceId: 'res-inel', integrationCategory: 'INSTALL_INELIGIBLE' }),
        ]}
        selectedIds={new Set(['c-sel'])}
      />,
    );
    expect(screen.queryByRole('button', { name: '제외 사유 입력' })).toBeNull();
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
    // The approve CTA lives in CandidateResourceSection's CardActionBar now (C-2).
    expect(screen.queryByRole('button', { name: '연동 대상 승인 요청' })).toBeNull();
  });
});
