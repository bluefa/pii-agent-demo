# Wave 12-B3 — InstallationInline Hook Extraction (not full unification)

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 12 follow-up to wave11-README deferred item "provider InstallationInline
unification (AWS/GCP/Azure)". **Full unification은 scope 외** — provider 별
rendering/modeling 차이가 크다. 이 spec 은 **실제 3-way 중복된 fetch+polling+error
상태 머신만** generic hook 으로 추출한다.

Sources (현재 main):
- `app/components/features/process-status/aws/AwsInstallationInline.tsx` (419 LOC)
- `app/components/features/process-status/azure/AzureInstallationInline.tsx` (376 LOC)
- `app/components/features/process-status/gcp/GcpInstallationInline.tsx` (104 LOC)

## Precondition
```
cd /Users/study/pii-agent-demo
git fetch origin main
# A1 consumer migration (PR #306) merged first — depends on ERROR_MESSAGES import already in each file
git log origin/main --oneline -20 | grep -q "wave11-a1-consumer" || { echo "✗ #306 not merged — wait"; exit 1; }
```

이 spec 은 PR #306 merge **이후** 시작해야 함. #306 이 `ERROR_MESSAGES.STATUS_FETCH_FAILED` 를 세 파일에 이미 심어둠 — 이 spec 은 그 import 를 그대로 사용.

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave12-b3-inst-hook --prefix refactor
cd /Users/study/pii-agent-demo-wave12-b3-inst-hook
```

## Step 2: Required reading
1. 3 파일 각각 full read (크기 상이하니 모두 읽기)
2. `.claude/skills/anti-patterns/SKILL.md` §D3 (중복 훅 패턴), §D6
3. `app/hooks/usePollingBase.ts` (wave11-B3 에서 merged) — **참고용**, 재사용하지는 않음 (이 spec 은 polling 이 아닌 1회 fetch + manual refresh 패턴)
4. API signatures:
   - `app/lib/api/aws.ts` — `getAwsInstallationStatus`, `checkAwsInstallation`
   - `app/lib/api/azure.ts` — `getAzureInstallationStatus`, `checkAzureInstallation`
   - `app/lib/api/gcp.ts` — `getGcpInstallationStatus`, `checkGcpInstallation`

## Step 3: Implementation

### 3-1. 실제 중복 확인 (baseline — 이미 grep 완료)

세 파일 공통 state:

| State | AWS | Azure | GCP |
|-------|-----|-------|-----|
| `status: T \| null` | ✅ | ✅ | ✅ |
| `loading: boolean` | ✅ | ✅ | ✅ |
| `error: string \| null` | ✅ | ✅ | ✅ |
| `refreshing: boolean` | ❌ | ✅ | ✅ |
| `completionNotifiedRef` | ✅ | ❌ | ❌ (inline callback) |

공통 callback:
- `fetchStatus`: `setLoading(true); setError(null); const d = await getFn(id); setStatus(d); setError(err.message ?? ERROR_MESSAGES.STATUS_FETCH_FAILED); setLoading(false)`
- `useEffect(() => { fetchStatus() }, [fetchStatus])`
- `handleRefresh`: 동일 shape 으로 `checkFn` 호출, `refreshing` state 토글 (AWS 는 없음 — 현재 AWS 는 refresh 버튼이 없거나 다른 방식)

### 3-2. 신규 훅 `app/hooks/useInstallationStatus.ts`

```ts
'use client';

import { useState, useEffect, useCallback } from 'react';
import { ERROR_MESSAGES } from '@/lib/constants/messages';

interface UseInstallationStatusOptions<T> {
  targetSourceId: number;
  getFn: (id: number) => Promise<T>;
  checkFn?: (id: number) => Promise<T>;
  onComplete?: (status: T) => void;
  isComplete?: (status: T) => boolean;
}

