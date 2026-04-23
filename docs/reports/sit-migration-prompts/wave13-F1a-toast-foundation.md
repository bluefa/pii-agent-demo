# Wave 13-F1a — Toast Component Foundation

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Audit evidence: 30 `alert()` sites (F1 🔴, wave11-README deferred, re-audited 2026-04-23).

This spec adds the **Toast infrastructure only**. Consumer migration (30 alert sites + 2 shared hooks) is **wave13-F1b**, which depends on this merge.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
find app lib -iname "*toast*" 2>/dev/null | head -5
[ -z "$(find app lib -iname '*toast*' 2>/dev/null)" ] || { echo "✗ Toast already exists — rethink scope"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave13-f1a-toast --prefix feat
cd /Users/study/pii-agent-demo-wave13-f1a-toast
```

## Step 2: Required reading
1. `.claude/skills/anti-patterns/SKILL.md` §F1 (native alert — blocks UI, not mobile-friendly, no styling)
2. `lib/theme.ts` — reuse `statusColors.success/error/info/warning`
3. `lib/constants/timings.ts` — extend `TIMINGS` with `TOAST_HIDE_MS` (2 sites already use 2000 for toast: `TopNav:91`, `IdcProcessStatusCard:200` — align semantics)
4. `app/layout.tsx` — root layout where the provider mounts
5. Existing Modal patterns in `app/components/ui/Modal.tsx` — for portal/stack reference

## Step 3: Target structure

```
app/components/ui/toast/
├── Toast.tsx               (single toast visual, ≤ 80 LOC)
├── ToastContainer.tsx      (portal + stack layout, ≤ 50 LOC)
├── ToastProvider.tsx       (context + queue state, ≤ 120 LOC)
├── useToast.ts             (consumer hook: `{ success, error, info, warning }`, ≤ 30 LOC)
└── index.ts                (barrel re-export)
```

### 3-1. API

```ts
// useToast.ts
export function useToast() {
  return {
    success: (message: string, options?: ToastOptions) => void,
    error: (message: string, options?: ToastOptions) => void,
    info: (message: string, options?: ToastOptions) => void,
    warning: (message: string, options?: ToastOptions) => void,
    dismiss: (id: string) => void,
  };
}

interface ToastOptions {
  durationMs?: number;   // default: TIMINGS.TOAST_HIDE_MS
  dismissible?: boolean; // default: true
}
```

- ID auto-generated via `crypto.randomUUID()` (available in client runtime)
- Stack newest-on-top, max 3 visible; older toasts get pushed out (drop, not queued)
- Auto-dismiss after `durationMs`; error variant defaults to `durationMs * 1.5`

### 3-2. Visual

- Position: `fixed top-4 right-4`, `z-50`
- Variant colors via `statusColors.*` from `lib/theme.ts` (no raw hex)
- Icon: reuse `StatusSuccessIcon`, `StatusErrorIcon`, `StatusInfoIcon`, `StatusWarningIcon` from `app/components/ui/icons/`
- Dismiss button (X) with `aria-label="닫기"`
- Enter/exit transition via Tailwind `transition-opacity` + `translate-x`

### 3-3. Portal + Provider

`ToastContainer` uses `createPortal` to `document.body`. Mount via `ToastProvider` at `app/layout.tsx`:

```tsx
// app/layout.tsx (change)
<ToastProvider>
  {children}
</ToastProvider>
```

Provider 가 `body` 에 portal 로 `ToastContainer` 를 띄운다. SSR 안전을 위해 첫 렌더에서 `typeof document === 'undefined'` 가드.

### 3-4. TIMINGS extension

`lib/constants/timings.ts` 에 추가:

```ts
export const TIMINGS = {
  PROCESS_STATUS_POLL_MS: 10_000,
  TOAST_HIDE_MS: 2000,   // 신규 — TopNav, IdcProcessStatusCard 가 이미 쓰는 값
} as const;
```

Foundation 성격이므로 등록만 — 실제 literal 교체는 별도 consumer PR.

## Step 4: Do NOT touch
- 기존 `alert()` 호출부 (F1b 에서 처리)
- `useApiMutation.ts`, `useAsync.ts` (F1b 스코프)
- 다른 UI 컴포넌트 (Modal, Badge 등)
- 다른 상수/타입 파일

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/components/ui/toast/ app/layout.tsx lib/constants/timings.ts
npm run build
```

수동 검증:
- 빈 앱 상태에서 Provider 가 SSR 없이 마운트
- Devtools 에서 `ToastContainer` 가 `<body>` 최하단 portal 에 존재 (초기엔 빈 `<ul>`)
- 아직 호출자가 없으므로 화면에 toast 없음 (정상)

## Step 6: Commit + push + PR

```
git add app/components/ui/toast/ app/layout.tsx lib/constants/timings.ts
git commit -m "feat(ui): Toast component foundation (wave13-F1a)

Audit §F1 (30 alert sites) 대응을 위한 infrastructure. consumer migration 은
wave13-F1b (후속 PR).

- app/components/ui/toast/{Toast,ToastContainer,ToastProvider,index}.tsx
- app/components/ui/toast/useToast.ts
- lib/constants/timings.ts — TOAST_HIDE_MS 2000 등록
- app/layout.tsx — ToastProvider 마운트

API: const toast = useToast(); toast.success('저장됨'); toast.error(msg);
Stack max 3, auto-dismiss, portal-based, a11y dismiss button."
git push -u origin feat/wave13-f1a-toast
```

PR body (write to `/tmp/pr-wave13-f1a-body.md`):
```
## Summary
Toast component foundation — no consumer migration yet. Dependency root for wave13-F1b (30 alert sites + 2 shared hooks).

## Why
Audit §F1 🔴: `alert()` is a blocking modal, not styleable, not mobile-friendly, and not a11y-consistent with the rest of our UI. We need a non-blocking toast primitive before migration can begin.

## Changes
- `app/components/ui/toast/` (new, 5 files)
- `lib/constants/timings.ts` — `TOAST_HIDE_MS` 2000 key added
- `app/layout.tsx` — Provider mount

## API
- `useToast()` → `{ success, error, info, warning, dismiss }`
- Variants use `statusColors.*` theme tokens
- Portal-based, stack max 3, auto-dismiss (error gets 1.5× duration)

## Deliberately excluded
- alert() migration (wave13-F1b)
- useApiMutation/useAsync hook updates (wave13-F1b)

## Test plan
- [x] tsc, lint, build
- [x] SSR-safe (typeof document guard)
- [x] Manual: Provider mounts, empty container in body portal

## Parallel coordination
- Safe to run in parallel with wave13-A1, wave13-A2, wave13-E1 (no file overlap)
- **Blocks wave13-F1b** (consumer migration imports `useToast`)
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build results
3. 파일별 LOC
4. Provider 마운트 위치 및 SSR 가드 확인
5. `crypto.randomUUID()` vs 다른 id 생성 방식 선택 근거
6. 스펙 대비 deviation with rationale

## Parallel coordination
- 파일 overlap **없음** (new files + `app/layout.tsx` + `timings.ts` 추가만):
  - wave13-A1 (feature components non-null) — 다른 파일
  - wave13-A2 (`lib/bff/http.ts`, `lib/api-client/mock/confirm.ts`) — 다른 파일
  - wave13-E1 (grep-fixable bulk) — `app/layout.tsx` 는 template className 포함 가능성 있음 → E1 은 F1a merge 후로
- **Blocks wave13-F1b** (useToast import 필요)
