# API 공통 정의

> 모든 API에서 공유하는 타입, 인증, 에러 형식을 정의합니다.

---

## Base URL

```
/api
```

---

## 인증

> TODO: 실제 인증 방식 정의 필요

```typescript
// 헤더
Authorization: Bearer <token>
```

---

## 응답 형식

### 성공

```typescript
{
  success: true,
  data: T
}
```

### 에러

```typescript
{
  error: string,      // 에러 코드 (e.g., "UNAUTHORIZED", "NOT_FOUND")
  message: string     // 사용자에게 보여줄 메시지
}
```

### 공통 에러 코드

| 코드 | HTTP Status | 설명 |
|------|-------------|------|
| UNAUTHORIZED | 401 | 인증 필요 |
| FORBIDDEN | 403 | 권한 없음 |
| NOT_FOUND | 404 | 리소스 없음 |
| BAD_REQUEST | 400 | 잘못된 요청 |
| INVALID_STATE | 400 | 현재 상태에서 불가능한 작업 |
| INTERNAL_ERROR | 500 | 서버 에러 |

### 예외 처리 규칙

> 모든 API는 예상치 못한 에러 발생 시 위 에러 형식을 따릅니다.

**비즈니스 실패 vs 예외:**
| 구분 | HTTP Status | 예시 |
|------|-------------|------|
| 비즈니스 실패 | 200 | Role 검증 결과 "없음", 스캔 결과 "리소스 0개" |
| 예외 (서버 에러) | 500 | 외부 API 장애, DB 연결 실패, 타임아웃 |

**서버 구현 규칙:**
- 외부 서비스 에러(AWS, Azure 등)는 내부적으로 로깅하고, 클라이언트에는 `INTERNAL_ERROR`로 응답
- 구현 세부사항(SDK 에러, DB 에러 등)은 클라이언트에 노출하지 않음

---

### Frontend 에러 처리 가이드

**HTTP 상태별 기본 처리:**
- `HTTP 200` → 응답 데이터 확인, 비즈니스 로직에 따라 UI 처리
- `HTTP 4xx` → 사용자 입력/권한 문제, 에러 메시지 표시
- `HTTP 5xx` → 아래 읽기/쓰기 구분에 따라 처리

**읽기 작업 (GET) - 적극적 재시도:**
| 상황 | 사용자 안내 | 액션 |
|------|------------|------|
| 첫 번째 실패 | "데이터를 불러올 수 없습니다" | 자동 재시도 (1~2회) |
| 반복 실패 | "문제가 지속되고 있습니다" | 새로고침 버튼 + 관리자 문의 안내 |

**쓰기 작업 (POST/PUT/DELETE) - 보수적 접근:**
| 상황 | 사용자 안내 | 액션 |
|------|------------|------|
| 실패 | "요청을 처리할 수 없습니다" | 사용자 입력 데이터 유지 |
| 재시도 | 사용자가 명시적으로 재시도 버튼 클릭 | 자동 재시도 금지 (중복 방지) |

**설계 원칙:**
- 읽기 작업은 멱등성이 보장되므로 자동 재시도 허용
- 쓰기 작업은 중복 실행 위험이 있으므로 사용자 확인 후 재시도
- 반복 실패 시 "문제가 지속되고 있습니다" 패턴으로 관리자 문의 유도

---

### 에러 컴포넌트 설계

**컴포넌트 유형:**

| 유형 | 사용 상황 | 위치 |
|------|----------|------|
| **InlineError** | 섹션/카드 내 데이터 로드 실패 | 해당 영역 내부 |
| **PageError** | 페이지 전체 로드 실패 | 페이지 중앙 |
| **Toast** | 액션 실패 알림 (일시적) | 화면 상단/하단 |
| **ModalError** | 중요 액션 실패 (승인, 저장 등) | 모달 |

---

#### InlineError

> 특정 섹션의 데이터 로드 실패 시 사용

```
┌─────────────────────────────────────┐
│  ⚠️ 데이터를 불러올 수 없습니다      │
│                                     │
│  [다시 시도]                         │
└─────────────────────────────────────┘
```

**Props:**
```typescript
interface InlineErrorProps {
  message?: string;        // 기본: "데이터를 불러올 수 없습니다"
  onRetry?: () => void;    // 재시도 버튼 (없으면 숨김)
}
```

---

#### PageError

> 페이지 전체 로드 실패 시 사용

```
┌─────────────────────────────────────────────┐
│                                             │
│              ⚠️                              │
│                                             │
│     페이지를 불러올 수 없습니다              │
│                                             │
│     문제가 지속되면 관리자에게 문의하세요     │
│                                             │
│     [새로고침]  [홈으로 이동]                │
│                                             │
└─────────────────────────────────────────────┘
```

**Props:**
```typescript
interface PageErrorProps {
  title?: string;          // 기본: "페이지를 불러올 수 없습니다"
  description?: string;    // 기본: "문제가 지속되면 관리자에게 문의하세요"
  showRefresh?: boolean;   // 기본: true
  showHomeLink?: boolean;  // 기본: true
}
```

---

#### Toast

> 액션 결과 알림 (자동 사라짐)

```
┌────────────────────────────────┐
│  ❌ 저장에 실패했습니다         │
└────────────────────────────────┘
```

