# Wave 13-F1b — alert() Migration to Toast

## Context
Project: pii-agent-demo.
Follow-up to wave13-F1a (Toast foundation). Migrates **all 30 `alert()` sites** to `useToast()`.

High-leverage target: **shared hooks `useApiMutation` and `useAsync` both contain `alert()` internally** — migrating those 2 files alone flips every caller's fallback path transparently.

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
git log origin/main --oneline -20 | grep -q "wave13-F1a\|wave13-f1a" || { echo "✗ wave13-F1a not merged — blocks this spec"; exit 1; }
[ -f app/components/ui/toast/useToast.ts ] || { echo "✗ useToast missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave13-f1b-alert --prefix refactor
cd /Users/study/pii-agent-demo-wave13-f1b-alert
```

## Step 2: Required reading
1. `app/components/ui/toast/useToast.ts` (wave13-F1a) — imported in every migrated file
2. `.claude/skills/anti-patterns/SKILL.md` §F1
3. 모든 30 사이트 — 메시지 tone 유지 (한국어 원문 그대로)
4. 2 shared hook 구현: `app/hooks/useApiMutation.ts:83`, `app/hooks/useAsync.ts:40`

## Step 3: Migration — site inventory (confirmed 2026-04-23)

### 3-1. Shared hooks (2 files, highest leverage)
| 위치 | 현재 |
|------|------|
| `app/hooks/useApiMutation.ts:83` | `alert(errorMessage \|\| error.message \|\| '작업에 실패했습니다.')` |
| `app/hooks/useAsync.ts:40` | 동일 |

두 파일은 훅 자체라서 `useToast()` 를 직접 호출할 수 없음 (callable state management 환경 제약). **전략**: 훅이 `toast` 를 옵션으로 받거나 root 에 전역 핸들러 노출.

**권장**: 간단한 전역 토스트 bus 를 `app/components/ui/toast/useToast.ts` 에 추가:
```ts
// wave13-F1a 의 useToast 파일 끝에 추가
let globalEmit: ToastApi | null = null;
export function registerGlobalToast(api: ToastApi) { globalEmit = api; }
export function toastGlobal(): ToastApi | null { return globalEmit; }
```
`ToastProvider` 가 마운트 시 `registerGlobalToast(api)` 호출. 훅들은 `toastGlobal()?.error(...)` 로 fallback.

⚠️ 전역 싱글톤이므로 SSR 사용 금지, 훅 내부에서만 소비. Document in jsdoc.

### 3-2. Direct call sites (28 files/lines)

**Project pages (17 sites)**:
| 파일 | Lines |
|------|-------|
| `app/projects/[projectId]/idc/IdcProjectPage.tsx` | 79, 120, 144, 172, 184, 191, 214 (7) |
| `app/projects/[projectId]/sdu/SduProjectPage.tsx` | 188, 190, 204, 217 (4) |
| `app/projects/[projectId]/gcp/GcpProjectPage.tsx` | 145, 175 (2) |
| `app/projects/[projectId]/azure/AzureProjectPage.tsx` | 238, 251 (2) |
| `app/projects/[projectId]/aws/AwsProjectPage.tsx` | 102, 128 (2) |

**Feature components (11 sites)**:
| 파일 | Lines |
|------|-------|
| `app/components/features/AdminDashboard.tsx` | 109, 114, 126, 140, 153, 168 (6) |
| `app/components/features/CredentialListTab.tsx` | 25, 53 (2) |
| `app/components/features/process-status/connection-test/CredentialSetupModal.tsx` | 60 (1) |
| `app/components/features/process-status/aws/AwsInstallationModeSelector.tsx` | 31 (1) |
| `app/projects/[projectId]/common/DeleteInfrastructureButton.tsx` | 17 (1) |

### 3-3. Mapping 규칙

| 원본 패턴 | Toast variant | 근거 |
|-----------|---------------|------|
| `alert(err instanceof Error ? err.message : 'X에 실패했습니다.')` | `toast.error(err instanceof Error ? err.message : 'X에 실패했습니다.')` | 실패 → error |
| `alert('연결 테스트가 성공했습니다.')` | `toast.success('연결 테스트가 성공했습니다.')` | 성공 메시지 |
| `alert('최소 1개 이상의 리소스가 필요합니다.')` | `toast.warning('최소 1개 이상의 리소스가 필요합니다.')` | validation 경고 |
| `alert('Credential 관리 페이지로 이동합니다. (데모에서는 미구현)')` | `toast.info('Credential 관리 페이지로 이동합니다. (데모에서는 미구현)')` | 안내 |
| `alert('기능 준비중입니다.')` | `toast.info('기능 준비중입니다.')` | 안내 |
| `alert('삭제 미구현')` | `toast.info('삭제 미구현')` | 안내 |
| `alert('다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n...')` | `toast.warning('다음 VM 리소스의 데이터베이스 설정이 필요합니다: <list>')` | 다중 줄 → 단일 줄로 flatten, comma join |

한국어 문구 **그대로 유지**. Variant 만 의도에 따라 지정.

### 3-4. Edge case: 다중 줄 alert (GCP/Azure/AWS VM 경고)

원본:
```ts
alert(`다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n${unconfiguredVms.map((r) => r.resourceId).join('\n')}`);
```

Toast 는 한 줄 UI 라 개행이 어색함. **2 가지 옵션**:
1. 리소스 ID 를 comma 로 join → `toast.warning('... 설정이 필요합니다: res1, res2, res3')`
2. Toast description 영역 도입 (F1a scope 확장 필요 → 비추천)

**판단**: 옵션 1 로 flatten. UX 미세 degradation 허용. 추후 필요하면 wave13-F1c 에서 description 필드 추가.

## Step 4: Do NOT touch
- Toast 컴포넌트 자체 (F1a 영역)
- `alert()` 이외의 에러 처리 로직 (try/catch 구조 유지)
- JSX 렌더, styling
- 테스트 파일
- Skipped sites — 의도적으로 production 사용 아닌 것 없음 (모두 migration 대상)

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/hooks app/projects app/components
npm run build
```

수동 검증:
- `grep -rn "alert(" app lib --include="*.ts" --include="*.tsx" | grep -v "//"` → **0 결과** 이어야 함 (테스트 파일 제외)
- Dev 서버에서 IdcProjectPage 에러 시나리오, Credential 변경 실패 → 우상단 토스트 표시
- AdminDashboard 의 6 개 alert 경로 검증
- `useApiMutation` 기본 에러 케이스 (suppressAlert=false) 토스트 전환 확인

## Step 6: Commit + push + PR

```
git add app/hooks/ app/projects/ app/components/ app/components/ui/toast/useToast.ts
git commit -m "refactor(ui): migrate 30 alert() sites to toast (wave13-F1b)

Audit §F1 🔴 clean-up. 2 shared hooks (useApiMutation, useAsync) 가
내부적으로 alert 을 쓰던 high-leverage 경로도 포함.

- useToast global bus (registerGlobalToast/toastGlobal) — 훅 환경용
- Shared hooks: useApiMutation:83, useAsync:40 → toastGlobal()?.error(...)
- Project pages: 17 sites (Idc/Sdu/Gcp/Azure/Aws)
- Feature components: 11 sites (AdminDashboard, CredentialListTab 등)
- Multi-line alerts (VM DB 경고 2건) → comma-join flatten

Depends on: wave13-F1a merged. No new alert() remaining in production."
git push -u origin refactor/wave13-f1b-alert
```

PR body (write to `/tmp/pr-wave13-f1b-body.md`):
```
## Summary

Migrate all **30 `alert()` sites** to `useToast()` (wave13-F1a). Includes 2 high-leverage shared hooks (`useApiMutation`, `useAsync`) that were the root of many caller-level alerts.

## Why
Audit §F1 🔴: alert is blocking, non-a11y, non-styleable. Wave13-F1a built the Toast; F1b closes the loop.

## Changes
- `app/components/ui/toast/useToast.ts` — global bus for hook-environment callers
- `app/hooks/useApiMutation.ts`, `app/hooks/useAsync.ts` — alert → toastGlobal()?.error
- 5 project pages (Idc/Sdu/Gcp/Azure/Aws) — 17 sites
- 5 feature files (AdminDashboard, CredentialListTab, 등) — 11 sites
- 2 multi-line alerts flattened (VM DB 경고)

## Depends on
- wave13-F1a merged

## Verify
- [x] tsc, lint, build
- [x] `grep -rn "alert(" app lib` → 0 production results
- [x] Manual error paths in all 5 project pages + AdminDashboard

## Parallel coordination
- wave13-A1, wave13-E1 과 project page 중첩 가능성 → 순차 권장
- wave13-A2 파일 겹치지 않음
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. tsc / lint / build
3. 실제 alert 제거 건수 (30 expected, 0 remain)
4. Global bus 설계 — SSR 가드 + unmount 시 unregister 여부
5. Multi-line flatten UX 확인 (2건)
6. Deviations with rationale

## Parallel coordination
- **Depends on**: wave13-F1a merged
- **Potential conflicts**:
  - wave13-A1 (feature components non-null) — ProcessGuideStepCard, ResourceTransitionPanel, ResourceRow 는 alert 없음 → 충돌 없음
  - wave13-E1 (template className / index key bulk) — `AdminDashboard.tsx`, `IdcProjectPage.tsx`, `SduProjectPage.tsx` 에서 겹칠 수 있음 → **F1b 먼저 merge 후 E1 실행** 권장
  - wave13-A2 (`lib/bff/http.ts`, `lib/api-client/mock/confirm.ts`) — 겹치지 않음
