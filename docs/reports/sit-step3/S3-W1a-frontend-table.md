# S3-W1a — Frontend Table + Card (Happy Path)

> **Recommended model**: Sonnet 4.6
> **Estimated LOC**: ~250 (~180 component + ~70 tests)
> **Branch prefix**: `feat/sit-step3-w1a-frontend-table`
> **Depends on**: S2-W1a, S2-W1b, S2-W1c (모두 머지)

## Context

Step 3 (`APPLYING_APPROVED` = ProcessStatus 3) 화면의 메인 카드 + 테이블을 시안에 맞춰 구현.

본 wave 는 **happy path 만 다룸** — SYSTEM_ERROR 케이스 + reselect 버튼은 S3-W1b 에서.

작업 범위:
1. **`ApplyingApprovedTable`** 신규 — 시안 7 컬럼 그대로.
2. **`ApplyingApprovedCard`** 신규 — 카드 + 테이블 컨테이너 (status pill **미사용**).
3. `ApplyingApprovedStep.tsx` 재구성 — 신규 카드로 교체.
4. 기존 `ApprovalApplyingBanner` 제거 (시안에 없음).
5. 기존 `ApprovedIntegrationSection` / `ApprovedIntegrationTable` 제거 또는 본 wave 산출물로 대체.
6. 시연 **Next 버튼 미포함**.

⛔ **`반영중` status pill 미사용** — 사용자 결정.

## Precondition

```bash
cd /Users/study/pii-agent-demo
git fetch origin main
[ -f app/components/ui/StepBanner.tsx ] || { echo "✗ S2-W1c 미머지"; exit 1; }
grep -q "scan_status" lib/bff/mock/confirm.ts || { echo "✗ S2-W1b mock 미반영"; exit 1; }
grep -q "ResourceScanStatus" lib/types.ts || { echo "✗ S2-W1a types 미반영"; exit 1; }
[ -f app/integration/target-sources/'[targetSourceId]'/_components/layout/ApplyingApprovedStep.tsx ] || { echo "✗ 기존 컴포넌트 부재"; exit 1; }
```

## Required reading

1. `design/app/SIT Prototype v2.html` line 1612–1677 — **시각/카피 단일 source of truth**
2. `app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep.tsx` (수정 대상)
3. `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationSection.tsx` (제거/통합 대상)
4. `app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable.tsx` (제거/통합 대상)
5. `app/components/features/process-status/ApprovalApplyingBanner.tsx` (제거 대상)
6. `docs/swagger/confirm.yaml` `ApprovedIntegrationResponseDto` (line 1052–1073) + `ResourceConfigDto` (S2-W1a 가 추가한 필드 확인)
7. `lib/types.ts` `ResourceScanStatus` / `ResourceIntegrationStatus`
8. `app/lib/api/index.ts` `getApprovedIntegration`
9. `app/components/ui/StepBanner.tsx` (참고만 — Step 3 happy path 에는 사용하지 않음)
10. `lib/theme.ts` `tagStyles` / `bgColors` / `textColors`
11. `docs/reports/sit-step3/00-README.md` §8 (디자인 원칙)

## Step 1: Worktree

```bash
bash scripts/create-worktree.sh --topic sit-step3-w1a-frontend-table --prefix feat
cd /Users/study/pii-agent-demo-sit-step3-w1a-frontend-table
```

## Step 2: 컴포넌트 트리 설계

```
ApplyingApprovedStep (수정 대상)
├── ProjectPageMeta              (기존 유지)
├── ProcessStatusCard            (기존 유지)
└── ApplyingApprovedCard         (✨ 신규)
    ├── card-header
    │   ├── title group (h2 + sub)
    │   └── (status pill 미사용 — Q3-5)
    ├── card-body
    │   └── ApplyingApprovedTable (✨ 신규)
    └── footer (✨ S3-W1b 가 errorSlot / reselectSlot 채움)
```

⛔ 본 wave 에서 errorSlot / reselectSlot 정의만 하고 wiring 은 비워둠 (`null`). S3-W1b 가 채움.

## Step 3: 데이터 매핑 헬퍼

### 3.1. `mergeApprovedResources` 함수

위치: `app/integration/target-sources/[targetSourceId]/_components/approved/merge-approved-resources.ts` (~50 LOC)

