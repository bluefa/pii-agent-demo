# FE 관측성 전략 개요 — 무엇을, 어디에, 어떻게 쌓고 볼 것인가

> **목적**: GKE에 배포될 프론트엔드에서 "고객이 무엇을 했고, 어떤 에러가 났고, API를 얼마나 호출했는가"를
> 추적하는 전체 전략을 한 문서로 설명한다. 의사결정용 요약 문서이며, 실행 계획은
> `observability-implementation-plan.md`, 수집 계층 구현 상세는 `observability-plan.md`(PR #558 브랜치)에 있다.
>
> **작성일**: 2026-07-21 · **개정**: 2026-07-22 — 저장소를 Cloud Logging에서 **BFF DB로 변경**(결정 ①),
> 인증 전제·sessionId 제거·필드 정책·인가 거부 추적 반영. **상태**: 전략 확정 제안

---

## 1. 확정 결정 (2026-07-22)

| # | 결정 | 원래 설계에서 바뀐 것 | 이유 |
|---|---|---|---|
| ① | **FE 로그는 BFF로 전송, BFF가 자체 DB에 저장** | stdout → Cloud Logging(FE 프로젝트 적재) 폐기 | FE가 서로 다른 GCP 프로젝트로 **최소 2회 마이그레이션** 예정. stdout 방식이면 이사할 때마다 저장소·metric·알림 재구성 + 히스토리 단절. BFF는 마이그레이션하지 않는 **고정점** |
| ② | **인증 전제 + 로그인 필수** | "인증 전 익명 구간" 개념 제거 | 로그인 없이는 페이지 접근 자체가 불가. userId는 **서버가 세션에서 resolve**(클라이언트가 보내는 userId는 신뢰 금지) |
| ③ | **sessionId 완전 제거** | Phase 3의 익명 sessionId·`X-Session-Id` 헤더 삭제 | 로그인 필수라 로그인 전 구간이 존재하지 않음 → sessionId가 메울 공백이 0. userId가 상위 호환. SSR 예외 처리도 통째로 사라짐 |
| ④ | **세션 리플레이 안 함** | (기존 스코프 아웃 재확인) | "그때 화면 재현"은 불필요. "무엇을 했는지(행동 흐름)"만 알면 충분 |
| ⑤ | **Grafana는 결정 보류** | Phase 2(Grafana 구성)를 확정 작업에서 후보로 강등 | "정보를 push로 알려줘야 하는지"부터 결정 필요. 후보 구성은 §6에 보존 |

**트레이드오프 인지(결정 ①)**: stdout 무부하 → 네트워크 전송 부하 발생(배치·비동기로 완화),
best-effort 유실 허용, Error Reporting의 자동 그룹핑·회귀 감지와 로그 기반 metric을 잃음 →
그룹핑·집계·알림은 BFF DB 쿼리로 직접 구성해야 한다.

## 2. 데이터가 흐르는 길 (개정)

수집 로직(스키마·PII 가드·컨텍스트 헤더·surface)은 PR #558 것을 그대로 재사용하고,
**유일한 출구인 `log.ts`의 전송부만 교체**한다.

```
[브라우저]
 ├─ 렌더 에러 / unhandled rejection → 에러 바운더리 + 전역 핸들러
 │     └─ 리포트(페이지·행동·직전 API 10건 동봉) → POST /observability/client-errors (FE 라우트)
 └─ 모든 API 호출 → fetchJson 단일 래퍼
       └─ X-Request-Id · X-Client-Page · X-Client-Action 헤더 자동 부착

[FE 서버 (Next.js, GKE — 프로젝트 이동 예정, 상태 없음)]
 ├─ withV1 공통 래퍼: 요청마다 접근 이벤트 1건, 예외·업스트림 5xx·인가 거부(403)는 ERROR/WARN
 ├─ 세션 → userId·role resolve (인증 도입 후) — 이벤트에 서버가 심음
 └─ log.ts(유일한 출구, 싱크 2개 — ADR-025 §5):
       ├─▶ emitAudit: audit 이벤트 6종(+403) → 배치·비동기 → [BFF (고정점)] ingest API → 자체 DB 저장
       │     — 구조화 필드만, 보존·삭제 정책은 BFF 소유
       └─▶ emitDiagnostic: withV1 접근 기록·예외/업스트림 5xx·상세 스택 → stdout 진단 로그만
             — Cloud Logging 30일, 이사 시 소멸 허용, audit 행 아님(requestId로만 연결)

[소비]
 ├─ In-app Admin: FE 서버 라우트 → BFF 조회 API → 도메인 데이터와 join해 표시
 └─ (보류) Grafana: BFF DB를 SQL 데이터소스로 직접 연결 — 집계·알림 push용
```

**저장소가 2개인 이유** — 역할이 다르다:

| 저장소 | 무엇을 | 특성 |
|---|---|---|
| **BFF DB** (본선) | 구조화 필드만 — `actor.userId`·`surface`·`action.name`·`action.status`·`error.code`·`correlation.requestId` 등 (ADR-025 봉투; `X-Client-Action`/`clientAction`·`pageTemplate`는 수집 계층 헤더/진단 명칭) | 영구적(정책 삭제), 조회·집계·도메인 join 가능, FE 이사와 무관 |
| **stdout 진단 로그** (보조) | 새니타이즈된 스택 등 상세 진단 | 30일 만료, FE 프로젝트 종속, 유실 허용 — requestId로 DB 레코드와 대조 |

## 3. 상관관계 키와 구분 축

키는 **2개**, 구분 축도 **2개**다. sessionId는 없다(결정 ③).

| 키/축 | 무엇 | 신뢰 원천 |
|---|---|---|
| `userId` | "이 사람이 누구고 뭘 했나" — 여러 탭·기기를 묶음 | **서버가 세션에서 resolve** (클라이언트 헤더 채택 금지) |
| `requestId` | "이 호출이 브라우저→FE→BFF에서 어떻게 흘렀나" | 요청마다 생성(위조돼도 무해), SSR·CSR·BFF 관통 |
| `surface` | 어느 화면에서 일어난 일인가 | `pageTemplate` prefix에서 파생 (아래) |
| `role` | 누가 — 운영자가 고객 화면을 본 트래픽까지 구분 | 서버 세션 (인증 도입 후) |

관계: `userId(사람) ⊃ requestId(요청)`.

### Surface 구분 — integration/services vs 타깃 상세 vs Admin

**API 경로가 아니라 "호출이 일어난 화면"으로 구분한다.** 같은 API(예: process-status)가
고객 화면과 Admin 양쪽에서 호출되므로 경로만 보면 트래픽이 섞인다.

| Surface | pageTemplate prefix | 성격 |
|---|---|---|
| `customer` | `/` · `/services` | 고객 셀프서비스 진입·탐색 |
| `target-detail` | `/target-sources/:id` | **고객이 실제 작업을 수행하는 곳** — 관측 우선순위 1위 |
| `admin` | `/admin/**` | 내부 운영자 트래픽 — 고객 지표에서 제외 |
| `dev` | `/api-docs` · `/swagger/*` | 지표에서 제외 |

```ts
// lib/log-path.ts — pageTemplate은 이미 정규화되어 있으므로 prefix 매칭이면 충분
export function surfaceOf(pageTemplate: string): 'customer' | 'target-detail' | 'admin' | 'dev' {
  if (pageTemplate.startsWith('/admin')) return 'admin';
  if (pageTemplate.startsWith('/target-sources')) return 'target-detail';
  if (pageTemplate.startsWith('/api-docs') || pageTemplate.startsWith('/swagger')) return 'dev';
  return 'customer';
}
```

## 4. 필드 정책 — 무엇을 저장하고 무엇을 저장하지 않나

에러 응답 처리의 원칙 (PII 제로):

| 필드 | 성격 | BFF DB 저장 | 근거 |
|---|---|---|---|
| `status` | 숫자 | ✅ 항상 | 안전 |
| `code` | 고정 심볼 | ✅ 있으면 (분류·집계·알림 라벨) | 안전 |
| `errorMessage` | **자유 텍스트** | ❌ **저장 금지** | 사용자 입력·이메일·내부 경로가 섞여 들어올 수 있음 — 진단 stdout 로그에도 새니타이즈 후 최소한만 |
| `error.name` | 고정 심볼 | ✅ **저장 확정 (ADR-025)** | 이벤트 필드 매트릭스가 에러 이벤트에 필수로 요구 — 알려진 에러 클래스 allowlist 검증, 미지값은 `Error` |
| `fingerprint` | 새니타이즈 스택 해시 | 🔲 **저장 권고 (결정 필요)** | 같은 error.name의 code 없는 에러(502·타임아웃·파싱)를 더 세분할 유일한 키. 해시는 자유 텍스트가 아니라 안전 |
| body · 쿼리스트링 | — | ❌ 어떤 로그에도 금지 | `lib/log-path.ts` 새니타이저 + 회귀 테스트로 잠금 |

code 없는 에러는 DB엔 `status`·`requestId`·`error.name`(+ 권고안 채택 시 `fingerprint`)만 남기고,
상세는 진단 로그로만 흘린다. requestId로 BFF 로그 대조는 여전히 가능.

## 5. 무엇이 추적되나 — 되는 것 / 구현이 필요한 것

**확실히 되는 것**: surface로 화면 구분(같은 API라도) · 누가·어떤 API·어떤 페이지(`actor.userId`·`action.name`·`page.template`) ·
서버발/브라우저발 에러와 requestId로 BFF 대조("FE 에러인데 BFF는 200") · 타깃소스/고객 단위 조회 ·
행동 흐름 시간순 재구성 · **CTA(쓰기) 실패 추적**(`action.name`+`action.status`+`correlation.requestId` — "쓰기가 진짜 됐나") ·
**인가 거부(403) 시도**(로그인은 했지만 권한 없는 경로 접근 — 서버 인가 검사 시점에 userId·role·경로·403 기록)

**구현이 따로 필요한 것(자동 아님)**:
- **SSR 에러의 화면 식별** — SSR엔 `X-Client-Page`가 없으므로 서버가 자기 렌더 경로를 직접 심어야 함
- **페이지 수준 인가 거부** — API 라우트(withV1)는 자동으로 잡히지만, 페이지 접근 자체를 막는
  middleware/SSR 가드의 거부는 별도 로깅 코드가 필요
- **"지금 상태"**(현재 process status 등) — 관측성 이력이 아니라 도메인 데이터. Admin이
  로그(이력)+도메인 API(현재 상태)를 합쳐 보여줘야 함

## 6. 소비 계층 — In-app Admin vs Grafana

| | **In-app Admin** (확정) | **Grafana** (보류) |
|---|---|---|
| 답하는 질문 | "**이 고객/이 타깃/이 요청**에서 무슨 일이?" | "지금 전체적으로 문제가 있나? 추이는?" |
| 소비 방식 | **pull** — 운영자가 들어가서 팜 | **push** — 임계 초과 시 Slack이 사람을 부름 |
| 데이터 | FE 라우트 → BFF 조회 API (도메인 join 가능) | BFF DB를 SQL 데이터소스로 직접 연결 |
| 도입 판단 기준 | 확정 (기능 목록은 구현 계획 §3) | **"사람이 보기 전에 시스템이 먼저 알려야 하는가"** — 알림이 필요해지는 순간이 도입 시점 |

결정 ①의 부수 효과: 데이터가 BFF DB에 있으므로 Grafana는 로그 기반 metric 파이프라인 없이
**SQL 데이터소스 연결만으로** 구성 가능 — 도입 결정 시 비용이 원안보다 낮아졌다.
단, 고객별/타깃별 드릴다운을 Grafana에 넣지 않는 원칙(고카디널리티 금지)은 유지 — 그것은 Admin의 몫.

## 7. 로드맵 (개정)

| 단계 | 내용 | 성격 | 전제 |
|---|---|---|---|
| 0 | **PR #558 리뷰·머지** — 수집 로직(스키마·헤더·PII 가드)은 그대로 재사용 | 리뷰만 | — |
| 1 | **BFF 협의** — ingest API 계약 · DB 스키마 · 보존/삭제 정책 · 조회 API | 협의 | 지금 시작 가능 |
| 2 | **전송 교체** — `log.ts` 출구를 stdout→BFF 배치 전송으로, surface 필드, 필드 정책 적용 | FE 코드 | 0·1 |
| 2b | **Audit Event 발행** — ADR-025 이벤트 6종 전부(빌더·allowlist·동기/비동기 Action·SSR·브라우저 page_view·screen_read·서버 스탬프) — 개발·스테이징 검증까지 | FE 코드 | 0·1·2 |
| 3 | **인증 연동** — userId·role 서버 resolve, 인가 거부(403) 로깅, SSR 화면 식별 | FE 코드 | 인증 도입(~1개월) |
| 4 | **In-app Admin — MVP** — 타깃소스 사용 이력(목록·상세·이벤트 모달) + 확인 필요 24h 집계 (구현 계획 §3 M1~M4; 관제·고객별·403 뷰는 후순위 P1~P4) | FE+BFF | 1·2·2b·3 (인증 게이트 — ADR-025 §5) |
| 5 | **커버리지 점검·방어 상수** — 6종 이벤트의 실페이지 커버리지 확인, rate cap 분리 (발행 구현은 2b) | FE 코드 소규모 | 2b |
| 6 | **Grafana 도입 결정** — push 알림 필요성 판단 후 SQL 데이터소스 구성 | 보류 | 결정 |

## 8. 열린 항목 (결정 필요)

- **Admin의 성격**: 실시간 관제탑(자동 갱신) vs 문제 시 파는 조사실(수동 조회) — 화면 자동 갱신 여부가 여기 달림
- **CTA 실패**: 전용 뷰로 만들지, 필터 축만 둘지
- ~~로그+도메인 상태 합치기를 Admin MVP(Phase 4)에 넣을지~~ → **채택 확정** (07-23): M1/M2의 이름·담당자·현재 단계는 도메인 API에서, join은 FE Admin 라우트가 조회 시점에 수행
- **이벤트 체계 상세**(6종·봉투·allowlist·신뢰 경계)는 ADR-025로 확정 — 연결테스트 trigger 응답의 job key 추가는 BFF 협의 필요
- ~~error.name 저장~~ → **채택 확정** (ADR-025 필드 매트릭스가 요구) · **fingerprint 저장**만 결정 필요 (§4)
- **BFF DB 스키마 상세**: 필드·보존 기간·삭제 정책 (많아지면 삭제 — 주기·기준 미정)
- **FE→BFF 전송 방식**: 배치 크기/주기, 유실 허용 범위
- **SSR 화면 식별** 구현 방법
- **Grafana/알림 도구** 도입 자체 (§6 판단 기준)

## 9. 참고 문서

- `docs/feature/observability-implementation-plan.md` — 실행 계획(아키텍처 + Phase별 작업 + Admin/Grafana 기능 목록), HTML 판 동일 경로 `.html`
- `docs/feature/observability-plan.md` (PR #558 브랜치) — 수집 계층 구현 상세·대안 비교·위협 모델·PII 가드
- Linear LIN-58(에러 바운더리) · LIN-59(에러 트래킹) · LIN-55~72(운영 배포 준비)
