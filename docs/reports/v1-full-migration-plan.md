# v1 Full API Migration — 실행 계획

> 작성일: 2026-02-17
> 근거: PR #179 회고 (`docs/reports/pr179-review-retrospective.md`)

## 0. PR #179 교훈 → 이번 마이그레이션 적용 원칙

| PR #179 실수 | 이번 적용 원칙 |
|-------------|--------------|
| swagger 작성 없이 구현 시작 | **Batch 0에서 swagger 먼저 확정** (IDC/SDU) |
| 일괄 구현 → 일괄 검증 | **1 endpoint 구현 → 1 endpoint 검증 → 다음** |
| route에서 envelope 재포장 (ADR-007 위반) | route는 `client.method()` 디스패치만. 변환은 client 계층 |
| swagger를 코드에 맞춤 | **코드를 swagger에 맞춤**. swagger가 source of truth |
| 매핑 테이블 없이 작업 | 매 Batch PR 전 **Swagger-Implementation 매핑 테이블** 작성 |

### Contract-First 검증 체크리스트 (매 엔드포인트)

```
□ swagger path + method 확인
□ swagger request schema 필드명 == FE 전송 필드명
□ swagger response envelope 키 == client 반환 키
□ swagger response 필드명 == mock 데이터 필드명
□ route handler는 client.method() 디스패치만 (ADR-007)
□ FE fetchJson 타입이 swagger response와 일치
```

---

## 1. 현재 상태 (origin/main 기준)

| 카테고리 | v1 완료 | legacy 잔여 | 비율 |
|----------|--------|-----------|------|
| User/Services | 7 | 2 | 78% |
| Target Sources Core | 19 | 0 | 100% |
| AWS | 7 | 5 | 58% |
| Azure | 5 | 7 | 42% |
| GCP | 3 | 0 | 100% |
| **IDC** | **0** | **7** | **0%** |
| **SDU** | **0** | **12** | **0%** |
| Projects (misc) | ~7 | ~7 | 50% |
| Services Settings | 0 | 4 | 0% |
| Dev | 0 | 1 | 0% |
| **합계** | **36** | **52** | **41%** |

---

## 2. Batch 분할 전략

### 의존성 그래프

```
Batch 0: Swagger 계약 (IDC/SDU)
    ↓
Batch 1: IDC v1 routes + FE        Batch 2: SDU v1 routes + FE
    ↓                                    ↓
Batch 3: History + Services Settings + Dev + Projects misc
    ↓
Batch 4: Legacy 제거 + Swagger 문서 동기화 + 호환성 보정
```

- Batch 1, 2는 **병렬 가능** (파일 겹침 없음)
- Batch 3는 Batch 1, 2 완료 후 (FE callsite 충돌 방지)
- Batch 4는 모든 v1 route 완료 후

### Batch별 상세

---

### Batch 0: Swagger 계약 확정 (IDC + SDU)

**목적**: Contract-first. 구현 전에 계약 고정.

**산출물**:
- `docs/swagger/idc.yaml` (신규)
- `docs/swagger/sdu.yaml` (신규)
- `docs/swagger/MIGRATION_PLAN.md` 갱신

**범위 — IDC endpoints**:

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/idc/source-ip-recommendation` | 방화벽 IP 추천 (query: ipType) |
| GET | `/api/v1/idc/target-sources/{targetSourceId}/installation-status` | 설치 상태 |
| POST | `/api/v1/idc/target-sources/{targetSourceId}/check-installation` | 설치 확인 요청 |
| POST | `/api/v1/idc/target-sources/{targetSourceId}/confirm-firewall` | 방화벽 확인 |
| GET/PUT | `/api/v1/idc/target-sources/{targetSourceId}/resources` | 리소스 조회/수정 |
| PUT/POST | `/api/v1/idc/target-sources/{targetSourceId}/resources/list` | 리소스 목록 갱신 |
| POST | `/api/v1/idc/target-sources/{targetSourceId}/confirm-targets` | 대상 확인 |

**범위 — SDU endpoints**:

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/v1/sdu/target-sources/{targetSourceId}/installation-status` | 설치 상태 |
| POST | `/api/v1/sdu/target-sources/{targetSourceId}/check-installation` | 설치 확인 |
| GET | `/api/v1/sdu/target-sources/{targetSourceId}/s3-upload` | S3 업로드 상태 |
| POST | `/api/v1/sdu/target-sources/{targetSourceId}/s3-upload/check` | S3 업로드 확인 |
| GET | `/api/v1/sdu/target-sources/{targetSourceId}/iam-user` | IAM 사용자 정보 |
| POST | `/api/v1/sdu/target-sources/{targetSourceId}/iam-user/issue-aksk` | AK/SK 발급 |
| GET | `/api/v1/sdu/target-sources/{targetSourceId}/source-ip` | Source IP 목록 |
| POST | `/api/v1/sdu/target-sources/{targetSourceId}/source-ip/register` | Source IP 등록 |
| POST | `/api/v1/sdu/target-sources/{targetSourceId}/source-ip/confirm` | Source IP 확인 |
| GET | `/api/v1/sdu/target-sources/{targetSourceId}/athena-tables` | Athena 테이블 목록 |
| GET | `/api/v1/sdu/target-sources/{targetSourceId}/connection-test` | 연결 테스트 상태 |
| POST | `/api/v1/sdu/target-sources/{targetSourceId}/connection-test/execute` | 연결 테스트 실행 |

