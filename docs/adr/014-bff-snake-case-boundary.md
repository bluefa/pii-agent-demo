# ADR-014: BFF 클라이언트 경계에서 snake_case 강제

## 상태

제안됨 · 2026-05-01

**해결:** [ADR-011](./011-typed-bff-client-consolidation.md) §"Scope of the type guarantee" — `httpBff`가 여전히 `camelCaseKeys(data) as T`를 사용한다는 명시적 미결 사항.
**대체:** PR #447 (`fix/case-tolerant-bff`, 닫힘) — 정규화 함수마다 `snakeCaseKeys()`를 끼워 넣던 임시방편을 단일 경계 정규화로 교체.

## 배경

ADR-011은 CSR/SSR을 하나의 `BffClient` 인터페이스로 통합하고, `mockBff`와 `httpBff`가 동일한 TypeScript 시그니처를 공유하도록 만들었습니다. 다만 **런타임 형태(shape) 보장은 명시적으로 미뤘습니다.**

> B-1은 `mockBff`와 `httpBff`가 동일한 메서드 시그니처와 typed return을 공유함을 보장한다. […] 그러나 업스트림 BFF가 실제로 그 typed shape에 런타임에서 부합하는지는 보장하지 않는다 — `httpBff`는 여전히 `camelCaseKeys(data) as T`를 쓴다. 업스트림 런타임 검증(zod 또는 type guard)은 별도 사안이다.

이 미결이 실제 프로덕션 버그와 만성적 마찰을 만들어 왔습니다.

### 현재 비대칭

`lib/bff/http.ts`는 GET 응답엔 `camelCaseKeys`를 돌리고, POST/PUT/DELETE는 raw passthrough입니다.

```ts
async function get<T>(path, opts?: { raw?: boolean }): Promise<T> {
  const data = await res.json();
  return (opts?.raw ? data : camelCaseKeys(data)) as T;     // ← GET: camelCase
}

async function send<T>(method, path, body?): Promise<T> {
  // I-3 invariant: POST/PUT bodies are raw passthrough (snake_case).
  return await res.json() as T;                             // ← POST/PUT: snake_case
}
```

반면 `mockBff`(`lib/bff/mock-adapter.ts`)는 케이싱 변환을 **전혀** 하지 않습니다. mock 핸들러가 emit한 그대로(snake_case로 작성됨)를 돌려줍니다.

| 채널 | GET | POST/PUT/DELETE |
|---|---|---|
| `httpBff` | camelCase | snake_case |
| `mockBff` | snake_case | snake_case |

두 구현은 TypeScript에선 호환(둘 다 `as T` 캐스트)이지만 **런타임에선 다른 케이싱을 반환**합니다. mock 모드에선 동작하던 라우트가 BFF 모드에선 깨지고, 그 반대도 발생합니다.

### 실제로 발생한 실패

1. **Confirmed-integration 크래시.** `extractConfirmedIntegration`은 `payload.confirmed_integration`과 `integration.resource_infos`를 읽습니다. 프로덕션에선 키가 camelCase(`confirmedIntegration`, `resourceInfos`)로 도착해 `integration.resource_infos.map(…)`이 `TypeError: Cannot read properties of undefined`로 던집니다. snake-only 픽스처를 쓰는 단위 테스트는 통과하므로 침묵.

2. **조용히 데이터 손실되는 정규화.** `normalizeProcessStatusResponse`, `normalizeApprovedIntegration` 등이 snake 키를 읽습니다. camelCase 입력 시 `undefined`/`null` 출력. `resource-catalog-response.ts`와 `normalizeProcessStatusResponse`엔 버그가 발견될 때마다 dual-read 코드(`x ?? camelX`)가 누적됨.

3. **PR #447의 임시방편.** 정규화 함수 8개 진입부에 `snakeCaseKeys()`를 추가. 동작은 하지만 비대칭을 코드베이스 전반으로 전파: 새 정규화 함수마다 작성자가 기억해야 하고, 안쪽 legacy 경로엔 `pickStringField('snake_key', 'camelKey')` 같은 누더기가 추가됨.

4. **Pass-through 라우트(~30개).** `app/integration/api/v1/**/route.ts`에서 단순히 `return NextResponse.json(await bff.foo())`만 하는 곳들. 프로덕션에선 camelCase, mock에선 snake로 프론트에 전달. 어느 쪽과도 일관되지 않음.

