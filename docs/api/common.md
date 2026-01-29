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
  | 'SQL_DATABASE' | 'COSMOS_DB' | 'SYNAPSE' | 'AZURE_VM'
  // GCP
  | 'CLOUD_SQL' | 'BIGQUERY' | 'SPANNER'
  // IDC
  | 'IDC'
  // SDU
  | 'ATHENA_TABLE'
  ;
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

### TfStatus

```typescript
type TfStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED';
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
| 2026-01-29 | 초안 작성 |
