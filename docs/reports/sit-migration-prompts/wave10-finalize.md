# Task — Phase 1 Finalize (Wave 10)

## Context
Project: pii-agent-demo (Next.js 14, TS, Tailwind, Korean UI).
Wave 10 — single consolidated session. Closes **all remaining Phase 1 gaps** surfaced by the Wave 9 reviews:

1. `GuideCard` renders `null` on Azure / GCP / IDC detail pages — `process-guides.ts` only has AWS content
2. SDU page still has no `GuideCard` — type bridge + SDU guide content required
3. Migration plan §6 I-07 decision record not updated to reflect the 2026-04-23 reversal (`목록으로` back-link removal)
4. Dead resource-table files and `ScanPanel` default wrapper left by Wave 9 flat-list refactor
5. MEMORY.md missing the Phase 1 session summary entry (T17 omission)

This wave ships all five as one PR. Net scope is large in LOC but each sub-task is self-contained.

## Precondition — verify Phase 1 Wave 9 merged
```
cd /Users/study/pii-agent-demo
git fetch origin main

git log origin/main --oneline -30 | grep -q "(Wave 9)" && echo "✓ Wave 9 merged" || { echo "✗ Wave 9 not merged"; exit 1; }
grep -q "export const DbSelectionCard" app/components/features/scan/DbSelectionCard.tsx || { echo "✗ DbSelectionCard missing"; exit 1; }

# GuideCard already renders in Azure/GCP/IDC but with null content
grep -q "GuideCard" app/projects/\[projectId\]/azure/AzureProjectPage.tsx || { echo "✗ Azure GuideCard insertion missing"; exit 1; }
```

## Step 1: Worktree
```
bash scripts/create-worktree.sh --topic wave10-finalize --prefix feat
cd /Users/study/pii-agent-demo-wave10-finalize
```

## Step 2: Required reading (in order)

1. `docs/reports/sit-migration-prompts/wave10-finalize.md` — this file
2. `docs/reports/sit-prototype-migration-plan.md` §6 I-07 (current text — you will rewrite the I-07 row)
3. `design/SIT Prototype.html` L1453-1518 — AWS 7-step guide HTML (adapt per provider)
4. `lib/constants/process-guides.ts` — see the existing AWS entry shape (`auto` / `manual` keys, `stepNumber`, `body` structure)
5. `app/components/features/process-status/GuideCard.tsx` — verify `getProcessGuide(provider, mode)` lookup path
6. `lib/types.ts` — `ProcessStatus` enum (7 values)
7. `app/projects/[projectId]/sdu/SduProjectPage.tsx` — find `SduProcessStatus` usage (around line 48, a `useState<SduProcessStatus>('S3_UPLOAD_PENDING')`)
8. Locate `SduProcessStatus` type definition — grep for `type SduProcessStatus` or `SduProcessStatus =` in `lib/` or `app/`
9. `app/components/features/scan/ScanPanel.tsx` — the `ScanPanel` default export is orphan after Wave 9. `ScanController` is still used. Verify which parts are dead.
10. `app/components/features/resource-table/` directory — run `git grep -l "from.*resource-table/<file>"` for each file to confirm orphan status
11. `app/components/features/admin/AdminHeader.tsx` — T17 retained it because `app/integration/task_admin/page.tsx` imports it. **Do NOT delete**. Confirm still imported.
12. `~/.claude/projects/-Users-study-pii-agent-demo/memory/MEMORY.md` — target file for Phase 1 session entry

---

## Step 3: Implementation — 5 sub-tasks

Order: 3-1 → 3-2 → 3-3 → 3-4 → 3-5. Verify incrementally; do not batch commit.

---

### 3-1. Azure / GCP / IDC guide content in `process-guides.ts`

`process-guides.ts` currently exposes `getProcessGuide(provider, mode)`. Inspect the AWS entry shape first:
```ts
// Expected shape (verify by reading the file):
{
  provider: 'AWS',
  mode: 'auto' | 'manual',
  steps: [
    { stepNumber: 1, title: '...', body: [...] },
    ...
  ]
}
```

Add equivalent 7-step entries for:

