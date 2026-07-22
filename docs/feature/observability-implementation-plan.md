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
| **L3 · 소비** | 사람이 보고 판단한다 | FE (+보류: Grafana) | In-app Admin 대시보드(FE 라우트 → BFF 조회 API, 도메인 join) · (보류) Grafana SQL 데이터소스 + Slack 알림 |

원안과 달라진 것: L2가 GCP(Cloud Logging/Error Reporting/Monitoring)에서 **BFF DB**로 바뀌었다.
이유는 FE의 GCP 프로젝트 마이그레이션(최소 2회) — 저장소는 이사하지 않는 고정점에 둔다.
stdout 진단 로그(새니타이즈된 스택 등)는 보조로 유지하되, 30일 만료·이사 시 소멸을 허용한다.
원안의 전제 V-5(FE→googleapis 도달성)는 **불필요해졌다** — Admin은 BFF 조회 API만 쓴다.

### 데이터 흐름

```
[브라우저]
 ├─ 렌더 에러/unhandled rejection → 바운더리+전역 핸들러
 │    └─ 리포트(페이지·행동·직전 API 10건) → POST /observability/client-errors (FE 라우트)
 ├─ (Phase 5) 라우트 전환 → page_view 이벤트
 └─ 모든 API 호출 → fetchJson 단일 래퍼
      └─ X-Request-Id · X-Client-Page · X-Client-Action

[FE 서버 (Next.js standalone, GKE — 상태 없음)]
 ├─ withV1: 접근 이벤트(INFO) · 예외/업스트림 5xx(ERROR) · 인가 거부(403, WARN)
 ├─ 세션 → userId·role resolve (Phase 3) — 서버가 이벤트에 심음, 클라이언트 헤더 채택 금지
 └─ log.ts: 버퍼링 → 배치·비동기 POST → BFF ingest API (best-effort, 유실 카운터)
      ├─▶ [BFF DB] 구조화 필드만 영구 저장 (errorMessage 없음)
      └─▶ stdout 진단 로그 (보조·30일·이사 시 소멸 허용)

[In-app Admin]  FE 서버 라우트 → BFF 조회 API + 도메인 API → 이력과 현재 상태를 합쳐 표시
[(보류) Grafana] BFF DB SQL 데이터소스 → 집계 패널·임계 알림 → Slack
```

### 이벤트 체계 — Audit Event 6종 (ADR-025 요약)

FE가 보내는 이벤트는 6종이며, "누가 · 어느 페이지에서 · 무엇을 했고 · 결과가 뭐였나"라는
하나의 공통 봉투(actor · page · action · correlation · domainContext)를 공유한다.

| eventType | 의미 (운영자 언어) | 발생 위치 |
|---|---|---|
| `page_view` | 페이지 방문 — 페이지를 열었다 | FE 서버 (SSR) |
| `screen_read` | 화면 조회 — 리소스 목록 등 사용자가 열어본 단발 조회 | 브라우저 |
| `action` | 사용자 Action — 버튼 행동. 동기 Action은 결과(status·code) 포함 | 브라우저 |
| `action_result` | 비동기 Action(스캔·연결 테스트)의 종료 결과 — 상태값·소요시간·구조화 요약 | 브라우저 |
| `client_error` | 사용 중 오류 — 화면이 떠 있는데 실패 (5xx, zod 검증 실패 등) | 브라우저 |
| `ssr_error` | 페이지 여는 중 오류 — 페이지 자체가 안 떴다 | FE 서버 (SSR) |

핵심 규칙 (근거·대안은 ADR-025):

- **폴링 미기록**: 스캔·연결 테스트를 지켜보는 개별 GET은 저장하지 않는다. 시작(`action`) +
  종료(`action_result`)만 남기고, 둘은 응답의 작업 번호(`scan_version` 등)로 잇는다(사실 기반 join).
- **업무 실패 ≠ 시스템 오류**: `scan_status=FAIL`, 연결 테스트 부분 실패는 `action_result`의
  실패 outcome이다(운영자의 핵심 데이터). `client_error`/`ssr_error`는 시스템 고장 전용.
- **응답 allowlist**: 이벤트에 복사하는 응답 값은 상태값·개수·소요시간·도메인 식별자만.
  spread/통복사 금지(passthrough 스키마의 미지 필드 유출 방지). 자유 텍스트는 어떤 경우에도 미저장.
- **사실만 저장, 판정 금지**: 이벤트 1건 = 관찰 1건. "복구됨"·"재방문" 같은 이벤트 간 해석은
  저장하지 않는다. 조회 시점의 **집계**(count·group-by·24h 창)는 허용 — 사실의 요약이지 새 판단이 아님.
