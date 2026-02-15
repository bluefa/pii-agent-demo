> **DEPRECATED**: 이 문서는 더 이상 유지보수되지 않습니다. `docs/swagger/*.yaml`을 참조하세요.

# IDC API

> IDC Provider 전용 API를 정의합니다.

---

## 특징

- 스캔 없음 (리소스 직접 입력)
- 승인 단계 없음
- BDC TF만 설치
- 방화벽 오픈 필요

---

## 프로세스

```
리소스 직접 입력 → 방화벽 확인 + BDC TF → Test Connection → 완료
```

---

## 리소스 관리

### 리소스 직접 등록

```
POST /api/projects/{projectId}/resources
```

**요청**:
```typescript
{
  name: string,
  ip: string,
  port: number,
  databaseType: 'ORACLE' | 'MYSQL' | 'POSTGRESQL' | 'MSSQL',
  serviceId?: string  // Oracle 필수
}
```

### 리소스 수정

```
PUT /api/projects/{projectId}/resources/{resourceId}
```

### 리소스 삭제

```
DELETE /api/projects/{projectId}/resources/{resourceId}
```

---

## 설치 상태 [ASYNC]

> BDC TF 설치는 비동기 작업 - TfStatus로 상태 추적

### 설치 상태 조회

```
GET /api/projects/{projectId}/installation-status
```

**응답**:
```typescript
{
  provider: 'IDC',
  bdcTf: TfStatus,
  firewallOpened: boolean
}
```

---

## 방화벽

### Source IP 추천

```
GET /api/firewall/source-ip-recommendation
```

**Query Params**:
```
?ipType=public|private|vpc
```

**응답**:
```typescript
{
  sourceIps: string[],
  port: number,
  description: string
}
```

### 방화벽 오픈 확인

```
POST /api/projects/{projectId}/confirm-firewall
```

> 서비스 담당자가 방화벽 오픈 후 호출

---

## 서비스 설정

### 설정 조회

```
GET /api/services/{serviceCode}/settings/idc
```

**응답**:
```typescript
{
  firewallPrepared: boolean
}
```

### 설정 수정

```
PUT /api/services/{serviceCode}/settings/idc
```

---

## TODO

- [ ] Source IP 추천 로직 정의
- [ ] 방화벽 확인 방식 구체화
- [ ] Oracle ServiceId 검증 로직

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-29 | 초안 작성 |
