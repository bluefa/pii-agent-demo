# FE 관측성 — BFF 경유 아키텍처 (중간 산출물)

> 상태: **검토 중** — §2의 미해결 질문에 답이 나와야 확정.
> 이 문서는 `error-boundary-and-error-tracking-plan.md`(LIN-58/59 구현 가이드)의 **상위 아키텍처를 수정**한다.
> 계기: 2026-07-12 확인된 망 제약 — FE 서버 아웃바운드가 BFF·OAuth·인가 서버로 제한됨.

---

## 1. Q&A 로그 — 질문과 받은 답변

| # | 질문 | 답변 (2026-07-12) | 상태 |
|---|------|------|------|
| Q1 | FE 서버의 아웃바운드 허용 범위는? | **BFF, OAuth, 인가 서버만 허용.** Slack 등 외부 호출 불가 | ✅ 확정 |
| Q2 | BFF 쪽에 기존 에러/메트릭 수집 인프라가 있는가? | **아직 없음.** 이 부분까지 설계에 포함할 것 | ✅ 확정 |
| Q3 | Slack 아웃바운드는? | FE에서는 제한 확정. **BFF 망에서 가능한지는 미답** | ⚠️ 부분 (→ O-3) |
| Q4 (신규 요구) | — | **"FE가 어떤 상황에서 API Call을 수행했는지" 추적 가능해야 함.** 기존 계획에 없던 요구 | ✅ 접수 (→ §4) |
| Q5 (원칙) | — | FE 서버는 많은 작업을 수행할 수 없음 — **메트릭 저장이 있다면 BFF 전송 방식** | ✅ 확정 |

## 2. 미해결 질문 (답변 필요)

| # | 질문 | 답이 결정하는 것 |
|---|------|------|
| O-1 | **BFF 팀 협의**: BFF 쪽에 ① envelope 중계 라우트 1개(POST 스트리밍 forward, 수십 줄)와 ② Bugsink+Postgres 컨테이너 2개를 BFF 망에 배치하는 것을 요청할 수 있는가? 협의 채널과 일정은? | §5 A안 성립 여부. 불가면 B안(BFF 자체 수집 API — 총비용 큼) |
| O-2 | FE 서버 컨테이너의 **stdout 로그는 현재 수집되는가?** (컨테이너 로그 수집 인프라 존재 여부) | LIN-62 구조화 로그의 목적지. 수집 안 되면 FE 서버 자체 지표도 BFF 전송 설계 필요 |
| O-3 | **BFF 망에서 Slack 아웃바운드 가능한가?** | 알림 채널: Slack vs 사내 이메일/내부 웹훅 |
| O-4 | BFF 도메인 아래 **경로 할당**: `/install/v1`과 별개로 `/observability/*` 같은 경로를 BFF 라우터(또는 그 앞 프록시)가 열어줄 수 있는가? | 중계 엔드포인트의 주소 체계 |

기술 검증 (사용자 답변 불필요, 구현 시 내가 확인):

- V-1: `@sentry/nextjs` 서버 런타임에서 `tunnel` 옵션이 동작하는지 스모크 테스트 (브라우저 SDK는 공식 지원 확정, 서버 쪽은 문서 근거가 약해 실측 필요). 실패 시 폴백: DSN 호스트 자체를 BFF 도메인으로 지정 (`https://key@bff-host/observability/api/{id}/envelope/` 형태로 경로를 맞춤).

---

## 3. 아키텍처 (수정판)

핵심 원칙: **FE에서 나가는 관측성 트래픽은 전부 "BFF로의 HTTP POST" 하나로 수렴한다.** FE는 저장·집계·알림을 하지 않는다.

```
[브라우저]
  렌더 에러/unhandled rejection
      │ Sentry SDK (tunnel: '/integration/api/v1/observability/envelope')
      ▼
[FE 서버]  중계 route 1개 ── raw passthrough ──┐
  서버 예외 (handleUnexpectedError 1줄)          │
      │ Sentry SDK (tunnel: BFF_API_URL/...)    │
      ▼                                         ▼
[BFF 서버]  중계 라우트 1개 (BFF 팀 구현) ──────→ [Bugsink + Postgres] (BFF 망)
                                                    │ 저장·그룹핑·대시보드
                                                    ▼
                                              알림 (Slack 또는 사내 채널 — O-3)
```

API 사용 컨텍스트(§4)는 별도 파이프라인을 만들지 않는다:

```
[브라우저] fetch-json.ts가 컨텍스트 헤더 부착
      ▼
[FE 서버] route → lib/bff/http.ts가 allowlist 헤더 forward   ← 현재는 인입 헤더 전부 드랍
      ▼
[BFF] 액세스 로그에 "누가·어느 화면에서·무슨 요청" 기록 (= API 사용 메트릭의 원천)
```

**설계 판단 (개념을 줄임):**

- BFF는 이미 FE의 **모든** API 호출을 받는다 (FE는 프록시 구조). 즉 "API 사용량 데이터"는 BFF에 이미 흐르고 있고, 빠진 것은 **상황(컨텍스트)** 뿐이다. 헤더 2~3개를 실어 보내면 BFF 로그가 곧 사용 메트릭 저장소가 된다 — 새 메트릭 수집 시스템을 만들 필요가 없다.
- 에러만 새 경로가 필요하다 (에러는 API 호출이 아니므로). 그것이 envelope 중계이고, 저장은 BFF 망의 Bugsink가 담당한다.

## 4. "어떤 상황에서 API Call을 수행했는가" 설계