- **표현은 조회 시점 번역**: "설치 확정 요청 → 성공" 같은 문장은 저장하지 않고, 함수명→한국어
  사전으로 읽을 때 만든다. 새 페이지·버튼은 사전 한 줄 추가로 확장.

### 설계 원칙 (모든 작업에 적용)

1. **FE-thin**: FE는 이벤트를 "올바른 형식으로 만들어 보내는 것"까지만. 저장·집계·보존은 BFF.
2. **PII 제로 + 필드 정책**: body·쿼리스트링은 어떤 로그에도 금지(`lib/log-path.ts` 새니타이저).
   `errorMessage`(자유 텍스트)는 **DB 저장 금지** — `status`(숫자)·`code`(고정 심볼)만 구조화 저장.
   code 없는 에러는 status·requestId만 남기고 상세는 진단 로그로.
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
| 1-1 | ingest API 계약 | 엔드포인트(예: `POST /integration/observability/events`), 배치 payload 스키마(이벤트 배열), 서버 간 인증 방식, 요청 크기 캡, 실패 시 FE 드랍 정책 합의 | 계약 문서 (swagger) |
| 1-2 | 이벤트 스키마·DB 필드 확정 | **입력 계약 = ADR-025 이벤트 6종 + 공통 봉투**(`eventType`·`ts`·`actor{userId,role}`·`page{template}`·`action{name,method,status,durationMs}`·`correlation{requestId,targetSourceId,serviceCode}`·`domainContext{processStatus,provider}`·종류별 detail). **`errorMessage` 컬럼 없음.** `errorName`·`fingerprint`(새니타이즈 스택 해시) 포함 여부는 열린 결정 — 미포함 시 code 없는 에러는 DB에서 구분 불가함을 명시하고 결정 | 스키마 문서 |
| 1-3 | 보존·삭제 정책 | 보존 기간(예: 상세 90일 + 일 단위 집계 롤업 장기), 삭제 주기, 용량 상한. "많아지면 삭제"의 구체 기준 | 정책 1쪽 |
| 1-4 | 조회 API 계약 | Admin이 쓸 조회·집계 엔드포인트(§3 기능 목록이 요구사항): 최근 에러 목록·추이 집계·API top-N·userId/targetSourceId/requestId 필터·403 목록 | 계약 문서 |

**완료 기준**: BFF팀과 계약·스키마·보존 정책 합의 문서화. FE 코드 작업(Phase 2·4)의 입력이 된다.

### Phase 2 — FE 전송 교체 + 필드 정책 (FE 코드 본체 ①)

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 2-1 | `surface` 필드 | `lib/log-path.ts`(+`surfaceOf()`) · `app/api/_lib/log.ts` · `app/api/_lib/handler.ts` | `pageTemplate` prefix 매칭으로 4값 파생, 모든 이벤트에 필드 추가 | 경로별 매핑 단위 테스트 |
| 2-2 | `log.ts` 출구 교체 | `app/api/_lib/log.ts` (+신규 `app/api/_lib/log-transport.ts`) | 이벤트를 메모리 버퍼에 쌓고 배치(N건 또는 T초)로 BFF ingest에 비동기 POST. 실패/버퍼 초과 시 드랍 + 유실 카운터(주기적으로 진단 로그에 1줄). 프로세스 종료 시 flush 시도. **전송 실패가 요청 처리를 막지 않음** | 배치·드랍·flush 단위 테스트, 부하 시 요청 지연 무영향 |
| 2-3 | 진단 로그 분리 | `app/api/_lib/log.ts` | 새니타이즈된 스택 등 상세는 stdout 진단 로그로만(BFF 전송 payload에서 제외). `errorMessage`는 어느 payload에도 원문 미포함 | payload 스냅샷 테스트 — 금지 필드 부재 확인 |
| 2-4 | 브라우저 리포트 경로 정합 | `app/api/v1/observability/client-errors/route.ts` | 수신 라우트가 받은 리포트를 같은 출구(log.ts→BFF)로 흘림. 방어(allowlist·캡·rate limit)는 그대로 | 방어 회귀 테스트 유지 |
| 2-5 | sessionId 흔적 제거 확인 | `lib/fetch-json.ts` · `lib/observability-headers.ts` | `X-Session-Id` 관련 코드·계획 흔적이 없음을 확인(원안 Phase 3-2는 폐기됨) | grep 0건 |

**완료 기준**: 테스트 이벤트가 FE→BFF ingest→DB 레코드로 저장되고, DB에 errorMessage 컬럼/값이 없음.
**규모**: 중. **전제**: Phase 0·1.