**작업 방법**:
1. 기존 legacy route.ts + mock 파일에서 request/response shape 추출
2. 기존 swagger (aws.yaml, azure.yaml 등) 패턴을 따라 작성
3. error response, `x-expected-duration` 포함
4. 공통 `ErrorResponse` 스키마 `$ref` 사용

**검증**:
- 각 endpoint의 request/response가 mock 데이터와 일치하는지 필드 단위 대조
- swagger-cli validate 또는 수동 검토

**예상 규모**: ~200-300줄 YAML × 2개 파일
**예상 PR**: 1개 (docs only)

---

### Batch 1: IDC v1 Routes + FE Callsite

**의존**: Batch 0 완료 (idc.yaml 확정)

**범위**:
1. v1 route 생성 (7개 route.ts)
2. `ApiClient` 인터페이스에 IDC v1 메서드 시그니처 추가/변경
   - `types.ts`: idc 네임스페이스의 `projectId: string` → `targetSourceId` 기반으로 전환
3. mock client 변환 계층 (`lib/api-client/mock/idc.ts`)
   - `projectId` → `targetSourceId` 매핑 (`resolveProjectId` 사용)
4. bff client 경로 변환 (`lib/api-client/bff-client.ts`)
5. FE helper 신규: `app/lib/api/idc.ts`
6. FE callsite 전환: `IdcProjectPage.tsx`
   - 직접 fetch 제거 → `app/lib/api/idc.ts` 함수 사용
   - `project.id` → `project.targetSourceId`

**수정 파일 목록**:

| 파일 | 작업 |
|------|------|
| `app/api/v1/idc/source-ip-recommendation/route.ts` | 신규 |
| `app/api/v1/idc/target-sources/[targetSourceId]/installation-status/route.ts` | 신규 |
| `app/api/v1/idc/target-sources/[targetSourceId]/check-installation/route.ts` | 신규 |
| `app/api/v1/idc/target-sources/[targetSourceId]/confirm-firewall/route.ts` | 신규 |
| `app/api/v1/idc/target-sources/[targetSourceId]/resources/route.ts` | 신규 |
| `app/api/v1/idc/target-sources/[targetSourceId]/resources/list/route.ts` | 신규 |
| `app/api/v1/idc/target-sources/[targetSourceId]/confirm-targets/route.ts` | 신규 |
| `lib/api-client/types.ts` | 수정 (idc 시그니처) |
| `lib/api-client/mock/idc.ts` | 수정 (targetSourceId 기반) |
| `lib/api-client/bff-client.ts` | 수정 (idc v1 경로) |
| `app/lib/api/idc.ts` | 신규 |
| `app/projects/[projectId]/idc/IdcProjectPage.tsx` | 수정 (callsite 전환) |

**매핑 테이블 (구현 전 작성 필수)**:

```
| Endpoint | Swagger Envelope | Mock Response | Route Action | FE Reads |
|----------|-----------------|---------------|-------------|----------|
| GET installation-status | { ... } | client.idc.getInstallationStatus() | dispatch | idc.getInstallationStatus(targetSourceId) |
| ... (7개 전부) |
```

