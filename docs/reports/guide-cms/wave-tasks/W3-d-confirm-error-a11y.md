# W3-d — Unsaved Confirm Modal + Error States + A11y Polish

> **Recommended model**: Sonnet 4.6 (조립 위주)
> **Estimated LOC**: ~300
> **Branch prefix**: `feat/guide-cms-w3d-confirm-error`
> **Depends on**: W3-a, W3-b, W3-c (전체 merged)

## Context

미저장 변경 confirm 다이얼로그 + GET/PUT 실패 + 렌더 검증 실패 + a11y 마무리.

Spec: `design/guide-cms/components.md` §2 UnsavedChangesModal / ErrorState / GuideCardInvalidState + `interactions.md` §1, §4.1, §4.2, §5

## Precondition

```bash
[ -f app/integration/admin/guides/components/GuideEditorPanel.tsx ] || { echo "✗ W3-b 미머지"; exit 1; }
[ -f app/integration/admin/guides/components/GuidePreviewPanel.tsx ] || { echo "✗ W3-c 미머지"; exit 1; }
```

## Required reading

1. `design/guide-cms/components.md` §2 UnsavedChangesModal / ErrorState / GuideCardInvalidState
2. `design/guide-cms/interactions.md` §4.1 (탭/행 dirty guard), §4.2 (Provider 전환), §5 a11y 체크리스트
3. 프로젝트 `useModal()` 훅 + `<Modal>` 컴포넌트 — 기존 패턴

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w3d-confirm-error --prefix feat
```

## Step 2: UnsavedChangesModal

### `app/integration/admin/guides/components/UnsavedChangesModal.tsx` (~80 LOC)

```tsx
import { useModal } from '@/app/hooks/useModal';
import { Modal } from '@/app/components/ui/Modal';
import { Button } from '@/app/components/ui/Button';

interface Props {
  open: boolean;
  onConfirm: () => void;   // 변경 폐기 후 이동
  onCancel: () => void;    // 현재 위치 유지
}

export function UnsavedChangesModal({ open, onConfirm, onCancel }: Props) {
  return (
    <Modal open={open} onClose={onCancel} title="저장되지 않은 변경사항">
      <p>현재 편집 중인 내용이 저장되지 않았습니다. 이동하시겠습니까?</p>
      <div className="flex justify-end gap-2 mt-6">
        <Button variant="outline" onClick={onCancel} autoFocus>취소</Button>
        <Button variant="destructive" onClick={onConfirm}>변경 폐기 후 이동</Button>
      </div>
    </Modal>
  );
}
```

> `variant="destructive"` 가 프로젝트에 없다면 회색 톤 (`bg-gray-700` text-white) 으로 inline. **primary 색 사용 금지**.

## Step 3: GuidesPage 통합

`app/integration/admin/guides/page.tsx` 수정:
- `dirty` state 를 GuideEditorPanel 로부터 lift up
- pendingNavigation: ProviderTab 또는 GuideSlotKey 변경 시도를 보류
- dirty + 새 navigation 요청 → modal open
- 취소 → 보류 폐기 / 확정 → setProvider 또는 setSelected

```tsx
const [dirty, setDirty] = useState(false);
const [pendingNav, setPendingNav] = useState<NavigationIntent | null>(null);

const handleProviderChange = (p: ProviderTab) => {
  if (dirty) setPendingNav({ type: 'provider', value: p });
  else setProvider(p);
};
const handleSelect = (key: GuideSlotKey) => {
  if (dirty && key !== selected) setPendingNav({ type: 'slot', value: key });
  else setSelected(key);
};

const confirmNav = () => {
  if (!pendingNav) return;
  if (pendingNav.type === 'provider') { setProvider(pendingNav.value); setSelected(null); }
  else setSelected(pendingNav.value);
  setPendingNav(null);
  setDirty(false);
};
```

### `beforeunload` (browser tab close)

```tsx
useEffect(() => {
  if (!dirty) return;
  const handler = (e: BeforeUnloadEvent) => { e.preventDefault(); return ''; };
  window.addEventListener('beforeunload', handler);
  return () => window.removeEventListener('beforeunload', handler);
}, [dirty]);
```

## Step 4: ErrorState

### `app/integration/admin/guides/components/GuideErrorState.tsx` (~50 LOC)

```tsx
interface Props {
  title?: string;
  message: string;
  onRetry: () => void;
}