### Phase 3 — 인증 연동 (인증 도입 ~1개월 후)

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 3-1 | `userId`·`role` resolve | `app/api/_lib/handler.ts` | withV1이 세션에서 userId·role을 읽어 모든 이벤트에 심음. 클라이언트 헤더 채택 금지 | 위조 헤더 무시 테스트 |
| 3-2 | 인가 거부(403) 이벤트 — API | `app/api/_lib/handler.ts` | 인가 검사 실패 시 `{userId, role, pathTemplate, status:403}` WARN 이벤트 — "권한 없이 접근 시도" 추적의 원천 | 403 시나리오 테스트 |
| 3-3 | 인가 거부 — 페이지 수준 | middleware 또는 SSR 가드 | 페이지 접근 자체를 막는 가드의 거부도 같은 이벤트로. **withV1 밖이라 자동으로 안 잡힘 — 별도 구현 필수** | 페이지 403 시나리오 테스트 |
| 3-4 | SSR 화면 식별 | SSR fetch 경로 | SSR엔 `X-Client-Page`가 없음 — 서버가 자기 렌더 경로를 이벤트에 직접 심는 구현. 방법은 열린 항목(레이아웃별 상수 vs 요청 URL 파생) | SSR 에러에 화면 필드 존재 |

**완료 기준**: 모든 이벤트에 userId·role, 403 시도가 API·페이지 양쪽에서 기록됨.

### Phase 4 — In-app Admin 대시보드 (FE 코드 본체 ②)

목업(인터랙션 포함): `docs/feature/observability-admin-audit-mockup.html` — 목록→상세→이벤트 모달, 확인 필요 뷰.

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 4-1 | FE 프록시 라우트 | 신규 `app/api/v1/admin/observability/*/route.ts` | Phase 1-4 조회 API를 감싸는 라우트. 운영자 role 검사(3-1 이후), 24h 기본 창 | 계약 테스트 + 비운영자 403 |
| 4-2 | 타깃소스 사용 이력 — 목록 | 신규 `app/admin/observability/page.tsx` + `_components/` | §3 M1. 타깃소스 목록(최근 활동 순·검색) + 24h Action/오류 집계 열. 기존 admin 패턴(theme.ts 토큰·한국어 UI) 준수 | 목업 모드 렌더 + 실데이터 |
| 4-3 | 타깃소스 사용 이력 — 상세 | 4-2 하위 상세 페이지 | §3 M2. ① 사용자 Action 이력(분리 표 — Action·당시 단계·결과, 비동기는 작업 번호로 짝지음) ② 전체 이력 타임라인(6종 전부, 최신순) ③ 행 클릭 → Audit Event 원본 모달(구조화 레코드 + 전송 payload) | 타깃 1건의 행동 흐름 시간순 재구성 |
| 4-4 | 확인 필요 뷰 | 4-2 하위 + 사이드바 | §3 M3. 24h 창 집계 3표(오류 발생 타깃소스·실패 Action 타깃소스·서비스별 요약) + 사이드바 빨간 배지(=오류 발생 타깃소스 수, 0이면 꺼짐) | 집계 쿼리 계약 테스트 |
| 4-5 | 표시 사전 | 4-2 하위 `_lib/` | 함수명→한국어 Action명, processStatus→단계명 사전(기존 UI 라벨 재사용). 사전에 없는 값은 원본 그대로 노출 | 미등록 값 원본 노출 테스트 |

**완료 기준**: 운영자가 "확인 필요 → 해당 타깃소스 상세 → Action 이력·전체 이력 → 이벤트 원본"까지 도달.
**규모**: 중. **전제**: Phase 1·2 (userId 축은 3).

### Phase 5 — page_view 이벤트 (방문 추적)

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 5-1 | page_view 이벤트 | SSR 페이지(`app/target-sources/[targetSourceId]/page.tsx` 등) + `log.ts` | **ADR-025: page_view는 FE 서버가 렌더 성공 시점에 발행**(renderMs 포함) — 대상 페이지가 동적 SSR이라 첫 진입·클라이언트 내비게이션 모두 서버 렌더를 거친다. 사람 묶기는 userId(서버가 심음) — **sessionId 없음** | 진입 시 1건, 렌더 실패 시 page_view 없음(ssr_error만) |
| 5-2 | screen_read 이벤트 | `lib/fetch-json.ts` 래퍼 태깅 | 단발 조회 함수(리소스 목록 등)를 `screen_read`로 태깅 — 폴링 함수는 제외(ADR-025 §2) | 폴링 함수 이벤트 미발생 테스트 |
| 5-3 | 방어 상수 재점검 | `lib/client-error-report.ts` | 이벤트 종류별 rate cap 분리 | 연타 시나리오 테스트 |