5. **테스트 픽스처는 이걸 잡지 못함.** 단위 테스트는 snake_case 픽스처를 정규화 함수에 직접 주입해 두 구현을 모두 우회. mock 모드 통합 테스트는 mock이 snake를 emit하므로 통과. 프로덕션만 단독으로 깨짐.

### 왜 한 가지 케이싱으로 통일해야 하나

Next.js → 프론트엔드 contract는 이미 대부분 snake_case (라우트 핸들러가 `resource_infos`, `target_source_id` 등을 반환하고, `app/lib/api/index.ts` 소비자도 snake로 읽음). 업스트림 BFF wire format도 snake_case. **camelCase는 `httpBff.get`의 JS 컨벤션 양보가 만든 섬이고, 그게 문제의 근원입니다.**

## 결정

**`BffClient` 인터페이스는 snake_case 응답을 보장한다. 두 구현 모두 런타임에서 강제한다.**

### D1. `httpBff`는 모든 응답에 `snakeCaseKeys`를 적용

`get`, `post`, `put`, `delete` 모두 `snakeCaseKeys(data)`를 거쳐 반환. 옵트아웃 옵션(`raw: true`) **제거**. 이유는 §"옵트아웃이 왜 필요 없나" 참고.

```ts
async function get<T>(path: string): Promise<T> {
  const data = await res.json();
  return snakeCaseKeys(data) as T;
}

async function send<T>(method, path, body?): Promise<T> {
  if (res.status === 204) return undefined as T;
  return snakeCaseKeys(await res.json()) as T;
}
```

### D2. `mockBff`도 `unwrap()`에서 동일 contract 강제

`lib/bff/mock-adapter.ts`의 `unwrap()`이 파싱된 JSON에 `snakeCaseKeys`를 적용. 현재 mock은 이미 snake로 작성돼 있어 **방어적**이지만, 작성자 규율에 의존하지 않게 contract를 명시적으로 만듦. 두 구현 모두 동일한 normalization point를 갖게 됨.

```ts
async function unwrap<T>(response: NextResponse): Promise<T> {
  if (!response.ok) { /* … */ }
  return snakeCaseKeys(await response.json()) as T;
}
```

### D3. `lib/bff/types/*` 파일 전체 snake_case로 변경

13개 파일에서 camelCase 필드를 snake_case로 rename. "GET responses use camelCase" 주석 제거하고 "Responses are snake_case (D1)"로 통일. tsc가 모든 소비자를 에러로 띄워 D4 가이드.

### D4. 정규화 함수의 임시 코드 모두 제거

PR #447의 band-aid를 되돌림:

- `extractConfirmedIntegration`, `extractResourceCatalog`, `lib/approval-bff.ts`의 `normalize*` 6개에서 진입부 `snakeCaseKeys()` 호출 제거
- `pickStringField` 헬퍼 삭제. legacy `endpoint_config` 경로는 `endpointConfig.oracle_service_id`로 직접 읽음
- `resource-catalog-response.ts`의 `LegacyResourceCatalogItem` dual-key shape 제거 (snake_case 필드만 남김)
- `normalizeProcessStatusResponse`의 `record.targetSourceId`, `page.totalElements`/`page.totalPages` fallback 제거

### D5. 두 구현 모두에서 동작하는 contract 테스트

`lib/bff/__tests__/casing-contract.test.ts` 신설. 도메인별 1개 메서드를 골라 `httpBff`(`fetch` 모킹)와 `mockBff` 양쪽에서 호출, 반환 객체의 모든 키가 재귀적으로 `^[a-z][a-z0-9_]*$`에 매칭하는지 단언. 업스트림 변경과 무관하게 boundary contract를 freeze.

## 옵트아웃이 왜 필요 없나

