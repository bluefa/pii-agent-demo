// @vitest-environment jsdom
import { render, screen, within, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LogicalDbModal } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModal';
import type {
  LogicalDatabase,
  LogicalDbModalDraft,
} from '@/app/target-sources/[targetSourceId]/_components/logical-db/logical-db-types';

/**
 * PG-shaped fixture (Schema-unit): schemas grouped under `live` (virtual parent),
 * `prd` saved-excluded at DATABASE scope, `legacy` policy-only (untested).
 */
const pgDatabases: LogicalDatabase[] = [
  { id: 'live', name: 'live', type: 'db', database: 'live', virtual: true },
  { id: 'live.public', name: 'live.public', type: 'schema', database: 'live', schema: 'public' },
  { id: 'live.analytics', name: 'live.analytics', type: 'schema', database: 'live', schema: 'analytics' },
  { id: 'prd', name: 'prd', type: 'db', database: 'prd', existingDenyReason: 'TEMP' },
  { id: 'prd.main', name: 'prd.main', type: 'schema', database: 'prd', schema: 'main' },
  { id: 'legacy', name: 'legacy', type: 'db', database: 'legacy', existingDenyReason: 'TEMP', untested: true },
];

const pgDraft: LogicalDbModalDraft = {
  excludedIds: new Set(['prd', 'legacy']),
  reasons: { prd: 'TEMP', legacy: 'TEMP' },
};

const mysqlDatabases: LogicalDatabase[] = [
  { id: 'live', name: 'live', type: 'db', database: 'live' },
  { id: 'reporting', name: 'reporting', type: 'db', database: 'reporting' },
];

const renderModal = (overrides: Partial<React.ComponentProps<typeof LogicalDbModal>> = {}) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <LogicalDbModal
      open
      resourceName="pg-cluster-prod-01"
      databases={pgDatabases}
      initialDraft={pgDraft}
      onSave={onSave}
      onClose={onClose}
      {...overrides}
    />,
  );
  return { ...result, onSave, onClose };
};

const rowOf = (name: string): HTMLElement => {
  const el = screen.getByTitle(name);
  const row = el.closest('div.relative');
  if (!row) throw new Error(`row not found for ${name}`);
  return row as HTMLElement;
};

