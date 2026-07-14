# FE 관측성 아키텍처 — 상세 계획서

> **목적**: 운영 배포를 앞둔 PII Agent 프론트엔드의 에러 추적·API 사용 추적 아키텍처를 설명하고,
> 왜 이 방식(로그 기반)을 선택했는지 근거와 함께 제시한다. 기술 리뷰·팀 설득용 문서.
>
> **상태**: 수집 계층 구현 완료 (PR #558) · 소비 계층(대시보드) 설계 확정 · 배포 환경 실측 대기
>
> **관련**: Linear LIN-58(에러 바운더리) · LIN-59(에러 트래킹) · LIN-61/62(requestId·구조화 로깅) 일부 선반영
>
> 5분 요약만 필요하면 §1~§3, 스키마·보안·반론은 §6~§9, 결정 근거의 원자료는 §12 참고.

---

## 1. 요약 (TL;DR)

1. **에러와 API 사용 이력을 "쓰는 순간 구조화된 JSON 로그"로 남긴다.**
   전용 수집 서버(Sentry/Bugsink 류)는 만들지 않는다.
2. 저장·그룹핑·대시보드·알림은 **이미 존재하는 인프라가 담당한다** —
   stdout → Cloud Logging(Stackdriver) → Error Reporting(자동 그룹핑) / Grafana(패널·알림) → Slack.
3. FE가 새로 갖는 것은 **로거 1개, 수신 라우트 1개, fetch 래퍼 계측**뿐이다.
   신규 의존성 0, 신규 컨테이너 0, 타 팀 작업 0.

핵심 근거 3가지:

- **폐쇄망 제약**: FE 서버의 아웃바운드는 BFF·OAuth·인가 서버로 제한된다. 외부 SaaS(sentry.io)는 물론,
  임의 사내 호스트의 수집 서버로도 직접 전송할 수 없다. stdout 로그 수집은 플랫폼(로깅 에이전트)의 몫이라
  이 제약의 **밖**에 있다.
- **인프라가 이미 있다**: Stackdriver 수집, Grafana(GCP metric 데이터소스), Slack 알림이 이미 가능하다.
  없는 것은 "에러를 이 파이프에 넣는 부분"뿐이었다.
- **운영 인력이 없다**: 팀 규모(1~3인)에서 수집 서버의 백업·업그레이드·모니터링을 추가로 떠안는 것은
  얻는 가치 대비 손해다. (대안 비교는 §4)

---

## 2. 문제 정의 — 무엇을 측정해야 하는가

배포 전 상태:

| # | 문제 | 배포 후 일어날 일 |
|---|---|---|
| P1 | 에러 바운더리가 앱 전체에 1개 | 대부분의 렌더 에러에서 사용자는 **흰 화면**을 본다 |
| P2 | 에러 발생 사실이 어디에도 기록되지 않음 | 사용자가 신고하기 전까지 장애를 **인지조차 못 한다** |
| P3 | API 사용 기록 없음 | 장애 시 영향 범위 분석 불가, 기능별 사용량 분석 불가 |
| P4 | 에러와 요청을 잇는 상관관계 키 없음 | "이 사용자의 이 에러"를 서버 로그에서 못 찾는다 |

측정 목표 (이 아키텍처가 답해야 하는 질문):

1. **지금 에러가 나고 있는가?** — 실시간 알림 (Slack)
2. **어떤 에러가, 어디서, 얼마나?** — 그룹핑·페이지별 집계
3. **이 에러 직전에 사용자는 무엇을 했는가?** — 페이지·행동·직전 API 호출 체인
4. **어떤 API가 어떤 화면에서 얼마나 쓰이는가?** — 사용 이력
5. 위 질문에 **개발자가 아닌 운영자도** 접근할 수 있는가? — 대시보드

## 3. 제약 조건 (설계를 결정한 것들)

| 제약 | 내용 | 설계에 미친 영향 |
|---|---|---|
| C1 · 폐쇄망 | FE 서버 아웃바운드 = BFF·OAuth·인가 서버만. Slack·외부 SaaS·임의 사내 호스트 불가 | 수집 서버로의 직접 전송 자체가 불가능. "전송"이 아닌 "stdout 기록" 모델 강제 |
| C2 · FE는 얇게 | FE 서버에 저장소·집계·스케줄러 등 무거운 역할 금지 | FE 역할 = 구조화 로그 출력에서 종료. 저장/집계/알림은 전부 바깥 |
| C3 · 기존 인프라 | Stackdriver 수집 연동 존재, Grafana(GCP metric) 구성 가능, Slack은 BFF 망에서 가능 | 새로 만들 것이 거의 없음 — 파이프에 "올바른 형식으로 넣기"만 하면 됨 |
| C4 · PII 서비스 | 개인정보 탐지 도구라는 서비스 특성상 로그에 PII가 새면 그 자체가 사고 | body·쿼리스트링 절대 미기록 원칙 + 코드/테스트로 강제 (§7) |
| C5 · 소규모 팀 | 1~3인, 별도 SRE 없음 | 운영 부담이 0에 수렴하는 안만 채택 가능 |
| C6 · 사용자 규모 | 사용자가 많아질 수 있음 | 로그 "눈으로 뒤지기"로는 불충분 → 대시보드가 1급 요구 (§6.4), 집계는 스캔 없는 metric으로 (§8) |

## 4. 대안 비교 — 무엇을 검토했고 왜 접었나

2026-07-11 딥리서치(웹 조사 + 1차 자료 검증) 후 외부 모델(Codex gpt-5.6-sol) 교차 검증까지 마친 결과다.
상세 근거는 §12의 원자료 문서에 보존되어 있다.

| 대안 | 평가 | 탈락/채택 사유 |
|---|---|---|
| **Sentry SaaS** (sentry.io) | ❌ 불가 | C1 위반 — 브라우저도 서버도 sentry.io로 나갈 수 없다 |
| **Self-hosted Sentry** | ❌ 탈락 | 최소 16GB RAM + 컨테이너 ~50개(Kafka·ClickHouse·Snuba). C5에서 운영 불가능한 체급 |
| **Bugsink** (Sentry 호환 경량 수집 서버) | ⭕ 검증 완료 후 보류 | 기술적으론 최적 후보(단일 컨테이너+Postgres, 최신 SDK 호환, Slack 알림 내장)로 도입 절차까지 검증 완료. 그러나 ① C1 때문에 브라우저→수집기 직송이 불가해 수동 터널+BFF 중계 라우트가 필요하고 ② Sentry SDK의 내장 터널(`tunnelRoute`)은 소스 확인 결과 sentry.io 전용 하드코딩이라 우회 불가하며 ③ C3(파이프가 이미 존재)가 확인되면서, 컨테이너 2대 + 중계 2단의 순증 비용이 순증 가치를 넘지 못했다. **승격 경로로 보존** (§9) |
| **GlitchTip** | ❌ 탈락 | Bugsink과 같은 계열(더 무거움) — Bugsink 탈락 사유가 동일 적용 |
| **PostHog self-host** | ❌ 탈락 | 에러 인제스트가 셀프호스트에서 불안정(공개 이슈) + Sentry 프로토콜 미지원 + ClickHouse/Kafka 스택(16GB) |
| **로그 기반 (채택)** | ✅ 채택 | 신규 인프라 0 · C1~C6 전부 충족. 대가는 §9의 트레이드오프 2가지 |

> **판단 기준을 명시하면**: "기능이 가장 많은 안"이 아니라 "제약을 전부 만족하면서 측정 목표(§2)를
> 달성하는 가장 싼 안"을 골랐다. 기능 격차(소스맵 심볼리케이션, 이슈 관리)는 §9에서 정직하게 다룬다.

## 5. 아키텍처 — 데이터가 흐르는 길

```
[브라우저]
 ├─ 렌더 에러 / unhandled rejection ──→ 전역 핸들러 + 에러 바운더리
 │      └─ 리포트(페이지·행동·직전 호출 10건 포함)
 │         └─ POST /integration/api/v1/observability/client-errors   (같은 도메인 = C1 무관)
 └─ 모든 API 호출 ──→ fetchJson 단일 래퍼
        └─ X-Request-Id · X-Client-Page · X-Client-Action 헤더 부착

[FE 서버 (Next.js standalone)]
 ├─ 수신 라우트: 리포트 검증(허용 필드만·크기·rate) 후 ERROR 로그 1줄
 ├─ withV1(전 라우트 공통 래퍼): 요청마다 접근 로그 1줄, 예외·업스트림 5xx는 ERROR 로그
 └─ BFF 프록시: 검증된 컨텍스트 헤더를 BFF로 전달 (BFF 로그에도 같은 맥락이 남음)
        │
        ▼  stdout에 JSON 한 줄  ←—— FE의 역할은 여기서 끝. 아웃바운드 아님.
[플랫폼 로깅 에이전트] — 수집은 인프라의 몫
        ▼
[Cloud Logging (Stackdriver)] — 저장·검색·보존 (JSON → jsonPayload 필드 자동 인식)
 ├─→ [GCP Error Reporting]  severity≥ERROR + 스택 자동 그룹핑, 회귀 감지
 ├─→ [로그 기반 metric] → [Cloud Monitoring] → [Grafana 패널 + 알림 룰] → [Slack]
 └─→ (필요 시) [로그 sink → BigQuery]  장기 보존·SQL 분석 — 플랫폼 설정만으로 활성화
```

각 구성요소의 책임이 한 줄씩이라는 점이 이 설계의 요지다:
**FE = 올바른 형식으로 찍는다. 플랫폼 = 나른다. GCP = 쌓고 묶는다. Grafana = 보여주고 알린다.**

## 6. 상세 설계

### 6.1 L0 — 에러 처리 (사용자가 보는 것)

- **3단 에러 바운더리**: 세그먼트 바운더리(구간 격리) → 루트 `app/error.tsx`(9개 페이지 세그먼트 공통,
  기존 `ErrorState` 컴포넌트 재사용 + 다시 시도) → `app/global-error.tsx`(루트 레이아웃 자체가 죽었을 때의
  최후 방어선 — 자체 `<html>/<body>` + 인라인 스타일, CSS 로딩을 신뢰할 수 없는 조건이므로).
- **404**: `app/not-found.tsx`.
- **API 에러**: 서버가 ProblemDetails(RFC 9457)로 정규화 → 클라이언트 `AppError`(code·retriable·requestId)
  → 화면의 에러 UI가 처리. **raw 에러 메시지는 사용자에게 노출하지 않는다.**
- 모든 바운더리는 표시와 동시에 에러를 리포트한다(§6.2). 표시가 실패해도 리포트는 전역 핸들러가 백업.

### 6.2 L1 — 수집 (무엇이 기록되는가)

**원칙: 쓰는 순간 구조화.** 자유 텍스트를 나중에 파싱하는 게 아니라, 소스에서 고정 스키마 JSON을 찍는다.
출구는 `app/api/_lib/log.ts`의 `emit()` 하나뿐이다 — 스키마가 흩어질 수 없는 구조.

이벤트는 3종이 전부다.

**① 접근 로그** — 모든 API 요청마다 1줄 (INFO)

```json
{"severity":"INFO","message":"GET /api/v1/target-sources/123 200 34ms",
 "time":"2026-07-12T04:12:33.101Z","method":"GET",
 "path":"/api/v1/target-sources/123","pathTemplate":"/api/v1/target-sources/:id",
 "status":200,"durationMs":34,"requestId":"8f14e45f-ceea-4f31-b0c9-1a2b3c4d5e6f",
 "clientPage":"/integration/target-sources/123","pageTemplate":"/integration/target-sources/:id",
 "clientAction":"getTargetSourceDetail"}
```

**② 서버 에러** — 라우트 예외 + 업스트림 5xx (ERROR, message에 스택 전체 = Error Reporting 그룹핑 키)

```json
{"severity":"ERROR","message":"Error: connect ECONNREFUSED ...\n    at BffClient.get (...)",
 "time":"...","context":"bff-upstream","method":"POST",
 "path":"/api/v1/approval-requests","status":502,"requestId":"8f14e45f-..."}
```

**③ 브라우저 에러** — 수신 라우트 경유 (ERROR)

```json
{"severity":"ERROR","message":"TypeError: Cannot read properties of undefined ...\n    at ...",
 "time":"...","source":"browser","page":"/integration/target-sources/123",
 "pageTemplate":"/integration/target-sources/:id","type":"boundary","digest":"1234567890",
 "breadcrumbs":[{"method":"GET","path":"/integration/api/v1/target-sources/123",
   "status":200,"durationMs":41,"requestId":"..."} ],
 "requestId":"..."}
```

**컨텍스트("어떤 페이지에서 어떤 맥락으로")의 4중 장치:**

| 장치 | 값 | 정확도 근거 |
|---|---|---|
| `clientPage` / `page` | 호출/에러 **시점**의 `location.pathname` | 모든 JSON 호출이 `fetchJson` 단일 래퍼 경유 (점검으로 확인). 예외 2곳: ① terraform zip 다운로드(바이너리 — 정당한 예외, 주석 명시) ② 히스토리 패널 조회 1곳(선존 디자인 토큰 이슈로 이 PR에서 전환 불가 — 후속 tokenization PR에서 함께 해소, §11 참고) |
| `pageTemplate` / `pathTemplate` | ID 세그먼트를 `:id`로 정규화한 값 | 집계용 — 실경로는 ID마다 흩어지므로 "이 화면에서 에러 몇 건"은 이 필드로 묻는다. 원본도 함께 보존 |
| `clientAction` | API 레이어의 **함수명 자동 태깅** (예: `confirmInstallation`) | 호출부가 전부 `app/lib/api/*`의 이름 있는 함수라서, 함수가 자기 이름을 넘긴다. 화면 코드 수정 없음, 저카디널리티라 metric 라벨 가능 |
| `breadcrumbs` | 직전 API 호출 10건 링버퍼 | "에러 직전에 무엇을 했나"가 이벤트 안에 동봉 — 별도 조회 없이 원인 특정 |

**requestId 수명주기** — 상관관계의 축:

```
브라우저: fetchJson이 UUID 생성 → X-Request-Id 헤더
  → FE 서버: 형식 검증(정규식) 통과 시 채택, 아니면 새로 생성 → 접근/에러 로그에 기록
  → BFF: 검증된 값만 allowlist로 전달 → BFF 로그에도 동일 ID
  → 에러 응답: ProblemDetails.requestId로 클라이언트 회수 → 브라우저 리포트·breadcrumb에 포함
```

ID 하나로 "브라우저에서 본 에러 ↔ FE 접근 로그 ↔ BFF 로그"가 전 구간 이어진다.

### 6.3 L2 — 저장

- **Cloud Logging**: stdout JSON을 `jsonPayload`로 자동 인식. `jsonPayload.pageTemplate="/integration/target-sources/:id" AND severity>=ERROR`
  같은 필드 쿼리가 파싱 없이 동작한다. 기본 보존 30일.
- **장기 보존/분석이 필요해지면**: 로그 라우터 sink → BigQuery. **플랫폼 설정만으로 켜지며 앱 코드 0줄.**
  "월별 기능 사용 추이" 같은 SQL 분석은 이때 시작한다. 필요가 확인되기 전에 미리 만들지 않는다.

### 6.4 L3 — 소비 (누가 어떻게 보나)

| 소비자 | 답하는 질문 | 경로 | 상태 |
|---|---|---|---|
| Slack 알림 | "지금 에러 나는가?" | 로그 기반 metric(severity≥ERROR 카운트) → Grafana 알림 룰 | 설정 예정 (Phase 5) |
| Error Reporting | "무슨 에러가, 새 에러인가?" | 스택 자동 그룹핑·회귀 감지 | 배포 실측 대기 (V-3) |
| Grafana 패널 | "추이는? 어느 화면·API가 문제인가?" | metric 시계열 (`pageTemplate`·`clientAction`·`pathTemplate` 라벨) | 설정 예정 |
| **In-app admin 대시보드** | 운영자가 앱 안에서 직접 확인 | FE 서버 라우트 → Cloud Logging API(최근 에러 목록) + Cloud Monitoring API(집계) → 요약만 응답 | 설계 확정, V-5 확인 후 구현 |

**In-app 대시보드 MVP** (admin 하위 페이지 1개): ① 최근 에러 50건(시간·페이지·요약·requestId, ≤24h 창)
② 24h 에러 추이(브라우저/서버 분리) ③ API 사용 top-N(pathTemplate별 호출 수·p95 지연).
GCP 토큰과 원본 로그는 서버에만 있고 클라이언트에는 요약만 내려간다.

## 7. 보안과 PII — 이 서비스에서 가장 중요한 절

**위협 모델**: 브라우저 에러 수신 라우트는 성격상 공개·무인증 엔드포인트다. 위협은 ① 위조 리포트로
로그에 임의 데이터(PII 포함) 주입 ② 초대형 body로 메모리 압박 ③ 플러딩으로 로그 오염/비용 공격.

**구현된 방어** (외부 모델 교차 리뷰에서 지적받아 보강 후, 재검증에서 전 항목 해소 확인):

| 위협 | 방어 |
|---|---|
| 임의 필드 주입 | **엄격 allowlist 재구성** — 허용된 필드만, 알 수 없는/중첩 속성 폐기. breadcrumbs는 항목별로 재조립(≤10건, 필드별 타입·길이 검증, requestId 패턴 불일치 시 드랍) |
| 초대형 body | Content-Length 선차단 + UTF-8 **바이트 단위** 32KiB 캡 (문자 수 아님 — 멀티바이트 우회 차단) |
| 플러딩 | 클라이언트: 동일 메시지 30초 dedupe + 탭당 분당 10건 · 서버: 인스턴스당 분당 60건 캡 |
| PII 유출 | **요청/응답 body와 쿼리스트링은 어떤 로그에도 남기지 않는다.** 공용 새니타이저(`lib/log-path.ts`)가 모든 URL 로깅 지점에 강제되고 회귀 테스트로 잠금. 도입 과정에서 **기존 코드의 쿼리·body 로깅 누출 4곳도 함께 제거** (업스트림 502 응답 body에 쿼리 포함 URL이 노출되던 것 포함) |
| 에코백 | 수신 라우트는 입력을 응답에 되돌려주지 않음 (204/4xx 무본문) |

## 8. 규모 — 사용자가 많아지면

| 축 | 거동 |
|---|---|
| 로그 볼륨 | 요청당 1줄(수백 바이트). 접근 로그가 지배적이며 선형 증가 — Cloud Logging의 일반적 사용 범위 |
| 집계 쿼리 비용 | **일정.** 카운트·추이는 로그 기반 metric(수집 시점에 증분 집계)이라 조회가 원본을 스캔하지 않는다 |
| 상세 조회 비용 | 시간창 강제(≤24h)로 상한. 대시보드가 무제한 스캔을 만들 수 없는 구조 |
| metric 카디널리티 | 라벨은 저카디널리티만 — `pageTemplate`(수십), `clientAction`(수십~백), `pathTemplate`, `severity`, `source`. `requestId`·실경로는 라벨 금지(로그에만) |
| 리포트 폭주 | 스로틀+캡 기구현. 수천 명 규모에서 캡이 좁아지면 샘플링(예: 10%) 전환 — 상수 1곳 수정 |
| 장기 분석 | BigQuery sink 승격 (플랫폼 설정, §6.3) |

## 9. 트레이드오프와 한계 — 정직한 비용

Sentry 계열을 접으면서 **잃은 것 두 가지**와 완화책:

1. **브라우저 minified 스택의 자동 심볼리케이션 없음.**
   프로덕션 번들은 압축되어 스택의 파일·라인이 원본과 다르다.
   - 완화 ①: 리포트에 페이지·행동·직전 호출 10건이 동봉되므로 "어디서 무슨 에러"는 대부분 특정된다.
   - 완화 ②: 빌드별 소스맵을 아티팩트로 보관(이미지 미포함)하고, 필요한 스택만 `source-map` CLI로 수동 디코드.
   - 판단: 팀 규모·트래픽에서 이 작업의 빈도는 낮다. 빈도가 올라가면 아래 승격으로 해소.
2. **이슈 라이프사이클 관리 없음** (할당·해결 처리·재발 알림 워크플로).
   - 완화: Error Reporting의 자동 그룹핑·회귀 감지 + Grafana 알림이 하한선. 이슈 추적은 Linear로.

**승격 경로 (미리 만들지 않되, 문은 열어둔다)**: 위 갭이 실제로 아프면 Bugsink(경량 Sentry 호환 서버)를
BFF 망에 배치한다. 도입에 필요한 전부 — SDK 버전 하한(≥10.57), 내장 터널이 sentry.io 전용이라
수동 중계가 필요하다는 소스 검증, `release.create:false` 등 설정 함정, BFF 경유 경로(`/integration/observability/*`)
확보 — 가 §12 원자료에 검증 완료 상태로 보존되어 있다. 승격 시 L1 계측(이벤트·컨텍스트)은 그대로 재사용된다.

**이 설계가 표준에서 벗어난 방식인가?** — 아니다. "구조화 stdout 로그 + 플랫폼 수집 + Error Reporting"은
GCP가 공식 권장하는 운영 패턴이고, "로그를 이벤트 스트림으로 취급하고 실행 환경이 수집을 담당한다"는
12-factor 원칙 그대로다. 특수한 것은 우리 망 제약이지, 방식이 아니다.

## 10. 구현 현황과 품질 근거

**PR #558** (`feat/observability-log-based`), 신규 의존성 0.

| 묶음 | 파일 |
|---|---|
| 에러 바운더리 | `app/global-error.tsx` · `app/error.tsx` · `app/not-found.tsx` + 기존 바운더리 재시도 연결 |
| 구조화 로거 | `app/api/_lib/log.ts` (~30줄, 유일한 출구) + `handleUnexpectedError`/`withV1` 연결 |
| 브라우저 캡처 | `lib/client-error-report.ts` + `app/components/ObservabilityInit.tsx` + 수신 라우트 |
| 컨텍스트 | `lib/fetch-json.ts`(헤더 3종+링버퍼) · `lib/bff/http.ts`(검증 후 전달) · `app/api/_lib/request-id.ts` |
| PII 가드 | `lib/log-path.ts`(쿼리 제거·경로 템플릿) · `lib/observability-headers.ts`(검증·클램프) |

**품질 게이트**: 전 커밋 pre-commit(lint + tsc + 전체 테스트 + prod build) 통과, 최종 테스트 1,256+ green
(관측성 신규 테스트 ~70: 악성 breadcrumbs 거부, 멀티바이트 캡, 헤더 검증, 쿼리 미로깅, 5xx ERROR 승격,
스로틀 프루닝 등 방어 각각에 회귀 테스트).

**외부 교차 검증**: OpenAI Codex(gpt-5.6-sol, reasoning xhigh)가 독립 리뷰 2회 —
1차에서 Critical 4·Major 3·Minor 1 (PII 로그 주입 가능성, 바이트 캡 부정확 등) 지적 → 전부 수정 →
2차에서 전 항목 해소 확인. "우리가 우리 코드를 통과시킨" 것이 아니라 외부 모델이 반박을 시도한 결과다.

## 11. 롤아웃 계획

| 단계 | 내용 | 완료 기준 |
|---|---|---|
| 1 | PR #558 리뷰·머지 | 승인·머지 |
| 2 | 배포 후 실측 V-2·V-3 | prod 컨테이너의 테스트 에러가 Cloud Logging에 jsonPayload로 보이고, Error Reporting이 그룹으로 묶음 |
| 3 | Grafana 구성 (Phase 5) | 로그 기반 metric 정의 → 에러 패널 + 알림 룰. **테스트 에러 → Slack 수신** 확인 |
| 4 | V-5 확인 | FE 서버 → googleapis 도달성(Private Google Access) + 서비스계정 `logging.viewer`/`monitoring.viewer` |
| 5 | In-app 대시보드 MVP | §6.4의 3개 패널이 실데이터로 렌더 |
| 6 | 후속 소정리 | history/ 디렉토리 토큰화 PR과 함께 히스토리 패널의 `fetchJson` 미경유 1곳 전환 (§6.2 예외 ②) |
| 7 | 운영 점검 (2주 후) | 알림 노이즈 수준, 그룹핑 품질, 소스맵 수동 디코드 빈도 리뷰 → Bugsink 승격 여부 재평가 |

## 12. 결정 기록과 원자료

| 시점 | 결정 | 이유 |
|---|---|---|
| 07-10 (v1) | Sentry SDK + Bugsink 셀프호스트 설계, 딥리서치·외부 검증 완료 | 당시 가정: 관측성 인프라 부재 |
| 07-12 오전 (v2) | BFF 경유 + BFF 망 Bugsink로 수정 | FE 아웃바운드 제한(C1) 확인 |
| 07-12 (v3, 최종) | **로그 기반 채택** | Stackdriver·Grafana·Slack 존재(C3) 확인 → 전용 수집 서버의 순증 가치 소멸 |

원자료 (docs/error-tracking-plan 브랜치):

- `docs/feature/observability-via-bff.md` — 아키텍처 결정 전 과정 + Q&A 로그 3라운드 + 4층 모델
- `docs/feature/error-boundary-and-error-tracking-plan.md` — 초기 구현 가이드 + **Part D: 트래커 리서치 결과**
  (Bugsink/GlitchTip/Sentry/PostHog 비교, `@sentry/nextjs`×Next 16 호환성 검증, codex 교차 검증 판정)

## 13. 예상 반론 FAQ

**Q. 그냥 Sentry 쓰면 되는 것 아닌가?**
sentry.io는 폐쇄망에서 도달 불가(C1). 셀프호스트 Sentry는 16GB/컨테이너 ~50개로 팀 체급 초과.
경량 호환 서버(Bugsink)는 실제로 도입 직전까지 검증했으나, 망 제약 하에서 필요한 중계 구조(2단)와
컨테이너 운영 비용이, 이미 존재하는 파이프 대비 순증 가치를 만들지 못했다. §4·§9 참고 — 감정적 배제가
아니라 검증 후 보류이며 승격 절차가 보존되어 있다.

**Q. `console.log`가 로거인가? 너무 원시적이지 않나?**
stdout JSON 한 줄이 Cloud Logging 구조화 로깅의 **표준 인터페이스**다. pino를 넣어도 하는 일은 같다
(더 빠른 직렬화 + 편의 API). 의존성 0을 택했고, 출구가 한 함수라 pino 전환은 언제든 내부 교체로 가능하다.

**Q. 로그로 하면 나중에 파싱 지옥 아닌가?**
파싱할 것이 없다. 쓰는 순간 고정 스키마 JSON이고 Cloud Logging이 필드 단위로 인덱싱한다.
"파싱 지옥"은 자유 텍스트 로그의 문제다.

**Q. 사용자 늘면 로그 비용 폭발하지 않나?**
집계는 metric(스캔 없음), 상세 조회는 24h 창 강제라 조회 비용이 볼륨과 무관하다. 수집 볼륨은 요청당
1줄로 선형이며, 문제가 되는 시점이 오면 그것은 "관측성을 줄일" 신호가 아니라 BigQuery sink/샘플링으로
구조화할 신호다 (§8).

**Q. action 태깅은 유지보수 부담 아닌가?**
API 레이어 함수가 자기 이름을 넘기는 1줄이다. 화면 코드는 건드리지 않고, 새 API 함수를 만들 때
1줄 추가가 규칙의 전부다.

**Q. 브라우저 에러 수신 라우트가 공개 엔드포인트인데 위험하지 않나?**
§7의 위협 모델과 방어(allowlist 재구성·바이트 캡·이중 rate limit·무에코) + 각 방어의 회귀 테스트로 대응.
외부 모델 교차 리뷰에서 이 지점을 집중 공격받고 보강했다.

**Q. BFF에서 다 수집하면 되지 않나?**
API 사용 이력은 실제로 BFF에도 남는다(컨텍스트 헤더가 전달되므로). 그러나 브라우저 렌더 에러는
BFF에 도달할 사건 자체가 없고, BFF에 에러 수집 API·저장·대시보드를 새로 만드는 것은 이미 있는
파이프를 두고 더 큰 시스템을 짓는 일이다. BFF 팀 확인 결과 수집 인프라가 없다는 답을 받았다.
