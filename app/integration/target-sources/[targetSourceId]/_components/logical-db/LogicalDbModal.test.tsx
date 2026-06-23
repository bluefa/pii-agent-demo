// @vitest-environment jsdom
import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LogicalDbModal } from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModal';
import type {
  LogicalDatabase,
  LogicalDbModalDraft,
} from '@/app/integration/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

const databases: LogicalDatabase[] = [
  { id: 'srv.db_alpha', name: 'db_alpha', type: 'db', database: 'db_alpha' },
  {
    id: 'srv.db_bravo',
    name: 'db_bravo.public',
    type: 'schema',
    database: 'db_bravo',
    schema: 'public',
  },
  { id: 'srv.db_charlie', name: 'db_charlie', type: 'db', database: 'db_charlie' },
];

const renderModal = (overrides: Partial<React.ComponentProps<typeof LogicalDbModal>> = {}) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <LogicalDbModal
      open
      resourceName="srv-prod-01"
      databases={databases}
      onSave={onSave}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...result, onSave, onClose };
};

const getPanel = (label: string): HTMLElement => {
  // Each panel header text uniquely identifies its container.
  const heading = screen.getByText(label);
  const panel = heading.closest('div.flex.flex-col');
  if (!panel) throw new Error(`Panel container not found for ${label}`);
  return panel as HTMLElement;
};

describe('LogicalDbModal', () => {
  it('renders both panel labels with counts', () => {
    renderModal();
    expect(screen.getByText('연동 대상 후보')).toBeTruthy();
    expect(screen.getByText('연동 제외 후보')).toBeTruthy();
    const panelA = getPanel('연동 대상 후보');
    expect(within(panelA).getByText('3개')).toBeTruthy();
    const panelB = getPanel('연동 제외 후보');
    expect(within(panelB).getByText('0개')).toBeTruthy();
  });

  it('renders Type / Database / Schema columns for each logical DB', () => {
    renderModal();
    const panelA = getPanel('연동 대상 후보');
    // column headers
    expect(within(panelA).getAllByText('Type').length).toBeGreaterThan(0);
    expect(within(panelA).getAllByText('Database').length).toBeGreaterThan(0);
    expect(within(panelA).getAllByText('Schema').length).toBeGreaterThan(0);
    // a database row shows its type pill + database name
    const dbRow = within(panelA).getByText('db_alpha').closest('tr') as HTMLElement;
    expect(within(dbRow).getByText('Database')).toBeTruthy();
    // a schema row shows the Schema pill, database, and schema name
    const schemaRow = within(panelA).getByText('db_bravo').closest('tr') as HTMLElement;
    expect(within(schemaRow).getByText('Schema')).toBeTruthy();
    expect(within(schemaRow).getByText('public')).toBeTruthy();
  });

  it('moves an item from Panel A to Panel B when 제외 is clicked', () => {
    renderModal();
    const panelA = getPanel('연동 대상 후보');
    const excludeButtons = within(panelA).getAllByRole('button', { name: '제외' });
    fireEvent.click(excludeButtons[0]);

    const updatedPanelA = getPanel('연동 대상 후보');
    expect(within(updatedPanelA).getByText('2개')).toBeTruthy();
    const updatedPanelB = getPanel('연동 제외 후보');
    expect(within(updatedPanelB).getByText('1개')).toBeTruthy();
    expect(within(updatedPanelB).getByText('db_alpha')).toBeTruthy();
  });

  it('moves an item back from Panel B to Panel A when 복원 is clicked', () => {
    const initialDraft: LogicalDbModalDraft = {
      excludedIds: new Set(['srv.db_alpha']),
      reasons: {},
    };
    renderModal({ initialDraft });

    const panelB = getPanel('연동 제외 후보');
    expect(within(panelB).getByText('db_alpha')).toBeTruthy();
    const restoreButton = within(panelB).getByRole('button', { name: '복원' });
    fireEvent.click(restoreButton);

    const updatedPanelA = getPanel('연동 대상 후보');
    expect(within(updatedPanelA).getByText('db_alpha')).toBeTruthy();
    const updatedPanelB = getPanel('연동 제외 후보');
    expect(within(updatedPanelB).getByText('0개')).toBeTruthy();
  });

  it('filters items in the targeted panel using the search input', () => {
    renderModal();
    const panelA = getPanel('연동 대상 후보');
    const searchInput = within(panelA).getByPlaceholderText('Database / Schema 검색');
    fireEvent.change(searchInput, { target: { value: 'bravo' } });

    expect(within(panelA).getByText('db_bravo')).toBeTruthy();
    expect(within(panelA).queryByText('db_alpha')).toBeNull();
    expect(within(panelA).queryByText('db_charlie')).toBeNull();
  });

  it('disables save when there are no pending changes', () => {
    renderModal();
    const saveButton = screen.getByRole('button', { name: '저장' }) as HTMLButtonElement;
    expect(saveButton.disabled).toBe(true);
  });

  it('calls onSave with the final draft when 저장 is clicked', () => {
    const { onSave } = renderModal();
    const panelA = getPanel('연동 대상 후보');
    const excludeButtons = within(panelA).getAllByRole('button', { name: '제외' });
    fireEvent.click(excludeButtons[0]);

    const saveButton = screen.getByRole('button', { name: '저장' });
    fireEvent.click(saveButton);

    expect(onSave).toHaveBeenCalledTimes(1);
    const draft = onSave.mock.calls[0][0] as LogicalDbModalDraft;
    expect(Array.from(draft.excludedIds)).toEqual(['srv.db_alpha']);
  });

  it('respects the initial draft on mount', () => {
    const initialDraft: LogicalDbModalDraft = {
      excludedIds: new Set(['srv.db_bravo', 'srv.db_charlie']),
      reasons: {},
    };
    renderModal({ initialDraft });
    const panelA = getPanel('연동 대상 후보');
    expect(within(panelA).getByText('1개')).toBeTruthy();
    expect(within(panelA).getByText('db_alpha')).toBeTruthy();
    const panelB = getPanel('연동 제외 후보');
    expect(within(panelB).getByText('2개')).toBeTruthy();
  });

  it('shows the pending-change footer values for added and removed items', () => {
    const initialDraft: LogicalDbModalDraft = {
      excludedIds: new Set(['srv.db_alpha']),
      reasons: {},
    };
    renderModal({ initialDraft });

    // restore db_alpha → removed=1
    const panelB = getPanel('연동 제외 후보');
    fireEvent.click(within(panelB).getByRole('button', { name: '복원' }));

    // exclude db_bravo → added=1
    const panelA = getPanel('연동 대상 후보');
    const bravoRow = within(panelA).getByText('db_bravo').closest('tr');
    if (!bravoRow) throw new Error('bravo row missing');
    fireEvent.click(within(bravoRow as HTMLElement).getByRole('button', { name: '제외' }));

    // Footer should render exact literals: 변경사항 2건 · 추가 1 · 제거 1.
    // Assert each segment explicitly so a regression to approximate
    // set-math (e.g. |added - removed| or added * removed) cannot pass.
    const footerText = (
      screen.getByText(/변경사항/).textContent ?? ''
    ).replace(/\s+/g, ' ').trim();
    expect(footerText).toContain('변경사항 2건');
    expect(footerText).toContain('추가 1');
    expect(footerText).toContain('제거 1');
  });

  it('does not crash when databases is empty', () => {
    renderModal({ databases: [] });
    const panelA = getPanel('연동 대상 후보');
    expect(within(panelA).getByText('0개')).toBeTruthy();
    expect(within(panelA).getByText('조건에 맞는 결과가 없어요.')).toBeTruthy();
  });
});
