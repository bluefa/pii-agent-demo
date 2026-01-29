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
  status: 'IDLE' | 'RUNNING' | 'FAILED'
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
  crawlerConfigured: boolean,
  athenaTablesReady: boolean
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
  firewallPaymentCompleted: boolean,
  dataUploaded: boolean
}
```

### 설정 수정

```
PUT /api/services/{serviceCode}/settings/sdu
```

---

## TODO

- [ ] Crawler 설정 상세 정의
- [ ] S3 업로드 확인 방식
- [ ] 방화벽 결제 확인 방식

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-29 | 초안 작성 |
