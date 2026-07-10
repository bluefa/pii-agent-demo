# 에러 바운더리 + 에러 트래킹 구현 가이드 (LIN-58 / LIN-59)

> 2026-07-10 작성. 감사 리포트(Linear 문서 "운영 배포 준비 감사 리포트")의 LIN-58/59를 실행 가능한 수준으로 구체화한 문서.
> 스택: Next.js 16.1.4 (App Router, standalone) + React 19.2.3. 사용자 페이지는 전부 `app/integration/**` 아래.

---

## 0. 전체 그림 — 에러가 흐르는 경로

지금 상태에서 에러가 발생하면 어디로 가는지 / 목표 상태:

```
[에러 발생 지점]                      [현재]                  [목표]

① 클라이언트 렌더 에러          Next 기본 에러 화면      error.tsx 계층 → 브랜드 UI + 트래커 리포트
② 루트 레이아웃 렌더 에러       Next 기본 에러 화면      global-error.tsx → 최소 UI + 트래커 리포트
③ unhandled promise rejection   조용히 소멸              SDK가 자동 수집 → 트래커
④ CSR API 호출 실패             ErrorState/토스트 (OK)   유지 + requestId로 서버 기록과 연결
⑤ 서버 route.ts 예외            console.error 한 줄      handleUnexpectedError → 트래커 + requestId 태그
⑥ RSC/라우팅 서버 에러          아무 데도 안 감          instrumentation.ts onRequestError → 트래커
```

핵심 설계 원칙 (중복 리포트 방지):

- **API 실패(④)는 서버(⑤)가 원천 기록한다.** 클라이언트는 API 실패를 트래커로 다시 보내지 않는다 — 이미 `withV1`이 모든 실패를 보고, 같은 사건이 클라/서버 2번 잡히면 노이즈만 늘어난다.
- **클라이언트가 트래커로 보내는 것은 ①②③만** — 서버가 볼 수 없는 에러들.
- 두 세계를 잇는 열쇠는 **requestId** (이미 `AppError.requestId`로 클라이언트까지 도달함).

---

## Part A — 에러 바운더리 (LIN-58)

### A-1. `app/global-error.tsx` (신규)

루트 레이아웃 자체가 죽었을 때의 마지막 방어선. **주의사항 3개가 이 파일의 전부다:**

1. `global-error.tsx`는 루트 레이아웃을 **대체**하므로 `<html><body>`를 직접 렌더해야 한다.
2. 루트 레이아웃이 죽은 상태 = `globals.css`/theme 토큰을 신뢰할 수 없음 → **인라인 스타일만 사용** (raw 색상 클래스 금지 규칙 위반이 아니라, CSS 자체가 로드 안 됐을 수 있는 상황이라 인라인이 유일한 선택지).
3. dev 모드에선 Next 오버레이가 대신 뜨므로 **prod 빌드에서만 동작 확인 가능**.

```tsx
'use client';

import { useEffect } from 'react';
// LIN-59 완료 후: import * as Sentry from '@sentry/nextjs';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // LIN-59 완료 후: Sentry.captureException(error);
    console.error('[global-error]', error.digest, error);
  }, [error]);

  return (
    <html lang="ko">
      <body style={{ margin: 0, fontFamily: 'sans-serif', background: '#f9fafb' }}>
        <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', textAlign: 'center' }}>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700 }}>일시적인 오류가 발생했습니다</h1>
            <p style={{ fontSize: 13, color: '#6b7280' }}>
              잠시 후 다시 시도해주세요.
              {error.digest && <> (오류 코드: {error.digest})</>}
            </p>
            <button type="button" onClick={reset} style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}>
              다시 시도
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
```

### A-2. `app/error.tsx` (신규 — 루트 세그먼트 바운더리)

10개 페이지 세그먼트 중 9개를 한 번에 커버하는 바운더리. 여기부터는 레이아웃이 살아 있으므로 **기존 `ErrorState` 컴포넌트 재사용** (`app/components/ui/state/ErrorState.tsx` — `message`/`title`/`onRetry` props).

