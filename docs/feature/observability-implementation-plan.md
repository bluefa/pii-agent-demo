# FE 관측성 구현 계획 — 아키텍처와 작업 목록

> **목적**: 전략 문서(`observability-strategy-overview.md`)에서 확정한 방향을 실행 가능한 작업 단위로 분해한다.
> 각 작업에 대상 파일·검증 기준·전제 조건을 명시하여 그대로 착수할 수 있게 한다.
>
> **작성일**: 2026-07-21 · **개정**: 2026-07-22 — 저장소 BFF DB 전환(결정 ①), 인증 전제, sessionId 제거,
> 필드 정책, 인가 거부 추적 반영 · **2026-07-23** — Audit Event 체계(ADR-025) 확정, Admin 스코프를
> "타깃소스 사용 이력 + 확인 필요"로 축소, 목업 추가(`observability-admin-audit-mockup.html`).
> **선행 문서**: 전략 = `observability-strategy-overview.md` ·
> 수집 계층 상세 = `observability-plan.md` (PR #558 브랜치) · 이벤트 체계 = `docs/adr/025-frontend-audit-event-emission.md`

---

## 1. 아키텍처 — 4계층 모델 (개정)

| 계층 | 책임 | 소유 | 구성요소 |
|---|---|---|---|
| **L0 · 에러 처리** | 사용자에게 복구 가능한 UI를 보여준다 | FE | 에러 바운더리 3단(`global-error`/`error`/세그먼트) + `not-found` |
| **L1 · 수집·전송** | 구조화 이벤트를 만들어 BFF로 배치 전송한다 | FE | `fetchJson` 헤더 3종 + 링버퍼 · `withV1` 접근/에러/403 이벤트 · 브라우저 리포트 수신 라우트 · `log.ts`(유일한 출구 — 전송부만 교체) |
| **L2 · 저장·집계** | 영구 저장·보존 정책·집계 쿼리 | **BFF (고정점)** | ingest API → 자체 DB · 조회/집계 API · 보존·삭제 정책 |
| **L3 · 소비** | 사람이 보고 판단한다 | FE (+보류: Grafana) | In-app Admin 대시보드(FE 라우트 → BFF 조회 API, 도메인 join) · (보류) Grafana — SQL 데이터소스는 G2/G4/G8만 커버, G1/G3/G5/G6/G7은 진단 스트림 기반 metric 소스 별도 필요(Phase 6) |

원안과 달라진 것: L2가 GCP(Cloud Logging/Error Reporting/Monitoring)에서 **BFF DB**로 바뀌었다.
이유는 FE의 GCP 프로젝트 마이그레이션(최소 2회) — 저장소는 이사하지 않는 고정점에 둔다.
stdout 진단 로그(새니타이즈된 스택 등)는 보조로 유지하되, 30일 만료·이사 시 소멸을 허용한다.
원안의 전제 V-5(FE→googleapis 도달성)는 **불필요해졌다** — Admin은 BFF 조회 API만 쓴다.

### 데이터 흐름

```
[브라우저]
 ├─ 렌더 에러/unhandled rejection → 바운더리+전역 핸들러 → client_error 이벤트
 ├─ 라우트 전환(커밋된 전환 전부 + 정적 페이지 초기 로드) → page_view 이벤트 (Phase 2b)
 ├─ 사용자 Action·화면 조회·비동기 settle → audit 이벤트 (Phase 2b)
 └─ 모든 API 호출 → fetchJson 단일 래퍼
      └─ X-Request-Id · X-Client-Page · X-Client-Action

[FE 서버 (Next.js standalone, GKE — 상태 없음)]
 ├─ 세션 → userId·role resolve (Phase 3) — 서버가 이벤트에 심음, 클라이언트 헤더 채택 금지
 └─ log.ts — 출구 2개 (ADR-025 §5):
      ├─ emitAudit: audit 6종(+403) → 배치·비동기 POST → BFF ingest → [BFF DB] 구조화 필드만 영구 저장
      └─ emitDiagnostic: withV1 접근 기록·예외/업스트림 5xx·새니타이즈 스택
                         → stdout 진단 로그만 (30일·이사 시 소멸, audit 행 아님 — requestId로만 연결)

[In-app Admin]  FE 서버 라우트 → BFF 조회 API + 도메인 API → 이력과 현재 상태를 합쳐 표시
[(보류) Grafana] BFF DB SQL 데이터소스(G2/G4/G8) + 진단 metric 소스(G1/G3/G5/G6/G7 — 별도 필요) → 패널·알림 → Slack
```

### 이벤트 체계 — Audit Event 6종 (ADR-025 요약)

FE가 보내는 이벤트는 6종이며, "누가 · 어느 페이지에서 · 무엇을 했고 · 결과가 뭐였나"라는
하나의 공통 봉투(actor · page · action · correlation · domainContext)를 공유한다.

| eventType | 의미 (운영자 언어) | 발생 위치 |
|---|---|---|
| `page_view` | 페이지 방문 — 페이지를 열었다 | **내비게이션 종류로 분담**: 동적 SSR 페이지의 전체 문서 렌더=FE 서버 · 정적/CSR 초기 로드와 모든 커밋된 클라이언트 라우트 전환(타깃 상세로의 soft-nav 포함)=브라우저. soft-nav의 RSC 재실행·prefetch는 발행 안 함(방문 아님) |
| `screen_read` | 화면 조회 — 리소스 목록 등 사용자가 열어본 단발 조회 | 브라우저 |
| `action` | 사용자 Action — 버튼 행동. 동기 Action은 결과(status·code) 포함 | 브라우저 |
| `action_result` | 비동기 Action(스캔·연결 테스트)의 종료 결과 — 상태값·소요시간·구조화 요약 | 브라우저 |
| `client_error` | 사용 중 오류 — 렌더 오류·unhandled rejection·브라우저가 관찰한 에러 응답 | 브라우저 |
| `ssr_error` | 페이지 여는 중 오류 — 페이지 자체가 안 떴다 | FE 서버 (SSR) |

이 6종은 **audit 스트림**(사용 이력) 전용이다. 서버 운영 기록(withV1 접근 로그·업스트림 5xx)은
진단 스트림에 남고 requestId로만 연결되며, 인가 거부(403)는 Phase 3에서 **7번째 타입으로 추가**된다
(`auth_denied` — 기존 필드 변경 없음, eventType enum 값과 `route.template` 필드를 **함께 늘리는 호환 가능한 추가 확장**, ADR-025 Scope).

핵심 규칙 (근거·대안·필드 계약은 ADR-025):

- **폴링 미기록**: 스캔·연결 테스트를 지켜보는 개별 GET은 저장하지 않는다. 시작(`action`) +
  종료(`action_result`)만 남기고, 둘은 `job{kind,key}`(scan_version 등)로 잇는다(사실 기반 join).
  ⚠️ `triggerTestConnection` 응답엔 작업 번호가 없음 — trigger 응답에 key 추가가 **Phase 1 협의
  항목**이고, 그 전까지 연결테스트는 시작 이벤트만 발행하고 **settle은 발행하지 않는다**
  (시간창 추정 join 금지 — 시작 행이 결과 없이 서는 것이 계약의 정직한 상태).
- **settle은 로컬로 증명된 key만**: 폴링 훅은 mount 시에도 돌므로(autoStart) 남이 시작한 작업의
  종료도 관찰할 수 있다. 브라우저는 자기 trigger 응답에서 기록한 job key에 한해 settle을 발행하고,
  ingest는 `(targetSourceId, job.kind, job.key, eventType)` 멱등 키로 중복을 접는다.
- **업무 실패 ≠ 시스템 오류**: `scan_status=FAIL`, 연결 테스트 부분 실패는 `action_result`의
  실패 outcome이다(운영자의 핵심 데이터). `client_error`/`ssr_error`는 시스템 고장 전용.
- **응답 allowlist**: 이벤트 타입별 명시적 필드 매트릭스(ADR-025 §4)만 복사 — 상태값(로컬 enum
  검증, 미지값→`UNKNOWN`)·개수·소요시간·경계 있는 식별자 배열(≤20)뿐. 단 **settle 판정은 별개**:
  정확한 종료 상태 집합(스캔 SUCCESS/FAIL/TIMEOUT/CANCELED · 연결테스트 SUCCESS/FAIL) 밖의 값은
  settle이 아니므로 `action_result` 자체를 발행하지 않고 진단 로그로만 남긴다. spread/통복사 금지
  (passthrough 스키마의 미지 필드 유출 방지). 자유 텍스트는 어떤 경우에도 미저장.
- **신뢰 경계**: ingest 스키마(브라우저가 주장 가능한 것)와 저장 스키마(서버 스탬프 포함)는
  별개. 서버가 actor·receivedAt·origin·surface를 확정하고, 주장된 targetSourceId에 대한
  세션 사용자의 접근 권한을 검증 후 저장한다.
- **사실만 저장, 판정 금지**: 이벤트 1건 = 관찰 1건. "복구됨"·"재방문" 같은 이벤트 간 해석은
  저장하지 않는다. 조회 시점의 **집계**(count·group-by·24h 창)는 허용 — 사실의 요약이지 새 판단이 아님.
- **표현은 조회 시점 번역**: "설치 확정 요청 → 성공" 같은 문장은 저장하지 않고, 함수명→한국어
  사전으로 읽을 때 만든다. 새 페이지·버튼은 사전 한 줄 추가로 확장.

### 설계 원칙 (모든 작업에 적용)

1. **FE-thin**: FE는 이벤트를 "올바른 형식으로 만들어 보내는 것"까지만. 저장·집계·보존은 BFF.
2. **PII 제로 + 필드 정책**: body·쿼리스트링은 어떤 로그에도 금지(`lib/log-path.ts` 새니타이저).
   `errorMessage`(자유 텍스트)는 **DB 저장 금지** — `status`(숫자, **호출이 있는 경우**)·`code`(고정
   심볼)·`error.name`(allowlist 검증된 클래스명, ADR-025 채택)만 구조화 저장.
   code 없는 에러는 error.name·requestId(+호출이 있었다면 status)를 남기고 상세는 진단 로그로 —
   렌더 오류·unhandled rejection엔 status가 없을 수 있다(ADR-025 §1a).
3. **신뢰 경계**: userId·role은 서버 세션에서만 resolve. 클라이언트가 보낸 식별자 헤더는 채택 금지.
   requestId는 위조돼도 무해(상관관계 전용).
4. **공개 엔드포인트 방어**: 브라우저발 수신 라우트는 allowlist·바이트 캡·이중 rate limit·무에코 유지.
5. **surface 구분**: `pageTemplate` prefix에서 파생 — `customer`/`target-detail`/`admin`/`dev`.
6. **best-effort 전송**: 관측성 전송 실패가 사용자 요청을 절대 막지 않는다. 버퍼 초과 시 드랍 + 유실 카운터.

---

## 2. 작업 목록

### Phase 0 — PR #558 머지 (전제 조건)

| # | 작업 | 상세 |
|---|---|---|
| 0-1 | PR #558 리뷰·머지 | 수집 계층 전체(바운더리·로거·수신 라우트·헤더 3종·링버퍼·PII 가드)가 이 PR에 있다. **저장소가 바뀌어도 이 계층은 전부 재사용** — 교체 대상은 `log.ts`의 출구뿐. 리뷰 관점: PII 미로깅, 수신 라우트 방어, basePath 경로 정합 |
| 0-2 | 원안 문서 주석 | `observability-plan.md`의 Cloud Logging 의존 부분에 본 개정(BFF 저장) 링크 각주 |

**완료 기준**: main에 머지, 전체 테스트 green.

### Phase 1 — BFF 협의 (외부 의존 — 지금 시작 가능)

| # | 작업 | 상세 | 산출물 |
|---|---|---|---|
| 1-1 | ingest API 계약 | 엔드포인트(예: `POST /integration/observability/events`), 배치 payload 스키마(이벤트 배열), 서버 간 인증 방식, 요청 크기 캡, 실패 시 FE 드랍 정책, **멱등 키 `(targetSourceId, job.kind, job.key, eventType)` 처리**, **`triggerTestConnection` 응답에 `test_connection_version` 추가**(시작/결과 join의 전제 — ADR-025 §2) 합의 | 계약 문서 (swagger) |
| 1-2 | 이벤트 스키마·DB 필드 확정 | **입력 계약 = ADR-025 §1a 필드 표** — 이벤트 6종의 discriminated union(타입별 필수/선택 명시). 공통 봉투: `eventType`·`origin`(서버 스탬프)·`observedAt`(발행자)·`receivedAt`(서버 스탬프, 시간창 쿼리 기준)·`actor{userId,role}`(서버 스탬프 — 인증 게이트로 항상 존재, ADR-025 §5)·`clockSkew`(서버 스탬프, 클램프 시)·`page{template}`·`surface`(서버 파생)·`action{name,method,status,durationMs}`·`job{kind,key}`·`correlation{requestId,targetSourceId,serviceCode}`·`domainContext{processStatus,provider}`·종류별 블록(`outcome.*`/`error.*`/`detail.renderMs` — 전부 최상위, ADR-025 §1a). **`errorMessage` 컬럼 없음.** `error.name`은 ADR-025 필드 매트릭스가 요구하므로 **저장 확정**; `fingerprint`(새니타이즈 스택 해시)만 열린 결정 — 미채택 시 같은 error.name의 code 없는 에러들은 DB에서 더 세분 불가 | 스키마 문서 |
| 1-3 | 보존·삭제 정책 | 보존 기간(예: 상세 90일 + 일 단위 집계 롤업 장기), 삭제 주기, 용량 상한. "많아지면 삭제"의 구체 기준 | 정책 1쪽 |
| 1-4 | 조회 API 계약 | Admin **MVP(§3 M1~M3)가 요구하는 것만**: 타깃소스별 이벤트 목록(시간순·페이지네이션)·타깃소스별 24h Action/오류 count·확인 필요 집계 3종(24h 창, group by targetSourceId/serviceCode). P1~P4(추이·top-N·userId/requestId 필터·403 목록) 계약은 해당 기능 착수 시점으로 이연 | 계약 문서 |

**완료 기준**: BFF팀과 계약·스키마·보존 정책 합의 문서화. FE 코드 작업(Phase 2·4)의 입력이 된다.

### Phase 2 — FE 전송 교체 + 필드 정책 (FE 코드 본체 ①)

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 2-1 | `surface` 필드 + basePath 정규화 | `lib/log-path.ts`(+`surfaceOf()`) · `app/api/_lib/log.ts` · `app/api/_lib/handler.ts` | **`page.template`을 basePath 상대값으로 정규화 후** prefix 매칭으로 4값 파생 — 앱은 `basePath:'/pass'`에 마운트되고 브라우저 태깅은 `location.pathname`의 `/pass/...`를 보므로, 서버가 `/pass`를 벗겨 저장하고 surfaceOf()는 정규값에만 적용 | 실제 `/pass/...` 경로 입력 매핑 테스트 |
| 2-2 | `log.ts` 출구 교체 | `app/api/_lib/log.ts` (+신규 `app/api/_lib/log-transport.ts`) | 이벤트를 메모리 버퍼에 쌓고 배치(N건 또는 T초)로 BFF ingest에 비동기 POST. 실패/버퍼 초과 시 드랍 + 유실 카운터(주기적으로 진단 로그에 1줄). 프로세스 종료 시 flush 시도. **전송 실패가 요청 처리를 막지 않음** | 배치·드랍·flush 단위 테스트, 부하 시 요청 지연 무영향 |
| 2-3 | 진단 로그 분리 | `app/api/_lib/log.ts` | 새니타이즈된 스택 등 상세는 stdout 진단 로그로만(BFF 전송 payload에서 제외). `errorMessage`는 어느 payload에도 원문 미포함 | payload 스냅샷 테스트 — 금지 필드 부재 확인 |
| 2-4 | 브라우저 리포트 경로 정합 | `app/api/v1/observability/client-errors/route.ts` | 수신 라우트가 받은 리포트를 같은 출구(log.ts→BFF)로 흘림. 방어(allowlist·캡·rate limit)는 그대로 | 방어 회귀 테스트 유지 |
| 2-5 | sessionId 흔적 제거 확인 | `lib/fetch-json.ts` · `lib/observability-headers.ts` | `X-Session-Id` 관련 코드·계획 흔적이 없음을 확인(원안 Phase 3-2는 폐기됨) | grep 0건 |

**완료 기준**: 테스트 이벤트가 FE→BFF ingest→DB 레코드로 저장되고, DB에 errorMessage 컬럼/값이 없음.
**규모**: 중. **전제**: Phase 0·1.

### Phase 2b — Audit Event 발행 (FE 코드 본체 ①-b, ADR-025 구현)

Phase 2가 "관을 BFF로 돌리는 것"이라면 2b는 "그 관에 ADR-025 이벤트 6종을 실제로 흘리는 것"이다.
PR #558에는 이 이벤트 타입들이 없다(헤더·client-error 라우트까지만) — Admin(Phase 4)은 이 phase 없이는 보여줄 데이터가 없다.

**발행 소유자(이벤트 타입당 1곳 — 중복 발행 방지의 근거)**: `action`(동기)=`fetchJson` 관찰 콜백 ·
`action`(비동기 trigger)/`action_result`=trigger 함수·폴링 훅(trigger 함수는 래퍼 자동 발행을
호출 지점에서 opt-out — 2b-2) · `screen_read`=UI 관찰 지점 ·
`client_error`=에러 바운더리+`fetchJson` 실패 경로 · `page_view`(브라우저)=`ObservabilityInit` ·
`page_view`(SSR)/`ssr_error`=서버 렌더 경로(`page_view`는 전체 문서 렌더에만,
`ssr_error`는 prefetch 제외 사용자-가시 렌더 실패 전부 — 2b-5).

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 2b-1 | 이벤트 빌더 + ingest 스키마 + 관찰 콜백 계약 | 신규 `lib/audit-event.ts` + `lib/fetch-json.ts` | ADR-025 §1a discriminated union의 **ingest 판**(actor·origin·receivedAt·surface·clockSkew 없음 — 서버 스탬프 몫; **브라우저 ingress는 브라우저 발생 variant만** — ssr_error·renderMs 있는 page_view는 거부) + allowlist 매트릭스(§4) 구현. **관찰 콜백 계약**: `fetchJson`이 호출별 클로저로 `{requestId, status, durationMs, 파싱된 응답}`을 관찰 지점에 전달(전역 링버퍼로 이벤트 조립 금지 — 동시 호출 레이스). 응답 spread 금지, 필드 지명 복사, enum 로컬 검증(미지값→`UNKNOWN`), 배열·문자열 캡. **브라우저 전송 계약**: 소량 버퍼 + 타이머·`pagehide`/`visibilitychange` 시 flush(`sendBeacon` 또는 keepalive fetch — 내비게이션 직전 발행분 유실 가능성 감소), at-most-once(실패/캡 초과 배치는 드랍+유실 카운터, 내비게이션 너머 재시도 없음) | 스키마 단위 테스트 + 금지 필드 스냅샷 + 동시 호출 격리 테스트 + pagehide flush 테스트 |
| 2b-2 | 동기 Action 발행 | `lib/fetch-json.ts` 래퍼 | 쓰기 함수(`confirmInstallation` 등) 호출 완료 시 `action` 1건(status·code 포함) 자동 발행. **단 비동기 trigger 함수(`startScan`·`triggerTestConnection`)는 제외** — 그 `action`은 job key와 함께 2b-3의 trigger 지점이 발행(1관찰 1이벤트). 분류는 호출 지점의 명시적 opt-out 플래그로(래퍼 내부 함수명 denylist 금지 — ADR-025 §2) | 성공/실패(409) 각 1건 발행 + trigger 함수 호출 시 래퍼 발행 0건 테스트 |
| 2b-3 | 비동기 settle 발행 | `useScanPolling`·`useTestConnectionPolling` + trigger 함수 | trigger 시 `action` 발행 + **로컬 job key 기억(공급 필드까지 — keyField)**, settle 관찰 시 같은 필드의 key에 한해 `action_result` 발행. 정확한 종료 상태 집합 밖(미지값·PENDING·RUNNING)은 발행 없음. 연결테스트는 trigger 응답 key(1-1 계약) 전까지 시작 이벤트에 job 없음 허용 | mount-폴링만으로는 settle 미발생 · 미지/진행 중 상태 settle 미발생 테스트 |
| 2b-4 | 수신 라우트 확장 + 서버 스탬프 | `app/api/v1/observability/*` + `app/api/_lib/handler.ts` | client-errors 라우트를 일반 audit 이벤트 수신으로 확장(방어 유지). 서버가 actor(세션)·receivedAt·origin·surface·clockSkew(클램프 판정 후에만 — 클라이언트 값 무시) 스탬프, **주장된 targetSourceId 접근 권한 검증 후 저장**, target 있으면 **serviceCode는 검증된 target에서 서버가 파생(클라이언트 값 무시)**, target 없는 서비스 이벤트는 서비스 소속 검증, 멱등 키 전달 | 위조 actor 무시·무권한 target 거부·위조 serviceCode 무시·클라이언트 clockSkew 무시(스큐/정상 타임스탬프 각 1)·위조 zod issue code 정규화·`job.*` 있는데 targetSourceId 없는 이벤트 거부·target-detail 페이지 이벤트에 targetSourceId 없으면 거부·`/services` 수준 target 없는 이벤트 정상 수용 테스트 |
| 2b-5 | SSR 발행 + 서버 렌더 컨텍스트 | `app/target-sources/[targetSourceId]/page.tsx` + `error.tsx`(또는 공용 브라우저 리포터) + `log.ts` | 동적 SSR 렌더 성공→`page_view`(renderMs), 실패→`ssr_error`. 발행 범위가 서로 다름(ADR-025 §1): `page_view`는 **전체 문서 렌더에만**(soft-nav RSC 재실행·prefetch는 방문 아님 — 브라우저 전환 발행은 2b-6 몫), `ssr_error`는 **사용자에게 보이는 렌더 실패 전부**(전체 문서 + soft-nav RSC 실패 — digest가 브라우저 client_error를 억제하므로 여기서 안 남기면 완전 무기록; prefetch 렌더 실패만 제외). **서버 렌더 컨텍스트 헬퍼 신설** — 이 Server Component는 `withV1` 밖이므로: 세션에서 actor resolve, **단일 requestId를 audit 이벤트와 두 BFF 호출(`targetSources.get`·`getProcessStatus`)에 함께 전파**, 정규 page.template·targetSourceId 스탬프. **SSR template 식별은 여기로 일원화**(3-4는 본 작업으로 흡수). digest 억제는 바운더리 쪽 수정 필수 — PR #558 바운더리는 무조건 리포트하므로 서버 에러 digest 인지 로직을 `error.tsx`/공용 리포터에 추가 | 렌더 실패 시 page_view 없음·ssr_error 1건·**같은 실패로 client_error 0건**(digest 있는 에러 vs 진짜 클라이언트 에러 각각 테스트)·**soft-nav 렌더 실패 시에도 ssr_error 1건·client_error 0건**·SSR page_view/ssr_error 모두 봉투 필수 필드 충족 |
| 2b-6 | 브라우저 page_view | `app/components/ObservabilityInit.tsx` | 발행 규칙(ADR-025 §1): ① 초기 문서 로드 — 동적 SSR 라우트는 서버(2b-5)가 발행하므로 브라우저 미발행, 정적/CSR 라우트(`/services`)는 브라우저 발행(`/`는 `/services`로 서버 redirect라 커밋된 페이지가 아님 — 최종 커밋된 `/services` 1건만) ② **커밋된 클라이언트 라우트 전환은 목적지 불문 브라우저 발행**(타깃 상세로의 soft-nav 포함, renderMs 없음) ③ prefetch는 미발행. 서버가 actor·receivedAt 스탬프 | 전환 시 1건 · 하드 로드 시 서버/브라우저 중복 0건 · prefetch 미발행 테스트 |
| 2b-7 | screen_read 발행 | 해당 UI 컴포넌트/훅 (패널 열림 지점) | **발행 지점은 UI 관찰 지점** — 사용자가 패널을 연 시점에 1건. 함수 단위 일괄 태깅 금지(mount 자동 로드·백그라운드 갱신·내부 재시도가 사용자 조회로 둔갑). **발행 조건 = 열기 제스처가 실제 네트워크 조회를 트리거한 경우** — 캐시 히트면 미발행(필수 `action{...}`·`outcome.count`의 원천이 없음, ADR-025 §1). 패널 인벤토리는 본 작업에서 확정하고 5-1 매트릭스가 그 목록으로 검증. `fetchJson` 우회 호출은 래퍼로 이관하거나 미계측 목록에 명시 — 현 브랜치 raw `fetchInfra` 우회: `ProjectHistoryPanel`(고객 target-detail) · `app/lib/api/aws.ts`(terraform-script) · `app/lib/api/task-queue-requests.ts`(NLB/승인/거부 — admin) | mount 자동 로드·캐시 히트 재열기 시 이벤트 미발생 테스트 |
| 2b-8 | 비-Action 읽기 실패의 client_error 발행 | `lib/fetch-json.ts` + 에러 소비 지점 | `fetchJson`은 throw하고 훅(`usePollingBase` 등)이 rejection을 삼키므로 기존 브라우저 리포터는 이를 못 본다 — **비-Action 읽기 실패에서 정확히 1건** client_error 발행(abort 제외, Action 실패와 중복 금지 = 1관찰 1이벤트). `error.zodIssues`는 서버가 ProblemDetails에 **캡 있는 `{path, code}` 확장**을 실어줄 때만 존재(withV1 검증 실패 시 이슈 목록 ≤20 포함 — 없으면 zodIssues 없이 저장) | 폴링 실패 1건·중복 0건·abort 미발행 테스트 |

**완료 기준**: 목업 시나리오(스캔 시작→성공, 확정 409→200, zod 검증 실패, SSR 504, 방문·화면 조회)가
전부 실제 이벤트로 저장 경로를 통과한다(스테이징). **규모**: 중~대. **전제**: Phase 0·1·2.
**⚠️ 인증 게이트(ADR-025 §5)**: actor 스탬프·target 접근 검증 모두 세션이 필요하므로, **프로덕션 영구
저장 활성화와 Admin 노출은 Phase 3 이후**다. 그 전에는 스테이징/mock에서 개발·검증만 — actor 없는
audit 행도, 자리만 차지하는 role 검사도 만들지 않는다.

### Phase 3 — 인증 연동 (인증 도입 ~1개월 후)

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 3-1 | `userId`·`role` resolve | `app/api/_lib/handler.ts` | withV1이 세션에서 userId·role을 읽어 모든 이벤트에 심음. 클라이언트 헤더 채택 금지 | 위조 헤더 무시 테스트 |
| 3-2 | 인가 거부 이벤트 — API | `app/api/_lib/handler.ts` | 인가 검사 실패 시 **`auth_denied` 이벤트**(7번째 타입, ADR-025 Scope: origin=server·actor=세션·action.status=403, 그 외 detail 없음). 거부된 API 경로는 **별도 `route.template`**(정규화)로 — API 경로는 page.template이 아니고 surfaceOf()는 페이지 prefix 전용이므로, surface는 page.template 있으면 거기서, 없으면 Phase 3에서 정의하는 route prefix 매핑에서 파생. eventType enum 확장은 FE ingest 스키마·BFF enum을 함께 늘리는 **호환 가능한 추가 변경**으로 BFF와 조율 | 403 시나리오 테스트 |
| 3-3 | 인가 거부 — 페이지 수준 | middleware 또는 SSR 가드 | 페이지 접근 자체를 막는 가드의 거부도 같은 `auth_denied`로(page.template 사용). **withV1 밖이라 자동으로 안 잡힘 — 별도 구현 필수** | 페이지 403 시나리오 테스트 |
| 3-4 | ~~SSR 화면 식별~~ | — | **2b-5의 서버 렌더 컨텍스트로 흡수** — 서버가 자기 렌더 template을 직접 스탬프. 여기서는 인증 결합(actor가 세션에서 오는지)만 확인 | SSR 이벤트 actor 존재 확인 |

**완료 기준**: 모든 이벤트에 userId·role, 403 시도가 API·페이지 양쪽에서 기록됨.
**게이트 해제**: 이 phase가 끝나야 Phase 2b의 프로덕션 영구 저장과 Phase 4 Admin 노출이 켜진다(ADR-025 §5 인증 게이트).

### Phase 4 — In-app Admin 대시보드 (FE 코드 본체 ②)

목업(인터랙션 포함): `docs/feature/observability-admin-audit-mockup.html` — 목록→상세→이벤트 모달, 확인 필요 뷰.

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 4-1 | FE 프록시 라우트 | 신규 `app/api/v1/admin/observability/*/route.ts` | Phase 1-4 조회 API를 감싸는 라우트. 운영자 role 검사(3-1 이후), 24h 기본 창 | 계약 테스트 + 비운영자 403 |
| 4-2 | 타깃소스 사용 이력 — 목록 | 신규 `app/admin/observability/page.tsx` + `_components/` | §3 M1. 타깃소스 목록(최근 활동 순·검색) + 24h Action/오류 집계 열. 기존 admin 패턴(theme.ts 토큰·한국어 UI) 준수 | 목업 모드 렌더 + 실데이터 |
| 4-3 | 타깃소스 사용 이력 — 상세 | 4-2 하위 상세 페이지 | §3 M2. ① 사용자 Action 이력(분리 표 — Action·당시 단계·결과, 비동기는 작업 번호로 짝지음) ② 전체 이력 타임라인(6종 전부, `receivedAt` 최신순) ③ 행 클릭 → Audit Event 원본 모달(구조화 레코드 + 전송 payload) | 타깃 1건의 행동 흐름 시간순 재구성 |
| 4-4 | 확인 필요 뷰 | 4-2 하위 + 사이드바 | §3 M3. 24h 창 집계 3표(오류 발생 타깃소스·실패 Action 타깃소스·서비스별 요약) + 사이드바 빨간 배지(=오류 발생 타깃소스 수, 0이면 꺼짐) | 집계 쿼리 계약 테스트 |
| 4-5 | 표시 사전 | 4-2 하위 `_lib/` | 함수명→한국어 Action명, processStatus→단계명 사전(기존 UI 라벨 재사용). 사전에 없는 값은 원본 그대로 노출 | 미등록 값 원본 노출 테스트 |

**완료 기준**: 운영자가 "확인 필요 → 해당 타깃소스 상세 → Action 이력·전체 이력 → 이벤트 원본"까지 도달.
**규모**: 중. **전제**: Phase 1·2·2b·**3**(이벤트가 있어야 보여줄 것이 있고, 인증이 있어야 actor·운영자 게이트가 성립 — ADR-025 §5 인증 게이트).

### Phase 5 — 커버리지 점검·방어 상수 (발행은 Phase 2b로 이동)

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 5-1 | 커버리지 점검 | — | 6종 이벤트가 실제 페이지 흐름 전체를 덮는지 점검(방문·조회·Action·오류 각 1건 이상 실데이터 확인) — 발행 구현 자체는 Phase 2b(2b-5·2b-6·2b-7) | 페이지별 이벤트 발생 매트릭스 |
| 5-2 | 방어 상수 재점검 | `lib/client-error-report.ts` | 이벤트 종류별 rate cap 분리 | 연타 시나리오 테스트 |

### Phase 6 — Grafana (보류 — 도입 결정 후)

**판단 기준**: "사람이 들어가 보기 전에 시스템이 먼저 알려야 하는가"(push 알림 필요성).
필요해지면: BFF DB에 읽기 전용 계정 → Grafana SQL 데이터소스 연결. 단 **SQL만으로 되는 후보는 G2·G4·G8뿐** — G1/G3/G5/G6/G7은 진단 스트림(접근 기록·서버 예외·유실 카운터) 기반 metric 소스가 별도로 필요(§3 표의 ⚠️)
→ §3 Grafana 후보 패널·알림 구성 → Slack 수신 확인. 고카디널리티(고객/타깃별) 패널 금지 원칙 유지.

---

## 3. 제공 기능 목록 — In-app Admin과 Grafana

### In-app Admin — MVP (확정 — Phase 4, 목업 반영)

07-23 스코프 축소: 관제 대시보드·고객(userId)별 조회는 MVP에서 제외하고,
**타깃소스 단위 이력 조회 + 확인 필요 집계**에 집중한다. 목업 = `observability-admin-audit-mockup.html`.

| # | 기능 | 내용 | 데이터 |
|---|---|---|---|
| M1 | **타깃소스 사용 이력 — 목록** | 전체 타깃소스(~2,000)를 최근 활동 순으로, 검색(이름/서비스/담당자) | 타깃소스별 최근 이벤트 시각 + 24h Action/오류 count |
| M2 | **타깃소스 사용 이력 — 상세** | ① 사용자 Action 이력(분리 표: 시각·담당자·Action·당시 단계·결과 — 비동기는 작업 번호로 짝지어 한 행) ② 전체 이력 타임라인(6종 전부, **`receivedAt` 최신순** — 시간창 필터와 동일 기준, `observedAt`은 클램프 대상이라 정렬 키 아님) ③ 행 클릭 → Audit Event 원본 모달(필드·값·의미 표 + 전송 payload JSON) | ADR-025 이벤트 6종 그대로 |
| M3 | **확인 필요** | 24h 창 집계 3표 — 오류 발생 타깃소스 · 실패 Action 타깃소스 · 서비스별 요약. 사이드바 메뉴에 빨간 배지(= 24h 오류 발생 타깃소스 수, 0이면 꺼짐) | `count(*) … where eventType in (client_error, ssr_error) and receivedAt > now()-24h group by target_source_id` — 집계만, 판정 없음 |
| M4 | **접근 통제·조회 창** | 운영자 role만, 기본 24h 창(확장 가능), 보존 정책 표시 | — |

M1/M2의 타깃소스 이름·담당자·현재 단계는 **도메인 API에서** 온다(채택 확정 — 전략 §8에서 열린 항목이었던
"로그+도메인 상태 합치기"는 MVP 포함으로 결정). join은 FE Admin 라우트(4-1)가 조회 시점에 수행하고,
audit 저장소에는 도메인 데이터를 복제하지 않는다.

### In-app Admin — 후순위 후보 (MVP 제외, 이벤트로 구현 가능)

| # | 기능 | 비고 |
|---|---|---|
| P1 | 관제 화면(최근 에러 목록·추이·API top-N) | 07-23 스코프 축소로 제외 |
| P2 | requestId 검색 (단일 요청 흐름 — "FE 에러인데 BFF는 200" 판별) | 모달의 correlation에서 출발 |
| P3 | 고객(userId)별 활동 타임라인 | 인증(Phase 3) 후 |
| P4 | 인가 거부(403) 시도 목록 | Phase 3-2/3-3 이벤트가 원천 |
| P5 | 파생 뷰(예: 실패 N회 이상 타깃) | audit 위의 **별도 기능 결정** — ADR-025 §6 |

### Grafana (보류 — 후보 목록)

| # | 종류 | 후보 | 비고 |
|---|---|---|---|
| G1 | 패널 | surface별 에러율 추이 (에러/요청) | ⚠️ 분모(전체 요청 수)는 audit에 없음 — 진단 로그 기반 metric 별도 필요 |
| G2 | 패널 | 에러 급증 감지 + 배포 마커 | "배포 직후 터졌나" 즉답 |
| G3 | 패널 | API 호출량·p95 (`action.name`별) | ⚠️ audit은 전 호출을 덮지 않음(폴링 미기록 등) — 진단 로그 기반 metric 별도 필요 |
| G4 | 패널 | CTA(쓰기) 실패율 | method+status 집계 |
| G5 | 패널 | ingest 유실 카운터 | ⚠️ 유실 카운터는 stdout 진단에만 존재 — 진단 로그 기반 metric 별도 필요 |
| G6 | 알림 | `target-detail` 에러율 임계 → Slack | 민감 임계 — 고객이 작업 중 실패. ⚠️ 에러율 분모는 G1과 동일 제약 |
| G7 | 알림 | server ERROR 급증 → Slack | 느슨 임계. ⚠️ 서버 예외는 진단 스트림 — BFF DB SQL만으론 불가 |
| G8 | 알림 | 403 시도 급증 → Slack | 보안 신호 |

**금지**: 고객별/타깃별 드릴다운 패널(고카디널리티) — Admin의 몫.

---

## 4. 의존 관계와 순서

```
Phase 0 (PR #558 머지)
  └─→ Phase 2 (전송 교체·필드 정책) ─→ Phase 2b (Audit Event 발행 — 개발·스테이징 검증)
Phase 1 (BFF 협의: ingest·스키마·멱등키·연결테스트 trigger key·M1~M3 조회) ─→ Phase 2·2b·4   ← 코드와 무관, 지금 바로 시작
Phase 3 (인증 연동) ─→ ⛔ 게이트: 프로덕션 audit 저장 활성화·Admin 노출은 여기부터
  └─→ Phase 4 (Admin MVP) ─→ Phase 5 (커버리지 점검) → 후순위 P1~P4(P5는 별도 기능 결정 — §3)
Phase 6 (Grafana)   ← 도입 결정 후, 언제든
```

**권장 착수 순서**: 0‖1 → 2 → 2b(개발·스테이징) → 3(게이트 해제) → 4(M1~M4) → 5 → (후순위 P1~P4) → 6.
지금 바로 시작할 수 있는 것: **PR #558 리뷰**와 **Phase 1 BFF 협의**.

## 5. 하지 않는 것 (명시적 스코프 아웃)

- **세션 리플레이·히트맵** — "그때 화면 재현" 불필요. page_view+`action.name`으로 행동 흐름 재구성 (결정 ④)
- **sessionId** — 로그인 필수라 익명 구간이 없음. userId가 상위 호환 (결정 ③)
- **errorMessage 저장** — 자유 텍스트 PII 위험. code/status/error.name(allowlist)만 구조화 저장 (필드 정책)
- **전용 수집 서버**(Sentry/Bugsink 등) — 보류, 승격 경로만 보존 (`observability-plan.md` §9)
- **OpenTelemetry 분산 트레이싱** — requestId 상관관계가 경량 대체
- **클라이언트가 보내는 userId 헤더** — 위조 가능, 영구 채택 금지

## 6. 참고

- 전략·결정 근거: `docs/feature/observability-strategy-overview.md`
- 이벤트 체계(6종·allowlist·신뢰 경계): `docs/adr/025-frontend-audit-event-emission.md`
- 수집 계층 상세(스키마·위협 모델·FAQ): `docs/feature/observability-plan.md` (PR #558 브랜치)
- 시각 자료: `docs/feature/observability-implementation-plan.html` (이 문서의 HTML 판) ·
  Admin 목업 = `docs/feature/observability-admin-audit-mockup.html`
- Linear: LIN-58 · LIN-59 · LIN-55~72 (운영 배포 준비)