```ts
import type {
  ApprovedIntegrationResponse,
  ResourceConfigDto,
  ExcludedResourceInfo,
} from '@/lib/types';

export interface ApplyingApprovedRow {
  resourceId: string;
  resourceType: string;       // "MySQL" / "PostgreSQL" / ...
  region?: string;
  databaseName?: string;
  exclusionReason?: string;   // 제외 리소스만
  scanStatus?: 'UNCHANGED' | 'NEW_SCAN';
  integrationStatus?: 'INTEGRATED' | 'NOT_INTEGRATED';
  isExcluded: boolean;
}

export const mergeApprovedResources = (
  response: ApprovedIntegrationResponse,
): ApplyingApprovedRow[] => {
  const selected: ApplyingApprovedRow[] = response.resource_infos.map((info) => ({
    resourceId: info.resource_id,
    resourceType: info.database_type ?? info.resource_type,  // 매핑 정책 확인
    region: info.database_region,
    databaseName: info.resource_name,
    exclusionReason: undefined,
    scanStatus: info.scan_status ?? undefined,
    integrationStatus: info.integration_status ?? undefined,
    isExcluded: false,
  }));

  const excluded: ApplyingApprovedRow[] = response.excluded_resource_infos.map((info) => ({
    resourceId: info.resource_id,
    resourceType: '',           // ExcludedResourceInfo 에 type 정보 부재 — 빈값 또는 lookup
    region: undefined,
    databaseName: undefined,
    exclusionReason: info.exclusion_reason,
    scanStatus: undefined,
    integrationStatus: undefined,
    isExcluded: true,
  }));

  return [...selected, ...excluded];
};
```

⚠️ `ExcludedResourceInfo` 가 BFF 에서 제외 리소스의 type/region/dbname 메타데이터를 제공하지 않을 수 있음. 시안 row 3 은 PostgreSQL 의 region/dbname 을 모두 표시. **현재 BFF 명세로는 채울 수 없으므로 빈셀 (`—`) 표시** + W1c 또는 별도 issue 에서 BFF 응답 확장 검토.

→ Self-audit Step 8 에서 grep 으로 명세 확인 필요.

### 3.2. enum 라벨 헬퍼

위치: 같은 파일 또는 `app/integration/target-sources/[targetSourceId]/_components/approved/labels.ts` (~30 LOC)

```ts
export const formatScanStatus = (status?: 'UNCHANGED' | 'NEW_SCAN'): string => {
  if (status === 'NEW_SCAN') return '신규';
  return '—';   // UNCHANGED 또는 null → '—'
};

export const formatIntegrationStatus = (
  status?: 'INTEGRATED' | 'NOT_INTEGRATED',
): string => {
  if (status === 'INTEGRATED') return 'Integrated';
  return '—';   // NOT_INTEGRATED 또는 null → '—'
};
```

⛔ 함수 시그니처에서 raw string 반환. JSX 에서 React node 가 필요하면 호출부에서 `<>{formatScanStatus(...)}</>` 로 wrapping.

## Step 4: `ApplyingApprovedTable` 컴포넌트

### 위치: `app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingApprovedTable.tsx` (~110 LOC)

#### 4.1. Props

```ts
interface ApplyingApprovedTableProps {
  rows: ApplyingApprovedRow[];
}
```

#### 4.2. 컬럼 (시안 line 1628–1636)

| # | 헤더 | 데이터 | null 처리 |
|---|---|---|---|
| 1 | `DB Type` | `<TagBadge variant="info">{resourceType}</TagBadge>` 또는 `'—'` | row.resourceType 비어있으면 `—` |
| 2 | `Resource ID` | `<span class="font-mono text-[12px]">{resourceId}</span>` | 항상 값 있음 |
| 3 | `Region` | `<span class="font-mono text-[12px]">` | null → `—` |
| 4 | `DB Name` | `<span class="font-mono text-[12px]">` | null → `—` |
| 5 | `연동 제외 사유` | `exclusionReason ?? '—'` | 선택 리소스 → `—` |
| 6 | `스캔 이력` | `formatScanStatus(scanStatus)` | NEW_SCAN→신규 / 그 외→`—` |
| 7 | `연동 이력` | `formatIntegrationStatus(integrationStatus)` | INTEGRATED→Integrated / 그 외→`—` |

⛔ **체크박스 컬럼 미포함** (시안에 없음 — Step 2 와 다름).
⛔ **# (행 번호) 컬럼 미포함** (시안 1628 에 없음 — Step 2 와 다름).

#### 4.3. 테이블 시각

- 헤더: `bg-gray-50 text-[12px] font-semibold text-gray-500 uppercase tracking-wide` + `px-6 py-3`
- 행: `border-t border-gray-100`. hover `bg-gray-50`
- 셀: `px-6 py-4 text-[14px]`
- 제외 행 — 시안에서 별도 시각 강조 없음. row dimming 이나 색상 처리 **하지 않음** (시안 그대로).

#### 4.4. Empty 상태

