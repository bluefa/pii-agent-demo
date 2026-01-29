# AWS API

> AWS Provider 전용 API를 정의합니다.

---

## 케이스 분류

| 케이스 | TF 권한 | VM | 설치 방식 |
|--------|---------|-----|----------|
| Case 1 | O | X | 자동 |
| Case 2 | O | O | 자동 |
| Case 3 | X | X | 수동 (TF Script) |
| Case 4 | X | O | 수동 (TF Script) |

---

## 스캔

### 스캔 실행

```
POST /api/projects/{projectId}/scan
```

> TODO: 비동기 작업 - 응답 형식 정의 필요

**응답**:
```typescript
{
  // TODO
}
```

### 스캔 정보 조회

```
GET /api/projects/{projectId}/scan-info
```

**응답**:
```typescript
{
  lastScannedAt: string | null,
  canScan: boolean,           // 5분 경과 여부
  hasNewResources: boolean,
  newResourceCount: number
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
  provider: 'AWS',
  hasTfPermission: boolean,

  // TF 권한 O
  serviceTf?: TfStatus,
  bdcTf?: TfStatus,

  // TF 권한 X
  tfScriptDownloaded?: boolean,
  installationConfirmed?: boolean
}
```

---

## TF Script (TF 권한 없는 경우)

### TF Script 다운로드

```
GET /api/projects/{projectId}/terraform-script
```

**Query Params**:
```
?type=service|bdc
```

**응답**:
```typescript
{
  downloadUrl: string,
  fileName: string,
  expiresAt: string
}
```

### 설치 완료 확인

```
POST /api/projects/{projectId}/confirm-installation
```

> 서비스 담당자가 수동으로 TF 실행 후 호출

---

## 서비스 설정

### 설정 조회

```
GET /api/services/{serviceCode}/settings/aws
```

**응답**:
```typescript
{
  scanRoleRegistered: boolean,
  tfPermissionGranted: boolean,
  vmIntegrationEnabled: boolean
}
```

### 설정 수정

```
PUT /api/services/{serviceCode}/settings/aws
```

---

## TODO

- [ ] 스캔 API 비동기 처리 방식 정의
- [ ] TF 설치 상태 폴링 vs 웹훅
- [ ] 에러 케이스 정의

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-29 | 초안 작성 |
