// @vitest-environment jsdom
import { render, screen, within, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LogicalDbModal } from '@/app/target-sources/[targetSourceId]/_components/logical-db/LogicalDbModal';
import { logicalDbStyles } from '@/lib/theme';
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

/** partial 상태가 넘기는 것 — 정책 행만, 전부 미조회. 판정할 조회 결과가 없다. */
const policyOnly: LogicalDatabase[] = [
  { id: 'legacy', name: 'legacy', type: 'db', database: 'legacy', existingDenyReason: 'TEMP', untested: true },
];
const policyOnlyDraft: LogicalDbModalDraft = {
  excludedIds: new Set(['legacy']),
  reasons: { legacy: 'TEMP' },
};

const mysqlDatabases: LogicalDatabase[] = [
  { id: 'live', name: 'live', type: 'db', database: 'live' },
  { id: 'reporting', name: 'reporting', type: 'db', database: 'reporting' },
];

/** 3h before the render, so the provenance line reads a stable '3시간 전'. */
const COMPLETED_AT = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString();

type ModalProps = React.ComponentProps<typeof LogicalDbModal>;

const renderModal = (overrides: Partial<ModalProps> = {}) => {
  const onSave = vi.fn();
  const onClose = vi.fn();
  const props: ModalProps = {
    open: true,
    resourceId: 'arn:aws:rds:ap-northeast-2:123456789012:cluster:pg-cluster-prod-01',
    resourceName: 'pg-cluster-prod-01',
    completedAt: COMPLETED_AT,
    databases: pgDatabases,
    initialDraft: pgDraft,
    onSave,
    onClose,
    ...overrides,
  };
  const result = render(<LogicalDbModal {...props} />);
  /** Same instance, new props — the draft state has to survive for the ledger to exist. */
  const rerenderWith = (next: Partial<ModalProps>): void => {
    result.rerender(<LogicalDbModal {...props} {...next} />);
  };
  return { ...result, onSave, onClose, rerenderWith };
};

/**
 * The ⓘ trigger's wrapper owns the reveal handler, so hover it, not the button. The popover
 * commits its measured coords in a microtask, so the hover is flushed inside `act`.
 */
const openUnitTip = async (): Promise<void> => {
  const trigger = screen.getByLabelText('논리 DB 조회·제외 안내');
  await act(async () => {
    fireEvent.mouseEnter(trigger.parentElement as HTMLElement);
  });
};

/** The list is a `ConsoleTable` now — a row is a `<tr>`, not a flex div. */
const rowOf = (name: string): HTMLElement => {
  const el = screen.getByTitle(name);
  const row = el.closest('tr');
  if (!row) throw new Error(`row not found for ${name}`);
  return row as HTMLElement;
};