```tsx
'use client';

import { useEffect } from 'react';
import { ErrorState } from '@/app/components/ui/state/ErrorState';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // LIN-59 완료 후: Sentry.captureException(error);
    console.error('[error-boundary]', error.digest, error);
  }, [error]);

  return (
    <ErrorState
      title="화면을 표시하는 중 문제가 발생했습니다"
      message={error.digest ? `오류 코드: ${error.digest}` : '잠시 후 다시 시도해주세요.'}
      onRetry={reset}
    />
  );
}
```

**주의**: `error.tsx`는 **같은 세그먼트의 `layout.tsx` 에러는 잡지 못한다** (한 단계 위 바운더리로 올라감). 루트 레이아웃 에러가 `global-error.tsx`까지 가는 이유. admin 쪽 레이아웃이 복잡해지면 `app/integration/admin/error.tsx`를 추가로 두는 것을 검토 — 지금은 루트 하나로 시작.

### A-3. `app/not-found.tsx` (신규)

`swagger/[swaggerFileName]/page.tsx:82`의 `notFound()` 호출이 현재 기본 404를 렌더. 브랜드 404로 교체:

```tsx
import Link from 'next/link';
// 서버 컴포넌트 — 'use client' 불필요. 테마 토큰 사용 가능.

export default function NotFound() {
  return (
    <div className="grid min-h-[60vh] place-items-center text-center">
      <div>
        <h1 className="text-lg font-bold">페이지를 찾을 수 없습니다</h1>
        <p className="mt-1 text-[13px]">주소가 잘못되었거나 삭제된 페이지입니다.</p>
        <Link href="/integration/services" className="mt-4 inline-block">
          서비스 목록으로 이동
        </Link>
      </div>
    </div>
  );
}
```

(위는 구조 스케치 — 실제 색상/버튼은 `lib/theme.ts` 토큰과 `getButtonClass`로. raw 색상 클래스 금지.)

### A-4. 기존 `app/integration/target-sources/[targetSourceId]/error.tsx` 수정

현재 `reset`/`digest`를 버리고 있음. props에 `reset` 추가 → 재시도 버튼 연결(`_components/common`의 ErrorState가 retry를 지원하는지 확인, 아니면 `app/components/ui/state/ErrorState`로 교체), `digest`를 메시지에 포함 + `useEffect`에서 리포트.

### A-5. 검증

- vitest 컴포넌트 테스트: `RootError`가 `reset` 호출을 전달하는지, digest 렌더하는지 (기존 테스트 스타일 따름)
- 수동: dev 페이지에 `?crash=1`이면 throw하는 임시 코드로 각 바운더리 확인 → **prod 빌드(`next build && next start`)에서 global-error까지 확인** 후 임시 코드 제거
- 예상 규모: 파일 4개, 반나절

---

## Part B — 에러 트래킹 (LIN-59)

### B-1. 백엔드(수집 서버) 선택 — ⚠️ Part C의 요구에 따라 달라짐 (Research R1)

| 후보 | 에러 트래킹 | 성능/트랜잭션 | 제품 분석(방문/사용) | 셀프호스트 비용 |
| --- | --- | --- | --- | --- |
| **Bugsink** | ◎ (전문) | ✕ 없음 | ✕ | 최소 (단일 컨테이너, SQLite 가능) |
| **GlitchTip** | ○ | △ 기본 트랜잭션 | ✕ | 낮음 (Postgres+Redis) |
| **PostHog** | ○ (2025~ 추가) | △ | ◎ (페이지뷰/이벤트/퍼널/리플레이) | 중간 (hobby docker-compose, ~4GB) |
| Sentry self-host | ◎ | ◎ | ✕ | 매우 높음 (~16GB, 비권장) |