ADR 초안엔 `raw: true` 옵트아웃을 유지하려 했지만 (Issue #222 호환), 검토 결과 **불필요**:

- Issue #222의 `getScanApp`이 `raw: true`를 쓴 이유는 "camelCaseKeys를 거치지 말고 snake_case 그대로 받고 싶다"였습니다 (`lib/bff/http.ts:198`).
- D1에선 default가 snake_case니까 Issue #222가 원하던 결과가 자동으로 만족됩니다. `raw: true`는 사라져야 할 잔재.
- 동적 키 맵(예: 사용자 데이터를 키로 쓰는 응답)이 있다면 `snakeCaseKeys`가 키를 망가뜨릴 수 있지만, **이 레포 BFF엔 그런 엔드포인트가 없습니다**. 현재 응답 키는 모두 API 계약상 정해진 필드명.
- 미래에 그런 케이스가 생기면 그때 옵트아웃을 다시 추가하면 됨. YAGNI.

## 강제 변환에 따른 위험은 무엇인가

검토 결과 **이 코드베이스에선 실질적 위험 없음**:

| 우려 | 평가 |
|---|---|
| 동적 키 맵 망가뜨림 | 해당 엔드포인트 없음. (있어도 `getRaw` 비-JSON 경로는 별도) |
| 성능 | sub-MB JSON 기준 < 5ms. 무시 가능. 가장 큰 관측 페이로드(resource catalog ~200 items)에서 < 1ms |
| 정보 손실 | `snakeCaseKeys` round-trip은 `d_e_f` 같은 단일문자 연속 세그먼트에서만 손실. 실제 BFF 키(`resource_id`, `oracle_service_id` 등)엔 해당 패턴 없음 |
| 타입 mismatch | D3에서 타입도 snake로 바꾸므로 정적/런타임 일치 |
| 라운드트립 (request body) | 본 ADR은 **응답** 한정. 요청 body 변환은 별도 사안 |

## 검토한 대안

| 옵션 | 결정 | 이유 |
|---|---|---|
| **A.** 현 상태 + 정규화 함수마다 `snakeCaseKeys` (= PR #447) | 거부 | 이미 적용했지만 사용자가 직접 문제 제기. 변환 책임이 N곳에 분산되어 새 엔드포인트마다 회귀 위험 |
| **B.** 경계에서 **camelCase**로 통일 | 거부 | Next.js→프론트 contract와 `app/lib/api/index.ts` 전반이 이미 snake. 마이그레이션 비용이 5–10배 |
| **C.** per-method opt-in (`bff.foo({ snakeCase: true })`) | 거부 | PR #447과 동일한 분산 부담을 다른 층에서 반복 |
| **D.** 정규화하지 않고 소비자가 양쪽 처리 | 거부 | 지금 상태. 정확히 그 문제 |
| **E.** Decorator wrapper `withSnakeCaseResponses(impl)` | 검토 후 보류 | 기능적으로 동등. `httpBff.get`/`unwrap`에 직접 쓰는 게 추론하기 더 쉬워서 거부. 세 번째 구현(예: 녹화 픽스처 플레이어)이 추가되면 재검토 |
| **F.** zod 스키마까지 도입 | 별도 트래킹 | 본 ADR의 strict superset. 케이싱 fix(필요 조건)와 schema validation(충분 조건)은 직교 |

## 결과

### 긍정

- 단일 normalization point. 새 엔드포인트가 자동으로 보장 적용
- `mockBff`와 `httpBff`가 타입뿐 아니라 런타임에서도 동등. mock 모드 통합 테스트가 프로덕션과 동일 shape 검증
- `pickStringField`, `LegacyResourceCatalogItem` dual-key, ~8개 정규화 함수의 `snakeCaseKeys()` 호출, `raw: true` 옵션 모두 삭제 (~50 LoC 감소)
- Pass-through 라우트가 모드와 무관하게 일관된 shape 반환
- `lib/bff/types/*.ts`의 "GET responses use camelCase" 주석 거짓말이 사라짐

### 부정 / Trade-off

- 13개 타입 파일과 그 소비자(추정 30–60 파일) 수정. 대부분 mechanical rename (`resourceId` → `resource_id`)
- 프론트엔드에서 pass-through GET 라우트의 camelCase를 직접 읽는 코드(예: `dashboardSummary.totalSystems`)는 D3에서 깨짐 → 동시에 수정. 구현 PR에서 감사
- `httpBff.get/send`의 `as T` 캐스트는 여전히 런타임 shape를 보장하지 않음(예상 외 필드 케이스). zod(F)가 그걸 닫음. 본 ADR은 케이싱만 닫음

### 중립

- ADR-011의 stance("BffClient는 컴파일타임 parity 보장")는 그대로 유효. 본 ADR은 같은 인터페이스에 런타임 parity를 추가

## 구현 계획

단일 PR로 머지. 경계와 소비자가 어긋나는 중간 상태를 만들지 않음. PR 내부 단계:

### Stage 1 — 경계
- `lib/bff/http.ts`: `get`/`send`가 `snakeCaseKeys` 적용. `raw` 옵션 제거 (D1)
- `lib/bff/mock-adapter.ts`: `unwrap`이 `snakeCaseKeys` 적용 (D2)

### Stage 2 — 타입 rename
- `lib/bff/types/*.ts` 13개 파일 + `lib/bff/types.ts`: camelCase → snake_case. 주석을 ADR-014로 갱신
- tsc가 모든 소비자를 에러로 노출 → Stage 3 가이드

### Stage 3 — 소비자 수정
- `app/integration/api/v1/**/route.ts`: 필드 read rename
- `app/lib/api/index.ts`: pass-through 응답에서 camelCase 읽던 manual mapper rename
- `app/components/features/**`, `app/integration/**/_components/**`: pass-through 라우트의 camelCase를 직접 읽던 곳 rename

### Stage 4 — 청소
- 정규화 함수의 `snakeCaseKeys()` 호출 제거 (D4)
- `pickStringField` 삭제
- `LegacyResourceCatalogItem`의 camelCase 키 제거
- `normalizeProcessStatusResponse`의 dual-read fallback 제거

### Stage 5 — Contract 테스트
- `lib/bff/__tests__/casing-contract.test.ts` 신설 (D5)

### Stage 6 — 문서 (프로젝트 규약 반영)
- `CLAUDE.md` "⛔ CRITICAL" 섹션에 신규 항목 추가:
  > **BFF 응답은 항상 snake_case** — `bff.*` 메서드 반환값과 `lib/bff/types/*` 타입은 모두 snake_case. camelCase 변환/dual-read 금지. 근거: ADR-014
- `AGENTS.md` BFF 섹션에 동일 규약 한 줄 추가
- `.claude/skills/coding-standards/SKILL.md`의 "Import Boundaries" 또는 BFF 관련 섹션에 contract 명시
- ADR-011 §"Scope of the type guarantee"에 본 ADR 링크 footnote
- `lib/bff/types/*.ts`의 "GET responses use camelCase" 주석 모두 제거

## 마이그레이션 맵

| 층 | 파일 패턴 | 변경 종류 | 추정 |
|---|---|---|---|
| 경계 | `lib/bff/http.ts`, `lib/bff/mock-adapter.ts` | `snakeCaseKeys` 추가 + `raw` 제거 | 2 |
| 타입 | `lib/bff/types/*.ts`, `lib/bff/types.ts` | 필드 rename + 주석 | 14 |
| 라우트 | `app/integration/api/v1/**/route.ts` | 필드 read rename | ≤ 40 (pass-through 다수는 무수정) |
| 프론트 | `app/lib/api/index.ts`, `app/components/**`, `app/integration/**/_components/**` | 필드 read rename | tsc로 식별 |
| 청소 | `lib/approval-bff.ts`, `lib/confirmed-integration-response.ts`, `lib/resource-catalog-response.ts` | 임시 코드 삭제 | 3 |
| 테스트 | `lib/__tests__/bff-response-case-tolerance.test.ts` | D5 도입 후 삭제 | 1 (삭제) |
| Contract | `lib/bff/__tests__/casing-contract.test.ts` | 신규 | 1 |

## 미해결 사항

- **O1.** Pass-through 라우트 중 프론트가 camelCase 키를 읽는 곳은 어디인가. Stage 3 감사로 식별. PR description에 목록화
- **O2.** 본 ADR은 응답 한정. 요청 body의 camelCase→snake_case 변환은 별도 사안 — 현재 BFF는 일부 엔드포인트가 camelCase body를 받음(`shouldAutoApprove` 등 mixed casing의 흔적). 별도 ADR로 다룰지 결정 필요

## 다른 ADR과의 관계

- **ADR-011**: 유효 유지. 본 ADR은 ADR-011이 명시적으로 미룬 사안을 닫음
- **ADR-008**(에러 처리): 영향 없음. 에러 shape는 `bffErrorFromBody`를 거치며 이미 snake_case
- **ADR-013**(i18n): 영향 없음