- `rows.length === 0` → `<EmptyState>반영 중인 리소스가 없습니다.</EmptyState>` (기존 `ApprovedIntegrationTable` 의 카피 재사용)

## Step 5: `ApplyingApprovedCard` 컴포넌트

### 위치: `app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingApprovedCard.tsx` (~90 LOC)

```tsx
'use client';

import type { ReactNode } from 'react';
import { useApiQuery } from '@/app/hooks/useApiQuery';
import { Card } from '@/app/components/ui/Card';
import { ApplyingApprovedTable } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingApprovedTable';
import { mergeApprovedResources } from '@/app/integration/target-sources/[targetSourceId]/_components/approved/merge-approved-resources';
import { getApprovedIntegration } from '@/app/lib/api';

interface ApplyingApprovedCardProps {
  targetSourceId: number;
  errorSlot?: ReactNode;        // S3-W1b 가 채움
  reselectSlot?: ReactNode;     // S3-W1b 가 채움
}

export const ApplyingApprovedCard = ({
  targetSourceId,
  errorSlot,
  reselectSlot,
}: ApplyingApprovedCardProps) => {
  const { data, error, isLoading } = useApiQuery({
    queryKey: ['approved-integration', targetSourceId],
    queryFn: ({ signal }) => getApprovedIntegration(targetSourceId, { signal }),
  });

  const rows = data ? mergeApprovedResources(data) : [];

  return (
    <Card
      title="연동 대상 반영중"
      subtitle="관리자 승인 후 Agent 설치를 위한 사전 작업이 자동으로 진행됩니다."
    >
      {/* errorSlot — S3-W1b 가 SYSTEM_ERROR/UNAVAILABLE 시 StepBanner 노출 */}
      {errorSlot}

      {isLoading ? <TableSkeleton /> : null}
      {error ? <ErrorState /> : null}
      {!isLoading && !error ? <ApplyingApprovedTable rows={rows} /> : null}

      {reselectSlot && (
        <div className="flex justify-end items-center mt-4">
          {reselectSlot}
        </div>
      )}
    </Card>
  );
};
```

⛔ status pill prop **미정의** (Q3-5).
⛔ Next 버튼 **미포함** (Q3-2).

## Step 6: `ApplyingApprovedStep.tsx` 재구성

```tsx
export const ApplyingApprovedStep = ({ project, identity, providerLabel, action, onProjectUpdate }: Props) => {
  return (
    <>
      <ProjectPageMeta project={project} providerLabel={providerLabel} identity={identity} action={action} />
      <ProcessStatusCard project={project} onProjectUpdate={onProjectUpdate} />

      {/* 본 wave 에서는 errorSlot / reselectSlot null. S3-W1b 가 wiring */}
      <ApplyingApprovedCard targetSourceId={project.targetSourceId} />

      {/* RejectionAlert 는 본 step 에서 렌더하지 않음 (반려는 Step 2 도메인) */}
    </>
  );
};
```

⛔ `ApprovalApplyingBanner` import 제거.
⛔ `ApprovedIntegrationSection` import 제거.
⛔ `RejectionAlert` import 제거 — Step 3 에서는 SYSTEM_ERROR 와 분리. RejectionAlert 의 `isRejected` 는 Step 2 의 도메인.

## Step 7: 기존 컴포넌트 정리

### 7.1. `ApprovalApplyingBanner` 제거

```bash
grep -rln "ApprovalApplyingBanner" app/ | grep -v __tests__
```

→ 결과가 `ApplyingApprovedStep.tsx` 만이면 import 제거 + 파일 삭제 + 테스트 제거.
→ 다른 사용처 있으면 별도 issue 분리.

### 7.2. `ApprovedIntegrationTable` / `ApprovedIntegrationSection` 처리

본 wave 산출물이 100% 대체하므로 삭제 권장. 단:
```bash
grep -rln "ApprovedIntegrationTable\|ApprovedIntegrationSection" app/ | grep -v __tests__
```
→ 다른 화면(예: target-source 상세의 다른 탭) 사용 여부 grep 후 결정.

## Step 8: Tests

### 8.1. `merge-approved-resources.test.ts` (~40 LOC)

- 선택 + 제외 리소스 concat 순서 (선택 먼저)
- 선택 리소스의 `isExcluded === false`
- 제외 리소스의 `isExcluded === true && exclusionReason !== undefined`
- ExcludedResourceInfo 의 region/dbname 미존재 시 undefined 그대로

### 8.2. `labels.test.ts` (~30 LOC)

- `formatScanStatus`: NEW_SCAN→`신규` / UNCHANGED→`—` / undefined→`—`
- `formatIntegrationStatus`: INTEGRATED→`Integrated` / NOT_INTEGRATED→`—` / undefined→`—`

