# ADR-007 재평가 — API Client 패턴이 앞으로도 적합한가

> 작성일: 2026-04-25
> 대상: ADR-007 「API Client 패턴 도입」 (승인 2026-02-14)
> 동기: Issue #222 후속 PR 군(#235·#237·#239·#240·#253 등)에서 반복적으로 발생한 mock↔BFF 계약 동기화 마찰. 그리고 `docs/api/boundaries.md`가 인정한 "Pipeline 1 vs Pipeline 2" 혼란.

---

## 0. TL;DR

ADR-007은 채택 후 약 2.5개월 동안 운용된 결과 **목표한 "route.ts가 깔끔해진다"는 결과는 부분적으로만 달성**됐다. 실제로는 다음과 같은 구조적 문제가 누적됐다.

1. **두 개의 BFF 클라이언트가 공존**한다 — `lib/api-client/bff-client.ts` (CSR 경로용)과 `lib/bff/http.ts` (RSC 경로용). 같은 upstream을 두 번 구현하면서, RSC용은 13개 도메인 중 2개만 구현된 상태로 정체됐다.
2. **`ApiClient` 인터페이스가 `Promise<NextResponse>`를 반환**한다. 이는 도메인 데이터 추상화가 아니라 *HTTP 응답 추상화*이며, route.ts는 즉시 다시 unwrap → cast → 변환 → re-wrap 한다. 결과적으로 mock과 BFF는 "같은 NextResponse JSON을 만들면 OK"라는 약속만 공유하는데, 이 본문 shape 약속은 **타입으로 강제되지 않는다**.
3. **Issue #222 마찰의 본질은 ADR-007의 추상화 위치 선택 실수**에서 비롯된다. mock과 BFF는 *NextResponse 본문 shape* 수준에서만 일치하면 되므로, snake/camel·필드명·페이지네이션 형태 차이가 컴파일러 검증을 통과한 채 런타임에서 발견된다 (PR #253 `mockScan.getHistory: {history,total} → {content,totalElements}`, `mockScan.create snake_case`, `proxyGet camelCase / proxyPost raw passthrough` 비대칭 사례).
4. **3중 변환 사슬**이 만들어졌다 — (a) bff-client `proxyGet` camelCase, (b) route.ts `_lib/transform.ts` legacy→v1, (c) `app/lib/api/index.ts` runtime normalize→UI model. 변환 지점이 늘수록 mock 드리프트 위험이 비례해 커진다.
5. ADR-007/`boundaries.md`가 "ESLint 강제 미정", "두 HTTP 클라이언트 통합 미정", "스키마 검증 미정"을 *open question*으로 남겨둔 채 운영 중이다.

**권고**: ADR-007을 폐기·전면 대체하지 말고, **Pipeline 2(`lib/bff/*`) 중심으로 통합**하는 방향으로 ADR-007을 *Superseded by*로 표시하고 ADR-011(가칭) 「Typed BFF Client 단일화」를 새로 작성한다. CSR route.ts는 `bff.x.y(id)`를 호출해 그 결과를 그대로 `NextResponse.json` 하는 *얇은 어댑터*로 축소한다.

마이그레이션 비용은 작지 않으나(~59 route, ~13 도메인), Issue #222 류의 마찰이 다음 BFF 변경(GCP/AWS Wave 등)마다 반복될 비용보다는 낮다.

---

## 1. 현재 구조 (ADR-007 채택 이후 실측)

### 1.1 두 파이프라인

`docs/api/boundaries.md`가 정리한 그림:

```
Pipeline 1 (CSR)
  Component → @/app/lib/api/*.ts → fetch('/integration/api/v1/...')
                                        ↓
                                   route.ts → @/lib/api-client/* (mockClient | bffClient)
                                                                       ↓
                                                                  upstream BFF

Pipeline 2 (RSC, server-only)
  RSC → @/lib/bff/client.ts → @/lib/bff/http.ts (httpBff) | mockBff
                                          ↓
                                     upstream BFF
```

- Pipeline 1은 13+ 도메인 (`ApiClient` 인터페이스 117 라인, 60+ 메서드).
- Pipeline 2는 **2개 도메인** (`BffClient` 인터페이스 19 라인 — `targetSources`, `users`).

같은 upstream을 두 번 호출하는 두 개의 HTTP 클라이언트가 공존한다.

### 1.2 route.ts 실제 모습

ADR-007 "After" 예시:
```typescript
export const GET = async (_request, { params }) => {
  const { projectId } = await params;
  return client.projects.get(projectId);
};
```

실제 production 코드 (`app/integration/api/v1/azure/target-sources/[targetSourceId]/installation-status/route.ts`):
```typescript
export const GET = withV1(async (_request, { requestId, params }) => {
  const parsed = parseTargetSourceId(params.targetSourceId, requestId);
  if (!parsed.ok) return problemResponse(parsed.problem);

  const response = await client.azure.getInstallationStatus(String(parsed.value));
  if (!response.ok) return response;

  const dbStatus = await response.json() as LegacyInstallationStatus;  // 타입 단언
  return NextResponse.json(buildV1Response(dbStatus, null));            // 변환
});
```