### Phase 6 — Grafana (보류 — 도입 결정 후)

**판단 기준**: "사람이 들어가 보기 전에 시스템이 먼저 알려야 하는가"(push 알림 필요성).
필요해지면: BFF DB에 읽기 전용 계정 → Grafana SQL 데이터소스 연결(로그 기반 metric 파이프라인 불필요)
→ §3 Grafana 후보 패널·알림 구성 → Slack 수신 확인. 고카디널리티(고객/타깃별) 패널 금지 원칙 유지.

---

## 3. 제공 기능 목록 — In-app Admin과 Grafana

### In-app Admin — MVP (확정 — Phase 4, 목업 반영)

07-23 스코프 축소: 관제 대시보드·고객(userId)별 조회는 MVP에서 제외하고,
**타깃소스 단위 이력 조회 + 확인 필요 집계**에 집중한다. 목업 = `observability-admin-audit-mockup.html`.

| # | 기능 | 내용 | 데이터 |
|---|---|---|---|
| M1 | **타깃소스 사용 이력 — 목록** | 전체 타깃소스(~2,000)를 최근 활동 순으로, 검색(이름/서비스/담당자) | 타깃소스별 최근 이벤트 시각 + 24h Action/오류 count |
| M2 | **타깃소스 사용 이력 — 상세** | ① 사용자 Action 이력(분리 표: 시각·담당자·Action·당시 단계·결과 — 비동기는 작업 번호로 짝지어 한 행) ② 전체 이력 타임라인(6종 전부 최신순, 운영자 문장 + 당시 단계) ③ 행 클릭 → Audit Event 원본 모달(필드·값·의미 표 + 전송 payload JSON) | ADR-025 이벤트 6종 그대로 |
| M3 | **확인 필요** | 24h 창 집계 3표 — 오류 발생 타깃소스 · 실패 Action 타깃소스 · 서비스별 요약. 사이드바 메뉴에 빨간 배지(= 24h 오류 발생 타깃소스 수, 0이면 꺼짐) | `count(*) … where eventType in (client_error, ssr_error) and ts > now()-24h group by target_source_id` — 집계만, 판정 없음 |
| M4 | **접근 통제·조회 창** | 운영자 role만, 기본 24h 창(확장 가능), 보존 정책 표시 | — |

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
| G1 | 패널 | surface별 에러율 추이 (에러/요청) | 고객 대면(`target-detail`)과 내부(`admin`) 분리 |
| G2 | 패널 | 에러 급증 감지 + 배포 마커 | "배포 직후 터졌나" 즉답 |
| G3 | 패널 | API 호출량·p95 (clientAction별) | 저카디널리티 라벨만 |
| G4 | 패널 | CTA(쓰기) 실패율 | method+status 집계 |
| G5 | 패널 | ingest 유실 카운터 | 관측 파이프 자체의 건강 |
| G6 | 알림 | `target-detail` 에러율 임계 → Slack | 민감 임계 — 고객이 작업 중 실패 |
| G7 | 알림 | server ERROR 급증 → Slack | 느슨 임계 |
| G8 | 알림 | 403 시도 급증 → Slack | 보안 신호 |

**금지**: 고객별/타깃별 드릴다운 패널(고카디널리티) — Admin의 몫.

---

## 4. 의존 관계와 순서

```
Phase 0 (PR #558 머지)
  └─→ Phase 2 (전송 교체·필드 정책) ─→ Phase 4 (Admin) ─→ Phase 5 (page_view)
Phase 1 (BFF 협의) ─→ Phase 2·4        ← 코드와 무관, 지금 바로 시작
Phase 3 (인증 연동) ─→ Phase 4의 userId·403 축   ← 인증 도입 후
Phase 6 (Grafana)   ← 도입 결정 후, 언제든
```

**권장 착수 순서**: 0‖1 → 2 → 4(관제·드릴다운) → 3 → 4(엔티티·보안 축) → 5 → 6.
지금 바로 시작할 수 있는 것: **PR #558 리뷰**와 **Phase 1 BFF 협의**.

## 5. 하지 않는 것 (명시적 스코프 아웃)

- **세션 리플레이·히트맵** — "그때 화면 재현" 불필요. page_view+clientAction으로 행동 흐름 재구성 (결정 ④)
- **sessionId** — 로그인 필수라 익명 구간이 없음. userId가 상위 호환 (결정 ③)
- **errorMessage 저장** — 자유 텍스트 PII 위험. code/status만 구조화 저장 (필드 정책)
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