describe('LogicalDbModal (tree redesign)', () => {
  it('renders the title, unit chip, and full-set counts', () => {
    renderModal();
    expect(screen.getByText('논리 DB 목록')).toBeTruthy();
    expect(screen.getByText('Schema 단위 조회')).toBeTruthy();
    // 6 entries total; prd(deny) + prd.main(inherited) + legacy(deny) are 제외.
    expect(screen.getByRole('button', { name: '전체 6' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '수집 대상 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '제외 3' })).toBeTruthy();
  });

  it('flat MySQL list shows the Database-unit chip and no chevrons', () => {
    renderModal({ databases: mysqlDatabases, initialDraft: undefined });
    expect(screen.getByText('Database 단위 조회')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /펼치기|접기/ })).toBeNull();
  });

  it('excluding a schema asks for a reason, then stages the change', () => {
    const { onSave } = renderModal();
    const row = rowOf('live.public');
    fireEvent.click(within(row).getByRole('button', { name: '제외' }));

    // Reason popover with Korean labels + enum.
    expect(screen.getByText('제외 사유')).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /개발용/ }));
    fireEvent.click(screen.getByRole('button', { name: '제외 (저장 전에 추가)' }));

    const stagedRow = rowOf('live.public');
    expect(within(stagedRow).getByText('저장 전')).toBeTruthy();
    expect(within(stagedRow).getByText(/Schema 제외 예정 · 사유: 개발용/)).toBeTruthy();
    // Footer diff names the change; save becomes possible.
    expect(screen.getByText(/저장 전 변경 1건/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const draft = onSave.mock.calls[0][0] as LogicalDbModalDraft;
    expect(draft.excludedIds.has('live.public')).toBe(true);
    expect(draft.reasons['live.public']).toBe('DEV');
  });

  it('a DATABASE exclusion absorbs schema-level entries and renders children inherited', () => {
    const { onSave } = renderModal({
      initialDraft: {
        excludedIds: new Set(['live.analytics']),
        reasons: { 'live.analytics': 'DEV' },
      },
    });
    const liveRow = rowOf('live');
    fireEvent.click(within(liveRow).getByRole('button', { name: '제외' }));
    // The popover warns about the merge before it happens.
    expect(screen.getByText(/기존 Schema 제외 1건은 Database 제외로 합쳐져요/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '제외 (저장 전에 추가)' }));

    // Children are inherited, with no per-row action.
    const childRow = rowOf('live.public');
    expect(within(childRow).getByText('↳ 상위 Database 제외에 포함')).toBeTruthy();
    expect(within(childRow).queryByRole('button')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const draft = onSave.mock.calls[0][0] as LogicalDbModalDraft;
    expect(draft.excludedIds.has('live')).toBe(true);
    expect(draft.excludedIds.has('live.analytics')).toBe(false);
    expect(draft.reasons['live.analytics']).toBeUndefined();
  });

  it('restore stages, undo returns to the saved exclusion', () => {
    renderModal();
    const prdRow = rowOf('prd');
    expect(within(prdRow).getByText(/Database 제외 · 하위 Schema 포함 · 사유: 임시/)).toBeTruthy();
    fireEvent.click(within(prdRow).getByRole('button', { name: '복원' }));

    const stagedRow = rowOf('prd');
    expect(within(stagedRow).getByText(/복원 예정/)).toBeTruthy();
    fireEvent.click(within(stagedRow).getByRole('button', { name: '실행 취소' }));
    expect(within(rowOf('prd')).getByRole('button', { name: '복원' })).toBeTruthy();
  });

  it('policy-only entries read as 미조회, neutrally, and stay restorable', () => {
    renderModal();
    const legacyRow = rowOf('legacy');
    expect(within(legacyRow).getByText(/이번 테스트 미조회/)).toBeTruthy();
    expect(within(legacyRow).getByRole('button', { name: '복원' })).toBeTruthy();
  });

  it('the 제외 filter narrows to denyish rows only', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: '제외 3' }));
    expect(screen.queryByTitle('live.public')).toBeNull();
    expect(screen.getByTitle('prd')).toBeTruthy();
    expect(screen.getByTitle('legacy')).toBeTruthy();
  });

  it('search matches schema names and keeps the group header visible', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox', { name: '논리 DB 검색' }), {
      target: { value: 'analytics' },
    });
    expect(screen.getByTitle('live')).toBeTruthy();
    expect(screen.getByTitle('live.analytics')).toBeTruthy();
    expect(screen.queryByTitle('live.public')).toBeNull();
    expect(screen.queryByTitle('prd')).toBeNull();
  });

  it('staged changes surface the re-test warning; a clean draft disables save', () => {
    renderModal();
    expect(screen.queryByText(/저장하면 연결 테스트를 다시 실행해야 해요/)).toBeNull();
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(true);

    const row = rowOf('live.public');
    fireEvent.click(within(row).getByRole('button', { name: '제외' }));
    fireEvent.click(screen.getByRole('button', { name: '제외 (저장 전에 추가)' }));
    expect(screen.getByText(/저장하면 연결 테스트를 다시 실행해야 해요/)).toBeTruthy();
    expect((screen.getByRole('button', { name: '저장' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('되돌리기 resets every staged change', () => {
    renderModal();
    const row = rowOf('live.public');
    fireEvent.click(within(row).getByRole('button', { name: '제외' }));
    fireEvent.click(screen.getByRole('button', { name: '제외 (저장 전에 추가)' }));
    fireEvent.click(screen.getByRole('button', { name: '되돌리기' }));
    expect(screen.getByText('변경 없음')).toBeTruthy();
    expect(within(rowOf('live.public')).getByRole('button', { name: '제외' })).toBeTruthy();
  });

  it('collapsing a database hides its schema rows', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'live 접기' }));
    expect(screen.queryByTitle('live.public')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'live 펼치기' }));
    expect(screen.getByTitle('live.public')).toBeTruthy();
  });
});