**검증 (엔드포인트별)**:
```
□ swagger path/method ↔ route.ts 일치
□ swagger response envelope ↔ mock client 반환 일치
□ route.ts에 client.method() 외 로직 없음 (ADR-007)
□ FE helper 타입 ↔ swagger response 일치
□ IdcProjectPage에서 legacy fetch 호출 0건
□ npm run lint 통과
□ npm run build 통과
```

**예상 PR**: 1개

---

### Batch 2: SDU v1 Routes + FE Callsite

**의존**: Batch 0 완료 (sdu.yaml 확정)
**병렬 가능**: Batch 1과 동시 진행 가능 (파일 겹침 없음, 단 `types.ts`, `bff-client.ts` 공유 — 순서 조율 필요)

**범위**:
1. v1 route 생성 (12개 route.ts)
2. `ApiClient` 인터페이스 SDU 시그니처 변경
3. mock client 변환 (`lib/api-client/mock/sdu.ts`)
4. bff client 경로 변환
5. FE helper 수정: `app/lib/api/sdu.ts`
   - base URL `/api/sdu` → `/api/v1/sdu/target-sources`
   - `project.id` → `project.targetSourceId`
6. FE callsite: `SduProjectPage.tsx`

**수정 파일 목록**:

| 파일 | 작업 |
|------|------|
| `app/api/v1/sdu/target-sources/[targetSourceId]/installation-status/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/check-installation/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/s3-upload/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/s3-upload/check/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/iam-user/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/iam-user/issue-aksk/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/source-ip/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/source-ip/register/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/source-ip/confirm/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/athena-tables/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/connection-test/route.ts` | 신규 |
| `app/api/v1/sdu/target-sources/[targetSourceId]/connection-test/execute/route.ts` | 신규 |
| `lib/api-client/types.ts` | 수정 (sdu 시그니처) |
| `lib/api-client/mock/sdu.ts` | 수정 |
| `lib/api-client/bff-client.ts` | 수정 |
| `app/lib/api/sdu.ts` | 수정 (v1 경로) |
| `app/projects/[projectId]/sdu/SduProjectPage.tsx` | 수정 |

**검증**: Batch 1과 동일 체크리스트, 12개 엔드포인트 각각 적용

**예상 PR**: 1개

---

### Batch 3: History + Services Settings + Dev + Projects misc

**의존**: Batch 1, 2 완료

**범위**:

#### 3-A: History
| 파일 | 작업 |
|------|------|
| `app/api/v1/target-sources/[targetSourceId]/history/route.ts` | 신규 |
| `app/lib/api/index.ts` | 수정 (history 함수 v1 전환) |
| `app/components/features/history/ProjectHistoryPanel.tsx` | 수정 (callsite) |
| `lib/api-client/types.ts` | 수정 (history 시그니처 추가) |

#### 3-B: Services Settings
| 파일 | 작업 |
|------|------|
| `app/api/v1/services/[serviceCode]/settings/aws/route.ts` | 신규 (GET/PUT) |
| `app/api/v1/services/[serviceCode]/settings/aws/verify-scan-role/route.ts` | 신규 |
| `app/api/v1/services/[serviceCode]/settings/azure/route.ts` | 신규 (GET) |
| `app/api/v1/services/[serviceCode]/settings/idc/route.ts` | 신규 (GET/PUT) |
| FE callsite 전환 (해당 설정 페이지들) | 수정 |

#### 3-C: Dev
| 파일 | 작업 |
|------|------|
| `app/api/v1/dev/switch-user/route.ts` | 신규 |
| FE callsite 전환 | 수정 |

#### 3-D: Projects misc (잔여 legacy)
- `approve`, `reject`, `completeInstallation`, `confirmCompletion` 등
- 이미 v1 confirm 네임스페이스에 있는지 확인 후, 없으면 추가
- `credentials`, `terraformStatus`, `resources/exclusions` 등 잔여 처리

**검증**: 엔드포인트별 체크리스트 + `npm run build`

**예상 PR**: 1개 (또는 3-A/B/C/D 분리 가능)

---

### Batch 4: Legacy 제거 + Swagger 동기화 + 호환성 보정

**의존**: Batch 1, 2, 3 모두 완료

**범위**:

#### 4-A: Legacy route 삭제
```
제거 대상 디렉토리:
├── app/api/aws/**          (v1 대체 완료 확인 후)
├── app/api/azure/**        (v1 대체 완료 확인 후)
├── app/api/idc/**          (Batch 1 완료 후)
├── app/api/sdu/**          (Batch 2 완료 후)
├── app/api/projects/**     (Batch 3 완료 후)
├── app/api/services/**     (Batch 3-B 완료 후)
├── app/api/user/**         (이미 v1 있음, 확인 후)
├── app/api/users/**        (이미 v1 있음, 확인 후)
└── app/api/dev/switch-user/** (Batch 3-C 완료 후)

유지:
├── app/api/_lib/**         (v1 공통 인프라)
├── app/api/v1/**           (신규)
├── app/api/swagger-spec/** (api-docs)
└── app/api/api-docs/**     (swagger UI)
```

#### 4-B: Legacy 사용처 최종 확인
- `grep -r '/api/aws\|/api/azure\|/api/idc\|/api/sdu\|/api/projects\|/api/services\|/api/user/' --include='*.ts' --include='*.tsx'`
- 0건이어야 삭제 진행

#### 4-C: Mock payload URL 보정
- `lib/mock-azure.ts`: VM terraform script `downloadUrl` 등 legacy URL 하드코딩 수정

#### 4-D: Swagger 문서 동기화
- `docs/swagger/idc.yaml` — Batch 0에서 생성
- `docs/swagger/sdu.yaml` — Batch 0에서 생성
- `docs/swagger/MIGRATION_PLAN.md` — 완료 상태 갱신
- `docs/swagger/README.md` — 파일 목록 갱신
- 기존 swagger (confirm.yaml, user.yaml 등) — 필요 시 갱신

#### 4-E: ApiClient 정리
- `types.ts`에서 legacy-only 메서드 제거 (v1으로 대체된 것들)
- `bff-client.ts`에서 legacy 경로 제거
- `mock/projects.ts` 등에서 사용되지 않는 메서드 제거

**검증**:
- legacy URL grep 0건
- `npm run test:run`
- `npm run lint`
- `npm run build`

**예상 PR**: 1개

---

## 3. Batch별 프롬프트 설계

### 프롬프트 원칙 (PR #179 교훈 반영)

1. **swagger 먼저 읽어라** — 구현 전 swagger 파일의 해당 endpoint path/schema를 반드시 읽고 인용
2. **매핑 테이블 먼저 작성** — 구현 코드 작성 전에 Swagger-Implementation 매핑 테이블 출력
3. **1개씩 검증** — 엔드포인트 N개 작업 시 "1개 구현 → 체크리스트 검증 → 다음" 순서
4. **route.ts는 dispatch-only** — `client.method()` 호출만. `response.json()` 파싱, envelope 재포장 금지
5. **swagger ≠ 코드이면 코드를 수정** — swagger를 코드에 맞추지 않음

### Batch 0 프롬프트