**Props:**
```typescript
interface ToastProps {
  type: 'success' | 'error' | 'warning';
  message: string;
  duration?: number;       // 기본: 3000ms (error는 5000ms)
}
```

**사용 케이스:**
- 성공: "저장되었습니다", "승인되었습니다"
- 실패: "저장에 실패했습니다", "권한이 없습니다"

---

#### ModalError

> 중요 액션 실패 시 사용자 확인 필요

```
┌─────────────────────────────────────┐
│  요청 처리 실패                      │
├─────────────────────────────────────┤
│                                     │
│  승인 요청을 처리할 수 없습니다.     │
│  입력하신 내용은 유지됩니다.         │
│                                     │
│           [닫기]  [다시 시도]        │
└─────────────────────────────────────┘
```

**Props:**
```typescript
interface ModalErrorProps {
  title?: string;          // 기본: "요청 처리 실패"
  message: string;
  preservedData?: boolean; // true면 "입력하신 내용은 유지됩니다" 표시
  onClose: () => void;
  onRetry?: () => void;    // 없으면 다시 시도 버튼 숨김
}
```

---

#### 에러 유형별 컴포넌트 선택 가이드

| 상황 | 컴포넌트 | 예시 |
|------|----------|------|
| 리소스 목록 로드 실패 | InlineError | 리소스 테이블 영역 |
| 프로젝트 상세 로드 실패 | PageError | 전체 페이지 |
| 승인/반려 실패 | ModalError | 모달로 안내 |
| Credential 저장 실패 | Toast + 폼 유지 | 토스트 알림 |
| 스캔 시작 실패 | Toast | 간단한 알림 |
| 반복 실패 | PageError (강화) | 관리자 문의 강조 |

---

## 공통 타입

### CloudProvider

```typescript
type CloudProvider = 'AWS' | 'Azure' | 'GCP' | 'IDC' | 'SDU';
```

### ProcessStatus

```typescript
type ProcessStatus =
  | 'WAITING_TARGET_CONFIRMATION'  // 1. 연동 대상 확정 대기
  | 'WAITING_APPROVAL'             // 2. 승인 대기
  | 'INSTALLING'                   // 3. 설치 진행 중
  | 'WAITING_CONNECTION_TEST'      // 4. 연결 테스트 대기
  | 'COMPLETED';                   // 5. 완료
```

### ResourceType

```typescript
type ResourceType =
  // AWS
  | 'RDS' | 'RDS_CLUSTER' | 'DYNAMODB' | 'ATHENA' | 'REDSHIFT' | 'EC2'
  // Azure
  | 'AZURE_MSSQL' | 'AZURE_POSTGRESQL' | 'AZURE_MYSQL' | 'AZURE_MARIADB'
  | 'AZURE_COSMOS_NOSQL' | 'AZURE_SYNAPSE' | 'AZURE_VM'
  // GCP
  | 'CLOUD_SQL' | 'BIGQUERY' | 'SPANNER'
  // IDC
  | 'IDC'
  // SDU
  | 'ATHENA_TABLE'
  ;
```

### VM 타입 (연동 시 port 필수)

```typescript
type VmResourceType = 'EC2' | 'AZURE_VM';
```

### ConnectionStatus

```typescript
type ConnectionStatus = 'CONNECTED' | 'DISCONNECTED' | 'NEW';
```

### LifecycleStatus

```typescript
type LifecycleStatus =
  | 'DISCOVERED'        // 스캔됨 (기본)
  | 'TARGET'            // 연동 대상 선택됨
  | 'PENDING_APPROVAL'  // 승인 대기
  | 'INSTALLING'        // 설치 중
  | 'READY_TO_TEST'     // 테스트 대기
  | 'ACTIVE';           // 연동 완료
```

### TfStatus (Deprecated)

> TF 설치 상태는 boolean으로 단순화되었습니다. (완료/미완료만 표시)
> 상세 상태(IN_PROGRESS 등)는 현재 UI에서 표기하지 않습니다.

```typescript
// 기존 (사용 안 함)
// type TfStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';

// 현재: boolean으로 완료 여부만 표시
// serviceTfCompleted: boolean
// bdcTfCompleted: boolean
```

---

## 역할/권한

### Role

```typescript
type Role = 'ADMIN' | 'SERVICE_MANAGER';
```

### 권한 규칙

| 역할 | 접근 범위 | 가능한 액션 |
|------|----------|------------|
| ADMIN | 전체 서비스 | 과제 등록/삭제, 승인/반려, 권한 관리 |
| SERVICE_MANAGER | 본인 권한 서비스만 | 연동 대상 확정, 테스트 연결 |

---

## 페이지네이션 (필요시)

```typescript
// 요청
?page=1&limit=20

// 응답
{
  data: T[],
  pagination: {
    page: number,
    limit: number,
    total: number,
    totalPages: number
  }
}
```

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-31 | TfStatus 타입 deprecated (boolean으로 단순화) |
| 2026-01-30 | Azure ResourceType 세분화, VmResourceType 타입 추가 |
| 2026-01-30 | 에러 컴포넌트 설계 추가 (InlineError, PageError, Toast, ModalError) |
| 2026-01-30 | Frontend 에러 처리 가이드 추가 (읽기/쓰기 구분) |
| 2026-01-30 | 예외 처리 규칙 추가 (비즈니스 실패 vs 예외 구분) |
| 2026-01-29 | 초안 작성 |
