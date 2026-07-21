# FE 관측성 전략 개요 — 무엇을, 어디에, 어떻게 쌓고 볼 것인가

> **목적**: GKE에 배포될 프론트엔드에서 "고객이 무엇을 했고, 어떤 에러가 났고, API를 얼마나 호출했는가"를
> 추적하는 전체 전략을 한 문서로 설명한다. 의사결정용 요약 문서이며, 구현 상세는
> `docs/feature/observability-plan.md`(PR #558 브랜치)에 있다.
>
> **작성일**: 2026-07-21 · **상태**: 전략 확정 제안 (수집 계층은 PR #558로 구현 완료·미머지)

---

## 1. 한 장 요약

요구는 성격이 다른 **3가지 관심사**로 나뉘고, 각각 정답이 다르다.

| # | 관심사 | 예시 질문 | 업계 표준 도구 | 우리 환경의 정답 | 상태 |
|---|---|---|---|---|---|
| ① | **에러·API 메트릭** (Observability) | "BFF는 정상인데 Next.js 파싱 에러가 났다" · "이 API 몇 번 호출됐나" | Sentry + Grafana | 구조화 로그 → Cloud Logging → Error Reporting / Grafana | ✅ **PR #558 구현 완료, 머지 대기** |
| ② | **방문·행동 추적** (Product Analytics) | "고객이 어느 페이지를 방문했나" · "어떤 버튼을 눌렀나" | PostHog / Amplitude | 같은 로그 파이프에 `page_view` 이벤트 추가 + 익명 sessionId | 🔲 소규모 확장 필요 |
| ③ | **고객별 행동 이력** (Audit Trail) | "고객 X가 타깃 Y에서 설치를 몇 번 시도했나" | 백엔드 DB 감사 테이블 | 단기: Cloud Logging 조회 / 장기: BFF·orchestrator 감사 테이블 | 🔲 단기는 ①로 커버, 장기는 BFF팀 협의 |

**왜 SaaS(Sentry/PostHog)를 안 쓰나**: FE 서버의 아웃바운드가 BFF·OAuth·인가 서버로 제한되는 폐쇄망이다.
2026-07-11 딥리서치 + 외부 모델 교차검증으로 Sentry SaaS/셀프호스트·Bugsink·GlitchTip·PostHog를 전부
검토한 뒤 로그 기반을 채택했다(근거: `observability-plan.md` §4). 이 방식은 GCP 공식 권장 패턴이자
12-factor 표준이며, 특수한 것은 우리 망 제약이지 방식이 아니다.

## 2. 데이터가 흐르는 길 (이미 구현된 부분)

```
[브라우저]
 ├─ 렌더 에러 / unhandled rejection → 에러 바운더리 + 전역 핸들러
 │     └─ 리포트(페이지·행동·직전 API 10건 동봉) → POST /observability/client-errors
 └─ 모든 API 호출 → fetchJson 단일 래퍼
       └─ X-Request-Id · X-Client-Page · X-Client-Action 헤더 자동 부착

[FE 서버 (Next.js, GKE)]
 ├─ withV1 공통 래퍼: 요청마다 접근 로그 1줄, 예외·업스트림 5xx는 ERROR 로그
 └─ BFF 프록시: 검증된 컨텍스트 헤더를 BFF로 전달 (BFF 로그에도 같은 맥락)
       ▼ stdout JSON 한 줄 — FE의 역할은 여기서 끝
[Cloud Logging (Stackdriver)]
 ├─→ Error Reporting: severity≥ERROR 스택 자동 그룹핑·회귀 감지
 ├─→ 로그 기반 metric → Cloud Monitoring → Grafana 패널·알림 → Slack
 └─→ (필요 시) BigQuery sink: 장기 보존·SQL 분석 (플랫폼 설정만으로 활성화)
```

모든 이벤트에 이미 붙는 컨텍스트:

- `clientPage` / `pageTemplate` — 호출 시점의 화면 (예: `/integration/target-sources/:id`)
- `clientAction` — API 레이어 함수명 자동 태깅 (예: `confirmInstallation`, 46개 함수 완료)
- `requestId` — 브라우저 ↔ FE 접근 로그 ↔ BFF 로그를 하나로 잇는 상관관계 키
- `breadcrumbs` — 에러 직전 API 호출 10건 링버퍼

"BFF API는 정상인데 Next.js 파싱에서 에러" 시나리오는 이 구조에서 정확히 잡힌다:
라우트의 zod 파싱 실패·예외는 `withV1`이 서버 ERROR 로그로, 브라우저 렌더·파싱 에러는
바운더리와 전역 핸들러가 리포트로 남긴다. 두 경우 모두 requestId로 BFF 로그와 대조하면
"BFF 응답은 200이었다"까지 확인된다.

## 3. Surface 구분 — integration/services vs 타깃 상세 vs Admin

**핵심 원리: API 경로가 아니라 "호출이 일어난 화면"으로 구분한다.**
같은 API(예: process-status 조회)가 고객 화면과 Admin 화면 양쪽에서 호출될 수 있으므로,
API 경로만 보면 두 트래픽이 섞인다. 구분 축은 이미 모든 이벤트에 붙는 `pageTemplate`이다.

현재 페이지 라우트를 surface로 분류하면:

| Surface | pageTemplate prefix | 화면 | 성격 |
|---|---|---|---|
| `customer` | `/` · `/services` | 홈, 서비스 목록 | 고객 셀프서비스 진입·탐색 |
| `target-detail` | `/target-sources/:id` | 타깃소스 상세 | **고객이 실제 작업을 수행하는 곳** — 설치·연결테스트·승인요청. 관측 우선순위 1위 |
| `admin` | `/admin/**` | 운영자 콘솔 (pipelines·queue·guides·services·targets) | 내부 운영자 트래픽 — 고객 지표에서 제외해야 함 |
| `dev` | `/api-docs` · `/swagger/*` | 개발 문서 | 지표에서 제외 |

**구현 (1함수 + 1필드)**: `pageTemplate`에서 surface를 파생하는 함수를 `lib/log-path.ts`에 추가하고,
접근 로그·에러 리포트·page_view 이벤트에 `surface` 필드로 실어 로그 기반 metric의 **라벨**로 쓴다.
4개 값뿐이라 저카디널리티 규칙(observability-plan.md §8)에 안전하다.

```ts
// lib/log-path.ts — pageTemplate은 이미 정규화되어 있으므로 prefix 매칭이면 충분
export function surfaceOf(pageTemplate: string): 'customer' | 'target-detail' | 'admin' | 'dev' {
  if (pageTemplate.startsWith('/admin')) return 'admin';
  if (pageTemplate.startsWith('/target-sources')) return 'target-detail';
  if (pageTemplate.startsWith('/api-docs') || pageTemplate.startsWith('/swagger')) return 'dev';
  return 'customer';
}
```

이 라벨 하나로 얻는 것:

1. **Grafana 패널·알림 분리** — `surface="target-detail"` 에러율에는 민감한 임계값(고객이 작업 중 실패),
   `surface="admin"`은 느슨한 임계값. "고객 대면 에러"와 "내부 콘솔 에러"의 온콜 우선순위가 다르다.
2. **사용량 지표의 순도** — Admin에서 운영자가 같은 API를 두드린 트래픽이 "고객 사용량"에 섞이지 않는다.
3. **폴링 노이즈 식별** — 타깃 상세의 설치/연결테스트 폴링(2초 간격)은 호출 수가 지배적이다.
   `clientAction` 라벨(예: `getInstallationStatus`)과 조합하면 "폴링 제외 실사용" 지표를 만들 수 있다.

인증이 붙은 뒤에는 역할(role)이 두 번째 구분축이 된다 — surface는 "어느 화면", role은 "누가".
운영자가 고객 화면을 열어본 트래픽까지 구분하려면 role이 필요하지만, 그 전까지는 surface로 충분하다.

## 4. Grafana vs In-app Admin — 역할 분담

| | Grafana | In-app Admin 대시보드 |
|---|---|---|
| 답하는 질문 | "지금 전체적으로 문제가 있나? 추이는?" | "**이 고객/이 타깃**에서 무슨 일이 있었나?" |
| 데이터 | 로그 기반 metric (저카디널리티 라벨: surface·pageTemplate·clientAction·severity) | FE 서버 라우트 → Cloud Logging/Monitoring API 조회 (원본 로그, 24h 창) |
| 사용자 | 개발자·운영자 (알림은 Slack으로) | 운영자 — 앱 안에서 도메인 맥락과 함께 |
| 예시 패널 | surface별 에러율 · API top-N · p95 지연 · 폴링 실패율 | 최근 에러 50건 · 24h 추이 · 타깃소스별 최근 API 호출 이력 |

**하지 말 것**: 고객별/타깃별 조회를 Grafana에 넣는 것. requestId·실경로·타깃 ID는 고카디널리티라
metric 라벨로 쓰면 비용이 폭발하고, Grafana는 도메인 엔티티(타깃소스·승인상태)와 join하지 못한다.
개별 드릴다운은 Admin 페이지의 몫이다 — 로그에 실경로(`/target-sources/123`)가 남으므로
Cloud Logging API를 타깃 ID로 필터하면 "이 타깃의 최근 활동"을 코드 변경 없이 조회할 수 있다.

## 5. "고객이 뭘 했나"의 최종 거처 — 감사 이력은 로그가 아니다

Cloud Logging은 기본 보존 30일이고 트랜잭션 보장이 없다. "고객 X가 언제 설치를 승인했나" 같은
질문에 6개월 뒤에도 답해야 한다면, 그것은 관측성 데이터가 아니라 **도메인 데이터**다.

- **지금**: FE가 이미 `X-Client-Action`·`X-Request-Id`를 BFF로 전달 중 → BFF 로그에도 맥락이 남는다.
- **중기**: BigQuery sink를 켜면 로그가 30일 넘게 보존되고 SQL 분석 가능 (플랫폼 설정, 코드 0줄).
- **장기(정답)**: BFF/orchestrator에 감사 테이블(누가·언제·무엇을·어느 타깃에·결과) — BFF팀 협의 필요.
  FE 쪽 준비는 이미 끝나 있어, 테이블이 생기면 헤더로 전달 중인 맥락이 그대로 기록 원천이 된다.

## 6. 로드맵

| 단계 | 내용 | 규모 | 전제 |
|---|---|---|---|
| 1 | **PR #558 리뷰·머지 + 배포 실측** — 테스트 에러가 Cloud Logging→Error Reporting에 잡히는지 확인 | 리뷰만 | — |
| 2 | **Grafana 구성** — 로그 기반 metric 정의 → surface별 에러 패널 + 알림 룰 → Slack 수신 확인 | 플랫폼 설정 | 1 |
| 3 | **`surface` 필드 + `page_view` 이벤트 + 익명 sessionId** — 방문 추적 시작 | 소 (수십 줄) | 1 |
| 4 | **In-app Admin 대시보드 MVP** — 최근 에러 50건·24h 추이·API top-N + 타깃소스별 활동 이력 탭 | 중 | FE→googleapis 도달성(V-5) |
| 5 | **인증 연동** — 서버 라우트에서 세션→userId를 로그에 추가 (클라이언트 헤더는 위조 가능하므로 서버에서 resolve) | 소 | 인증 도입 (~1개월) |
| 6 | **BFF 감사 테이블 협의** — 30일 이상 보존할 고객 행동 이력의 최종 거처 | 협의 | BFF팀 |

## 7. 참고 문서

- `docs/feature/observability-plan.md` (PR #558 브랜치) — 아키텍처 상세·대안 비교·위협 모델·PII 가드·FAQ
- `docs/feature/observability-via-bff.md` (docs/error-tracking-plan 브랜치) — 결정 과정 원자료
- Linear LIN-58(에러 바운더리) · LIN-59(에러 트래킹) · LIN-55~72(운영 배포 준비)
