# GCP API

> GCP Provider 전용 API를 정의합니다.

---

## 케이스 분류

| 케이스 | Subnet | 특이사항 |
|--------|--------|----------|
| Case 1 | 불필요 | TF 자동 |
| Case 2 | 필요 | Subnet 생성 후 TF |

> GCP는 VM 연동 미지원

---

## 스캔

> 스캔 API는 [scan.md](../scan.md) 참조
> GCP 특이사항: Cloud SQL 사용 시 Host Project 권한 필요

---

## 설치 상태

### 설치 상태 조회

```
GET /api/projects/{projectId}/installation-status
```

**응답**:
```typescript
{
  provider: 'GCP',
  subnetRequired: boolean,
  subnetCreated?: boolean,
  serviceTf: TfStatus
}
```

---

## Subnet

> GCP는 시스템이 직접 생성 권한 있음

### Subnet 목록 조회

```
GET /api/projects/{projectId}/subnets
```

**Query Params**:
```
?vpcId=xxx&region=xxx
```

**응답**:
```typescript
{
  subnets: Array<{
    id: string,
    name: string,
    cidr: string,
    region: string,
    vpcId: string
  }>,
  canCreate: boolean
}
```

### Subnet 생성

```
POST /api/projects/{projectId}/subnets
```

**요청**:
```typescript
{
  vpcId: string,
  region: string,
  name: string,
  cidr: string,
  purpose: 'REGIONAL_MANAGED_SUBNET'
}
```

---

## 서비스 설정

### 설정 조회

```
GET /api/services/{serviceCode}/settings/gcp
```

**응답**:
```typescript
{
  projectScanPermission: boolean,
  hostProjectPermission: boolean,  // Cloud SQL용
  subnetCreationRequired: boolean
}
```

### 설정 수정

```
PUT /api/services/{serviceCode}/settings/gcp
```

---

## TODO

- [ ] 스캔 API 비동기 처리 방식 정의
- [ ] Host Project 권한 에러 처리
- [ ] Subnet 생성 비동기 처리

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-29 | 초안 작성 |