export function useInstallationStatus<T>({
  targetSourceId,
  getFn,
  checkFn,
  onComplete,
  isComplete,
}: UseInstallationStatusOptions<T>) {
  const [status, setStatus] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getFn(targetSourceId);
      setStatus(data);
      if (isComplete?.(data)) onComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.STATUS_FETCH_FAILED);
    } finally {
      setLoading(false);
    }
  }, [targetSourceId, getFn, onComplete, isComplete]);

  const refresh = useCallback(async () => {
    if (!checkFn) return;
    try {
      setRefreshing(true);
      setError(null);
      const data = await checkFn(targetSourceId);
      setStatus(data);
      if (isComplete?.(data)) onComplete?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.STATUS_FETCH_FAILED);
    } finally {
      setRefreshing(false);
    }
  }, [targetSourceId, checkFn, onComplete, isComplete]);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return { status, loading, refreshing, error, fetchStatus, refresh };
}
```

### 3-3. 3 파일 각각 migration

세 파일에서 `useState`/`useCallback`/`useEffect` 블록을 제거하고 `useInstallationStatus` 로 교체. **JSX/rendering logic 은 건드리지 않음**.

예시 (GCP, 가장 간단):

```ts
// Before: 4 useStates + fetchStatus useCallback + useEffect + handleRefresh
// After:
const { status, loading, refreshing, error, refresh } = useInstallationStatus({
  targetSourceId,
  getFn: getGcpInstallationStatus,
  checkFn: checkGcpInstallation,
  onComplete: onInstallComplete,
  isComplete: (s) => s.summary.allCompleted,
});
const handleRefresh = refresh; // 기존 이름 유지
```

**주의 케이스**:
- **AWS**: `completionNotifiedRef` 로 onComplete 1회만 호출하는 로직 → `isComplete` 는 그대로 두고, `onComplete` 래퍼에서 중복 호출 방지. 또는 `useInstallationStatus` 내부로 ref 이동은 **금지** — scope 초과.
  ```ts
  const completionNotifiedRef = useRef(false);
  const { status, loading, error, fetchStatus } = useInstallationStatus({
    targetSourceId,
    getFn: getAwsInstallationStatus,
    isComplete: isFullyCompleted,
    onComplete: () => {
      if (!completionNotifiedRef.current) {
        completionNotifiedRef.current = true;
        onInstallComplete?.();
      }
    },
  });
  ```
- **Azure**: 다른 useEffect/useMemo (`unifiedResources`, `showSubnetGuide`, `showPeGuide`) 는 **건드리지 않음**. 오직 status/loading/error/refreshing + fetchStatus/refresh 만 훅으로 이동.
- **GCP**: `handleRefresh` 가 GCP 고유 `'상태 새로고침에 실패했습니다.'` 를 쓰고 있음. 훅은 `STATUS_FETCH_FAILED` 만 지원 → **훅을 쓰지 않고 refresh 만 inline 유지** 하거나, fetch 실패 메시지는 통합(권장). **판단**: GCP refresh 의 에러 메시지는 `STATUS_FETCH_FAILED` 로 통합 (UX 영향 minor). 원본 문자열 변경은 PR body 에 명시적 deviation 기록.

### 3-4. LOC 목표

| 파일 | Before | After (target) |
|------|--------|---------------|
| `app/hooks/useInstallationStatus.ts` | 0 | ~55 (new) |
| `AwsInstallationInline.tsx` | 419 | ≤ 395 (~24 LOC saved) |
| `AzureInstallationInline.tsx` | 376 | ≤ 352 |
| `GcpInstallationInline.tsx` | 104 | ≤ 80 |
| **총계** | 899 | 882 (net −17 after +55 hook) |

순수 LOC 절감은 작아 보이지만 **상태 머신 consolidation** 이 핵심 가치 — 향후 세 provider 의 fetch/error 동작 일관성 유지 용이.

## Step 4: Do NOT touch
- 각 `InstallationInline` 의 JSX 렌더 부분
- provider-specific modal/guide (AzureSubnetGuide, AzurePeApprovalGuide 등)
- API layer (`app/lib/api/{aws,azure,gcp}.ts`)
- 다른 hook 파일
- `app/hooks/usePollingBase.ts` — 재사용 금지 (polling 패턴 다름)

## Step 5: Verify
```
npx tsc --noEmit
npm run lint -- app/hooks/useInstallationStatus.ts app/components/features/process-status/{aws,azure,gcp}/
npm run build
```

모두 통과해야 함. Lint warning count 불변.

수동 검증:
- AWS / Azure / GCP 각 페이지에서 InstallationInline 로딩 → 상태 표시 → refresh 버튼 (AWS 제외) → 에러 시나리오
- 완료 콜백(`onInstallComplete`) 이 정상 1회 호출되는지 (AWS 특히)
- Network 탭에서 `getXxxInstallationStatus` 1회 초기 호출 확인

## Step 6: Commit + push + PR
```
git add app/hooks/useInstallationStatus.ts \
        app/components/features/process-status/{aws,azure,gcp}/
