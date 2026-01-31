# AWS API

> AWS Provider 전용 API를 정의합니다.

---

## 케이스 분류

| 케이스 | TF 권한 | 설치 방식 |
|--------|---------|----------|
| Case 1 | O | 자동 설치 |
| Case 2 | X | 수동 (TF Script 다운로드) |

> **TF 권한 (TerraformExecutionRole)**
> - 프로젝트 생성 시 선택
> - 최초 선택 후 변경 불가 (immutable)
> - ProjectDetail에서 항상 표시

> **VM (EC2) 연동**
> - 리소스 API는 EC2 항상 포함하여 반환
> - VM 표시 여부는 UI 필터로 처리 (API 레벨 아님)
> - 연동 대상 확정 시 "VM 포함" 필터로 선택

---

## TerraformExecutionRole 검증

> 프로젝트 생성 전 TF 권한 선택을 위해 Role 존재 여부 확인

### Role 검증

```
POST /api/aws/verify-tf-role
```

**요청**:
```typescript
{
  accountId: string,
  roleArn?: string  // 생략 시 기본 Role 이름으로 검색
}
```

**응답 (성공)**:
```typescript
{
  valid: true,
  roleArn: string,
  permissions: {
    canCreateResources: boolean,
    canManageIam: boolean,
    canAccessS3: boolean
  }
}
```

**응답 (실패)**:
```typescript
{
  valid: false,
  errorCode: 'ROLE_NOT_FOUND' | 'INSUFFICIENT_PERMISSIONS' | 'ACCESS_DENIED',
  errorMessage: string,
  guide: {
    title: string,
    steps: string[],
    documentUrl?: string
  }
}
```

**에러 케이스**:
| 에러 코드 | 설명 | 가이드 |
|-----------|------|--------|
| ROLE_NOT_FOUND | Role이 존재하지 않음 | Role 생성 가이드 |
| INSUFFICIENT_PERMISSIONS | Role 권한 부족 | 필요 권한 목록 + 정책 추가 가이드 |
| ACCESS_DENIED | 검증 자체 불가 | AssumeRole 설정 가이드 |

---

## 스캔

> 스캔 API는 [scan.md](../scan.md) 참조

---

## 설치 상태

> TF 설치는 Backend에서 자동 처리되며, Frontend는 완료 여부만 확인합니다.

### 설치 상태 조회

```
GET /api/projects/{projectId}/installation-status
```

**응답**:
```typescript
{
  provider: 'AWS',
  hasTfPermission: boolean,

  // TF 설치 완료 여부 (자동/수동 무관하게 동일)
  serviceTfCompleted: boolean,
  bdcTfCompleted: boolean,
  completedAt?: string,

  // 수동 설치 UI용 (다운로드 버튼 표시)
  tfScriptDownloaded?: boolean
}
```

**설치 완료 판단** (자동/수동 동일):
```typescript
const installationCompleted = serviceTfCompleted && bdcTfCompleted;
```

---

## TF Script (TF 권한 없는 경우)

> Service TF만 다운로드 가능 (BDC는 시스템이 자동 처리)

### TF Script 다운로드

```
GET /api/projects/{projectId}/terraform-script
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

> TF 권한이 없는 경우(Case 2), 서비스 담당자가 수동으로 TF Script를 실행한 후 호출합니다.
> Backend는 AWS API를 통해 리소스 생성 여부를 검증하고, 성공 시 `serviceTfCompleted = true`로 변경합니다.
> BDC TF는 이 시점에 시스템이 자동으로 실행합니다.

**요청**:
```typescript
{
  // 현재 별도 파라미터 없음
  // 필요시 확장: executionId, remarks 등
}
```

**응답 (성공)**:
```typescript
{
  confirmed: true,
  confirmedAt: string,
  validationResult?: {
    serviceTfResources: boolean,  // Service TF 리소스 존재 확인
    message?: string
  }
}
```

**응답 (검증 실패)**:
```typescript
{
  confirmed: false,
  errorCode: 'TF_RESOURCES_NOT_FOUND' | 'VALIDATION_FAILED',
  errorMessage: string,
  guide: {
    title: string,
    steps: string[]
  }
}
```

**에러 케이스**:
| 에러 코드 | 설명 | 가이드 |
|-----------|------|--------|
| TF_RESOURCES_NOT_FOUND | TF로 생성되어야 할 리소스가 없음 | TF Script 재실행 가이드 |
| VALIDATION_FAILED | 리소스 검증 실패 | 문제 해결 가이드 |

**프로세스 전이**: 설치 완료 확인 → 연결 테스트 대기

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
  tfPermissionGranted: boolean  // 프로젝트 레벨, immutable
}
```

### 설정 수정

```
PUT /api/services/{serviceCode}/settings/aws
```

---

## TODO

- [ ] TF Role 검증 시 필요한 최소 권한 목록 정의
- [ ] TF Role 생성 가이드 문서 작성
- [x] TF 설치 상태 단순화 (완료/미완료 boolean)
- [x] confirm-installation API 상세 정의

> 예외 처리는 [common.md](../common.md)의 "예외 처리 규칙" 참조

---

## 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-01-31 | installation-status 자동/수동 구분 제거, Service/BDC 구분 유지 |
| 2026-01-31 | TfStatus → boolean 단순화 (완료/미완료만 표시) |
| 2026-01-31 | confirm-installation API 상세 정의 (요청/응답/에러) |
| 2026-01-30 | TerraformExecutionRole 검증 API 추가 |
| 2026-01-30 | 케이스 단순화 (TF 권한만), VM은 UI 필터로 변경 |
| 2026-01-29 | 초안 작성 |