```
[작업] IDC/SDU Swagger 스펙 작성

기존 swagger 패턴을 참조하여 `docs/swagger/idc.yaml`, `docs/swagger/sdu.yaml`을 작성해줘.

[참조]
- 기존 패턴: `docs/swagger/aws.yaml`, `docs/swagger/azure.yaml`
- Legacy route 구현: `app/api/idc/**`, `app/api/sdu/**`
- Mock 데이터: `lib/api-client/mock/idc.ts`, `lib/api-client/mock/sdu.ts`
- Mock 비즈니스 로직: `lib/mock-idc.ts`, `lib/mock-sdu.ts`
- 에러 처리: `docs/swagger/ERROR_HANDLING_DESIGN.md`

[규칙]
- base path: `/api/v1`
- path parameter: `targetSourceId` (integer)
- 공통 ErrorResponse 스키마 사용
- 모든 endpoint에 `x-expected-duration` 포함
- error 응답 (401, 403, 404, 409) 정의 포함
- response envelope 키는 mock 데이터의 실제 반환 shape를 기준으로 정의
  (단, 기존 swagger 네이밍 컨벤션 따름)

[산출물]
1. `docs/swagger/idc.yaml`
2. `docs/swagger/sdu.yaml`
3. `docs/swagger/README.md` 파일 목록 갱신
4. 매핑 테이블 (endpoint별 mock response shape ↔ swagger schema 대조)

[검증]
- 매 endpoint마다: mock 함수 반환값의 필드명 ↔ swagger response 필드명 일치 확인
- 빠진 endpoint 없는지 legacy route 목록과 대조
```

### Batch 1 프롬프트

```
[작업] IDC v1 Route + FE Callsite 마이그레이션

`docs/swagger/idc.yaml` 계약 기준으로 v1 route를 생성하고, FE callsite를 전환해줘.

[⚠️ PR #179 교훈 — 반드시 준수]
1. 구현 전: swagger의 해당 endpoint response schema를 먼저 읽고 인용
2. 매핑 테이블을 먼저 작성 (아래 형식)
3. route.ts는 client.method() 디스패치만 (ADR-007)
4. 1개 endpoint 구현 → 체크리스트 검증 → 다음 endpoint
5. swagger ≠ 코드이면 코드를 수정 (swagger 수정 금지)

[매핑 테이블 형식]
| Endpoint | Method | Swagger Envelope | Mock Method | Route Action | FE Helper |
|----------|--------|-----------------|-------------|-------------|-----------|

[참조 파일]
- Swagger: `docs/swagger/idc.yaml`
- v1 패턴: `app/api/v1/aws/target-sources/[targetSourceId]/installation-status/route.ts` (참조용)
- 공통 인프라: `app/api/_lib/handler.ts`, `target-source.ts`, `problem.ts`
- Mock client: `lib/api-client/mock/idc.ts`
- BFF client: `lib/api-client/bff-client.ts`
- Types: `lib/api-client/types.ts`
- FE: `app/projects/[projectId]/idc/IdcProjectPage.tsx`

[산출물]
1. v1 route.ts × 7개 (+ resources/list 포함 시 8개)
2. `lib/api-client/types.ts` idc 시그니처 변경
3. `lib/api-client/mock/idc.ts` targetSourceId 기반 전환
4. `lib/api-client/bff-client.ts` idc v1 경로
5. `app/lib/api/idc.ts` (신규 FE helper)
6. `IdcProjectPage.tsx` callsite 전환

[검증 — 매 endpoint마다]
□ swagger path/method ↔ route.ts 일치
□ swagger response envelope ↔ mock 반환 일치
□ route.ts에 client.method() 외 로직 없음
□ FE helper 타입 ↔ swagger response 일치
□ npm run lint && npm run build
```

### Batch 2 프롬프트

```
[작업] SDU v1 Route + FE Callsite 마이그레이션

(Batch 1과 동일 구조, SDU 대상)

[⚠️ PR #179 교훈] (Batch 1과 동일)

[참조 파일]
- Swagger: `docs/swagger/sdu.yaml`
- Mock client: `lib/api-client/mock/sdu.ts`
- FE: `app/lib/api/sdu.ts`, `SduProjectPage.tsx`

[주의]
- `app/lib/api/sdu.ts`는 이미 존재. base URL과 파라미터만 v1으로 전환
- `types.ts`, `bff-client.ts`는 Batch 1과 공유 파일
  → Batch 1이 먼저 merge된 상태에서 작업 (또는 conflict 최소화 설계)

[산출물]
1. v1 route.ts × 12개
2. types.ts sdu 시그니처 변경
3. mock/sdu.ts 전환
4. bff-client.ts sdu v1 경로
5. app/lib/api/sdu.ts 수정
6. SduProjectPage.tsx callsite 전환
```

### Batch 3 프롬프트

```
[작업] History + Services Settings + Dev + Projects 잔여 v1 마이그레이션

[범위]
A. History: /api/v1/target-sources/{targetSourceId}/history
B. Services Settings: /api/v1/services/{serviceCode}/settings/{aws,azure,idc} + verify-scan-role
C. Dev: /api/v1/dev/switch-user
D. Projects 잔여: approve, reject, completeInstallation 등 (v1 confirm에 이미 있는지 먼저 확인)

[⚠️ PR #179 교훈] (동일)

[특이사항]
- History는 swagger에 spec이 없을 수 있음 → 기존 confirm.yaml 또는 user.yaml에 추가 필요
- Services Settings도 swagger spec 없을 수 있음 → 필요 시 신규 작성
- Projects 잔여 중 이미 v1에 있는 것은 skip (중복 생성 금지)

[검증]
- legacy URL grep 결과에서 해당 패턴 0건 확인
- npm run lint && npm run build
```

### Batch 4 프롬프트

```
[작업] Legacy Route 제거 + Swagger 동기화 + 호환성 보정

[사전 확인 — 삭제 전 필수]
1. grep으로 legacy URL 사용처 전수 조사
2. 사용처가 0건인 디렉토리만 삭제
3. 1건이라도 남아있으면 해당 callsite를 먼저 v1으로 전환

[삭제 대상]
- app/api/aws/**, azure/**, idc/**, sdu/**
- app/api/projects/**, services/**, user/**, users/**
- app/api/dev/switch-user/**

[유지]
- app/api/_lib/**, v1/**, swagger-spec/**, api-docs/**

[추가 작업]
- lib/mock-azure.ts 등에서 legacy URL 하드코딩 수정
- types.ts에서 legacy-only 메서드 정리
- docs/swagger/MIGRATION_PLAN.md 완료 상태 갱신
- docs/swagger/README.md 파일 목록 갱신

[검증]
- grep -r 'legacy URL 패턴' 0건
- npm run test:run
- npm run lint
- npm run build
- 실패 시 원인/영향/후속 TODO를 PR 본문에 명시
```

---

## 4. 세션 운영 전략

### 세션 분할 권장

| 세션 | Batch | 예상 규모 | 비고 |
|------|-------|----------|------|
| 세션 1 | Batch 0 | YAML 2개 + README | docs only, 빠름 |
| 세션 2 | Batch 1 (IDC) | route 7-8개 + FE 2개 + client 3개 | 중간 규모 |
| 세션 3 | Batch 2 (SDU) | route 12개 + FE 2개 + client 3개 | 대규모 |
| 세션 4 | Batch 3 | route ~8개 + FE ~5개 | 중간 규모 |
| 세션 5 | Batch 4 | 삭제 + 정리 | 주의 필요 |

### Batch 1/2 병렬 실행 가능 조건

Batch 1과 2가 공유하는 파일:
- `lib/api-client/types.ts` — idc/sdu 네임스페이스가 분리되어 있어 conflict 낮음
- `lib/api-client/bff-client.ts` — 같은 이유로 conflict 낮음

**조건**: Batch 1이 먼저 merge되면 Batch 2는 rebase 후 진행.
**대안**: 같은 세션에서 순차 작업 (types.ts/bff-client.ts merge conflict 방지).

### 팀 에이전트 활용

| 역할 | 담당 |
|------|------|
| team-lead | Batch 분배, 매핑 테이블 검증, PR 리뷰 |
| code-implementer (서브에이전트) | route.ts + client 계층 구현 |
| designer (서브에이전트) | FE callsite 전환 (UI 변경 없으므로 code-implementer가 겸임 가능) |
| code-reviewer | 매 Batch PR 전 contract-first 체크리스트 검증 |

---

## 5. 리스크 및 완화

| 리스크 | 영향 | 완화 |
|--------|------|------|
| IDC/SDU swagger 작성 시 mock과 불일치 | 구현 단계에서 재작업 | Batch 0에서 필드 단위 대조 |
| types.ts 공유 파일 conflict | Batch 1/2 merge 시 충돌 | 순차 merge 또는 같은 세션에서 작업 |
| Legacy 제거 시 숨겨진 사용처 | 런타임 에러 | grep 전수 조사 + build 검증 |
| FE에서 project.id → project.targetSourceId 전환 누락 | 404 에러 | FE 파일별 grep 확인 |
| Admin 액션 (approve/reject) v1 계약 미정의 | Batch 3-D 범위 불확실 | 기존 v1 confirm에 이미 있는 것 확인 후 판단 |

---

## 6. 성공 기준

- [ ] `app/api/` 하위에 legacy route 디렉토리 0개 (api-docs, swagger-spec, _lib, v1 제외)
- [ ] FE 코드에서 `/api/aws/`, `/api/azure/`, `/api/idc/`, `/api/sdu/`, `/api/projects/`, `/api/services/`, `/api/user/`, `/api/dev/` 패턴 grep 0건
- [ ] `docs/swagger/idc.yaml`, `docs/swagger/sdu.yaml` 존재
- [ ] `npm run test:run` 통과
- [ ] `npm run lint` 통과
- [ ] `npm run build` 통과
- [ ] 각 endpoint별 Contract-First 체크리스트 전체 통과
