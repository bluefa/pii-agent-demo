# Wave 14-E1b — IdcResourceInputPanel IP Row Stable ID

## Context
wave13-E1 의 **유일한 deferred item**: `IdcResourceInputPanel.tsx:210` `<div key={index}>` IP row. Stable id 적용을 위해 FormState 의 `ips` shape 변경 필요하므로 wave13 scope 밖이었음.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
target="app/components/features/idc/IdcResourceInputPanel.tsx"
grep -n "key={index}" "$target" | head -3
# 현 baseline: 1 사이트 남아있어야 함 (L210)
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave14-e1b-ip-row-id --prefix refactor
cd /Users/study/pii-agent-demo-wave14-e1b-ip-row-id
```

## Step 2: Required reading
1. 전체 `IdcResourceInputPanel.tsx` — wave11-B1 (#311) 이후 380 LOC, useReducer 기반
2. `app/components/features/idc/validation.ts` — IP 검증 함수 (`validateIps`)
3. wave11-B1 의 FormAction / formReducer 구조 — 어떻게 ips 조작하는지
4. `.claude/skills/anti-patterns/SKILL.md` §E1 (index key 안티패턴 근거)

## Step 3: Shape migration

### 3-1. 현재 shape
```ts
interface FormState {
  ips: string[];                      // ['', '', ...]
  errors: Record<string, string>;     // {'ip_0': 'error', ...}
}

type FormAction =
  | { type: 'ADD_IP' }
  | { type: 'REMOVE_IP'; index: number }
  | { type: 'SET_IP'; index: number; value: string }
  ...
```

문제: array index 가 identity 역할 → row 재정렬/삭제 시 key collision + error object key (`ip_0`, `ip_1`) 도 index-based 라 마찬가지.

### 3-2. 목표 shape
```ts
interface IpEntry {
  id: string;          // crypto.randomUUID() 또는 증가 카운터
  value: string;
}

interface FormState {
  ips: IpEntry[];
  errors: Record<string, string>;     // key: `ip_${entry.id}`
}

type FormAction =
  | { type: 'ADD_IP' }
  | { type: 'REMOVE_IP'; id: string }
  | { type: 'SET_IP'; id: string; value: string }
  | ...
```

### 3-3. 구현 단계

1. **Type 수정**: `FormState.ips: string[]` → `IpEntry[]`
2. **Lazy initializer** 업데이트:
   ```ts
   const buildInitialState = (initialData?: InitialData): FormState => ({
     ...,
     ips: (initialData?.ips ?? ['']).map(value => ({ id: crypto.randomUUID(), value })),
     errors: {},
   });
   ```
3. **Reducer action 변경**:
   - `ADD_IP`: `ips: [...state.ips, { id: crypto.randomUUID(), value: '' }]`
   - `REMOVE_IP`: `ips: state.ips.filter(entry => entry.id !== action.id)`
   - `SET_IP`: `ips: state.ips.map(entry => entry.id === action.id ? { ...entry, value: action.value } : entry)`
4. **Error key scheme**: `ip_${index}` → `ip_${entry.id}` (validator 수정 포함)
5. **Validator 업데이트** (`validation.ts`):
   - `validateIps(ips: IpEntry[])` 로 시그니처 변경
   - error map 의 키도 id 기반
6. **JSX key 교체**:
   ```tsx
   {state.ips.map((entry) => (
     <div key={entry.id} className="flex items-center gap-2">
       <input value={entry.value} onChange={e => dispatch({ type: 'SET_IP', id: entry.id, value: e.target.value })} />
       ...
     </div>
   ))}
   ```
7. **onRemove 호출**: `dispatch({ type: 'REMOVE_IP', id: entry.id })` — 기존 `onRemove(index)` 패턴을 id 기반으로 교체

### 3-4. onSave payload 호환성

`handleSave` 가 upstream 으로 보내는 payload 는 문자열 배열 유지:
```ts
const onSave = () => {
  const payload = {
    ...state,
    ips: state.ips.map(e => e.value).filter(Boolean),
  };
  parent.onSave(payload);
};
```

prop 계약 변경 없음 → 소비처 (`IdcProjectPage`) 건드리지 않음.

### 3-5. validateIps filtered-index 이슈 해결

wave11-B1 PR #311 의 `/simplify` 리뷰에서 포착된 `validateIps` filtered-index vs JSX full-index skew 이슈는 id 기반 전환으로 **자연 해소**. 검증 결과의 error key 도 id 기반이라 JSX 와 일치.

## Step 4: Do NOT touch
- Prop 계약 (`onSave`, `initialData`)
- 소비처 `IdcProjectPage.tsx`
- 다른 form field (name, host, port, serviceId, credentialId 등)
- JSX 구조 (key 값 / handler 만 수정)
- Styling

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/features/idc/IdcResourceInputPanel.tsx app/components/features/idc/validation.ts
npm run build

# 최종 확인
grep -n "key={index}" app/components/features/idc/IdcResourceInputPanel.tsx
# → 결과 없어야 함
```