- **에러만 필요하면 Bugsink**가 정답 (감사 리포트의 원 권고).
- **"API 사용·페이지 방문 추적과 엮고 싶다"가 진지한 요구라면 선택지가 바뀐다** — Part C 참고. 이 결정이 R1의 핵심.
- 어느 쪽이든 **`@sentry/nextjs` SDK는 공통** (Bugsink/GlitchTip은 Sentry 프로토콜 호환 — DSN만 교체). PostHog만 자체 SDK(`posthog-js`) 병행.

### B-2. SDK 설치 및 부트스트랩 (Next 16 기준)

```bash
npm i @sentry/nextjs
```

파일 4개가 생긴다 (⚠️ Next 15.3+에서 클라이언트 설정 파일명이 `instrumentation-client.ts`로 바뀜 — 옛 문서의 `sentry.client.config.ts`를 따라하지 말 것):

**`instrumentation.ts`** (레포 루트) — 서버 부트스트랩 + 서버 에러 훅:

```ts
import * as Sentry from '@sentry/nextjs';

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./sentry.server.config');
  }
}

// Next 15+ 서버 에러 훅 — RSC/route handler에서 잡히지 않은 에러를 자동 수집 (경로 ⑥)
export const onRequestError = Sentry.captureRequestError;
```

**`sentry.server.config.ts`**:

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.SENTRY_DSN,          // LIN-60의 env 스키마에 optional로 추가
  environment: process.env.APP_ENV,      // dev | stg | prd
  release: process.env.BUILD_SHA,        // Makefile 빌드 시 --build-arg로 주입 (LIN-65와 연계)
  tracesSampleRate: 0,                   // 1단계는 에러만. 성능 추적은 Part C 결정 후
  sendDefaultPii: false,                 // ⚠️ PII 도구 — 쿠키/헤더/IP 자동 첨부 금지 (기본값이지만 명시)
  beforeSend(event) {
    // 요청 body는 절대 첨부하지 않음. URL 쿼리스트링 제거 (users/search?q=이름 등)
    if (event.request?.url) event.request.url = event.request.url.split('?')[0];
    delete event.request?.data;
    return event;
  },
});
```

**`instrumentation-client.ts`** (레포 루트):

```ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NEXT_PUBLIC_APP_ENV,
  release: process.env.NEXT_PUBLIC_BUILD_SHA,
  tracesSampleRate: 0,
  sendDefaultPii: false,
  beforeBreadcrumb(breadcrumb) {
    // fetch/xhr breadcrumb의 URL 쿼리 제거 (PII성 검색어 유출 방지)
    if (breadcrumb.category === 'fetch' || breadcrumb.category === 'xhr') {
      if (typeof breadcrumb.data?.url === 'string') {
        breadcrumb.data.url = breadcrumb.data.url.split('?')[0];
      }
    }
    return breadcrumb;
  },
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
```

**`next.config.ts`** — `withSentryConfig`로 감싸고 소스맵 업로드 설정 (셀프호스트 URL 지정).

⚠️ 현재 이 레포는 `NEXT_PUBLIC_*`가 0개인 클린 상태 — DSN은 secret이 아니므로 노출 자체는 문제없지만, **빌드 시점에 값이 박히므로** "1회 빌드 → 환경 승격"(LIN-65)과 맞물린다. 전 환경이 같은 트래커 인스턴스를 쓰고 `environment` 태그로 구분하면 충돌 없음 — 이 방식 권장. 환경별 DSN이 꼭 필요해지면 R4의 터널 방식이 해법.

### B-3. 서버 연결점 — `app/api/_lib/problem.ts`

`handleUnexpectedError`가 서버 예외의 단일 관문(경로 ⑤). 여기 한 곳만 수정하면 60개 라우트가 전부 커버된다:

```ts
export function handleUnexpectedError(
  error: unknown,
  requestId: string,
): NextResponse {
  Sentry.captureException(error, { tags: { requestId } });
  console.error(`[v1] Unexpected error (requestId=${requestId}):`, error);  // LIN-62 지적사항 동시 해결
  return problemResponse(createProblem(
    'INTERNAL_ERROR',
    '서버에서 예기치 않은 오류가 발생했습니다.',
    requestId,
  ));
}
```

추가 검토: `BffError` 중 5xx만 선별 리포트할지 — 트래커 대시보드에서 업스트림(BFF) 장애 가시성을 원하면 `withV1`의 `BffError` 분기에서 5xx만 `captureMessage` (4xx는 정상 흐름이므로 제외).

### B-4. 클라이언트 연결점

- Part A의 `error.tsx` / `global-error.tsx`에서 주석 처리해둔 `Sentry.captureException(error)` 활성화 (경로 ①②)
- unhandled rejection / window.onerror는 **SDK가 자동 수집** (경로 ③) — 별도 코드 불필요, 검증만
- **fetch-json/AppError는 트래커로 보내지 않는다** (0장의 중복 방지 원칙). 단, `AppError.requestId`를 UI에 노출하는 것은 LIN-62 몫

### B-5. 검증 체크리스트

- [ ] 강제 클라이언트 throw → 트래커에 소스맵 해석된 스택 등장
- [ ] `Promise.reject()` 방치 → 자동 수집 확인
- [ ] route.ts에서 강제 throw → 서버 이벤트에 `requestId` 태그 확인, 응답 ProblemDetails의 requestId와 일치
- [ ] 이벤트에 요청 body/쿼리스트링/쿠키가 **없는지** 확인 (PII 스크러빙)
- [ ] DSN 미설정 로컬(mock 모드)에서 조용히 no-op (개발 편의)
- 예상 규모: 트래커 컨테이너 제외 1~1.5일. 컨테이너 호스팅 결정(R4)은 별도

---

## Part C — "API 사용 / 페이지 방문 추적과 엮을 수 있는가?"

**결론 먼저: 엮을 수 있지만, 에러 트래킹 SDK 하나로 셋 다 해결하려 하지 않는 것을 권장.** 세 가지는 성격이 다른 데이터다:

| 데이터 | 목적 | 가장 싼 올바른 수집처 |
| --- | --- | --- |
| ① 에러 | "뭐가 깨졌나" | 트래커 (이 문서 Part B) |
| ② API 사용량 | "어떤 API가 얼마나 / 얼마나 느리게" | **서버 구조화 로그 (LIN-62)** — 이미 계획됨 |
| ③ 페이지 방문 | "누가 어떤 화면을 쓰나" | 별도 경량 분석 도구 (요구 구체화 시) |

### ② API 사용 추적 — 추가 도구가 필요 없다

LIN-62(pino 구조화 로깅)가 완성되면 **모든 API 요청이 `{method, path, status, duration, requestId}` JSON 라인으로 남는다.** 이것이 곧 API 사용 데이터다:

- 단기: 로그를 `jq`/스크립트로 집계 (엔드포인트별 호출수·에러율·p95 latency)
- 중기: 로그를 Loki/BigQuery 등으로 배송하면 대시보드화 — 수집 코드는 그대로
- Sentry 계열 "performance tracing"으로도 비슷한 걸 얻지만: **샘플링 기반이라 사용량 집계엔 부정확**하고 Bugsink는 아예 미지원. 집계가 목적이면 로그가 정답, 추적(느린 요청의 원인 분석)이 목적일 때만 tracing.

### ③ 페이지 방문 추적 — 요구를 먼저 구체화할 것

내부 admin 도구에서 페이지 분석이 실제로 답할 질문이 무엇인지에 따라 도구가 갈린다:

- "어떤 화면이 안 쓰이나" 수준 → **Umami** (초경량 셀프호스트, 스크립트 한 줄, 쿠키/PII 없음)
- "사용자별 여정/퍼널/이탈" 수준 → **PostHog** (무겁지만 에러 트래킹까지 통합 가능 — 이 경우 B-1 선택이 Bugsink 대신 PostHog로 바뀔 수 있음)
- ⚠️ PII 도구 특성상 "누가"를 추적하는 순간 내부 규정 검토가 필요할 수 있음 — 익명 집계(Umami 방식)로 시작하는 것이 안전

### 권장 단계

1. **지금**: 에러 = Bugsink(또는 R1 결과), API 사용 = LIN-62 로그. 페이지 방문은 보류
2. **방문 분석 요구가 구체화되면**: 답하고 싶은 질문 목록을 만들고 Umami vs PostHog 결정 (R2)
3. PostHog로 통합하는 경우에만 B-1 선택을 재검토

---

## Part D — Research 필요 항목

🔍 = 웹/외부 리서치 필요, 🏢 = 사내 확인 필요.

| # | 항목 | 내용 | 방법 |
| --- | --- | --- | --- |
| R1 | 🔍 트래커 선택 최신 검증 | Bugsink/GlitchTip/PostHog 2026 현재 상태: GlitchTip performance 트랜잭션 지원 범위, PostHog error tracking 성숙도(알림·소스맵·이슈 그루핑이 Sentry 수준인지), 각각의 self-host 최소 리소스 | deep research |
| R2 | 🔍 방문 분석 도구 | Umami vs PostHog vs 로그 기반 — ③의 질문 목록이 나온 뒤에만 | deep research (보류) |
| R3 | 🔍 `@sentry/nextjs` × Next 16.1 호환성 | Next 16이 최신이라 SDK 지원 시점 확인 필수: `withSentryConfig`의 Turbopack 지원, `onRequestError`/`instrumentation-client.ts` 동작, 알려진 이슈 | deep research |
| R4 | 🏢 폐쇄망 도달성 | **사용자 브라우저 → 트래커 컨테이너가 네트워크로 닿는가?** (CX망 구조상 안 닿을 가능성 높음). 안 닿으면 자체 라우트로 터널링(`/integration/api/monitoring` route.ts가 Sentry envelope을 트래커로 중계) 설계 필요 — 이 경우 클라이언트 DSN 빌드타임 베이킹 문제도 함께 풀림. 트래커 컨테이너를 어느 계정/망에 띄울지 | 사내 망 구조 확인 + deep research(터널 구현 패턴) |
| R5 | 🏢 소스맵 업로드 경로 | CI 없이 가는 동안 `make build`에서 `sentry-cli sourcemaps upload`를 어느 시점에 수행할지, prod 이미지에 소스맵을 남기지 않는 구성 | 로컬 검증으로 충분 |

**R3 → R1 → R4 순서 권장** — R3에서 SDK가 Next 16을 아직 못 따라왔으면 전체 계획의 전제가 흔들리므로 최우선.

### Research 진행 방법 (Claude / Codex)

- **Claude**: ChatGPT Deep Research와 동등한 딥리서치 하니스 사용 가능 — 다중 웹서치 fan-out → 출처 원문 확인 → 교차 검증 → 인용 포함 리포트. R1/R3/R4(터널 패턴)를 각각 하나의 리서치 질문으로 넘기면 됨. 감사 때 사용한 best-practice 리서치가 이것의 경량 버전.
- **Codex** (`/codex-review`, gpt-5.5 xhigh): 웹 리서치보다는 **결론 교차 검증**에 강함 — Claude 리서치 결과("Bugsink로 간다, 터널 구조는 이렇게")를 넘겨 반박시키는 최종 게이트로 사용.
- 순서: Claude deep research (R3→R1→R4) → 결정 초안 → Codex 교차 검증 → 구현.

---

## Part E — 작업 순서 요약

```
1. Part A (에러 바운더리 4파일)          ← 트래커 없이도 독립 진행 가능, 반나절
2. R3 리서치 (SDK × Next 16)             ← 30분~1시간, 전제 확인
3. R1 + R4 (트래커 선택 + 망 도달성)     ← R4는 사내 확인 병행
4. Part B (SDK 연동 + problem.ts 훅)     ← 1~1.5일
5. Part A의 주석 처리된 리포트 코드 활성화
6. B-5 검증 체크리스트 통과
```

Part C의 ②(API 사용)는 LIN-62가 담당하므로 이 작업 범위에 포함하지 않는다. ③(페이지 방문)은 답하고 싶은 질문 목록이 나올 때까지 보류.
