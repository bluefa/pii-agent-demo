# ADR-001: Process 상태 관리 아키텍처

> **상태**: 승인됨
> **날짜**: 2026-01-30
> **의사결정자**: 설계 논의 참여자

---

## 컨텍스트

PII Agent 시스템은 Cloud Provider별로 서로 다른 연동 프로세스를 가집니다:

| Provider | 프로세스 특징 |
|----------|--------------|
| AWS | TF 권한 유무에 따라 자동/수동 설치 분기 |
| Azure | DB + VM 선택 시 추가 설치 단계 (PE 승인, VM TF) |
| GCP | Subnet 생성 옵션 |
| IDC | 승인 없음, 스캔 없음 |
| SDU | 승인 없음, Crawler 기반 |

초기 설계에서는 Backend가 모든 Process 상태를 계산하여 제공하는 **Server-Driven** 방식을 고려했습니다:

```typescript
// 초기 설계안 (채택하지 않음)
{
  currentStep: 'INSTALLING',
  steps: [...],
  availableActions: ['cancel', 'retry'],
  canApprove: boolean,
  canConfirmTargets: boolean,
  // ...
}
```

---

## 문제점

### 1. 확장성 문제
- `canXxx` 플래그가 상태/액션마다 추가됨
- Provider별 케이스가 다양해지면 플래그 폭발

### 2. 관심사 혼재
- Backend가 "어떤 버튼을 보여줄지"까지 결정
- Step 라벨, 버튼 순서 변경에도 Backend 배포 필요
- i18n, UI 스타일 등 프론트 관심사가 Backend에 침투

### 3. 케이스 판별의 복잡성
- "어떤 Process 케이스인지" 판별하려면 Config + 리소스 정보 필요
- 하지만 실제로 케이스 분기가 필요한 건 **설치 단계** 이후
- 그 시점에는 이미 리소스 확정이 완료되어 필요한 정보가 있음

### 4. 핵심 질문
> "리소스 확정 전에 hasVmResources는 무슨 값이어야 하는가?"

→ 확정 전에는 의미 없는 값. 케이스 판별 자체가 시기상조.

---

## 결정

### Data-Driven 아키텍처 채택

**Backend 역할**: 비즈니스 상태 데이터만 제공
```typescript
{
  scan: { status: 'COMPLETED', ... },
  targets: { confirmed: true, selectedCount: 5 },
  approval: { status: 'APPROVED', ... },
  installation: { status: 'IN_PROGRESS' },
  connectionTest: { status: 'NOT_TESTED' }
}
```

**Frontend 역할**: 상태 데이터를 해석하여 Process UI 구성
```typescript
// Process 정의 (Frontend)
const AWS_STEPS = ['SCAN', 'CONFIRM', 'APPROVAL', 'INSTALL', 'TEST', 'DONE'];

// 현재 단계 계산 (Frontend)
function getCurrentStep(status) {
  if (status.scan?.status !== 'COMPLETED') return 'SCAN';
  if (!status.targets.confirmed) return 'CONFIRM';
  // ...
}

// 가능한 액션 계산 (Frontend)
function getAvailableActions(status, user) {
  if (canApprove(status, user)) return ['approve', 'reject'];
  // ...
}
```

---

## 역할 분담

| 구분 | Backend | Frontend |
|------|---------|----------|
| **역할** | 사실(Fact) 제공 | 해석(Interpretation) |
| **예시** | "승인 상태는 PENDING" | "지금 승인 대기 단계" |
| **변경 시** | 비즈니스 규칙 변경 | UI/UX 변경 |

### 같은 규칙, 다른 목적

"리소스 확정 없이 승인 불가"라는 규칙:

| | Frontend | Backend |
|---|----------|---------|
| **구현** | 버튼 비활성화 | 400 에러 반환 |
| **목적** | UX 개선 | 데이터 무결성 |
| **필수 여부** | 없어도 동작 | **필수** |

---

## Process는 Frontend 개념

**"Process"라는 개념은 Frontend에만 존재합니다.**

- Step 순서, 라벨, 현재 단계 표시 → Frontend
- Step Indicator UI → Frontend
- 어떤 버튼을 보여줄지 → Frontend

**Backend는 "Process"를 모릅니다.**

- 상태 데이터만 제공
- 상태 전이 API만 제공
- 잘못된 전이 요청은 Validation으로 거부

---

## 결과

### 장점

1. **관심사 분리**
   - Backend: 데이터 무결성, 상태 전이 규칙
   - Frontend: UI 로직, 사용자 경험

2. **배포 독립성**
   - Step 라벨 변경 → Frontend만 배포
   - 버튼 추가/순서 변경 → Frontend만 배포
   - 비즈니스 규칙 변경 → 양쪽 배포

3. **유연성**
   - Provider별 UI 차이를 Frontend에서 자유롭게 처리
   - 케이스 판별 시점을 필요한 단계로 지연 가능

4. **테스트 용이성**
   - Frontend Process 로직은 순수 함수로 테스트 가능
   - Backend 상태 전이는 독립적으로 테스트 가능

### 단점 및 완화 방안

1. **로직 중복**
   - 완화: 목적이 다름 (UX vs Validation)
   - Backend validation이 최종 권위

2. **Frontend 복잡도 증가**
   - 완화: `lib/process/` 모듈로 구조화
   - TypeScript로 타입 안전성 확보

3. **불일치 가능성**
   - 완화: Frontend 계산이 틀려도 Backend가 거부
   - 에러 시 상태 새로고침으로 복구

---

## 구현 가이드

### Frontend 구조

```
lib/
  process/
    definitions.ts   # Provider별 Step 정의
    calculator.ts    # 현재 단계 계산
    actions.ts       # 가능한 액션 계산
    types.ts         # 타입 정의
```

### API 호출 전략

```typescript
// Project Detail 페이지 진입 시
const [project, status] = await Promise.all([
  fetchProject(projectId),
  fetchProjectStatus(projectId)
]);

// 현재 단계 계산
const currentStep = getCurrentStep(project.cloudProvider, status);

// 설치 단계라면 상세 정보 추가 로드
if (currentStep === 'INSTALLING') {
  const installStatus = await fetchInstallationStatus(projectId);
  // Provider별로 다른 UI 렌더링
}
```

---

## 참고

- [Cloud Provider별 프로세스 정의](../cloud-provider-states.md)
- [Core API 문서](../api/core.md)