수동 검증:
- IDC 리소스 입력 패널: Add IP → 새 row 하단 추가 → 채우고 저장 성공
- 중간 row 제거 → 남은 rows 의 에러 표시가 올바른 row 에 남아있음 (key collision 없음)
- 동일 IP 를 두 row 에 입력 → 중복 검증 동작
- Validate 에러 메시지가 JSX row 와 동기화 (이전 filtered-index 버그 없음)

## Step 6: Commit + push + PR

```
git add app/components/features/idc/IdcResourceInputPanel.tsx \
        app/components/features/idc/validation.ts
git commit -m "refactor(idc): IP row stable id (wave14-E1b)

wave13-E1 deferred 해소. FormState.ips: string[] → IpEntry[] (id+value).

- FormAction REMOVE_IP/SET_IP 를 id 기반으로 전환
- Error key scheme ip_<index> → ip_<id>
- JSX key={entry.id} 로 교체
- validator.validateIps 시그니처 업데이트 + error key id 기반
- onSave payload 는 string[] 유지 (prop 계약 불변)
- 부작용: wave11-B1 의 validateIps filtered-index 이슈 자연 해소

No rendering change, no consumer modification."
git push -u origin refactor/wave14-e1b-ip-row-id
```

PR body (`/tmp/pr-wave14-e1b-body.md`):
```
## Summary
Close wave13-E1's sole deferred site. `IdcResourceInputPanel` IP rows get stable ids via FormState shape change (`ips: string[]` → `IpEntry[]`).

## Changes
- `FormState.ips`, `FormAction.REMOVE_IP/SET_IP` id-based
- `validateIps(ips: IpEntry[])` signature + id-based error keys
- `IpEntry` shape: `{ id: string; value: string }`, `crypto.randomUUID()` per entry
- JSX `key={entry.id}` (no more `key={index}`)

## Side effect
- Fixes wave11-B1 `validateIps` filtered-index vs JSX full-index skew (자연 해소)

## Deliberately excluded
- Prop contract (`onSave` still receives `string[]` payload)
- Consumer files
- JSX / styling / other form fields

## Verify
- [x] tsc, lint, build
- [x] `grep "key={index}" IdcResourceInputPanel.tsx` → empty
- [x] Manual: add/remove/edit IP rows, error display, submit

## Parallel coordination
- Safe with B1a/B1b/B1c/C1
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. `key={index}` 잔존 grep 결과 (0 expected)
4. Id 생성 방식 (`crypto.randomUUID()` vs counter) + 선택 근거
5. Validator 에러 key 교체 범위
6. Wave11-B1 filtered-index skew 자연 해소 확인
7. Deviations with rationale

## Parallel coordination
- **파일 overlap 없음**: target 은 `features/idc/IdcResourceInputPanel.tsx` + `validation.ts` 만
  - wave14-B1a/B1b/B1c/C1 과 모두 disjoint
