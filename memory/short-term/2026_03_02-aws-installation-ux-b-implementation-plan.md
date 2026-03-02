# AWS 설치 UX B안 구현 계획 (Swagger/MockData 중심)

> 작성일: 2026-03-02  
> 기준 문서: `docs/requirements/aws-installation-status-ux-options.md`  
> 목표: B안(Service Accordion + Resource 패널) 구현을 위해 **Swagger 계약**과 **MockData/Mock API**를 선행 정비한다.

## 1) 구현 목표 요약

채택안(B)에서 UI가 필요로 하는 핵심 데이터는 아래 3개다.

1. 상단 요약
   - `서비스 담당자 조치 필요 여부`
   - `BDC 설치 필요 여부`
2. Script 단위 목록
   - `terraformScriptName`별 row
   - Script 상태 라벨: `서비스 측 확인 필요 | 설치 완료 | 확인 필요`
3. Script 선택 시 Resource 패널
   - Resource 상태 라벨: `설치 확인중 | 설치 완료 | 확인 필요`
   - 조치 버튼 타입: `설치 가이드 | 상태 확인 | 없음`

## 2) 범위/비범위

### 범위 (이번 계획의 상세 대상)

- `docs/swagger/aws.yaml` 계약 정비
- `lib/mock-installation.ts` / `lib/mock-data.ts` / `lib/api-client/mock/aws.ts` Mock 데이터 흐름 정비
- 관련 타입/변환 계층 정비 (`lib/types.ts`, `app/api/v1/aws/**/route.ts`)

### 비범위 (후속 구현 단계)

- 실제 UI 컴포넌트 리팩터링 (`AwsInstallationInline` -> B안 레이아웃)
- 디자인 토큰/스타일링 세부 튜닝

## 3) 작업 스트림 개요

1. **S1 - Swagger 계약 확정**
2. **S2 - Mock API 응답 구조 맞춤**
3. **S3 - Mock 초기 데이터/시나리오 확장**
4. **S4 - 테스트 보강**

선행 순서: `S1 -> S2 -> S3 -> S4`

---

## 4) S1 - Swagger 변경 상세

## 4.1 변경 원칙

1. 기존 엔드포인트는 유지한다.
   - `GET /aws/target-sources/{targetSourceId}/installation-status`
   - `POST /aws/target-sources/{targetSourceId}/check-installation`
2. **Breaking change 없이 additive 확장**으로 진행한다.
3. 기존 필드는 하위호환 유지하고, B안 전용 표현 필드는 선택(optional) 필드로 추가한다.

## 4.2 변경 파일

- `docs/swagger/aws.yaml`

## 4.3 스키마 변경안 (초안)

### A. `AwsInstallationStatus`에 상단 요약 정보 추가

`actionSummary`(신규, optional)

```yaml
actionSummary:
  type: object
  required: [serviceActionRequired, bdcInstallationRequired]
  properties:
    serviceActionRequired:
      type: boolean
      description: "서비스 담당자 조치 필요 여부"
    bdcInstallationRequired:
      type: boolean
      description: "BDC 설치 필요 여부"
```

### B. `ServiceScript`에 Script 식별/표현 필드 추가

신규 필드:

- `scriptId: string` (안정적 키)
- `terraformScriptName: string` (UI 표기용 이름)
- `serviceDisplayStatus: enum`
  - `SERVICE_CHECK_REQUIRED`
  - `INSTALLATION_COMPLETED`
  - `NEEDS_ATTENTION`
- `resourceCount: integer`

### C. `ResourceItem`에 UI 표시 필드 추가

신규 필드:

- `installationDisplayStatus: enum`
  - `CHECKING` (`설치 확인중`)
  - `COMPLETED` (`설치 완료`)
  - `NEEDS_ATTENTION` (`확인 필요`)
- `actionType: enum`
  - `SHOW_GUIDE`
  - `REFRESH_STATUS`
  - `NONE`

## 4.4 상태 매핑 계약 명시(문서화)

Swagger 설명(description)에 아래 규칙을 명시:

1. `serviceDisplayStatus`
   - Service `PENDING/IN_PROGRESS` -> `SERVICE_CHECK_REQUIRED`
   - Service `COMPLETED` -> `INSTALLATION_COMPLETED`
   - Service `FAILED` 또는 상태 불명확 -> `NEEDS_ATTENTION`
2. `installationDisplayStatus`
   - Service 완료 + BDC 완료 -> `COMPLETED`
   - Service 미완료 또는 BDC 미완료 -> `CHECKING`
   - BDC 실패 또는 Service 불명확 -> `NEEDS_ATTENTION`

## 4.5 버전/호환성 처리

1. `info.version` 소폭 상향 (예: `1.15.0 -> 1.16.0`)
2. 기존 `scriptName`, `status` 필드는 유지
3. 신규 필드는 optional로 추가해 기존 클라이언트 영향 최소화

---

## 5) S2 - Mock API 응답 변경 상세

## 5.1 변경 파일

- `app/api/v1/aws/target-sources/[targetSourceId]/installation-status/route.ts`
- `app/api/v1/aws/target-sources/[targetSourceId]/check-installation/route.ts`
- `lib/types.ts` (v1 AWS 타입 확장)

## 5.2 구현 포인트