describe('LogicalDbModal (tree redesign)', () => {
  it('renders the title, unit chip, and full-set counts', () => {
    renderModal();
    expect(screen.getByText('논리 DB 관리')).toBeTruthy();
    expect(screen.getByText('Schema 단위 조회')).toBeTruthy();
    // The old hardcoded verdict chip read no verdict — it is gone.
    expect(screen.queryByText('연결 테스트 성공')).toBeNull();
    // 6 entries total; prd(deny) + prd.main(inherited) + legacy(deny) are 제외.
    expect(screen.getByRole('button', { name: '전체 6' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '수집 대상 3' })).toBeTruthy();
    expect(screen.getByRole('button', { name: '제외 3' })).toBeTruthy();
  });

  it('names the run the list came from, in relative time', () => {
    renderModal();
    expect(screen.getByText(/연결 테스트 완료 · 3시간 전/)).toBeTruthy();
  });

  it('omits the provenance line when no run completion time is known', () => {
    renderModal({ completedAt: null });
    expect(screen.queryByText(/연결 테스트 완료/)).toBeNull();
  });

  it('heads the resource with a Name + ID stack, each copyable', () => {
    renderModal();
    expect(screen.getByText('Resource Name')).toBeTruthy();
    expect(screen.getByText('Resource ID')).toBeTruthy();
    expect(
      screen.getByText('arn:aws:rds:ap-northeast-2:123456789012:cluster:pg-cluster-prod-01'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resource ID 복사' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resource Name 복사' })).toBeTruthy();
  });

  it('운영자가 넘긴 엔진은 머리에 배지로 선다; 안 넘기면 배지도 없다', () => {
    const view = renderModal({ databaseType: 'RDS_CLUSTER' });
    expect(screen.getByText('MySQL')).toBeTruthy();
    view.unmount();
    renderModal();
    expect(screen.queryByText('MySQL')).toBeNull();
  });

  it('the ID row stands alone when the resource has no name', () => {
    renderModal({ resourceName: '' });
    expect(screen.queryByText('Resource Name')).toBeNull();
    expect(screen.getByText('Resource ID')).toBeTruthy();
  });

  it('keeps one purpose sentence visible and the exclusion rules behind the ⓘ', async () => {
    renderModal();
    expect(screen.getByText('조회된 논리 DB를 확인하고, 수집에서 제외할 DB를 골라요.')).toBeTruthy();
    expect(screen.queryByText(/제외 목록에는 계속 남아 복원할 수 있어요/)).toBeNull();

    await openUnitTip();
    expect(
      screen.getByText(/Database 행에서 제외하면 하위 Schema까지/),
    ).toBeTruthy();
    expect(screen.getByText(/제외 목록에는 계속 남아 복원할 수 있어요/)).toBeTruthy();
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

    // Reason popover with Korean labels + enum. The column header carries the same
    // words, so name the popover by its own fieldset.
    expect(screen.getByRole('group', { name: '제외 사유 선택' })).toBeTruthy();
    fireEvent.click(screen.getByRole('radio', { name: /개발용/ }));
    fireEvent.click(screen.getByRole('button', { name: '제외 (저장 전에 추가)' }));

    const stagedRow = rowOf('live.public');
    // 상태 열은 점 + 낱말, 사유는 자기 열에 선다 — 잘린 문장의 꼬리가 아니다.
    expect(within(stagedRow).getByText('제외 · 저장 전')).toBeTruthy();
    expect(within(stagedRow).getByText('개발용')).toBeTruthy();
    expect(within(stagedRow).getByText('Schema')).toBeTruthy();
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

    // An inherited child names the ANCESTOR and keeps a control that acts on it.
    const childRow = rowOf('live.public');
    expect(within(childRow).getByText('제외 · live')).toBeTruthy();
    expect(within(childRow).getByRole('button', { name: '상위에서 복원' })).toBeTruthy();
    expect(within(childRow).queryByText('↳ 상위 Database 제외에 포함')).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const draft = onSave.mock.calls[0][0] as LogicalDbModalDraft;
    expect(draft.excludedIds.has('live')).toBe(true);
    expect(draft.excludedIds.has('live.analytics')).toBe(false);
    expect(draft.reasons['live.analytics']).toBeUndefined();
  });

  it('restore stages, undo returns to the saved exclusion', () => {
    renderModal();
    const prdRow = rowOf('prd');
    expect(within(prdRow).getByText('제외')).toBeTruthy();
    expect(within(prdRow).getByText('임시')).toBeTruthy();
    fireEvent.click(within(prdRow).getByRole('button', { name: '복원' }));

    const stagedRow = rowOf('prd');
    expect(within(stagedRow).getByText('복원 · 저장 전')).toBeTruthy();
    fireEvent.click(within(stagedRow).getByRole('button', { name: '실행 취소' }));
    expect(within(rowOf('prd')).getByRole('button', { name: '복원' })).toBeTruthy();
  });

  it('policy-only entries read as 미조회, neutrally, and stay restorable', () => {
    renderModal();
    const legacyRow = rowOf('legacy');
    // 미조회 rides beside the NAME (a fact about this row's provenance), not in 상태.
    expect(within(legacyRow).getByText('미조회')).toBeTruthy();
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

  it('policy-only data (nothing tested) is not judged as a unit; the state sentence moved into the ⓘ', async () => {
    // Everything was excluded, so the next test collected nothing: only policy
    // rows remain. The unit must not be judged from them.
    renderModal({
      databases: [
        { id: 'analytics_archive', name: 'analytics_archive', type: 'db', database: 'analytics_archive', existingDenyReason: 'TEMP', untested: true },
      ],
      initialDraft: {
        excludedIds: new Set(['analytics_archive']),
        reasons: { analytics_archive: 'TEMP' },
      },
    });
    expect(screen.queryByText(/단위 조회/)).toBeNull();
    expect(screen.getByText('조회된 논리 DB 없음')).toBeTruthy();
    await openUnitTip();
    // Same sentence as the fully-empty case: what the run found is the only thing said,
    // because the rows below may or may not be there and the copy must be true either way.
    expect(screen.getByText('이번 Test Connection에서 조회된 논리 DB가 없어요.')).toBeTruthy();
    // The policy row itself stays listed and restorable.
    expect(within(rowOf('analytics_archive')).getByRole('button', { name: '복원' })).toBeTruthy();
  });

  it('a fully empty result renders the empty state and is not judged as a unit', () => {
    renderModal({ databases: [], initialDraft: undefined });
    expect(screen.queryByText(/단위 조회/)).toBeNull();
    expect(screen.getByText('조회된 논리 DB 없음')).toBeTruthy();
    expect(screen.getByText('조회된 논리 DB가 없어요.')).toBeTruthy();
  });

  it('collapsing a database hides its schema rows', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', { name: 'live 접기' }));
    expect(screen.queryByTitle('live.public')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'live 펼치기' }));
    expect(screen.getByTitle('live.public')).toBeTruthy();
  });
});

