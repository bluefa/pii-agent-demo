# ADR-004: processStatus 저장 필드 리팩토링

## 상태
폐기됨

## 대체 ADR
[ADR-009: processStatus 용어 체계 확정 및 BFF 계산 모델](./009-process-status-terminology.md)

## 날짜
2026-02-04

## 맥락

[ADR-001: Process 상태 관리 아키텍처](./001-process-state-architecture.md)에서 **Data-Driven 아키텍처**를 채택했습니다:

- Backend: 비즈니스 상태 데이터만 제공
- Frontend: 상태 데이터를 해석하여 현재 단계 계산

하지만 현재 구현은 이 결정을 위반하고 있습니다.

### 현재 구현의 문제

`processStatus`가 **저장 필드**로 관리되고, API에서 직접 변경합니다:

```typescript
// lib/types.ts
interface Project {
  processStatus: ProcessStatus;  // 저장 필드로 존재
  // ...
}

// API Routes에서 직접 변경
updateProject(projectId, {
  processStatus: ProcessStatus.INSTALLING,  // 직접 상태 전이
});
```

### ADR-001 기준 올바른 구현

`processStatus`는 **계산 값**이어야 합니다:

```typescript
// Backend가 제공하는 상태 데이터
interface ProjectStatus {
  scan: { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' };
  targets: { confirmed: boolean; selectedCount: number };
  approval: { status: 'PENDING' | 'APPROVED' | 'REJECTED' };
  installation: { status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' };
  connectionTest: { status: 'NOT_TESTED' | 'PASSED' | 'FAILED' };
}

// Frontend에서 계산
function getCurrentStep(status: ProjectStatus): ProcessStatus {
  if (status.scan?.status !== 'COMPLETED') return 'SCAN';
  if (!status.targets.confirmed) return 'WAITING_TARGET_CONFIRMATION';
  if (status.approval.status === 'PENDING') return 'WAITING_APPROVAL';
  if (status.installation.status !== 'COMPLETED') return 'INSTALLING';
  if (status.connectionTest.status !== 'PASSED') return 'WAITING_CONNECTION_TEST';
  return 'INSTALLATION_COMPLETE';
}
```

## 문제점

### 1. 상태 불일치 가능성

설치 상태(`AwsInstallationStatus`)와 프로젝트 상태(`processStatus`)가 별도로 관리되어 불일치 발생:

```
mockAwsInstallations[proj-1]: serviceTfCompleted=true, bdcTfCompleted=true
mockProjects[proj-1]: processStatus=WAITING_TARGET_CONFIRMATION
```

→ UI는 설치 완료로 표시되지만 단계 전이 안 됨

### 2. 관심사 혼재

Frontend가 상태 전이 API(`complete-installation`)를 호출하여 Backend 상태를 변경:

```typescript
// AwsInstallationInline.tsx
if (data.serviceTfCompleted && data.bdcTfCompleted) {
  onInstallComplete?.();  // → complete-installation API 호출
}
```

이는 ADR-001의 "Frontend는 해석만, Backend는 사실 제공"을 위반합니다.

### 3. 중복 로직

상태 전이 조건이 여러 곳에 분산:
- API Routes: validation 체크
- 컴포넌트: UI 분기 조건
- Mock 데이터: 초기값 설정

## 영향 범위

### API Routes (상태 변경) - 10개 파일

| 파일 | 현재 동작 |
|------|----------|
| `approve/route.ts` | WAITING_APPROVAL → INSTALLING |
| `reject/route.ts` | WAITING_APPROVAL → WAITING_TARGET_CONFIRMATION |
| `confirm-targets/route.ts` | → WAITING_APPROVAL 또는 INSTALLING |
| `complete-installation/route.ts` | INSTALLING → WAITING_CONNECTION_TEST |
| `test-connection/route.ts` | → CONNECTION_VERIFIED |
| `confirm-completion/route.ts` | → INSTALLATION_COMPLETE |
| `confirm-pii-agent/route.ts` | → INSTALLATION_COMPLETE |
| `credentials/route.ts` | 상태 validation |
| `resources/credential/route.ts` | 상태 validation |
| `projects/route.ts` | 초기값 설정 |

### 컴포넌트 (상태 읽기) - 6개 파일

| 파일 | 현재 동작 |
|------|----------|
| `ProcessStatusCard.tsx` | `project.processStatus`로 현재 단계 결정 |
| `ResourceTable.tsx` | 편집 가능 여부, credential 컬럼 표시 |
| `ProjectsTable.tsx` | 상태 뱃지, 액션 버튼 분기 |
| `AwsProjectPage.tsx` | `isStep1` 판단 |
| `AzureProjectPage.tsx` | `isStep1` 판단 |
| `ProjectDetail.tsx` | credential 로드 여부 |

## 제안

### 1단계: 상태 데이터 구조 정의

```typescript
// lib/types.ts
interface ProjectStatus {
  scan: ScanStatus;
  targets: TargetsStatus;
  approval: ApprovalStatus;
  installation: InstallationStatus;
  connectionTest: ConnectionTestStatus;
}
```

### 2단계: 현재 단계 계산 함수 구현

```typescript
// lib/process/calculator.ts
export function getCurrentStep(
  cloudProvider: CloudProvider,
  status: ProjectStatus
): ProcessStatus {
  // Provider별 로직 분기
}
```

### 3단계: API Routes 수정

- `processStatus` 직접 변경 제거
- 개별 상태 데이터만 업데이트
- 응답에 계산된 `processStatus` 포함

### 4단계: 컴포넌트 수정

- `project.processStatus` → `getCurrentStep(project)` 사용
- 또는 API 응답에 계산된 값 포함

## 관련 파일

- `lib/types.ts` - Project 타입 정의
- `lib/mock-data.ts` - Mock 데이터
- `app/api/projects/[projectId]/*/route.ts` - 상태 전이 API들
- `app/components/features/ProcessStatusCard.tsx`
- `app/components/features/ResourceTable.tsx`
- `app/projects/[projectId]/**/*.tsx`

## 참고

- [ADR-001: Process 상태 관리 아키텍처](./001-process-state-architecture.md)
