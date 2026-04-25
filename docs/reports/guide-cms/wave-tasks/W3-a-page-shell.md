# W3-a — Admin Page Shell + Provider Tabs + Step List Panel

> **Recommended model**: Sonnet 4.6 (시안 옮기기 위주, 디자인 결정 깊이 ↓)
> **Estimated LOC**: ~500
> **Branch prefix**: `feat/guide-cms-w3a-page-shell`
> **Depends on**: W1-a (merged)

## Context

`/integration/admin/guides` 페이지 진입점 구축. AdminLayout 재사용 + Provider Tabs + Step List Panel + 빈 편집/미리보기 placeholder.

Spec: `design/guide-cms/components.md` §1 페이지 트리, §2 ProviderTabs / StepListPanel + `interactions.md` §1 (탭/리스트 키보드)

## Precondition

```bash
[ -f lib/constants/guide-registry.ts ] || { echo "✗ W1-a 미머지"; exit 1; }
[ -d app/integration/admin ] || { echo "✗ admin segment 없음"; exit 1; }
[ ! -d app/integration/admin/guides ] || { echo "✗ already exists"; exit 1; }
```

## Required reading

1. `design/guide-cms/components.md` §1 페이지 트리, §2 ProviderTabs / StepListPanel
2. `design/guide-cms/interactions.md` §1, §2 (호버·포커스), §4.1 (dirty guard — 이번 wave 는 hook 자리만)
3. `design/guide-cms/guide-cms.html` line 1-300 (top nav · provider tabs · step list 시안)
4. `app/integration/admin/dashboard/page.tsx` (예시 admin 페이지)
5. `app/integration/admin/layout.tsx` — 재사용
6. `lib/theme.ts` — primaryColors / cardStyles
7. `lib/constants/guide-registry.ts` — slot 조회

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic guide-cms-w3a-page-shell --prefix feat
```

## Step 2: 페이지 + layout

### `app/integration/admin/guides/page.tsx` (~100 LOC)

```tsx
'use client';
import { useState } from 'react';
import { ProviderTabs } from './components/ProviderTabs';
import { StepListPanel } from './components/StepListPanel';
import { GuidePlaceholder } from './components/GuidePlaceholder';
import type { GuideSlotKey } from '@/lib/types/guide';
import type { ProviderTab } from './types';

export default function GuidesPage() {
  const [provider, setProvider] = useState<ProviderTab>('aws');
  const [selected, setSelected] = useState<GuideSlotKey | null>(null);

  return (
    <div className="flex flex-col h-full">
      <ProviderTabs value={provider} onChange={(p) => { setProvider(p); setSelected(null); }} />
      <div className="grid grid-cols-[25%_35%_40%] flex-1 overflow-hidden">
        <StepListPanel provider={provider} selectedKey={selected} onSelect={setSelected} />
        <GuidePlaceholder>편집할 단계를 선택해주세요</GuidePlaceholder>
        <GuidePlaceholder>미리보기 영역</GuidePlaceholder>
      </div>
    </div>
  );
}
```

> Editor + Preview 본체는 W3-b/W3-c 에서 교체. 이번 wave 는 placeholder.

## Step 3: ProviderTabs

### `app/integration/admin/guides/components/ProviderTabs.tsx` (~120 LOC)

components.md §2 ProviderTabs 그대로:
- `role="tablist"` + 좌우 화살표 키 네비
- 활성: AWS / AZURE / GCP — primary border + text
- 비활성: IDC / SDU — `aria-disabled` + 클릭 시 toast

```tsx
type ProviderTab = 'aws' | 'azure' | 'gcp' | 'idc' | 'sdu';
const ENABLED: ProviderTab[] = ['aws', 'azure', 'gcp'];
const DISABLED: ProviderTab[] = ['idc', 'sdu'];

export function ProviderTabs({ value, onChange }) {
  // 키보드 좌우 화살표는 ENABLED 만 순환 — interactions.md §1 Provider tabs
  // Home / End 도 처리
  // IDC/SDU 클릭 시 toast (단, 동일 toast id 중복 방지 — interactions.md §4.6)
}
```

## Step 4: StepListPanel

### `app/integration/admin/guides/components/StepListPanel.tsx` (~150 LOC)

components.md §2 StepListPanel:
- `role="list"` + 각 행 `role="button"` + `↑↓` / Enter / Space 처리
- `slot registry` 에서 현재 provider 의 slot 만 필터링
- AWS step 4 는 2행으로 자동 분기 (AUTO + MANUAL)
- Selected 행 시각: `primary-50` 배경 + 3px 좌측 엣지 + `◉` 마커
- 공유 가이드 (`findSlotsForGuide(slot.guideName).length >= 2`) 행에 작은 "공유" subtle label

```tsx
import { GUIDE_SLOTS, findSlotsForGuide } from '@/lib/constants/guide-registry';
// provider 별 필터 + step 정렬
function listSlotsForProvider(provider: ProviderTab) {
  return Object.entries(GUIDE_SLOTS)
    .filter(([_, slot]) => slot.placement.kind === 'process-step' && slot.placement.provider === provider.toUpperCase())
    .sort((a, b) => stepOrder(a) - stepOrder(b));
}
```

`dirty` 상태에서 다른 행 클릭 시 `UnsavedChangesModal` 띄우는 로직은 W3-d 에서 통합. 이번 wave 는 prop hook 자리만 노출 (`onSelect: (key: GuideSlotKey) => void`).

## Step 5: GuidePlaceholder

### `app/integration/admin/guides/components/GuidePlaceholder.tsx` (~30 LOC)

빈 상태 안내 — 텍스트 중앙 정렬, fg-3 색, 안내 메시지 prop.

## Step 6: types.ts

### `app/integration/admin/guides/types.ts` (~30 LOC)

```ts
export type ProviderTab = 'aws' | 'azure' | 'gcp' | 'idc' | 'sdu';
export const ENABLED_PROVIDERS: ProviderTab[] = ['aws', 'azure', 'gcp'];
export const DISABLED_PROVIDERS: ProviderTab[] = ['idc', 'sdu'];
```

## Step 7: 검증

```bash
npx tsc --noEmit
npm run lint -- app/integration/admin/guides/
bash scripts/dev.sh   # mock 모드
# 브라우저: /integration/admin/guides
# - AWS / AZURE / GCP 탭 클릭 — step list 갱신
# - IDC / SDU 클릭 — toast
# - step 클릭 — 선택 강조 (편집/미리보기는 placeholder)
# - 키보드 ←→Tab/Enter/Home/End 동작
```

## Out of scope

- Editor (Tiptap) → W3-b
- Preview (GuideCard 재사용) → W3-c
- Confirm modal · 에러 상태 · a11y polish → W3-d
- GuideCard 분리 → W4-a

## PR body checklist

- [ ] 페이지 진입 → 5개 탭 보임 · AWS 기본 활성
- [ ] AWS 탭에서 step 4 가 2행 (AUTO + MANUAL)
- [ ] AZURE / GCP 는 7행, variant 없음
- [ ] IDC / SDU 클릭 시 toast (제목 정확)
- [ ] 키보드 좌우 / 위아래 / Home / End 모두 동작
- [ ] tsc 0, lint 0