/**
 * 저장 결과는 이 모달 안에서 말한다 — toast 는 모달 뒤에서 살다 사라졌다.
 * `saving` 은 버튼의 상태(표는 그대로), `result` 는 프레임(표와 푸터가 사라진다).
 */
describe('LogicalDbModal — save result frames', () => {
  /** Stage one exclusion and press 저장, so the ledger has something to remember. */
  const stageAndSave = (): ReturnType<typeof renderModal> => {
    const view = renderModal();
    const row = rowOf('live.public');
    fireEvent.click(within(row).getByRole('button', { name: '제외' }));
    fireEvent.click(screen.getByRole('button', { name: '제외 (저장 전에 추가)' }));
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    return view;
  };

  it('the 저장 button is disabled while the save is in flight', () => {
    const view = stageAndSave();
    view.rerenderWith({ saving: true });
    const save = screen.getByRole('button', { name: /저장 중/ });
    expect((save as HTMLButtonElement).disabled).toBe(true);
    // 표는 있던 자리에 그대로 — 대기는 프레임이 아니다.
    expect(screen.getByTitle('live.public')).toBeTruthy();
  });

  it('an error result replaces the table with the reason for that code', () => {
    const view = stageAndSave();
    view.rerenderWith({ result: { kind: 'error', code: 'CONFLICT' }, onRetry: vi.fn() });
    expect(screen.getByText('제외 설정을 저장하지 못했어요')).toBeTruthy();
    expect(screen.getByText('이미 진행 중인 연결 테스트가 있어요.')).toBeTruthy();
    // The list and the footer diff are gone; the resource header is not.
    expect(screen.queryByTitle('live.public')).toBeNull();
    expect(screen.queryByRole('button', { name: '저장' })).toBeNull();
    expect(screen.getByText('논리 DB 관리')).toBeTruthy();
    expect(screen.getByRole('button', { name: '다시 저장하기' })).toBeTruthy();
  });

  it('a non-retriable code offers no 다시 저장하기', () => {
    const view = stageAndSave();
    view.rerenderWith({ result: { kind: 'error', code: 'FORBIDDEN' }, onRetry: vi.fn() });
    expect(screen.getByText('이 연동 대상의 제외 설정을 바꿀 권한이 없어요.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: '다시 저장하기' })).toBeNull();
    expect(screen.getByRole('button', { name: '닫기' })).toBeTruthy();
  });

  it('the success frame ledgers what was saved and names when it applies', () => {
    const view = stageAndSave();
    view.rerenderWith({ result: { kind: 'success' } });
    expect(screen.getByText('논리 DB 제외 설정을 저장했어요')).toBeTruthy();
    expect(screen.getByText('제외 1건이 정책에 반영됐어요.')).toBeTruthy();
    expect(screen.getByText('저장된 변경')).toBeTruthy();
    expect(screen.getByText('제외 (스테이징)')).toBeTruthy();
    expect(screen.getByText(/다음 연결 테스트부터/)).toBeTruthy();
  });

  /**
   * ⛔ 핀은 px 한 숫자가 아니라 clamp 다. `min-height` 는 카드의 `max-h-[90vh]` 를 이기므로,
   * 프레임이 선 채 창이 줄면 닫기가 화면 밖으로 나간다. 표현식이 90vh 를 품고 있어야
   * 브라우저가 매 뷰포트 변화마다 다시 푼다 — 리스너도, 추가 렌더도 없이.
   */
  it('the height pin is clamped to the viewport, not a bare px number', () => {
    const view = stageAndSave();
    view.rerenderWith({ result: { kind: 'success' } });
    const card = screen.getByRole('dialog');
    expect(card.style.minHeight).toContain('90vh');
    expect(card.style.minHeight).toMatch(/^min\(/);
  });

  /**
   * ⛔ 바닥은 **크기**로 잰다. `headRef` 는 스크롤되는 본문 안에 있어서, 위치(`head.bottom`)로
   * 재면 scrollTop 만큼 부풀고 프레임이 방보다 커진다 — 실측에서 120px 스크롤이 그대로
   * 120px 초과로 나타났고, ESC 도 바깥 클릭도 막힌 화면에서 닫기가 카드 밖으로 내려갔다.
   * 여기서는 스크롤된 배치를 흉내 내, 두 공식이 서로 다른 수를 내놓게 만든다.
   */
  it('the frame floor is measured from heights, not from a scrolled position', () => {
    const rect = (top: number, height: number): DOMRect =>
      ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect;
    const spy = vi
      .spyOn(Element.prototype, 'getBoundingClientRect')
      .mockImplementation(function (this: Element) {
        // 카드는 540 높이. 머리는 160 높이인데, 본문이 124px 스크롤돼 화면에서는 위로 올라가 있다.
        if (this.getAttribute('role') === 'dialog') return rect(0, 540);
        if (this.firstElementChild?.tagName === 'H2') return rect(-100, 160);
        return rect(0, 0);
      });
    try {
      const view = stageAndSave();
      view.rerenderWith({ result: { kind: 'success' } });
      const frame = screen.getByRole('status');
      // 540 − 160 = 380. 위치로 쟀다면 540 − 60 = 480 이 나온다.
      expect(frame.style.minHeight).toContain('380px');
      expect(frame.style.minHeight).not.toContain('480px');
    } finally {
      spy.mockRestore();
    }
  });

  it('while the success frame stands, ESC does not close the modal', () => {
    const view = stageAndSave();
    view.rerenderWith({ result: { kind: 'success' } });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(view.onClose).not.toHaveBeenCalled();
    // 닫기 is the way out, and it is the only one.
    fireEvent.click(screen.getByRole('button', { name: '닫기' }));
    expect(view.onClose).toHaveBeenCalledTimes(1);
  });

  it('a notice stands above the table without taking the table away', () => {
    renderModal({ notice: '조회는 안 되지만 제외 목록은 고칠 수 있어요.' });
    expect(screen.getByText('조회는 안 되지만 제외 목록은 고칠 수 있어요.')).toBeTruthy();
    // The table is the point: a notice replaces nothing.
    expect(rowOf('live.public')).toBeTruthy();
    expect(screen.getByRole('button', { name: '저장' })).toBeTruthy();
  });

  /**
   * ⛔ 모르는 것과 없는 것은 다른 사실이다. notice 는 조회를 **읽지 못했다**는 뜻이므로,
   * 그 아래에서 `조회된 논리 DB 없음` 은 실패를 결과로 바꿔 말하는 것이다.
   */
  it('조회를 못 읽은 화면은 이번 실행이 무엇을 찾았는지 말하지 않는다', async () => {
    renderModal({
      notice: '최근 연결 테스트의 논리 DB 조회가 안 돼요.',
      databases: [],
      initialDraft: { excludedIds: new Set(), reasons: {} },
    });
    expect(screen.getByText('조회 결과 미확인')).toBeTruthy();
    expect(screen.getByText('조회 결과를 읽지 못했어요.')).toBeTruthy();
    await openUnitTip();
    expect(
      screen.getByText('최근 연결 테스트의 조회 결과를 읽지 못해 단위를 판정할 수 없어요.'),
    ).toBeTruthy();
    // 없다고 말하는 세 문장은 하나도 서지 않는다.
    expect(screen.queryByText('조회된 논리 DB 없음')).toBeNull();
    expect(screen.queryByText('조회된 논리 DB가 없어요.')).toBeNull();
    expect(screen.queryByText('이번 Test Connection에서 조회된 논리 DB가 없어요.')).toBeNull();
  });

  it('notice 없이 정말 아무것도 못 찾은 화면은 그대로 그렇게 말한다', async () => {
    renderModal({ databases: [], initialDraft: { excludedIds: new Set(), reasons: {} } });
    expect(screen.getByText('조회된 논리 DB 없음')).toBeTruthy();
    expect(screen.getByText('조회된 논리 DB가 없어요.')).toBeTruthy();
    await openUnitTip();
    expect(screen.getByText('이번 Test Connection에서 조회된 논리 DB가 없어요.')).toBeTruthy();
    expect(screen.queryByText('조회 결과 미확인')).toBeNull();
  });

  it('정책만 남은 화면도 조회를 못 읽었으면 판정하지 않는다', () => {
    renderModal({
      notice: '최근 연결 테스트의 논리 DB 조회가 안 돼요.',
      databases: policyOnly,
      initialDraft: policyOnlyDraft,
    });
    expect(screen.getByText('조회 결과 미확인')).toBeTruthy();
    // 정책 행은 그대로 선다 — 못 읽은 건 조회 쪽이다.
    expect(rowOf('legacy')).toBeTruthy();
  });
});

/** Type one DB into the 제외 추가 toolbar and press 추가. */
const addManual = (database: string, schema?: string): void => {
  fireEvent.change(screen.getByLabelText('Database 이름'), { target: { value: database } });
  if (schema !== undefined) {
    fireEvent.change(screen.getByLabelText('Schema 이름 (선택)'), { target: { value: schema } });
  }
  fireEvent.click(screen.getByRole('button', { name: '추가' }));
};

describe('LogicalDbModal — 손으로 더한 제외 (manualEntry)', () => {
  it('요청자 화면은 그대로다 — 추가 줄도, 전체 교체 경고도 없다', () => {
    renderModal();
    expect(screen.queryByLabelText('Database 이름')).toBeNull();
    expect(screen.queryByRole('button', { name: '추가' })).toBeNull();
    expect(screen.queryByText(/제외 목록 전체가 교체돼요/)).toBeNull();
  });

  it('운영자 화면은 추가 줄과 전체 교체 경고를 함께 세운다', () => {
    renderModal({ manualEntry: true });
    expect(screen.getByLabelText('Database 이름')).toBeTruthy();
    expect(screen.getByLabelText('Schema 이름 (선택)')).toBeTruthy();
    expect(screen.getByText('schema를 비우면 database 전체')).toBeTruthy();
    expect(
      screen.getByText('저장하면 제외 목록 전체가 교체돼요. 목록에서 뺀 항목은 제외가 해제됩니다.'),
    ).toBeTruthy();
    // 운영자 화면의 사유는 wire enum 이 앞에 선다 — 로그·BE 와 맞춰보는 눈이 먼저 닿는
    // 쪽이 코드다. 요청자 화면은 라벨만 본다(위 표 테스트).
    const reason = screen.getByLabelText('추가할 제외 사유') as HTMLSelectElement;
    expect(Array.from(reason.options).map((o) => o.textContent)).toEqual([
      'STG · 스테이징',
      'DEV · 개발용',
      'TEMP · 임시',
    ]);
  });

  it('손으로 더한 DB 가 미조회 행으로 표에 서고 저장 전 변경에 오른다', () => {
    const { onSave } = renderModal({ manualEntry: true });
    addManual('shadow');

    const row = rowOf('shadow');
    // 미조회 — 실행이 못 본 이름이라는 사실. excluded-only 행과 같은 표시다.
    expect(within(row).getByText('미조회')).toBeTruthy();
    expect(within(row).getByText('제외 · 저장 전')).toBeTruthy();
    expect(within(row).getByText('TEMP · 임시')).toBeTruthy();
    // 방금 앉은 자리를 한 번 훑는다.
    expect(row.className).toContain(logicalDbStyles.flashRow);
    expect(screen.getByText(/저장 전 변경 1건/)).toBeTruthy();

    // ⛔ 저장은 표가 그린 행들과 함께 나간다 — 이 두 번째 인자가 없으면
    // `draftToExcludedItems` 가 이 id 를 조용히 버린다.
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const [draft, rows] = onSave.mock.calls[0] as [
      LogicalDbModalDraft,
      ReadonlyArray<LogicalDatabase>,
    ];
    expect(draft.excludedIds.has('shadow')).toBe(true);
    expect(draft.reasons.shadow).toBe('TEMP');
    expect(rows.some((row) => row.id === 'shadow')).toBe(true);
  });

  /**
   * ⛔ THE P1. 손으로 적은 schema 의 DATABASE 부모는 트리의 자리표시자였을 뿐 `allRows` 에
   * 없었다. 그 그룹 행을 제외하면 자식 id 는 지워지고 부모 id 는 행이 없어, `저장 전 변경`
   * 도 PUT 몸통도 통째로 비었다 — 표만 `제외 · 저장 전` 이라고 말하는 화면.
   */
  it('손으로 더한 schema 의 DB 전체를 제외해도 그 제외가 남는다', () => {
    const { onSave } = renderModal({ manualEntry: true });
    addManual('shadow', 'audit');

    fireEvent.click(within(rowOf('shadow')).getByRole('button', { name: '제외' }));
    fireEvent.click(screen.getByRole('button', { name: '제외 (저장 전에 추가)' }));

    expect(screen.getByText(/저장 전 변경 1건/)).toBeTruthy();
    const save = screen.getByRole('button', { name: '저장' }) as HTMLButtonElement;
    expect(save.disabled).toBe(false);

    fireEvent.click(save);
    const [draft, rows] = onSave.mock.calls[0] as [
      LogicalDbModalDraft,
      ReadonlyArray<LogicalDatabase>,
    ];
    expect(draft.excludedIds.has('shadow')).toBe(true);
    // DATABASE 제외가 schema 제외를 흡수한다 — 둘은 공존하지 않는다.
    expect(draft.excludedIds.has('shadow.audit')).toBe(false);
    expect(rows.find((row) => row.id === 'shadow')?.type).toBe('db');
  });

  it('원장과 푸터의 사유도 표와 같은 답을 쓴다', () => {
    const view = renderModal({ manualEntry: true });
    addManual('shadow');
    // 푸터의 저장 전 변경 줄.
    expect(screen.getByText(/제외\(TEMP · 임시\)/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    view.rerenderWith({ result: { kind: 'success' } });
    // 결과 원장.
    expect(screen.getByText('제외 (TEMP · 임시)')).toBeTruthy();
  });

  /** 결과가 선 아래에서 `저장하면 … 교체돼요` 는 이미 벌어진 일에 대고 하는 지시다. */
  it('결과가 서면 전체 교체 경고는 사라진다', () => {
    const view = renderModal({ manualEntry: true });
    const warn = '저장하면 제외 목록 전체가 교체돼요. 목록에서 뺀 항목은 제외가 해제됩니다.';
    expect(screen.getByText(warn)).toBeTruthy();
    view.rerenderWith({ result: { kind: 'success' } });
    expect(screen.queryByText(warn)).toBeNull();
    // 머리는 그대로 남는다 — 결과를 말하는 상자도 이 리소스의 상자다.
    expect(screen.getByText('논리 DB 관리')).toBeTruthy();
  });

  it('schema 를 채우면 그 스키마만, 비우면 database 전체다', () => {
    const { onSave } = renderModal({ manualEntry: true });
    addManual('shadow', 'audit');

    const row = rowOf('shadow.audit');
    expect(within(row).getByText('Schema')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const rows = onSave.mock.calls[0][1] as ReadonlyArray<LogicalDatabase>;
    const added = rows.find((r) => r.id === 'shadow.audit');
    expect(added?.type).toBe('schema');
    expect(added?.schema).toBe('audit');
  });

  /**
   * ⛔ select 의 값은 DOM 문자열이지 계약 enum 이 아니다. 단언(`as SkipReason`)으로 받으면
   * 옵션에 없는 값이 그대로 상태가 되고, 그 사유가 PUT 몸통까지 간다.
   */
  it('옵션에 없는 값은 사유로 앉지 않는다', () => {
    const { onSave } = renderModal({ manualEntry: true });
    const select = screen.getByLabelText('추가할 제외 사유') as HTMLSelectElement;
    fireEvent.change(select, { target: { value: 'BOGUS' } });
    expect(select.value).toBe('TEMP');

    addManual('shadow');
    fireEvent.click(screen.getByRole('button', { name: '저장' }));
    const draft = onSave.mock.calls[0][0] as LogicalDbModalDraft;
    expect(draft.reasons.shadow).toBe('TEMP');
  });

  it('Enter 로도 더해진다', () => {
    renderModal({ manualEntry: true });
    fireEvent.change(screen.getByLabelText('Database 이름'), { target: { value: 'shadow' } });
    fireEvent.keyDown(screen.getByLabelText('Database 이름'), { key: 'Enter' });
    expect(rowOf('shadow')).toBeTruthy();
  });

  it('빈 이름과 이미 있는 이름은 행을 만들지 않고 이유를 말한다', () => {
    renderModal({ manualEntry: true });
    fireEvent.click(screen.getByRole('button', { name: '추가' }));
    expect(screen.getByRole('alert').textContent).toBe('Database 이름을 입력해 주세요.');

    // 표가 이미 그리고 있는 이름 — 조회된 행이든 정책만 있는 행이든 마찬가지다.
    addManual('legacy');
    expect(screen.getByRole('alert').textContent).toBe('이미 목록에 있습니다.');
    expect(screen.getByText(/변경 없음/)).toBeTruthy();
  });

  it('더한 뒤 두 이름 칸만 비고, 사유는 그대로 남는다', () => {
    renderModal({ manualEntry: true });
    fireEvent.change(screen.getByLabelText('추가할 제외 사유'), { target: { value: 'DEV' } });
    addManual('shadow', 'audit');

    expect((screen.getByLabelText('Database 이름') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('Schema 이름 (선택)') as HTMLInputElement).value).toBe('');
    expect((screen.getByLabelText('추가할 제외 사유') as HTMLSelectElement).value).toBe('DEV');
    expect(within(rowOf('shadow.audit')).getByText('DEV · 개발용')).toBeTruthy();
  });

  /**
   * ⛔ 단위 칩은 **조회된** 행만 본다. 손으로 적은 이름은 정책이지 실행 결과가 아니라서,
   * Database 단위로 조회되는 대상에 schema 를 하나 적었다고 Schema 단위가 되지 않는다.
   *
   * 이 불변식은 두 겹이다: 호출부가 `allRows` 가 아니라 `databases` 를 넘기고, 그와 별개로
   * `logicalDbUnit` 자신이 `untested` 행을 거른다(그쪽은 logical-db-tree.test.ts 가 잡는다).
   * 그래서 둘 중 **하나만** 뒤집어도 이 테스트는 초록으로 남는다 — 여기가 지키는 것은 화면이
   * 말하는 판정이고, 인자 하나가 아니다.
   */
  it('손으로 더한 schema 행은 단위 칩을 바꾸지 못한다', () => {
    renderModal({ databases: mysqlDatabases, initialDraft: undefined, manualEntry: true });
    expect(screen.getByText('Database 단위 조회')).toBeTruthy();
    addManual('shadow', 'audit');
    expect(screen.getByText('Database 단위 조회')).toBeTruthy();
    expect(screen.queryByText('Schema 단위 조회')).toBeNull();
  });
});