1. 기존 `transformServiceScript` 확장
   - legacy `id` -> `scriptId`
   - legacy `label` -> `terraformScriptName` (기존 `scriptName`과 병행)
   - `resourceCount` 계산
2. `actionSummary` 계산 함수 추가
   - `serviceActionRequired`: service script 중 미완료/불명확 존재 여부
   - `bdcInstallationRequired`: `bdcStatus != COMPLETED`
3. `ResourceItem`별 표시 상태 계산 함수 추가
   - Service/BDC 조합으로 `installationDisplayStatus`/`actionType` 산출

## 5.3 리팩터링 가이드

두 route 파일에 동일 로직이 중복될 가능성이 높으므로 `_lib` 유틸로 분리:

- 신규 파일(예시): `app/api/v1/aws/target-sources/_lib/installation-transform.ts`
- 공통 함수:
  - `toServiceDisplayStatus(...)`
  - `toResourceDisplayStatus(...)`
  - `toActionSummary(...)`

---

## 6) S3 - MockData 변경 상세

## 6.1 변경 파일

- `lib/mock-installation.ts`
- `lib/mock-data.ts` (seed 시나리오 확장)
- `lib/api-client/mock/aws.ts` (초기화/조회 흐름 점검)
- 필요 시 `lib/mock-store.ts` (구조 유지 확인)

## 6.2 데이터 구조 전략

핵심: **Script 중심 데이터는 유지**하고, UI 표시는 S2 변환계층에서 계산한다.  
즉, mock 원본 구조는 크게 바꾸지 않고 시나리오 데이터 품질을 높인다.

유지할 원본:

- `serviceTfScripts[]` (id, label, status, resources)
- `bdcTf.status`

## 6.3 시나리오 확장(필수)

최소 5개 케이스 seed를 확보:

1. `CASE-A` Service 미완료 + BDC 미완료
2. `CASE-B` Service 완료 + BDC 미완료
3. `CASE-C` Service 완료 + BDC 완료
4. `CASE-D` Service 상태 불명확(UNKNOWN 취급 대상)
5. `CASE-E` BDC 실패(상세는 비노출, 결과는 `확인 필요`)

각 케이스에 대해:

- script 2~3개
- script별 resource 1~3개
- 동일 script에 resource 다수 매핑(N:1)

## 6.4 Mock 로직 보강 포인트

1. `checkInstallation` 결과가 케이스별로 결정적으로 재현되도록 랜덤 의존 최소화
2. BDC 실패 케이스를 테스트용 식별자로 강제 재현 가능하게 처리
   - 예: projectId suffix 규칙 또는 fixture flag
3. `lastCheckedAt` 갱신과 상태 전이가 검증 가능하도록 타이머 흐름 유지

---

## 7) S4 - 테스트 계획

## 7.1 단위 테스트

- `lib/__tests__/mock-installation.test.ts`
  - 케이스별 전이 검증
  - BDC 실패 시 `NEEDS_ATTENTION`로 승격되는지 검증(변환 로직 기준)

## 7.2 변환(route) 테스트 추가 권장

신규 테스트 파일(예시):

- `app/api/v1/aws/target-sources/[targetSourceId]/installation-status/__tests__/transform.test.ts`

검증 포인트:

1. `actionSummary` 계산 정확성
2. `serviceDisplayStatus`/`installationDisplayStatus` 매핑 정확성
3. 기존 필드 하위호환 유지(`scriptName`, `status` 존재)

## 7.3 회귀 검증 명령

```bash
npm run test:run
npm run lint
npx tsc --noEmit
npm run build
```

---

## 8) 단계별 실행 체크리스트

## 8.1 Swagger

- [ ] `AwsInstallationStatus` 확장 필드 반영
- [ ] `ServiceScript` 확장 필드 반영
- [ ] `ResourceItem` 확장 필드 반영
- [ ] 상태 매핑 설명/예시 추가
- [ ] version 업데이트

## 8.2 Mock/Transform

- [ ] `lib/types.ts` 타입 확장
- [ ] v1 route transform 공통화
- [ ] actionSummary 계산 반영
- [ ] resource 표시 상태 계산 반영

## 8.3 Mock Seed

- [ ] 5개 케이스 fixture 반영
- [ ] BDC 실패 재현 경로 추가
- [ ] 랜덤 의존 축소

## 8.4 Tests

- [ ] 기존 mock-installation 테스트 갱신
- [ ] transform 테스트 추가
- [ ] 전체 회귀 통과

---

## 9) 리스크 및 대응

1. **리스크**: Swagger enum 확장 시 기존 클라이언트 파싱 이슈
   - **대응**: 기존 enum 필드는 유지, 신규 표현은 별도 필드로 분리
2. **리스크**: mock/route에 상태 매핑 중복
   - **대응**: route 공통 유틸로 단일화
3. **리스크**: BDC 실패 노출 정책 혼선
   - **대응**: 문서 기준 고정 (`확인 필요` 승격)

---

## 10) 구현 착수 기준

아래가 충족되면 UI 구현으로 넘어간다.

1. Swagger에서 B안 표현 필드가 확정됨
2. Mock API가 Script/Resource 패널 렌더링에 필요한 데이터를 제공함
3. 테스트로 5개 상태 케이스가 재현 가능함