#### Azure (single mode — no auto/manual split)
Use `mode: 'default'` or extend the union to include `'default'` if not already present.

7-step content — adapt prototype AWS content with Azure-specific terminology:
- Step 1: 연동 대상 DB 선택 — "Azure Portal에서 대상 DB 리스트를 조회한 뒤 승인 요청을 보내 주세요"
- Step 2: 연동 대상 승인 대기 — 공통 문구
- Step 3: 연동 대상 반영중 — 공통 문구
- Step 4: Agent 설치 — "Azure Agent 설치 스크립트 실행. Subscription/Tenant 정보로 인증"
- Step 5: 연결 테스트 — 공통
- Step 6: 관리자 승인 대기 — 공통
- Step 7: 완료 — 공통

#### GCP (single mode)
Similar to Azure with GCP-specific terms (Project ID, service account 등).

#### IDC (single mode)
IDC는 scan step이 없고 사용자 입력 기반. 간단화된 가이드:
- Step 1: 대상 DB 정보 입력 — "IDC 환경 DB 목록을 수동 입력하여 승인 요청"
- Step 2–7: 공통 진행/완료 안내 (SDU 모듈 설치 안내 포함)

**Structure**:
- Each entry keyed by `{provider, mode}` or whatever key the existing code uses
- Match existing AWS JSON shape (don't invent new fields)
- `body` uses JSX-serializable units (string | `<strong>` | `<a>`) — the same pattern as AWS

**Verify**: After editing, `GuideCard` renders non-null for each provider on detail pages.

---

### 3-2. SDU guide + type bridge

#### a. Find `SduProcessStatus` type
```
grep -rn "type SduProcessStatus\|SduProcessStatus =" app/ lib/ 2>&1 | head
```

It's likely a string literal union in `lib/types/sdu.ts` or `app/projects/[projectId]/sdu/*`. Sample:
```ts
export type SduProcessStatus =
  | 'S3_UPLOAD_PENDING'
  | 'S3_UPLOAD_COMPLETE'
  | 'ATHENA_SETUP_PENDING'
  | ...
```

#### b. Create mapping function
Under `lib/process/sdu-guide-bridge.ts`:
```ts
import { ProcessStatus } from '@/lib/types';
import type { SduProcessStatus } from '<path>';

/**
 * Maps SDU-specific process states to the canonical ProcessStatus enum used
 * by GuideCard. Many-to-one is acceptable (e.g. multiple S3 stages → INSTALLING).
 */
export const mapSduStatusToProcessStatus = (s: SduProcessStatus): ProcessStatus => {
  switch (s) {
    case 'S3_UPLOAD_PENDING': return ProcessStatus.INSTALLING;
    case 'S3_UPLOAD_COMPLETE': return ProcessStatus.WAITING_CONNECTION_TEST;
    case 'ATHENA_SETUP_PENDING': return ProcessStatus.WAITING_CONNECTION_TEST;
    // ... fill rest based on actual SduProcessStatus values
    case 'INSTALLATION_COMPLETE': return ProcessStatus.INSTALLATION_COMPLETE;
    default: return ProcessStatus.WAITING_TARGET_CONFIRMATION;
  }
};
```

Confirm the mapping with `lib/process/calculator.ts` `getSduCurrentStep` if such logic exists — reuse or align.

#### c. Add SDU guide content to `process-guides.ts`
Follow IDC pattern (single mode, simplified). Use SDU domain terms (IAM user, Source IP, Athena 등).

#### d. Insert GuideCard in `SduProjectPage.tsx`
```tsx
// Find: <SduProcessStatusCard ... />
// Insert immediately AFTER it:
<GuideCard
  currentStep={mapSduStatusToProcessStatus(currentStep)}
  provider="SDU"
/>
```

Import `GuideCard` and `mapSduStatusToProcessStatus`.

**Verify**: SDU page renders the GuideCard with SDU-specific content.

---

### 3-3. Migration plan §6 I-07 update

File: `docs/reports/sit-prototype-migration-plan.md`
Section: §6 Open Issues table, row **I-07**

Current wording (approximate):
```
| I-07 | 상세 페이지 복귀 UX | ✅ Breadcrumb + PageHeader backHref 이중 제공 ... |
```

Replace with:
```
| I-07 | 상세 페이지 복귀 UX | ✅ Breadcrumb 단일 제공 (초기 이중 제공 결정은 2026-04-23 사용자 요청으로 변경됨 — PageHeader backHref 제거). 관련 PR: #294 |
```

Add one line in "§6 후속 재검토 사항" if it helps document the history:
```
- 2026-04-23: I-07 번복 — PageHeader `목록으로` ghost 버튼 제거. Breadcrumb만으로 충분하다는 사용자 결정
```

---

### 3-4. Dead file cleanup

**⚠️ Grep confirm before each deletion.** Do not delete a file until `git grep -l "from.*<filename>" app/ lib/` returns nothing.

#### Candidates (Wave 9 flat-list refactor aftermath)
```
app/components/features/resource-table/AwsResourceTableBody.tsx
app/components/features/resource-table/GroupedResourceTableBody.tsx
app/components/features/resource-table/ResourceTypeGroup.tsx
app/components/features/resource-table/RegionGroup.tsx
app/components/features/resource-table/ClusterRow.tsx
```

#### ServiceIcon (check both)
```
app/components/features/resource-table/ServiceIcon.tsx
app/components/ui/AwsServiceIcon.tsx        # or wherever
```
Grep for usage. Some may still be referenced by `FlatResourceTableBody` or `ResourceRow`.

#### ScanPanel default export
`app/components/features/scan/ScanPanel.tsx` contains both:
- `export const ScanController` — still used by `DbSelectionCard`
- `export const ScanPanel` — orphan after Wave 9 (no ProjectPage imports it)

**Action**:
- If `ScanController` is the only surviving export, consider renaming the file to `ScanController.tsx` (git mv) for clarity. Keep `ScanPanel` export? Grep confirms zero callers → safe to delete that function and move `ScanController` to its own file.
- If renaming feels risky, leave the file path as-is and just delete the `ScanPanel` function body + default export. Document choice in PR body.

#### index.ts updates
After deletions, clean up `export` lines in:
- `app/components/features/resource-table/index.ts` (if exists)
- `app/components/features/scan/index.ts`

---

### 3-5. MEMORY.md Phase 1 session entry

File: `~/.claude/projects/-Users-study-pii-agent-demo/memory/MEMORY.md`

Append to the "Completed Sessions (compact)" table:
```
| 04-23 | #272-#294 | SIT Phase 1 완료 — 서비스 목록 + 타겟소스 상세 + 생성 모달 Wave 1-9 통합 (18 PR). 후속은 Phase 2 (IDC 생성 경로, Credentials/PII 메뉴 구현, scanHistoryStatus BFF 필드 연동) |
```

Do **not** duplicate if a similar entry already exists. `cat` the file first and inspect.

---

## Step 4: Do NOT touch

- `GuideCard.tsx` internals
- `DbSelectionCard.tsx` (Wave 9 output)
- `ScanController` logic
- `ResourceTable.tsx` (B8 output)
- `useScanPolling.ts`
- `ProcessGuideModal`, `StepProgressBar`, `ProcessGuideStepCard`, `StepGuide` (StepGuide is now orphan but Phase 2 scope)
- `AdminHeader.tsx` (task_admin still imports)
- 5 `*ProjectPage.tsx` **except** `SduProjectPage.tsx` (getting GuideCard insertion in 3-2)

---

## Step 5: Verify

```
npx tsc --noEmit
npm run lint -- app/projects/ app/components/features/ lib/ 2>&1 | tail -8
```

Both must pass. Lint warning count should **decrease** (dead file deletion + removed unused imports).

Live smoke (if dev server available):
- `/integration/projects/<aws-id>` — GuideCard shows AWS content
- `/integration/projects/<azure-id>` — GuideCard shows Azure content (new)
- `/integration/projects/<gcp-id>` — GuideCard shows GCP content (new)
- `/integration/projects/<idc-id>` — GuideCard shows IDC content (new)
- `/integration/projects/<sdu-id>` — GuideCard shows SDU content (new, via bridge)

---

## Step 6: Commit + push + PR

Single commit covering all 5 sub-tasks (they form a coherent "Phase 1 finalize" chunk).

```
git add lib/constants/process-guides.ts lib/process/sdu-guide-bridge.ts \
        app/projects/[projectId]/sdu/SduProjectPage.tsx \
        docs/reports/sit-prototype-migration-plan.md \
        app/components/features/resource-table/ \
        app/components/features/scan/
git add ~/.claude/projects/-Users-study-pii-agent-demo/memory/MEMORY.md 2>/dev/null || true
git commit -m "feat(sit): Phase 1 finalize — guide content + SDU + docs + cleanup (Wave 10)

1. process-guides.ts: add Azure / GCP / IDC 7-step content (previously null)
2. SDU: type bridge (SduProcessStatus → ProcessStatus) + SDU guide content +
   GuideCard insertion in SduProjectPage
3. Migration plan §6 I-07: record the 2026-04-23 reversal that removed the
   PageHeader '목록으로' back-link
4. Dead file cleanup: remove orphan resource-table bodies and ScanPanel
   default wrapper (Wave 9 flat-list refactor aftermath)
5. MEMORY.md: append Phase 1 session entry (18 PRs: #272-#294)

Closes all review-flagged follow-ups from Waves 7/9. Phase 1 scope complete.

Spec: docs/reports/sit-migration-prompts/wave10-finalize.md"
git push -u origin feat/wave10-finalize
```

PR body (write to `/tmp/pr-wave10-body.md`):
```
## Summary
Wave 10 — single PR closing all Phase 1 review follow-ups.

## Sub-tasks delivered
1. **Guide content (Azure / GCP / IDC)** — `process-guides.ts` now returns non-null for all 4 providers
2. **SDU guide + bridge** — `SduProcessStatus` mapped to `ProcessStatus`; SDU guide content authored; `GuideCard` now renders on SDU detail pages
3. **I-07 documentation** — migration plan §6 updated with 2026-04-23 reversal record
4. **Dead file cleanup** — orphan resource-table bodies + ScanPanel wrapper removed
5. **MEMORY.md** — Phase 1 session entry (#272–#294)

## Before/after
- Azure/GCP/IDC GuideCard: null → populated
- SDU detail page: no guide → populated guide + correct step mapping
- resource-table directory: N files → M files (list both before/after)
- ScanPanel wrapper: orphan → removed (ScanController retained)

## Test plan
- [x] npx tsc --noEmit
- [x] npm run lint (warning count decrease)
- [x] 5 provider detail pages render GuideCard with correct content
- [x] grep confirms 0 imports of deleted files

## Follow-up (Phase 2 scope)
- IDC 신규 생성 경로 (C-03/04 disabled chip 재활성화)
- Credentials / PII Tag mgmt / PII Map 실 구현 (I-08 disabled 처리만 되어 있음)
- `resource.scanHistoryStatus` BFF 필드 연동 (I-06 stub 교체)
- Permissions API 완전 폐기 (I-01 보류분)

## Ref
- docs/reports/sit-migration-prompts/wave10-finalize.md
- Wave 9 review: PR #294 #issuecomment-4301493349
- PR #291 (T17) — MEMORY.md omission patched here
```

## ⛔ Do NOT auto-merge
Stop at `gh pr create`. Report URL.

## Return (under 300 words)

1. PR URL
2. `tsc` / `lint` results (before/after warning count)
3. Sub-task 3-1: 추가된 Azure/GCP/IDC entries와 step 매핑 — 간단 리스트
4. Sub-task 3-2: `SduProcessStatus` 실제 값과 `ProcessStatus` 매핑 표
5. Sub-task 3-4: 실제 삭제한 파일 목록 (grep 결과 근거) + 보존한 파일 (사유)
6. Sub-task 3-5: MEMORY.md 변경 라인 수
7. 감지한 edge case (예: IDC가 single-mode인데 process-guides가 mode 필드를 필수로 요구한다면 어떻게 우회했는지)
8. Deviations from spec + rationale

## Parallel coordination
Single track. This is the **last planned Phase 1 PR**. Follow-ups after merge are Phase 2 candidates, not Phase 1.