### 8.3. `ApplyingApprovedTable.test.tsx` (~70 LOC)

- 7 컬럼 헤더 렌더링 검증
- 선택 행의 `연동 제외 사유` 셀 = `—`
- 제외 행의 `연동 제외 사유` 셀 = exclusionReason
- enum 라벨 매핑 검증
- mono 셀 클래스 적용
- empty state 카피

### 8.4. `ApplyingApprovedCard.test.tsx` (~50 LOC)

- 카피 1:1 검증 (`연동 대상 반영중`, sub-text)
- status pill 노출 안 됨 (검색해서 `반영중` 텍스트 없어야 함)
- errorSlot / reselectSlot prop 작동
- loading / error / data 상태별 렌더

## Step 9: Self-Audit

`/sit-recurring-checks` + `/simplify` + `/vercel-react-best-practices` 순차.

추가 검증:
- 카피:
  ```bash
  grep -F "연동 대상 반영중" app/integration/target-sources/'[targetSourceId]'/_components/approved/
  grep -F "관리자 승인 후 Agent 설치를 위한 사전 작업이 자동으로 진행됩니다" app/integration/target-sources/'[targetSourceId]'/_components/approved/
  ```
- 금지 카피 부재 (status pill 제거):
  ```bash
  grep -F "반영중" app/integration/target-sources/'[targetSourceId]'/_components/approved/ApplyingApprovedCard.tsx
  ```
  → 0 matches (카드 sub-text 의 "반영중" 은 "연동 대상 반영중" 의 일부이지만, 별도 status pill 노출은 없어야 함 — 컴포넌트 분리해서 검증 가능)
- Next 버튼 부재:
  ```bash
  grep -nE "setStep\(4\)|onClick.*Next" app/integration/target-sources/'[targetSourceId]'/_components/approved/
  ```
  → 0 matches.
- raw hex 0건:
  ```bash
  grep -rnE "#[0-9a-fA-F]{3,6}" app/integration/target-sources/'[targetSourceId]'/_components/approved/ | grep -v "fill=\"#" | grep -v "stroke=\"#"
  ```

## Step 10: Verify

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/'[targetSourceId]'/_components/approved/
npm run test -- ApplyingApproved merge-approved-resources labels
USE_MOCK_DATA=true npm run dev   # 수동: ProcessStatus=3 로 강제 진입 후 시안과 픽셀 비교
```

## Step 11: PR

```markdown
## Summary
- Spec: `docs/reports/sit-step3/S3-W1a-frontend-table.md` @ <SHA>
- Wave: S3-W1a
- 의존: S2-W1a, S2-W1b, S2-W1c (merged)
- 디자인 reference: `design/app/SIT Prototype v2.html` line 1612–1677

## Changed files
- app/integration/target-sources/[targetSourceId]/_components/approved/merge-approved-resources.ts (신규)
- app/integration/target-sources/[targetSourceId]/_components/approved/labels.ts (신규)
- app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingApprovedTable.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/approved/ApplyingApprovedCard.tsx (신규)
- app/integration/target-sources/[targetSourceId]/_components/layout/ApplyingApprovedStep.tsx (수정)
- (조건부 삭제) app/components/features/process-status/ApprovalApplyingBanner.tsx
- (조건부 삭제) app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationTable.tsx
- (조건부 삭제) app/integration/target-sources/[targetSourceId]/_components/approved/ApprovedIntegrationSection.tsx
- 테스트 신규/수정

## Manual verification
- [ ] 시안 line 1612–1677 와 픽셀 비교 — 스크린샷 첨부
- [ ] 카피 1:1
- [ ] `반영중` status pill / Next 버튼 미노출
- [ ] mock 에서 scan_status=NEW_SCAN / UNCHANGED 케이스 모두 표시 정상

## Deferred to later waves
- SYSTEM_ERROR / UNAVAILABLE alert + Step 1 회귀 버튼 → S3-W1b
- 디자인 토큰 정리 / 픽셀 정합 final pass → S3-W1c
```

## ⛔ 금지

- 시안 카피 변경.
- `반영중` status pill 추가.
- 시연 Next 버튼 추가.
- `ApprovedIntegrationTable` 의 기존 카피 ("반영 중인 리소스가 없습니다") 외 새로운 카피 도입 시 reviewer 승인.
- ExcludedResourceInfo 에 BFF 가 제공하지 않는 필드를 frontend 가 fabricate 하는 것 — 빈셀 `—` 그대로 표시.
- 다른 Step (1, 2, 4, 5, 6, 7) 컴포넌트 수정.
