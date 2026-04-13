# GCP 사전조치 조회 구현 계획

> **Issue:** [#259](https://github.com/bluefa/pii-agent-demo/issues/259)
> **Status:** 계획 수립 완료 / 구현 대기

## Context

GCP 상세 정보 조회 시 Scan Service Account와 Terraform Execution Service Account의 검증 상태를 **"사전 조치 현황"** 섹션으로 표시합니다. 기존 AWS AwsInfoCard의 "사전 조치 현황" 패턴을 GCP에 동일하게 적용합니다.

### 백엔드 API (Issue #259 Swagger 명세)

| 엔드포인트 | 메서드 | 설명 |
|------------|--------|------|
| `/install/v1/target-sources/{id}/gcp/scan-service-account` | GET | Scan SA 검증 상태 조회 |
| `/install/v1/target-sources/{id}/gcp/terraform-service-account` | GET | Terraform SA 검증 상태 조회 |

**응답 스키마 — `GcpServiceAccountInfo`:**

```
gcpProjectId    string    (필수) 대상 GCP 프로젝트 ID
status          enum      (필수) VALID | INVALID | UNVERIFIED
failReason      string?   INVALID 시 실패 사유 코드
failMessage     string?   INVALID 시 사용자 노출 메시지
lastVerifiedAt  datetime? 마지막 검증 시각 (UNVERIFIED 시 생략)
```

**failReason 코드:**

| 코드 | 설명 |
|------|------|
| `SA_NOT_CONFIGURED` | SA 미설정 |
| `SA_KEY_EXPIRED` | SA 키 만료 |
| `SA_NOT_FOUND` | SA를 찾을 수 없음 |
| `SA_INSUFFICIENT_PERMISSIONS` | IAM 권한 부족 |
| `SCAN_SA_UNAVAILABLE` | Scan SA 사용 불가 (TF SA 전용) |

---

## 프론트엔드 UI 설계

### Before — 현재 GcpInfoCard

```
┌──────────────────────────────────────┐
│ GCP 연동 정보                         │
│                                      │
│ GCP 프로젝트 ID     my-gcp-project   │
├──────────────────────────────────────┤
│ DB Credential           가이드  관리  │
│ ┌──────────────────────────────────┐ │
│ │ db-credential-1                 │ │
│ │ db-credential-2                 │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ Scan Service Account     등록 가이드  │  ← 스텁 (상태 정보 없음)
└──────────────────────────────────────┘
```

### After — 사전 조치 현황 추가

```
┌──────────────────────────────────────┐
│ GCP 연동 정보                         │
│                                      │
│ GCP 프로젝트 ID     my-gcp-project   │
├──────────────────────────────────────┤
│ DB Credential           가이드  관리  │
│ ┌──────────────────────────────────┐ │
│ │ db-credential-1                 │ │
│ │ db-credential-2                 │ │
│ └──────────────────────────────────┘ │
├──────────────────────────────────────┤
│ 사전 조치 현황           [2/2 완료]   │ ← 완료 배지
│──────────────────────────────────────│
│ Scan Service Account                 │
│   ✅ 검증 완료            등록 가이드  │ ← VALID
│   2026-02-15 10:30 검증              │ ← lastVerifiedAt
│──────────────────────────────────────│
│ Terraform Execution SA               │
│   ✅ 검증 완료            등록 가이드  │ ← VALID
│   2026-02-15 10:30 검증              │ ← lastVerifiedAt
└──────────────────────────────────────┘
```

### 상태별 표시 (3가지 + 미로딩)

**VALID — 검증 완료**
```
│ Scan Service Account                 │
│   ✅ 검증 완료            등록 가이드  │  초록색 체크 아이콘
│   2026-02-15 10:30 검증              │  lastVerifiedAt 표시
```

**INVALID — 검증 실패**
```
│ Terraform Execution SA               │
│   ⚠️ 검증 실패            등록 가이드  │  주황색 경고 아이콘
│   Scan SA를 먼저 설정해주세요.        │  failMessage 표시 (빨간색)
```

**UNVERIFIED — 미검증**
```
│ Scan Service Account                 │
│   ○ 미검증                등록 가이드  │  회색 빈 원 아이콘
```

**null (미로딩) — API 응답 전**
```
│ (사전 조치 현황 섹션 자체를 숨김)      │
```

### 완료 배지 규칙

| 조건 | 배지 | 색상 |
|------|------|------|
| Scan + TF 모두 VALID | `2/2 완료` | 초록 (`statusColors.success`) |
| 하나만 VALID | `1/2 완료` | 주황 (`statusColors.warning`) |
| 둘 다 미완료 | `0/2 완료` | 주황 (`statusColors.warning`) |

> AWS와 달리 GCP는 설치 모드 구분 없이 **항상 2개 항목** (Scan SA + TF SA)을 표시합니다.

---

## 구현 상세

### Step 1. 타입 정의 추가

**파일:** `app/api/_lib/v1-types.ts`

```ts
export type GcpServiceAccountStatus = 'VALID' | 'INVALID' | 'UNVERIFIED';

export type GcpServiceAccountFailReason =
  | 'SA_NOT_CONFIGURED'
  | 'SA_KEY_EXPIRED'
  | 'SA_NOT_FOUND'
  | 'SA_INSUFFICIENT_PERMISSIONS'
  | 'SCAN_SA_UNAVAILABLE';

export interface GcpServiceAccountInfo {
  gcpProjectId: string;
  status: GcpServiceAccountStatus;
  failReason?: GcpServiceAccountFailReason | null;
  failMessage?: string | null;
  lastVerifiedAt?: string;
}
```

### Step 2. BFF API 라우트 (신규 2개)

기존 `app/api/v1/gcp/target-sources/[targetSourceId]/settings/route.ts` 패턴을 따릅니다.

**파일 A:** `app/api/v1/gcp/target-sources/[targetSourceId]/scan-service-account/route.ts`

- `withV1` 래퍼 + 인증/권한 검증
- Mock 응답: `{ gcpProjectId, status: 'VALID', lastVerifiedAt: ISO시각 }`

**파일 B:** `app/api/v1/gcp/target-sources/[targetSourceId]/terraform-service-account/route.ts`

- 동일 구조
- Mock 응답: `{ gcpProjectId, status: 'VALID', lastVerifiedAt: ISO시각 }`

### Step 3. 프론트엔드 API 클라이언트

**파일:** `app/lib/api/gcp.ts` (기존 파일에 추가)

```ts
export const getGcpScanServiceAccount = async (
  targetSourceId: number
): Promise<GcpServiceAccountInfo> =>
  fetchInfraCamelJson<GcpServiceAccountInfo>(
    `${BASE_URL}/${targetSourceId}/scan-service-account`
  );

export const getGcpTerraformServiceAccount = async (
  targetSourceId: number
): Promise<GcpServiceAccountInfo> =>
  fetchInfraCamelJson<GcpServiceAccountInfo>(
    `${BASE_URL}/${targetSourceId}/terraform-service-account`
  );
```

### Step 4. GcpInfoCard 컴포넌트 업데이트

**파일:** `app/components/features/GcpInfoCard.tsx`

| 변경 항목 | 내용 |
|-----------|------|
| Props 확장 | `scanServiceAccount`, `terraformServiceAccount` (`GcpServiceAccountInfo \| null`) 추가 |
| 아이콘 추가 | `CheckIcon`, `WarningIcon` (AwsInfoCard 패턴 동일) |
| 내부 컴포넌트 | `ServiceAccountStatusRow` — label/status/failMessage/lastVerifiedAt/onGuide |
| Section 3 교체 | 기존 Scan SA 스텁 → "사전 조치 현황" 헤더 + 완료 배지 + StatusRow x2 |
| 모달 유지 | 기존 Scan SA 등록 가이드 모달 그대로 활용 |

### Step 5. GcpProjectPage 데이터 페칭

**파일:** `app/projects/[projectId]/gcp/GcpProjectPage.tsx`

| 변경 항목 | 내용 |
|-----------|------|
| import | `getGcpScanServiceAccount`, `getGcpTerraformServiceAccount`, `GcpServiceAccountInfo` |
| state | `scanSA`, `tfSA` (`GcpServiceAccountInfo \| null`) |
| useEffect | 마운트 시 두 API 호출 (AWS 패턴 동일: `.catch(() => {})`) |
| props 전달 | GcpInfoCard에 `scanServiceAccount={scanSA}` `terraformServiceAccount={tfSA}` |

---

## 파일 변경 요약

| # | 파일 | 작업 | 설명 |
|---|------|------|------|
| 1 | `app/api/_lib/v1-types.ts` | 수정 | GcpServiceAccountInfo 타입 추가 |
| 2 | `app/api/v1/gcp/.../scan-service-account/route.ts` | **신규** | Scan SA 조회 BFF 라우트 |
| 3 | `app/api/v1/gcp/.../terraform-service-account/route.ts` | **신규** | TF SA 조회 BFF 라우트 |
| 4 | `app/lib/api/gcp.ts` | 수정 | API 클라이언트 함수 2개 추가 |
| 5 | `app/components/features/GcpInfoCard.tsx` | 수정 | 사전 조치 현황 섹션 구현 |
| 6 | `app/projects/[projectId]/gcp/GcpProjectPage.tsx` | 수정 | SA 데이터 fetch + props 전달 |

---

## 검증 방법

1. `npm run type-check` — 타입 에러 없음
2. `npm run lint` — lint 통과
3. dev 서버 → GCP 프로젝트 상세 → 사이드바 "사전 조치 현황" 섹션 표시 확인
4. Mock 응답을 VALID / INVALID / UNVERIFIED로 변경하며 3가지 상태 렌더링 확인
5. 완료 배지 카운트 정확성 확인 (0/2, 1/2, 2/2)

---

## TODO — 구현 작업 목록

> **규칙:** 각 TODO를 완료할 때마다 아래 순서를 따릅니다.
> 1. 코드 작성
> 2. `/pr-context-review` 수행 — 변경사항이 계획에 맞는지, 타입/린트 에러 없는지 검증
> 3. 검증 통과 후 commit 생성
>
> `/pr-context-review`에서 문제가 발견되면 수정 후 다시 리뷰한 뒤 commit합니다.

### TODO 1. 타입 정의 추가

- [ ] `app/api/_lib/v1-types.ts`에 `GcpServiceAccountStatus`, `GcpServiceAccountFailReason`, `GcpServiceAccountInfo` 타입 추가
- **커밋 메시지:** `feat: add GcpServiceAccountInfo type definitions (#259)`
- **검증:** `npm run type-check` 통과

### TODO 2. BFF API 라우트 — Scan SA

- [ ] `app/api/v1/gcp/target-sources/[targetSourceId]/scan-service-account/route.ts` 신규 생성
- [ ] `withV1` 래퍼 + 인증/권한 검증 (settings route 패턴)
- [ ] Mock 응답: `status: 'VALID'`, `lastVerifiedAt: 현재시각`
- **커밋 메시지:** `feat: add scan service account BFF route (#259)`
- **검증:** `npm run type-check` 통과 + API 응답 스키마가 Swagger 명세와 일치

### TODO 3. BFF API 라우트 — Terraform SA

- [ ] `app/api/v1/gcp/target-sources/[targetSourceId]/terraform-service-account/route.ts` 신규 생성
- [ ] Scan SA route와 동일 구조
- [ ] Mock 응답: `status: 'VALID'`, `lastVerifiedAt: 현재시각`
- **커밋 메시지:** `feat: add terraform service account BFF route (#259)`
- **검증:** `npm run type-check` 통과 + API 응답 스키마가 Swagger 명세와 일치

### TODO 4. 프론트엔드 API 클라이언트

- [ ] `app/lib/api/gcp.ts`에 `getGcpScanServiceAccount()`, `getGcpTerraformServiceAccount()` 추가
- **커밋 메시지:** `feat: add GCP service account API client functions (#259)`
- **검증:** `npm run type-check` 통과 + import 경로 정상

### TODO 5. GcpInfoCard 사전 조치 현황 UI

- [ ] Props 확장: `scanServiceAccount`, `terraformServiceAccount` 추가
- [ ] `CheckIcon`, `WarningIcon` 아이콘 추가 (AWS 패턴)
- [ ] `ServiceAccountStatusRow` 내부 컴포넌트 구현
- [ ] Section 3 교체: 기존 Scan SA 스텁 → "사전 조치 현황" 섹션 (헤더 + 완료 배지 + StatusRow x2)
- [ ] 기존 등록 가이드 모달 유지
- **커밋 메시지:** `feat: implement prerequisite status section in GcpInfoCard (#259)`
- **검증:** `npm run type-check` + `npm run lint` 통과 + 상태별 렌더링 정상 (VALID/INVALID/UNVERIFIED)

### TODO 6. GcpProjectPage 데이터 페칭 연결

- [ ] `scanSA`, `tfSA` state 추가
- [ ] `useEffect`에서 두 API 호출 (AWS 패턴 동일)
- [ ] GcpInfoCard에 새 props 전달
- **커밋 메시지:** `feat: fetch GCP service account status in GcpProjectPage (#259)`
- **검증:** `npm run type-check` + `npm run lint` + dev 서버에서 GCP 상세 페이지 사이드바 확인

---

## 참고: AWS 사전 조치 현황 패턴 (레퍼런스)

- `app/components/features/AwsInfoCard.tsx` — RoleStatusRow, CheckIcon/WarningIcon, 완료 배지
- `app/projects/[projectId]/aws/AwsProjectPage.tsx` — useEffect로 awsStatus/awsSettings 페칭
- `app/lib/api/aws.ts` — getAwsSettings(), getAwsInstallationStatus()
