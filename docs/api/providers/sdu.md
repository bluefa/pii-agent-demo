# SDU API

> SDU Provider 전용 API를 정의합니다.

---

## 특징

- 스캔 없음 (Crawler가 Athena Table 목록화)
- 승인 단계 없음
- S3 업로드 기반
- 방화벽 결제 필요

---

## 프로세스

```
Crawler 설정 → Athena Table 확인 → Test Connection → 완료
```

---

## Crawler [ASYNC]

> Crawler 실행은 비동기 - 'IDLE' | 'RUNNING' | 'FAILED' 상태로 추적

### Crawler 설정

```
POST /api/projects/{projectId}/crawler
```

**요청**:
```typescript
{
  s3Bucket: string,
  s3Prefix?: string,
  schedule?: string  // cron expression (optional)
}
```

### Crawler 상태 조회

```
GET /api/projects/{projectId}/crawler
```

**응답**:
```typescript
{
  configured: boolean,
  s3Bucket?: string,
  s3Prefix?: string,
  lastRunAt?: string,
  status: 'IDLE' | 'RUNNING' | 'FAILED',
  lastRunStatus: 'NONE' | 'SUCCESS' | 'FAILED'
}
```

---

## Athena Table

### Athena Table 목록 조회

```
GET /api/projects/{projectId}/athena-tables
```

**응답**:
```typescript
{
  tables: Array<{
    name: string,
    database: string,
    s3Location: string,
    columns: number,
    lastUpdated: string
  }>
}
```

---

## 설치 상태

### 설치 상태 조회

```
GET /api/projects/{projectId}/installation-status
```

**응답**:
```typescript
{
  provider: 'SDU',

  // 서브스텝 상태
  crawler: {
    configured: boolean,
    completed: boolean,
    completedAt?: string
  },
  athenaTable: {
    ready: boolean,
    tableCount?: number,
    completedAt?: string
  },
  targetConfirmed: {
    confirmed: boolean,
    confirmedBy?: string,
    confirmedAt?: string
  },
  athenaSetup: {
    completed: boolean,
    completedBy?: string,
    completedAt?: string
  },

  // 전체 완료 여부
  installationCompleted: boolean,
  completedAt?: string
}
```

---

## S3 업로드

### S3 업로드 상태 조회

```
GET /api/projects/{projectId}/s3-upload
```

> BDC 제공 API를 호출하여 S3 데이터 업로드 여부를 확인합니다.

**응답**:
```typescript
{
  uploaded: boolean,
  s3Bucket?: string,
  s3Prefix?: string,
  lastUploadedAt?: string,
  objectCount?: number
}
```

### S3 업로드 확인

```
POST /api/projects/{projectId}/s3-upload/confirm
```

> 서비스측에서 S3 업로드 완료를 확인하여 다음 단계로 진행합니다.

**응답**:
```typescript
{
  confirmed: boolean,
  confirmedAt: string,
  nextStep: 'installation'
}
```

---

## IAM USER

### IAM USER 조회

```
GET /api/projects/{projectId}/iam-user
```

**응답**:
```typescript
{
  created: boolean,
  userName?: string,
  aksk?: {
    issued: boolean,
    issuedAt?: string,
    issuedBy?: string,
    expiresAt?: string
  }
}
```

### AK/SK 재발급

```
POST /api/projects/{projectId}/iam-user/issue-aksk
```

> ⚠ 파괴적 액션: 기존 AK/SK는 즉시 삭제되며 복구 불가능합니다.

**응답 (성공)**:
```typescript
{
  issued: true,
  accessKey: string,
  secretKey: string,
  issuedAt: string,
  expiresAt: string
}
```

**응답 (실패)**:
```typescript
{
  issued: false,
  errorCode: 'IAM_USER_NOT_FOUND' | 'PERMISSION_DENIED',
  errorMessage: string
}
```

---

## SourceIP

### SourceIP 목록 조회

```
GET /api/projects/{projectId}/source-ip
```

**응답**:
```typescript
{
  sourceIps: Array<{
    cidr: string,
    registeredBy: string,
    registeredAt: string,
    status: 'PENDING' | 'CONFIRMED',
    confirmedBy?: string,
    confirmedAt?: string
  }>
}
```

### SourceIP 등록

```
POST /api/projects/{projectId}/source-ip/register
```

**요청**:
```typescript
{
  cidr: string
}
```

**응답**:
```typescript
{
  registered: boolean,
  cidr: string,
  registeredAt: string,
  status: 'PENDING'
}
```

### SourceIP 확인

```
POST /api/projects/{projectId}/source-ip/confirm
```

> BDC측에서 등록된 SourceIP를 확인합니다.

**요청**:
```typescript
{
  cidr: string
}
```

**응답**:
```typescript
{
  confirmed: boolean,
  cidr: string,
  confirmedAt: string,
  status: 'CONFIRMED'
}
```

---

## 서비스 설정

### 설정 조회

```
GET /api/services/{serviceCode}/settings/sdu
```

**응답**:
```typescript
{
  iamUserCreated: boolean,
  s3Uploaded: boolean
}
```

### 설정 수정

```
PUT /api/services/{serviceCode}/settings/sdu
```

---

## TODO

- [x] Crawler 설정 상세 정의 → 서브스텝 상태로 확장
- [x] S3 업로드 확인 방식 → BDC API 호출
- [x] 방화벽 결제 확인 방식 → SDU는 SourceIP 관리로 대체

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-02-08 | BFF API 명세 확장 (IAM USER, SourceIP, S3 확인, 설치 서브스텝) |
| 2026-01-29 | 초안 작성 |