// 편집 패널 자리에 표시 (GET 실패 시)
// title default = "가이드를 불러올 수 없습니다"
// onRetry → useGuide().refresh()
```

기존 `<ErrorState>` (다른 page 의) 재사용 가능하면 그쪽 import. 없으면 신규.

## Step 5: GuideCardInvalidState

### `app/components/features/process-status/GuideCard/GuideCardInvalidState.tsx` (~50 LOC)

```tsx
interface Props {
  errors: ValidationError[];   // validateGuideHtml 의 errors
  variant?: 'admin' | 'enduser';
}

export function GuideCardInvalidState({ errors, variant = 'enduser' }: Props) {
  if (variant === 'admin') {
    // 검증 에러 mono 폰트로 노출 (관리자 디버깅용)
    return <pre>{errors.map(...).join('\n')}</pre>;
  }
  // end-user: generic fallback
  return <div>가이드를 불러올 수 없습니다.</div>;
}
```

미리보기 패널에서 `validateGuideHtml(previewHtml)` 결과 invalid 면 이 컴포넌트로 스왑 (W3-c 와 통합).

## Step 6: A11y polish

components.md §2 + interactions.md §5 체크리스트 항목 모두 점검:

- [x] Provider tabs / Language tabs `role="tablist"` + `aria-selected` + `aria-controls`
- [x] Step list `role="list"` + 각 행 `role="button"` + `tabindex="0"` + `aria-label`
- [x] Save 버튼 disabled 시 `aria-disabled="true"` + tooltip + `aria-describedby`
- [x] Preview panel root `aria-live="polite"`
- [x] Toolbar `role="toolbar"` + roving tabindex (W3-b 에서 이미 작업)
- [x] Modal focus trap + Esc → 취소 + 취소 버튼 autoFocus
- [x] 단축키는 에디터 focus 안일 때만 (전역 충돌 방지)
- [x] 모든 아이콘 버튼 `aria-label` (toolbar 7개, 언어 dot, provider dot)
- [x] Step label `aria-label="AWS 4단계 설치 진행 (자동)"` 형식 — provider + no + label + variant 병합

## Step 7: 검증

```bash
npx tsc --noEmit
npm run lint
npx vitest run app/integration/admin/guides/
bash scripts/dev.sh
# 브라우저 시나리오:
# - 편집 → step 행 클릭 → modal 노출 → 취소 → 편집 그대로
# - 편집 → step 행 클릭 → modal 노출 → 변경 폐기 → 새 step 로드
# - 편집 → provider 탭 클릭 → modal 노출 → 폐기 → provider 전환 (selected null)
# - 편집 중 페이지 리로드 시 browser confirm 노출
# - GET 실패 mock (수동 — store 비활성화 또는 fetch mock) → ErrorState
# - 잘못된 HTML 직접 store 주입 (test infra) → GuideCardInvalidState
# - axe-core 또는 Lighthouse a11y 점수 90+ 확인
```

## Out of scope

- 이미 W3-a/b/c 에서 구현된 a11y 추가 작업 — 점검만
- localStorage draft preservation — spec 명시적 out of scope

## PR body checklist

- [ ] UnsavedChangesModal — `useModal()` 사용 (browser confirm() X)
- [ ] dirty + provider/step 변경 → modal 노출 + cancel/confirm 동작
- [ ] beforeunload (browser tab close) — dirty 일 때 confirm
- [ ] ErrorState (GET 실패) + GuideCardInvalidState (렌더 실패) 둘 다 노출 가능
- [ ] interactions.md §5 a11y 체크리스트 항목 모두 ✓
- [ ] tsc 0, lint 0, dev smoke OK