ADR-007이 가정한 "`return client.x.y(id)`" 한 줄 패턴은 실제로는 거의 적용되지 않는다. `app/integration/api/v1/**/route.ts` 59개 중:
- **13개 파일**이 `response.json() as ...` 타입 단언을 사용 (`rg -l 'response\.json\(\) as' app/integration/api/v1 --glob 'route.ts'`).
- **27개 파일**이 `response.json()` unwrap 후 추가 처리/변환 (단언이 없는 경우 포함).
- 다수가 별도 `_lib/transform.ts` 또는 `lib/issue-222-approval.ts`를 호출해 BFF→Swagger v1 매핑을 수행.
- `withV1` 미들웨어, `parseTargetSourceId`, `problemResponse` 등 Phase 0 헬퍼 호출.

### 1.3 변환 사슬 (예: AzureProjectPage 한 화면)

```
upstream BFF (snake_case, legacy shape)
   ↓ proxyGet(): camelCaseKeys
NextResponse #1 (camelCase, legacy shape)        ← route.ts 안에서 unwrap
   ↓ buildV1Response() in _lib/transform.ts
NextResponse #2 (Swagger v1 shape)                ← browser가 받는 응답
   ↓ fetchInfraCamelJson() in app/lib/api/infra.ts
JSON #3 (camelCase, v1 shape)                    ← app/lib/api/index.ts에서 다시 normalize
   ↓ normalizeIssue222ApprovalRequestSummary() in lib/issue-222-approval.ts
도메인 객체 (UI 모델)
```

