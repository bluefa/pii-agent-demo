# FE 관측성 구현 계획 — 아키텍처와 작업 목록

> **목적**: 전략 문서(`observability-strategy-overview.md`)에서 확정한 방향을 실행 가능한 작업 단위로 분해한다.
> 각 작업에 대상 파일·검증 기준·전제 조건을 명시하여 그대로 착수할 수 있게 한다.
>
> **작성일**: 2026-07-21 · **선행 문서**: 전략 = `observability-strategy-overview.md` ·
> 수집 계층 상세 = `observability-plan.md` (PR #558 브랜치)

---

## 1. 아키텍처 — 4계층 모델

전체 시스템은 4개 계층으로 나뉘고, **FE가 소유하는 것은 L0·L1과 L3의 일부(Admin 화면)뿐**이다.
L2(저장·집계)는 전부 기존 GCP 인프라가 담당한다 — FE에 저장소·스케줄러를 두지 않는다(FE-thin 원칙).

| 계층 | 책임 | 소유 | 구성요소 |
|---|---|---|---|
| **L0 · 에러 처리** | 사용자에게 복구 가능한 UI를 보여준다 | FE | 에러 바운더리 3단(`global-error`/`error`/세그먼트) + `not-found` |
| **L1 · 수집** | 쓰는 순간 구조화된 JSON을 stdout에 찍는다 | FE | `fetchJson` 헤더 3종 + 링버퍼 · `withV1` 접근/에러 로그 · 브라우저 리포트 수신 라우트 · `log.ts`(유일한 출구) |
| **L2 · 저장·집계** | 수집·보존·그룹핑·증분 집계 | 플랫폼/GCP | 로깅 에이전트 → Cloud Logging → Error Reporting / 로그 기반 metric → Cloud Monitoring |
| **L3 · 소비** | 사람이 보고 판단한다 | Grafana + FE | Grafana 패널·알림→Slack · In-app Admin 대시보드(서버 라우트가 GCP API 조회) |

### 데이터 흐름

```
[브라우저]
 ├─ 렌더 에러/unhandled rejection → 바운더리+전역 핸들러
 │    └─ 리포트(페이지·행동·직전 API 10건) → POST /observability/client-errors
 ├─ (확장) 라우트 전환 → page_view 이벤트 → POST /observability/events
 └─ 모든 API 호출 → fetchJson 단일 래퍼
      └─ X-Request-Id · X-Client-Page · X-Client-Action (+확장: X-Session-Id)

[FE 서버 (Next.js standalone, GKE)]
 ├─ withV1: 요청마다 접근 로그 1줄 (INFO) · 예외/업스트림 5xx는 ERROR
 ├─ 수신 라우트: 엄격 allowlist·바이트 캡·rate limit 후 로그 1줄
 └─ BFF 프록시: 검증된 컨텍스트 헤더를 BFF로 전달
      ▼ stdout JSON 한 줄 — FE의 역할은 여기서 종료 (아웃바운드 아님)
[Cloud Logging]
 ├─→ Error Reporting (severity≥ERROR 스택 그룹핑·회귀 감지)
 ├─→ 로그 기반 metric → Cloud Monitoring → Grafana → Slack
 └─→ (필요 시) BigQuery sink — 30일 초과 보존·SQL 분석

[In-app Admin]  FE 서버 라우트 → Cloud Logging/Monitoring API → 요약만 클라이언트로
```

### 설계 원칙 (모든 작업에 적용)

1. **FE-thin**: FE는 로그를 "올바른 형식으로 찍는 것"까지만. 저장·집계·알림은 바깥.
2. **PII 제로**: 요청/응답 body·쿼리스트링은 어떤 로그에도 남기지 않는다. 모든 URL 로깅은
   `lib/log-path.ts` 새니타이저 경유 + 회귀 테스트로 잠금.
3. **카디널리티 규율**: metric 라벨은 저카디널리티만(`surface`·`pageTemplate`·`clientAction`·`severity`·`source`).
   `requestId`·실경로·타깃 ID는 라벨 금지 — 로그에만 남기고 드릴다운은 Admin이 담당.
4. **공개 엔드포인트 방어**: 브라우저발 수신 라우트는 무인증이므로 allowlist 재구성·바이트 캡·
   이중 rate limit·무에코를 유지한다. 새 이벤트 종류를 추가해도 같은 방어를 적용.
5. **surface 구분**: API 경로가 아니라 "호출이 일어난 화면"(`pageTemplate`)에서 파생한다.
   `customer`(`/`·`/services`) · `target-detail`(`/target-sources/:id`) · `admin`(`/admin/**`) · `dev`(`/api-docs`·`/swagger`).

---

## 2. 작업 목록

작업은 6개 Phase로 나뉜다. Phase 0→2가 크리티컬 패스(이것만으로 "에러를 신고 전에 아는" 상태 도달),
3~4가 이번 요구의 본체(행동 추적 + Admin 화면), 5~6은 외부 의존이 있는 후속이다.

### Phase 0 — PR #558 머지 (전제 조건, 다른 모든 작업의 선행)

| # | 작업 | 상세 |
|---|---|---|
| 0-1 | PR #558 리뷰·머지 | 수집 계층 전체(바운더리·로거·수신 라우트·헤더·PII 가드)가 이 PR에 있다. 테스트 1,256+ green, 외부 모델 교차 리뷰 2회 완료 상태. 리뷰 관점: PII 미로깅 원칙 위반 여부, 수신 라우트 방어, basePath(`/integration`) 경로 정합 |
| 0-2 | 머지 후 관련 브랜치 정리 | `docs/error-tracking-plan`(원자료)은 보존, 데모/실험 브랜치 정리 |

**완료 기준**: main에 머지, 전체 테스트 green.

### Phase 1 — 배포 실측 (코드 0줄, 플랫폼 확인)

| # | 작업 | 상세 | 검증 기준 |
|---|---|---|---|
| 1-1 | GKE 배포 후 stdout→Cloud Logging 인식 확인 (V-2) | 컨테이너 stdout의 JSON 한 줄이 `jsonPayload` 필드로 파싱되는지. 로깅 에이전트가 severity 필드를 로그 레벨로 매핑하는지 | 테스트 요청 1건의 접근 로그를 `jsonPayload.requestId` 필드 쿼리로 조회 성공 |
| 1-2 | Error Reporting 그룹핑 확인 (V-3) | 의도적 테스트 에러(서버 throw 1건 + 브라우저 리포트 1건) 발생 → Error Reporting 콘솔에서 그룹 생성 확인 | 두 에러가 각각 그룹으로 잡히고 스택이 보임 |
| 1-3 | 로그 보존·볼륨 베이스라인 기록 | 일일 로그 볼륨(GB)·요청 수를 1주 관찰, 향후 샘플링 판단 기준으로 문서화 | 수치가 이 문서 부록에 기록됨 |

**완료 기준**: 실제 에러가 "발생 → Cloud Logging → Error Reporting 그룹"으로 이어지는 것을 실측.

### Phase 2 — Grafana + Slack (플랫폼 설정, 코드 0줄)

| # | 작업 | 상세 | 검증 기준 |
|---|---|---|---|
| 2-1 | 로그 기반 metric 정의 | ① `fe_error_count` — 필터 `severity>=ERROR`, 라벨 `source`(browser/server)·`pageTemplate` ② `fe_api_request_count` — 접근 로그, 라벨 `pathTemplate`·`clientAction`·`status` ③ `fe_api_latency` — distribution, `durationMs` 추출 | Metrics Explorer에서 3개 metric 조회됨 |
| 2-2 | Grafana 데이터소스·권한 (U-1) | GCP Monitoring 데이터소스 연결, 팀 조회 권한 | 패널에서 metric 시계열 렌더 |
| 2-3 | 대시보드 v1 (패널 4종) | ① surface별 에러 추이(24h) ② 에러율(에러/요청) ③ API 호출 top-N (`clientAction`) ④ p95 지연 (`pathTemplate`별). ※ surface 라벨은 Phase 3-1 전까지 `pageTemplate` prefix 매칭으로 대체 | 실데이터로 4패널 렌더 |
| 2-4 | 알림 룰 2종 → Slack | ① 고객 대면: `pageTemplate=~"/target-sources.*"` ERROR 5분 N건 초과(민감) ② 전체: ERROR 급증(느슨). Slack 채널은 BFF 망 경유 가능 확인됨 | 테스트 에러 → Slack 메시지 실수신 |

**완료 기준**: 테스트 에러 1건이 5분 내 Slack에 도착.

### Phase 3 — FE 코드 확장: surface · page_view · sessionId (이번 요구의 본체 ①)

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 3-1 | `surface` 필드 | `lib/log-path.ts`(+`surfaceOf()`) · `app/api/_lib/log.ts`(AccessFields) · `app/api/_lib/handler.ts` · 수신 라우트 | `pageTemplate`에서 prefix 매칭으로 4값 파생(`customer`/`target-detail`/`admin`/`dev`), 접근 로그·에러 리포트에 필드 추가. Phase 2-1 metric 라벨에 승격 | 단위 테스트(경로별 매핑) + 로그 라인에 필드 확인 |
| 3-2 | 익명 `sessionId` | `lib/fetch-json.ts` · `lib/observability-headers.ts` · `lib/bff/http.ts` allowlist | 탭 세션 단위 UUID를 `sessionStorage`에 생성·보관, `X-Session-Id` 헤더로 부착. 서버는 형식 검증(UUID 정규식) 후 로그 필드로. **PII 아님**(익명 난수) — 인증 도입 전 "같은 사용자의 연속 행동"을 잇는 유일한 키 | 헤더 검증 테스트 + 위조 값 드랍 테스트 |
| 3-3 | `page_view` 이벤트 | `app/components/ObservabilityInit.tsx` · 신규 `app/api/v1/observability/events/route.ts` (또는 기존 client-errors 라우트 확장) | App Router 라우트 전환 감지(`usePathname` 변화) → `{event:"page_view", pageTemplate, surface, sessionId}` INFO 이벤트 전송. 수신 라우트는 기존 client-errors와 동일 방어(allowlist·바이트 캡·rate limit·무에코) 적용. 로그 기반 metric `fe_page_view_count` 추가 | 라우트 전환 시 이벤트 1건, 새로고침 시 중복 없음, 방어 회귀 테스트 |
| 3-4 | 방어 상수 재점검 | `lib/client-error-report.ts` | page_view가 추가되면 탭당 분당 캡(현재 10건)이 좁을 수 있음 — 이벤트 종류별 캡 분리 | 폴링·라우트 전환 연타 시나리오 테스트 |

**완료 기준**: Cloud Logging에서 `sessionId` 하나로 "방문 → 조회 → 동작 → (에러)"가 시간순으로 조회됨.
**규모**: 소(~200줄 + 테스트). **전제**: Phase 0.

### Phase 4 — In-app Admin 대시보드 MVP (이번 요구의 본체 ②)

**전제 V-5**: FE 서버 → `googleapis` 도달성(Private Google Access) + 서비스계정에
`roles/logging.viewer`·`roles/monitoring.viewer`. **이것부터 인프라팀에 확인** — 불가하면 Phase 4 전체가
Grafana 단독 소비로 대체된다(화면은 포기, 데이터는 동일).

| # | 작업 | 대상 파일 | 상세 | 검증 기준 |
|---|---|---|---|---|
| 4-1 | GCP 조회 어댑터 | 신규 `lib/gcp/logging.ts` · `lib/gcp/monitoring.ts` | Cloud Logging `entries.list`·Monitoring `timeSeries.list` 호출. 24h 창 강제(무제한 스캔 구조적 차단), 페이지 크기 캡, 타임아웃. 토큰은 서버 전용(클라이언트 노출 금지) | 모킹 테스트 + 24h 초과 요청 거부 테스트 |
| 4-2 | Admin API 라우트 3종 | 신규 `app/api/v1/admin/observability/{recent-errors,error-trend,api-usage}/route.ts` | ① 최근 에러 50건(시각·source·surface·pageTemplate·요약·requestId) ② 24h 추이(browser/server 분리) ③ API top-N(호출 수·p95). 원본 로그는 서버에서 요약으로 축약 후 응답 | 계약 테스트(응답 스키마) |
| 4-3 | Admin 화면 | 신규 `app/admin/observability/page.tsx` + `_components/` | 기존 admin 패턴(theme.ts 토큰·한국어 UI) 준수. 에러 목록 → 행 확장 시 breadcrumbs·requestId 체인 표시 | 목업 모드(`USE_MOCK_DATA`)로 렌더 + 실데이터 확인 |
| 4-4 | 타깃소스 활동 이력 | `app/admin/pipelines/targets/[targetSourceId]/` 탭 추가 또는 4-3 하위 뷰 | `jsonPayload.path=~"/target-sources/{id}"` 필터로 해당 타깃의 접근/에러 로그 시간순 표시 — "고객이 언제 무엇을 했나" 재구성 | 타깃 1건의 확정→폴링→에러 흐름이 화면에 재구성됨 |
| 4-5 | 접근 통제 (임시) | 4-2 라우트 | 인증 도입 전 과도기: 내부망 전제 + admin 경로 분리. 인증 도입 시 Phase 5-2에서 role 검사로 교체 | — |

**완료 기준**: 운영자가 GCP 콘솔 없이 Admin 화면에서 "최근 에러 → 상세 → 해당 타깃 이력"까지 도달.
**규모**: 중(~4개 파일 신규 + 화면). **전제**: Phase 0·1, V-5.

### Phase 5 — 인증 연동 (인증 도입 ~1개월 후)

| # | 작업 | 상세 |
|---|---|---|
| 5-1 | 로그에 `userId` 추가 | 서버 라우트에서 세션→userId를 resolve해 접근/에러 로그 필드로 추가. **클라이언트가 보내는 userId 헤더는 채택 금지**(위조 가능) — 서버 세션이 유일한 진실. sessionId는 유지(로그인 전 구간 연결용) |
| 5-2 | Admin 화면 인가 | 4-5의 임시 통제를 role 검사로 교체(운영자 role만 접근) |
| 5-3 | Admin 검색 축 추가 | 사용자별 필터("이 사용자의 최근 활동") — 로그의 userId 필드 기반 |

### Phase 6 — BFF 감사 테이블 협의 (외부 의존)

| # | 작업 | 상세 |
|---|---|---|
| 6-1 | 요구사항 정리·협의 | 30일 초과 보존이 필요한 도메인 이벤트 목록(설치 확정·승인 요청·연결 테스트 등)과 스키마(누가·언제·무엇을·어느 타깃에·결과) 제안. FE는 이미 `X-Client-Action`·`X-Request-Id`·(3-2 후) `X-Session-Id`를 BFF로 전달 중 — **FE 추가 작업 없음**, 기록 원천은 BFF가 이미 받는 헤더 |
| 6-2 | (대안) BigQuery sink | 협의가 길어지면 로그 라우터 sink로 30일 초과 보존을 먼저 확보(플랫폼 설정, 코드 0줄). 단, 도메인 join은 여전히 불가 — 임시방편임을 명시 |

---

## 3. 의존 관계와 순서

```
Phase 0 (PR #558 머지)
  ├─→ Phase 1 (배포 실측) ─→ Phase 2 (Grafana·Slack)     ← 크리티컬 패스: 여기까지가 "신고 전에 아는" 상태
  ├─→ Phase 3 (surface·page_view·sessionId)               ← 코드 작업, Phase 1·2와 병행 가능
  └─→ Phase 4 (Admin MVP)                                  ← V-5 확인 선행, Phase 3의 surface 필드 활용
Phase 5 (인증 연동)  ← 인증 도입 후
Phase 6 (BFF 감사 테이블)  ← 협의 개시는 지금부터 가능 (완성 의존성 없음)
```

**권장 착수 순서**: 0 → (1‖3) → 2 → 4 → 5·6.
V-5(googleapis 도달성)와 6-1(BFF 협의)은 코드와 무관하게 **지금 바로 시작할 수 있는 확인 작업**이다.

## 4. 하지 않는 것 (명시적 스코프 아웃)

- **전용 수집 서버**(Sentry/Bugsink/PostHog 셀프호스트) — 검증 후 보류, 승격 경로만 보존 (`observability-plan.md` §9)
- **OpenTelemetry 분산 트레이싱** — requestId 상관관계가 경량 대체. 트레이스가 실제로 아쉬워지면 재평가
- **고카디널리티 metric** — 타깃별/사용자별 집계를 Grafana에 넣지 않는다. 드릴다운은 Admin(로그 조회)의 몫
- **세션 리플레이·히트맵** — 요구에 없음. page_view + clientAction으로 행동 흐름은 충분히 재구성됨
- **클라이언트 소스맵 심볼리케이션 자동화** — 수동 디코드로 시작, 빈도가 올라가면 Bugsink 승격 신호

## 5. 참고

- 전략·surface 설계 근거: `docs/feature/observability-strategy-overview.md`
- 수집 계층 상세(스키마·위협 모델·FAQ): `docs/feature/observability-plan.md` (PR #558 브랜치)
- 시각 자료: `docs/feature/observability-implementation-plan.html` (이 문서의 HTML 판)
- Linear: LIN-58 · LIN-59 · LIN-55~72 (운영 배포 준비)