두 소비자 관점으로 나뉜다. 수정 지점은 두 파일뿐이다.

**(a) BFF/서버 관점 — 컨텍스트 헤더.** `lib/fetch-json.ts`(모든 CSR 호출의 단일 래퍼)가 매 요청에 부착:

| 헤더 | 값 | 용도 |
|---|---|---|
| `X-Request-Id` | 클라이언트 생성 UUID | 브라우저→FE→BFF→에러 이벤트 전 구간 상관관계 키 (LIN-61의 "requestId 업스트림 미전파" 해소와 동일 작업) |
| `X-Client-Page` | 호출 시점 `location.pathname` | 어느 화면에서 |
| `X-Client-Action` | 선택: 트리거 액션명 (mutation 이름 등) | 무슨 행위로 |

`lib/bff/http.ts`에 **allowlist forward** 추가 (현재 인입 헤더 전부 드랍 — 이 allowlist 메커니즘은 향후 인증 헤더 전파에도 그대로 재사용됨). 쿼리스트링·body는 forward 대상에서 제외(PII).

**(b) 에러 이벤트 관점 — breadcrumbs.** 같은 `fetch-json.ts`에서 성공/실패 호출을 `Sentry.addBreadcrumb({method, path(쿼리 제거), status, duration, requestId})`로 기록 → 에러 발생 시 **직전 API 호출 이력이 이벤트에 자동 첨부**되어 "이 에러 직전에 무슨 호출을 했는가"가 Bugsink에서 바로 보인다.

**(c) FE 서버 자체 로그.** `withV1`이 처리하는 서버 측 `{method, path, status, duration, requestId}`는 LIN-62(구조화 로깅) 스코프 — 목적지는 O-2 답변에 따라 stdout(수집 인프라 있음) 또는 BFF 전송(없음).

## 5. 역할 분담

**FE 작업 (thin — 파일 기준 총 4묶음):**

1. 에러 바운더리 4파일 — 기존 계획 Part A 그대로, 변동 없음
2. Sentry SDK init (errors-only, PII 스크럽, ≥10.57 핀) + `handleUnexpectedError`에 1줄 — 기존 계획 Part B 그대로, tunnel 목적지만 변경
3. **envelope 중계 route 1개** (`app/integration/api/v1/observability/envelope/route.ts`): raw byte passthrough → BFF. 크기 제한(예: 1MiB)·rate limit·body 미로깅·타임아웃, BFF 에러 정규화(`withV1`/zod)에서 격리
4. `lib/fetch-json.ts` 컨텍스트 헤더+breadcrumb, `lib/bff/http.ts` allowlist forward

FE에 **없는** 것: 저장, 집계, 그룹핑, 알림, 스케줄러, 대시보드. 전부 BFF 망.

**BFF 팀 요청 목록 (제안서 형태로 전달):**

| 항목 | 규모 | 비고 |
|---|---|---|
| 중계 라우트 1개: `POST /observability/envelope` → Bugsink로 스트리밍 forward | 수십 줄 | 크기 제한·rate limit 포함. 인증은 FE→BFF 기존 신뢰 경계 따름 |
| Bugsink + Postgres 컨테이너 호스팅 (BFF 망) | 컨테이너 2개 | `PHONEHOME=false`, `TIME_ZONE=Asia/Seoul`, 백업 |
| (선택) 인입 로그에 `X-Request-Id`/`X-Client-Page` 기록 | 로깅 설정 | API 사용 분석의 원천 데이터화 |

**B안 (페일백, 권장하지 않음):** BFF 팀이 컨테이너 호스팅 불가 시 — BFF가 자체 에러 수집 API+DB 저장을 구현. 그룹핑·대시보드·알림을 전부 직접 만들어야 하므로 총비용이 A안보다 훨씬 크다. Sentry SDK도 무용해져 FE가 커스텀 리포터를 짜야 함.

## 6. 기존 계획서 대비 변경점

| 기존 (error-boundary-and-error-tracking-plan.md) | 변경 |
|---|---|
| Phase 2: Bugsink를 "어딘가" 셀프호스트 (위치 미정, R4) | **BFF 망 확정** — BFF 팀 협의(O-1)가 선행 조건 |
| Phase 4: 터널은 A안(인그레스)/B안(route.ts) 중 택1 | **인그레스 A안 폐기** (FE 인그레스는 BFF 망의 Bugsink로 라우팅 못 함). route.ts 중계 확정 + **BFF 쪽 중계 라우트가 추가로 필요** |
| Phase 6: Bugsink→Slack 알림 | FE 스코프에서 제외, BFF 망 문제로 이관 (O-3) |
| Part C: API 사용량 = FE의 LIN-62 pino 로그 | **BFF 액세스 로그가 원천**으로 이동 (FE는 컨텍스트 헤더만). FE 자체 로그 목적지는 O-2에 따름 |
| (없던 항목) | §4 API 컨텍스트 — `fetch-json.ts`+`http.ts` 수정, LIN-61(requestId 전파)과 통합 수행 |

## 7. 착수 가능 vs 대기

- **지금 가능 (협의 무관):** 에러 바운더리 4파일 · SDK init+훅(개발 검증은 로컬 docker Bugsink로) · `fetch-json.ts` 컨텍스트/breadcrumb · `http.ts` allowlist forward · FE 중계 route (목적지 env로 추상화)
- **O-1~O-4 대기:** BFF 중계 라우트, Bugsink 실배치, 알림 채널, 사용 로그 규격 합의