`lib/issue-222-approval.ts`만 529 라인, `app/lib/api/index.ts`만 667 라인. 이 길이는 **ADR-007 채택 후에 늘어난 것**이며 (PR #235 +184 라인 등), 추상화 비용을 상위 레이어가 흡수한 결과다.

### 1.4 ApiClient의 반환 타입

```typescript
export interface ApiClient {
  azure: {
    getInstallationStatus: (targetSourceId: string) => Promise<NextResponse>;
    // ...
  };
  // ...
}
```

`Promise<NextResponse>`는 다음 의미를 가진다:
- 인터페이스가 *HTTP 전송 표면*만을 추상화한다.
- mockClient·bffClient의 계약은 "같은 NextResponse JSON을 돌려준다"이지만, JSON 본문 구조는 타입으로 강제되지 않는다.
- 호출자(route.ts)는 매번 `await response.json() as SomeShape`로 단언해야 한다 (anti-pattern A2).

이는 Pipeline 2의 `BffClient`와 대조적이다:
```typescript
export interface BffClient {
  targetSources: {
    get: (id: number) => Promise<TargetSource>;  // 도메인 타입
  };
}
```

---

## 2. 문제점 — Issue #222 사례를 통해 본 마찰의 구조

### 2.1 P1 — Mock-BFF 응답 본문 shape가 타입으로 강제되지 않는다

`ApiClient`의 모든 메서드가 `Promise<NextResponse>`를 반환하므로, NextResponse 본문 JSON이 어떤 *구조*여야 하는지는 타입으로 표현되지 않는다. mockClient와 bffClient는 "같은 NextResponse 본문 JSON을 만들면 OK"라는 비공식 약속만 공유한다.

PR #253 사례:
- `mockScan.getHistory`: 기존 `{ history, total }` → BFF는 `{ content, totalElements }` (camelCase, 페이지네이션 형태). mock과 BFF가 다른 shape을 반환하다 컴포넌트가 깨졌고, mock을 고쳐 정렬.
- `mockScan.create`: BFF는 snake_case `ScanJob`을 반환하고 `proxyPost`는 raw passthrough이므로 mock도 snake_case로 보내야 했음.
- `mockScan.getStatus`: BFF는 camelCase `ScanJob`을 반환하고 `proxyGet`은 `camelCaseKeys`로 자동 변환하므로 mock은 camelCase.

같은 PR description에서 이미 명시된 비대칭:
> "proxyGet은 camelCaseKeys 자동 변환, proxyPost/Put은 raw passthrough — 이 비대칭 때문에 getHistory(GET)는 camelCase, create(POST)는 snake_case로 내야 합니다"

이 비대칭은 mockClient 작성자가 *어느 메서드는 camelCase, 어느 메서드는 snake_case*로 본문을 만들어야 한다는 비공식 규칙을 만들어낸다. 타입 시스템이 본문 shape을 검증할 수 없으므로 사후 런타임 발견에 의존하게 된다.

### 2.2 P2 — Issue #222 후속 PR 5건의 공통 패턴

| PR | 핵심 변경 | 본질 |
|---|---|---|
| #234 user bootstrap contract | `app/lib/api/index.ts` + route + mock 모두 수정 | 동일 도메인 3곳 중복 변경 |
| #235 Azure approval/install flow | `lib/issue-222-approval.ts` 498라인 신규 + 9 routes + mock 159라인 추가 | 변환 헬퍼가 폭발적으로 성장 |
| #237 normalize azure read model | mock + route + 어댑터 동기 | 같은 작업의 분할 |
| #240 credential proxy contract | bff-client + route + app/lib/api 모두 동시에 PATCH→PUT | 한 endpoint 변경에 3 레이어 동시 수정 |
| #253 sync mock with bff contract | mock-only 정합성 보정 | 컴파일러가 못 잡아서 사후 보정 |

**모든 변경이 "같은 도메인의 3 레이어를 함께 수정"하는 구조**다. 이는 Shotgun Surgery(산탄총 수술) 안티패턴으로, 추상화 경계가 잘못 그어진 신호다.

### 2.3 P3 — 다층 변환 사슬

§1.3에서 보인 (a)→(b)→(c) 3단계 변환은 다음 비용을 발생시킨다:
- 한 도메인의 BFF 응답 구조 변경 → 3 레이어 모두 수정.
- mock은 (a) 입력을 emulate해야 함 → (b)·(c)가 동일 결과를 내도록 설정.
- 새 endpoint 추가 → `ApiClient` 타입, mockX 구현, bffClient 메서드, route.ts, app/lib/api 헬퍼, (선택) lib/bff types/http/mock 까지 7곳 수정.

### 2.4 P4 — Pipeline 2 `lib/bff/*` 정체

`lib/bff/types.ts`는 19라인, 2개 도메인이다. 이는 ADR-007이 Pipeline 1을 강하게 추진하는 동안, RSC 경로는 사실상 **개발 중단** 상태에 머물렀음을 보여준다. 그러나 `app/integration/target-sources/[targetSourceId]/page.tsx`(서버 컴포넌트)는 여전히 `bff`를 사용한다. 따라서 두 클라이언트 모두 production 의존성이고, 어느 쪽도 제거할 수 없다.

`docs/api/boundaries.md` "open questions"에도 명시:
> "lib/bff/* vs lib/api-client/bff-client.ts — two HTTP clients targeting the same upstream. Possible consolidation: have httpBff reuse bff-client transport (needs design review)."

이 통합 질문이 `boundaries.md`에서 **답을 미룬 채 제도화**됐다.

### 2.5 P5 — `Promise<NextResponse>` 약속의 실패

ADR-007 채택의 핵심 가정 중 하나는 "route.ts에서 mock 분기를 제거하고 BFF 전환 시 환경변수만 바꾸면 된다"였다. 그러나:

- BFF가 실제 연결되면 (`USE_MOCK_DATA=false`) `bff-client.ts.proxyGet`이 응답을 camelCase로 변환해서 NextResponse를 만든다. mock도 같은 변환을 emulate해야 같은 NextResponse가 나온다.
- 그런데 mock은 in-memory로 데이터를 만들기 때문에 *애초에* camelCase로 만들거나, 일부러 snake_case로 만든 후 변환을 거치게 해야 한다 — 어느 쪽도 자연스럽지 않다.
- mockClient의 각 메서드는 결국 `NextResponse.json(data)`로 끝나며, 그 *data 구조*가 BFF 응답과 일치하는지는 컴파일러로 강제되지 않는다 (PR #253의 `mockScan.getHistory` shape 불일치가 그 사례).

추상화가 *데이터 레이어*가 아닌 *HTTP 응답 레이어*에 그어졌기 때문에 발생한 결과다.

> **별도 검증 필요**: PR #253 커밋 메시지에 따르면 `mockAzure.getScanApp`이 `ApiClient['azure']` 타입 선언에는 있었으나 mock 구현에 누락된 채로 한동안 운영됐다. 본 보고서가 이를 NextResponse 본문 shape 문제의 사례로 인용하는 것은 부정확하다. `mockClient: ApiClient` 구조적 할당은 누락된 메서드를 컴파일 타임에 잡아야 하므로, 이 미스터리는 별도 조사가 필요하다 (가설: 과거 일시적 `as ApiClient` 캐스트, type-only import 위치 변경, 또는 CI에서 tsc 단계 누락). 이는 본 보고서의 *NextResponse-typed 추상화* 진단과 분리해서 다뤄야 한다.

### 2.6 P6 — 작은 비일관성

- ADR-007 본문 상태: "제안됨" / `docs/adr/README.md` 표 상태: "승인됨". 운영 중인 결정이므로 본문을 "승인됨"으로 갱신해야 한다.
- ADR-007 "마이그레이션 계획 Phase 2: 나머지 ~61개 route 전환"은 사실상 완료됐다 (현재 59 route 중 거의 전부가 `client.x.y` 호출). Phase 3은 미실행.

---

## 3. Frontend Best Practice 비교

### 3.1 일반적 BFF 레이어링 (Next.js App Router 기준)

업계에서 통용되는 패턴은 다음 중 하나이며, 두 가지 모두 **추상화 경계를 데이터 레이어에 둔다**:

**패턴 A — Server-only typed BFF, Route Handler가 얇은 HTTP 어댑터**
```
Server Component → bff.users.me() → Promise<User>
Client Component → fetch('/api/v1/me') → Route → return Response.json(await bff.users.me())
                                                ────────────────────────
                                                같은 typed client 호출
```
- 장점: 단일 typed 계약. mock은 이 계약을 만족하는 in-memory 구현.
- 단점: route handler가 transformation을 하려면 typed client를 넘어 한 번 더 호출해야 함.

**패턴 B — Service layer + thin route + react-query**
```
Browser → useQuery({ queryFn: () => fetch('/api/v1/me') }) → Route → service.getCurrentUser()
RSC     → service.getCurrentUser() (직접 호출)
```
- 장점: cache·retry·invalidation 표준화. 양 방향 모두 service 한 곳을 부름.
- 단점: 클라이언트 라이브러리 종속(@tanstack/react-query 등).

### 3.2 현재 ADR-007 패턴의 위치

ADR-007은 패턴 A와 닮았으나, *추상화 경계를 한 단계 늦게* 그었다 — `Promise<User>`가 아니라 `Promise<NextResponse>`. 이 한 단계 차이가 §2의 모든 마찰을 만든다.

### 3.3 검증 가능한 best-practice 신호

| 신호 | 현재 상태 |
|---|---|
| 클라이언트와 서버가 같은 typed 계약을 공유한다 | ❌ Pipeline 1과 2가 다른 인터페이스 |
| Mock과 real impl이 같은 도메인 타입 반환 | ❌ NextResponse-typed |
| 새 endpoint 추가 시 변경 파일 ≤ 3 | ❌ 평균 5–7곳 |
| mock과 BFF의 *응답 본문 shape*이 컴파일 타임에 강제됨 | ❌ NextResponse 본문은 타입으로 표현되지 않음 (PR #253 mockScan 사례) |
| ESLint가 boundary 위반을 차단 | ❌ `boundaries.md` 미정 |

---

## 4. 선택지

### 4.1 옵션 A — 현 상태 유지 + 마이너 보강

- ADR-007 본문 상태를 "승인됨"으로 갱신.
- ADR-008 ESLint `no-restricted-imports` 룰을 즉시 도입해 boundary 강제.
- `proxyGet`/`proxyPost` camelCase 비대칭 문서화.
- mock 누락을 잡기 위한 contract test 추가 (mock 메서드가 `ApiClient` 모든 키를 만족하는지 컴파일 단계 확인은 이미 되고 있어야 하나, 누락 사례가 발생했으므로 점검 필요).

비용: 낮음. 효과: 점진적·미봉책. 다음 BFF Wave에서 같은 마찰 반복 가능성 높음.

### 4.2 옵션 B — `lib/bff/*` 중심 단일화 (권장)

- `BffClient` 인터페이스를 13 도메인까지 확장 (`ApiClient`의 메서드 목록을 그대로 포팅, 단 반환 타입을 도메인 타입으로 변경).
- `httpBff`가 모든 도메인 구현. `mockBff`도 동일.
- route.ts는 `withV1` + 얇은 `NextResponse.json(await bff.x.y(id))` 패턴으로 전환.
- `lib/api-client/*` 디렉토리 폐기 (또는 deprecated re-export 유지 후 마이그레이션 완료 시 제거).
- `app/lib/api/*` CSR 헬퍼는 유지 — 단, route 응답이 이미 `bff.x.y()`의 도메인 타입과 동일하므로 `app/lib/api/index.ts`의 normalize 로직을 대폭 축소할 수 있다.

비용: 중간~큼 (§5.2의 cost table 참조). 도메인별 wave로 끊으면 기존 작업 흐름과 호환.
효과: §3.3 신호 5개 중 4개를 한꺼번에 확보.

#### 4.2.1 Canonical Contract 선택 (B-1 / B-2 / B-3)

옵션 B를 채택하려면 `BffClient`가 **어느 shape을 반환할 것인가**를 명시해야 한다. 세 후보가 있다:

| 변형 | `bff.azure.getInstallationStatus(id)` 반환 | 장점 | 단점 |
|---|---|---|---|
| **B-1** Upstream BFF shape (typed legacy) | `LegacyInstallationStatus` (현재 `_lib/transform.ts`의 입력 타입) | 가장 작은 변경. 기존 route 변환 그대로 유지. mock과 httpBff의 *메서드 시그니처와 반환 타입*이 동일 → mock 누락·snake/camel 드리프트가 컴파일 타임에 검출. | route.ts에 v1 변환 그대로 남음. 변환 사슬 3→2단계로만 감소. **upstream BFF가 실제로 그 typed shape을 보낸다는 것은 컴파일 타임에 보장되지 않으므로** (httpBff는 여전히 `as T` 캐스트), 런타임 shape 검증은 zod/type guard가 별도로 필요. |
| **B-2** Public Swagger v1 shape | `AzureInstallationStatusV1Response` (route.ts가 현재 반환하는 shape) | route.ts가 진짜로 thin (`NextResponse.json(await bff.x.y())`). 변환 사슬이 2→1로 감소. UI는 Swagger 계약을 *그대로* 본다. | `_lib/transform.ts` 등 모든 v1 변환을 `httpBff`/`mockBff`로 이동 필요. composite route(아래 §4.2.2)는 BffClient 메서드가 내부에서 multiple HTTP call을 조합. |
| **B-3** UI/Domain model | `AzureInstallationStatus` (UI가 쓰는 타입) | `app/lib/api/index.ts` normalize 로직이 거의 사라짐. | UI shape이 Swagger 계약을 더 이상 1:1 반영하지 않음 → 대외 API 계약 검증이 어려워지고 contract test가 BFF 응답과 UI shape 사이에서 모호. |

**권장: B-1 (typed legacy upstream)**. B-2도 가치 있으나, `_lib/transform.ts`나 `lib/issue-222-approval.ts`(529 라인)을 BffClient로 이동하는 비용이 크고, *어느 transform이 BFF 영역이고 어느 transform이 frontend BFF-for-Frontend 영역인가*라는 책임 분담을 다시 그려야 한다. B-1은 그 결정을 미루고도 즉시 효과를 본다 — 즉 "type-only 단일화"가 1차 목표. B-2 이행은 ADR-011 채택 후 도메인별 wave에서 선택적으로 진행.

#### 4.2.2 Composite route 처리

대표 사례: `app/integration/api/v1/azure/target-sources/[targetSourceId]/check-installation/route.ts`는 다음을 한다:
1. `client.azure.checkInstallation(id)` 호출 (DB check)
2. **선택적으로** `client.azure.vmCheckInstallation(id)` 호출 (실패 시 silent fallback)
3. 두 응답을 `buildV1Response(dbStatus, vmStatus)`로 병합

옵션 B-1 마이그레이션에서 이 route는:
```typescript
const dbStatus = await bff.azure.checkInstallation(id);  // typed
let vmStatus: LegacyVmInstallationStatus | null = null;
try { vmStatus = await bff.azure.vmCheckInstallation(id); } catch { /* keep null */ }
return NextResponse.json(buildV1Response(dbStatus, vmStatus));
```
구조는 거의 동일하다 — 단지 `as` cast가 사라진다. composite logic은 route.ts에 남는다.

옵션 B-2를 적용하려면 `bff.azure.checkInstallation(id)`이 v1 shape을 반환해야 하므로, BffClient 메서드가 내부에서 DB+VM 두 호출을 조합하고 fallback을 처리해야 한다. 이는 단순한 method 1:1 포팅이 아니라 *BFF 클라이언트 안에 합성 정책*을 들여놓는 것이다. 신중히 설계해야 한다.

### 4.3 옵션 C — TanStack Query + zod 전면 재작성

- 클라이언트 측에 TanStack Query 도입, 모든 응답을 zod로 parse.
- BFF 클라이언트는 옵션 B와 동일한 typed 구조.
- route handler는 zod schema 공유.

비용: 큼. 새 의존성, 모든 컴포넌트의 데이터 페칭 hook 재작성.
효과: cache·invalidation·로딩 상태 표준화.
권장 시점: 옵션 B 완료 후 별도 ADR로 도입 검토. 지금 함께 추진하면 변경 표면이 너무 커진다.

### 4.4 옵션 D — 두 클라이언트 유지 + 공유 zod 스키마 (Option B 경쟁안)

- `lib/api-client/*`와 `lib/bff/*`를 그대로 유지. `ApiClient` 반환 타입은 *변경하지 않음* (`Promise<NextResponse>` 유지).
- 공통 zod schema(`lib/contracts/<domain>.ts`)를 작성한다. mock·bffClient·httpBff가 NextResponse(또는 typed) 응답을 만들기 *직전에* `schema.parse(data)`를 호출. parse fail 시 즉시 throw.
- route.ts는 여전히 `await response.json()`으로 unwrap하지만, schema가 보장된 본문이므로 `as` 캐스트 대신 `schema.parse(await response.json())`로 한 번 더 검증할 수 있다.
- `boundaries.md` open question("schema validation at the route-handler/bff boundary")의 직접 답.

비용: 작음~중간. 새 디렉토리 + 도메인별 schema 작성. mock·bff-client 구현체에 `schema.parse(...)` 한 줄씩 추가.
효과:
- mock-BFF 본문 shape 드리프트가 **런타임에 즉시** 검출 (테스트 환경이나 실제 호출에서 schema fail). 컴파일 타임 검출은 *아님*.
- 두 HTTP 클라이언트 통합은 *유보*. ADR-007 구조와 호환.
- composite route 변환은 그대로 route.ts에 남음.

비고: 이 옵션은 §3.3의 신호 중 (a) "mock과 real impl이 같은 도메인 타입 반환"을 schema-runtime으로 만족시키나, (b) "두 typed 계약 공유"는 만족시키지 못한다. 즉 *두 클라이언트의 존재 자체가 만들어내는 cognitive overhead*는 남는다.

옵션 B / E와의 차이: D는 `Promise<NextResponse>` 추상화를 *유지한 채* 런타임 검증만 추가한다. 마이그레이션 비용이 절반 이하지만, 컴파일 타임 보호가 아니므로 첫 PR에서 누락 시 detect 안 됨 (테스트 실행이나 실제 호출에서만 fail).

### 4.5 옵션 E — `ApiClient` 반환 타입을 typed data로 (Option B 경쟁안 #2)

- `lib/api-client/*` 구조 유지 (Pipeline 1).
- `ApiClient` 인터페이스를 `Promise<NextResponse>`에서 `Promise<DomainType>`으로 변경.
- bff-client·mock-client 구현체가 NextResponse 대신 typed data를 반환.
- route.ts가 NextResponse 래핑 (현재 `bff-client.ts`의 `proxyGet`이 했던 일).
- `lib/bff/*`는 그대로 RSC 전용으로 남거나, 또는 ApiClient 호출을 `'server-only'` 마커로 wrapping해 흡수.

비용: 중간. `ApiClient` 타입 + bff-client 구현 + mock 구현의 반환 타입 변경. composite route는 route.ts에 남으므로 옵션 B-1과 비슷한 작업량.
효과:
- mock-BFF 본문 shape 드리프트가 **컴파일 타임에** 검출.
- Pipeline 1과 2 두 클라이언트 통합 여부는 별개 결정으로 미룰 수 있음.

옵션 B와의 차이: E는 Pipeline 1을 보존한 채 typed로 만든다. B는 Pipeline 1을 폐기하고 Pipeline 2로 흡수한다. *typed 보장*만 따지면 E·B 둘 다 같은 효과지만, B는 추가로 클라이언트 수를 1로 만들어 `boundaries.md` 혼란을 해소한다.

---

## 5. 권장: 옵션 B-1 + ADR-007 Superseded 처리

### 5.1 결정

ADR-007을 **대체됨 by ADR-011 (가칭) 「Typed BFF Client 단일화」**로 표시한다. ADR-011은 §4.2의 옵션 **B-1 (typed legacy upstream shape)**을 정식 ADR로 작성한다. B-2(전면 v1 변환 흡수)는 ADR-011 채택 후 도메인별 wave에서 *선택적*으로 추진한다.

옵션 D(zod schemas)와 옵션 E(typed ApiClient) 대비 옵션 B-1을 권장하는 이유:
- D는 *클라이언트 수 2*를 수용한 채 강제만 강화 → `boundaries.md` 혼란이 그대로.
- E는 Pipeline 1만 typed로 만들고 `lib/bff/*`는 정체된 채 남김 → ADR-007이 벌인 "두 클라이언트" 문제를 절반만 해결.
- B-1은 single source of truth. 전환 비용은 더 크지만, 다음 1~2년의 BFF 변경 비용을 누계로 줄인다.

다만 ADR-011이 거부될 가능성에 대비해 **옵션 D를 즉시 도입 가능한 fallback**으로 둔다 (5.4 참조).

### 5.2 마이그레이션 Phase + 비용 견적

| Phase | 작업 | PR 수 (예상) | 위험 |
|---|---|---|---|
| **Phase 0 — Schema 인벤토리** | `BffClient`로 옮길 도메인별 메서드 표 작성. composite route(체크 + 폴백 + 합성) 식별. transform 위치 결정(B-1: route.ts 유지 / B-2: BffClient 흡수). | 1 (문서) | 낮음 |
| **Phase 1 — Boundary 규칙 갱신 (선결 조건)** | `docs/api/boundaries.md`의 "route handler는 `@/lib/api-client`만 import" 규칙을 *route handler는 `@/lib/bff/*` 또는 deprecated `@/lib/api-client/*`*로 일시 완화. AGENTS.md ADR-007 가드(`route dispatch to client.method()`)와 `.claude/skills/anti-patterns/SKILL.md`의 boundary 섹션도 동일 갱신. ADR-011 본문에 명기. | 1 (문서·rule) | 낮음 — 이 phase 없이 Phase 4를 진행하면 첫 마이그레이션 PR이 자체 규칙 위반으로 리뷰에서 차단됨 |
| **Phase 2 — BffClient 타입 확장** | `lib/bff/types.ts`에 모든 도메인의 메서드를 추가. 반환 타입은 B-1(typed legacy)로 통일. | 1 | 낮음 |
| **Phase 3 — `httpBff` 구현 확장** | 도메인 단위로 `httpBff.<domain>` 구현 추가. `lib/api-client/bff-client.ts`의 path/method를 그대로 옮기되 typed return으로 변경. | 3~5 (도메인별) | 중간 — `proxyConfirmedIntegrationGet` 같은 특수 변환 함수의 typed 포팅 |
| **Phase 4 — `mockBff` 구현 확장** | `mockBff.<domain>`을 `mockClient`의 본문 추출 로직에서 가져옴. `authorize()` 같은 mock 전용 인증/권한 로직을 *유지할지 제거할지* 결정 (BFF는 인증을 책임지지 않음). | 3~5 (도메인별) | 중간 — mock 전용 로직 처리 결정이 핵심 |
| **Phase 5 — Route handler 전환** | route.ts의 `client.x.y()` → `bff.x.y()` 교체. composite route(예: Azure check-installation DB+VM)는 §4.2.2 패턴으로 유지. v1 transform 함수(`buildV1Response`, `extractTargetSource`, `lib/issue-222-approval.ts`)는 그대로. | 5~7 (도메인별) | 중간~높음 — 13 type-assertion route + 27 unwrapping route + composite 케이스 + 기존 route test fixture 재정렬 |
| **Phase 6 — Cleanup + 최종 boundary 잠금** | `lib/api-client/*` 제거. `boundaries.md`를 단일 파이프라인으로 *최종* 재작성 (Phase 1의 일시 완화를 거두고 "route handler는 `@/lib/bff/*`만"으로 잠금). ESLint `no-restricted-imports` 도입. `app/lib/api/index.ts`의 normalize 로직 중 typed BFF 응답으로 대체 가능한 것 정리 (PR #235에서 +184 추가된 부분 일부 회수 가능). | 1 (대) | 중간 — `app/lib/api/index.ts` 의존도 높은 컴포넌트 다수 |

**과소평가하지 말아야 할 비용**:
- Phase 5의 *route test fixture* 변경: 현재 다수의 route test가 `client.x.y()`를 mock하고 NextResponse를 반환하는 구조. `bff.x.y()` mock으로 fixture를 새로 작성해야 함.
- PR #235가 보여준 patten — `lib/issue-222-approval.ts` 498라인 + `app/lib/api/index.ts` +184라인 — 은 한 도메인(approval 흐름)을 위한 비용이었다. 다른 도메인들도 정도 차이는 있어도 비슷한 normalize 로직을 갖고 있으므로, Phase 5·6의 cleanup은 *기계적이지 않다*.
- composite route는 도메인별로 1~3개씩 존재 추정. 각각 BFF의 합성 정책을 어디에 둘지 (route or httpBff) 개별 결정 필요.

각 Phase는 BFF Wave 작업과 충돌하지 않도록 wave-task 스킬과 정합되게 진행. Phase 1~4는 background, Phase 5~6는 BFF 변경이 *없는* 도메인부터. **Phase 1(boundary 규칙 갱신)은 반드시 Phase 5보다 먼저 머지되어야 함** — 그러지 않으면 첫 route 마이그레이션 PR이 자기 자신의 규칙을 위반.

### 5.3 ADR-007 본문 수정안

`docs/adr/007-api-client-pattern.md` 헤더를 다음으로 변경:
```
## 상태
대체됨 ([ADR-011](./011-typed-bff-client-unification.md))
```

본문에 후기 섹션 추가:
```
## 회고 (2026-04-25)

ADR-007은 2026-02-14 승인 후 ~61 routes를 일관된 패턴으로 정렬하는 데 성공했으나,
약 2.5개월 운영 결과 다음 한계가 드러났다:

- `Promise<NextResponse>` 추상화가 mock-vs-BFF 응답 본문 shape 동기화를 컴파일 타임에 강제하지 못함 (PR #253 사례 참조)
- Pipeline 2(`lib/bff/*`) 통합 질문이 `boundaries.md`의 open question으로 미해결
- Issue #222 후속 PR(#234 #235 #237 #240 #253)에서 같은 도메인의 3 레이어 동시 수정이 반복됨

이 회고를 바탕으로 ADR-011이 Typed BFF Client 단일화 방향을 채택한다.
```

`docs/adr/README.md` ADR 표의 ADR-007 행 상태를 "승인됨" → "대체됨"으로 갱신하고, ADR-011 행을 추가.

### 5.4 Fallback: ADR-011 거부 시 옵션 D 즉시 채택

ADR-011 검토 과정에서 마이그레이션 비용이 거부 사유가 될 가능성이 있다. 그 경우:

- **옵션 D 단독 채택** (별도 ADR-012 「Mock-BFF Schema Validation」). 도메인별 zod schema를 `lib/contracts/`에 작성, mock과 bff-client에 schema parse 추가. PR 1~2개로 즉시 보호 효과.
- 동시에 ADR-007 본문에 "schema validation 추가됨" 회고 섹션만 추가하고 상태는 "승인됨" 유지.
- 두 클라이언트 통합 문제는 별도 후속 작업으로 미룸.

옵션 D는 *주 권장이 아니지만 최소한의 보호*다. ADR-011 이행이 어렵다는 결론이 나면 즉시 가동.

---

## 6. 위험 / 미결 질문

### 6.1 위험

- **Phase 2~5 동안 두 클라이언트가 공존**한다. 새 도메인을 어느 쪽에 추가할지 wave마다 명확히 해야 함 (기본: BffClient).
- **B-1에서 v1 변환은 route.ts에 그대로 남는다**. 따라서 *변환 사슬 자체*를 줄이는 효과는 제한적 — 본 권고의 1차 목표는 "타입 강제"이지 "변환 사슬 단축"이 아님을 분명히 한다. 변환 사슬 단축은 B-2(선택적 후속)의 영역.
- **B-1은 컴파일 타임 보호의 범위가 한정적**: mockBff와 httpBff의 *메서드 시그니처와 반환 타입*이 동일함을 보장한다. 그러나 httpBff가 실제 upstream 응답을 typed shape로 받았다는 *런타임* 보장은 없다 (`httpBff`는 여전히 `as T` 캐스트 — `lib/bff/http.ts:44-45`). upstream 런타임 검증은 별도 zod/type guard가 필요. ADR-011은 이 제약을 명시.
- **ESLint 강제 시점**: Phase 6에 도입하지 않으면 또 미루어진다. Phase 6 완료 조건에 ESLint 룰 도입 포함.
- **bff-client.ts의 `proxyConfirmedIntegrationGet`/`proxyResourceCatalogGet` 같은 특수 변환**: B-1에서는 typed return을 만족하도록 `httpBff` 안에서 동일 transform을 적용하면 된다(`extractConfirmedIntegration` 등을 BFF 클라이언트 메서드 내부에서 호출).
- **mock 전용 인증/권한 로직** (`mockData.getCurrentUser()`, role 체크 등)이 `mockClient.azure.authorize()` 같은 helper에 박혀 있다. mockBff로 이동 시 이를 제거할지 유지할지 결정 필요. 일반적으로 BFF는 인증을 하지 않으므로 *제거*가 자연스러우나, mock 테스트 시나리오가 이에 의존한다면 별도 helper로 분리.

### 6.2 미결 질문 (별도 ADR 또는 Phase 외부에서 결정)

1. **TanStack Query 도입 여부** — 옵션 C. Phase 4 완료 후 별도 ADR.
2. **zod schema 공유** — Swagger spec에서 zod 자동 생성? 또는 수동? `lib/issue-222-approval.ts` 529라인 normalize는 zod로 대체 가능성 높음.
3. **Server Action vs Route Handler** — Next.js 15+에서 mutating endpoint는 server action이 더 자연스러움. 이는 옵션 B와 직교하나 Phase 5+로 별도 검토 가치.
4. **mock 데이터 store의 위치** — 현재 `lib/mock-*.ts` (mockClient 내부 의존). BffClient mockBff로 통합 시 store 위치도 재정렬할지 결정 필요.

### 6.3 본 문서가 필요로 하는 외부 검증

- Codex cross-review (부록 참조 — 1차 round 완료, 2차 round 권장).
- 옵션 B 비용 견적 — 도메인별 메서드 수와 변환 복잡도 mapping을 별도 spreadsheet/table로 작성 후 wave로 분할 (Phase 0의 결과물).
- BFF 팀과의 계약 안정성 검증 — typed BffClient가 가정하는 응답 구조가 BFF Roadmap과 충돌하는 부분 없는지.

---

## 7. 결론

ADR-007의 패턴 자체가 잘못된 것은 아니다. 다만 **추상화 경계를 NextResponse(HTTP) 레이어가 아닌 도메인 데이터 레이어에 그었어야 한다**. Pipeline 2(`lib/bff/*`)가 이미 그 형태로 존재하나 정체된 상태다.

권고는 두 단계다:
1. **즉시 결정 필요**: ADR-011 승인 — `BffClient`를 typed legacy upstream shape(B-1)로 단일화. ADR-007은 대체됨으로 표시. 마이그레이션은 도메인별 wave로 분할.
2. **B-2 이행은 선택적**: ADR-011 채택 후 도메인별로 합성/변환을 BffClient로 흡수할지를 *그 도메인의 transform 안정성*을 보고 개별 결정. 모든 도메인에 일괄 적용하지 않는다.

만약 B-1의 마이그레이션 비용도 부담스럽다는 결론이 나면, **옵션 D(공유 zod schema)**를 ADR-012로 즉시 채택해 *최소한*이라도 mock-BFF 본문 shape 드리프트를 막는다.

Issue #222 류 후속 작업의 비용이 다음 BFF Wave에서도 그대로 반복되는 것을 막는 것이 본 결정의 1차 목표다.

---

## 부록 A. Codex 1차 cross-review (2026-04-25)

본 문서 초안에 대해 OpenAI Codex CLI(gpt-5.5, reasoning xhigh)로 cross-review를 실행. 4개 조건을 부여한 Conditional mergeable 판정.

| # | Codex 지적 | 본 개정에서 반영 |
|---|---|---|
| Critical | "PR #253 `mockAzure.getScanApp 누락` 사례는 NextResponse 본문 shape 드리프트의 증거가 아님 — `mockClient: ApiClient` 구조적 할당이 누락 메서드를 잡았어야 함" | §0/§2.1을 `mockScan.getHistory/create/getStatus` shape 사례로 교체. `getScanApp` 누락은 별도 검증-필요 항목으로 분리(§2.5 callout). |
| Major | "Option B의 BffClient가 *어느* shape을 반환할지 명시되지 않음 (upstream / Swagger v1 / UI domain)" | §4.2.1에 B-1/B-2/B-3 trade-off 표 추가. B-1(typed legacy upstream) 권장. §4.2.2에 composite route 처리 패턴. |
| Major | "Phase 3은 composite route(check-installation의 DB+VM 조합)와 route test fixture 비용을 과소평가" | §5.2를 Phase 0~5 cost table로 재구성. PR #235 비용(498 + 184 라인)을 명시. |
| Major | "zod schema 대안이 TanStack Query와 묶여서 평가됨 — boundaries.md 168이 이미 별도 옵션으로 식별" | §4.4 옵션 D(zod 단독), §4.5 옵션 E(typed ApiClient) 추가. §5.1에서 B vs D vs E 비교. §5.4에 옵션 D fallback. |
| Minor | "ADR 상태 표기가 `docs/adr/README.md` 양식과 불일치" | §5.3을 `대체됨 ([ADR-011](./011-...))` 형식으로 수정. 승인 일자는 회고 본문으로 이동. |
| Minor | "`response.json() as` 카운트 15 → 실제 13 (broader unwrapping 27)" | §1.2를 13 + 27로 정정. |

2차 round는 본 개정본을 commit한 후 권장 — Option D/E 비교의 정확성과, Phase 0 cost table 산식이 합리적인지 추가 검증.

## 부록 B. Codex 2차 cross-review (2026-04-25)

1차 개정본에 대한 round-2 검증 결과 4개 추가 Major 발견. 모두 본 개정본에서 반영.

| # | Codex 2차 지적 | 본 개정에서 반영 |
|---|---|---|
| Major | "§3.3 표에 'PR #253 사례'가 mock 누락의 컴파일 검출 실패 증거로 남아 1차 Critical을 재도입" | §3.3 행을 *응답 본문 shape* 검출 실패 증거로 재작성 (`mockScan` body shape 사례 인용). |
| Major | "B-1이 컴파일 타임 shape 강제를 과대주장 — `httpBff`는 여전히 `as T` 캐스트" | §4.2.1 B-1 단점 칸을 "**upstream BFF 런타임 shape 보장은 zod/guard 필요**"로 명시. §6.1에도 동일 제약 추가. |
| Major | "Option D가 `Promise<NextResponse>` 유지를 명시하지 않아 Option E와 구분 불가" | §4.4 D를 "ApiClient 반환 타입 *변경하지 않음* (`Promise<NextResponse>` 유지)"로 명시. route.ts는 unwrap 후 schema parse. |
| Major | "Phase 4의 route 마이그레이션이 현행 `boundaries.md`/`AGENTS.md`/anti-pattern 규칙(route는 `@/lib/bff/*` import 금지)을 위반 — 규칙 갱신을 cleanup으로 미룸" | Phase 1을 신설 → "Boundary 규칙 갱신 (선결 조건)". 기존 Phase 1~5 → Phase 2~6. Phase 6에 boundary 최종 잠금. §5.2 본문에 Phase 1 → Phase 5 순서 강제 명시. |

3차 round는 옵션하지 않음 — 본 문서는 *결정 문서*가 아니라 *조사 보고서*이므로 ADR-011 작성 시 별도 round.