git commit -m "refactor(install): extract useInstallationStatus hook (wave12-B3)

3-way 중복이었던 fetch+refresh+error 상태머신을 generic hook 으로
통합. JSX/modeling 차이가 커서 full 컴포넌트 통합은 scope 외.

- app/hooks/useInstallationStatus.ts (new, ~55 LOC)
- Aws/Azure/GcpInstallationInline.tsx: 각 ~24 LOC 제거
- Net: +55 / -~72 = -17 LOC
- 에러 메시지 STATUS_FETCH_FAILED 로 통합 (GCP refresh 포함)

No rendering change, no API contract change."
git push -u origin refactor/wave12-b3-inst-hook
```

PR body (write to `/tmp/pr-wave12-b3-body.md`):
```
## Summary

Extract duplicated `fetchStatus / loading / refreshing / error` state machine
from AWS/Azure/GCP InstallationInline into a generic `useInstallationStatus<T>`
hook. **Full component unification is deferred** — provider별 modeling/rendering
차이가 substantial.

## Why
- 3 파일 모두 동일 shape 의 state 4종 + fetchStatus/refresh callback
- 에러 fallback 동일 (`ERROR_MESSAGES.STATUS_FETCH_FAILED`, PR #306 에서 통합 완료)
- 향후 provider 추가 / 에러 정책 변경 시 single source

## Changes
- `app/hooks/useInstallationStatus.ts` (new)
- `AwsInstallationInline.tsx`: 4 useStates + fetchStatus + useEffect → hook 1 line
- `AzureInstallationInline.tsx`: 동일 (단, `unifiedResources` useMemo + guide 관련 state 은 유지)
- `GcpInstallationInline.tsx`: 동일, refresh 에러 메시지 STATUS_FETCH_FAILED 로 통합

## Deliberately excluded
- JSX / rendering logic / modals
- Provider-specific modeling (AzureV1Resource, UnifiedInstallResource 등)
- AWS completionNotifiedRef 로직 (훅 외부에서 처리)

## Test plan
- [x] tsc / lint / build
- [x] Manual: 3 provider installation 화면, refresh, error
- [x] `onInstallComplete` 1회만 호출 (AWS)

## Depends on
- PR #306 (wave11-A1 consumer migration) — ERROR_MESSAGES import 사전 존재
- 파일 overlap 없어 `wave11-B1`, `wave12-B1` 와 병렬 가능

## Ref
- Audit: `docs/reports/frontend-anti-patterns-audit-2026-04-23.md` §D3, §D6
- Skill: `.claude/skills/anti-patterns/SKILL.md`
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report the URL.

## Return (under 200 words)
1. PR URL
2. `tsc` / `lint` / `build` results
3. LOC before/after for 3 files + new hook
4. AWS completionNotifiedRef 처리 방식 (spec 제안 대로인지)
5. GCP refresh 에러 메시지 통합 확인 ("상태 새로고침에 실패했습니다." 제거 여부)
6. 훅 extraction 중 발견한 provider 별 edge case
7. Deviations from spec with rationale

## Parallel coordination
- **Depends on**: PR #306 merged
- 파일 overlap **없음** 으로 다음과 병렬 안전:
  - `wave11-B1` (`app/components/features/idc/*`)
  - `wave12-B1` (`ConnectionTestPanel` + `connection-test/*`)
