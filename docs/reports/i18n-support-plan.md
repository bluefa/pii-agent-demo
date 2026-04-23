# i18n 도입 설계서 — Cloud Provider PII Agent

> 작성일: 2026-04-23
> 브랜치: `docs/i18n-support-plan`
> 작성 기준: `main@dd0b17e` (Wave 12 완료 시점)
> 상태: **초안(Draft)** — 팀 리뷰 및 BFF 팀 협의 대기

---

## TL;DR

- 프로젝트는 한국어 전용으로 설계되어 있고, 한국어 문자열이 **앱 전반 약 3,100 라인 / 고유 500~600 문자열**로 분산돼 있다.
- i18n 라이브러리는 아직 없다. **`next-intl`** + **cookie 기반 locale 전환**(URL 변경 없음)을 권장한다.
- 사용자 요구 **"언어 전환 시 API Call 재실행 금지"** 를 달성하려면, 현재 서버 응답에 섞여 있는 한국어 문자열(`detail`, `message`, mock 에러 메시지, 상태 문구) 을 걷어내고 **서버는 code+원본 데이터만, 클라이언트가 모든 사용자 노출 문구를 i18n으로 해석** 하도록 계약을 바꿔야 한다.
- 현재는 다행히 SWR / React Query 같은 중앙 캐시가 없고 훅들의 cache key가 `targetSourceId` 같은 도메인 id만 사용하므로, locale 변수만 전역 상태 외부에서 관리하면 **훅이 자동 refetch 하지 않는 구조가 그대로 유지**된다. 즉 재호출 없음은 "의도된 기본값"으로 구현할 수 있다.
- 가장 큰 덩어리는 `lib/constants/process-guides.ts`(526 LOC) 의 가이드 문단. 별도 `messages/*/guides.*.json` 로 분리하는 전용 PR 1~2개가 필요하다.
- 실행 순서: 기반 설치 → 정적 상수 교체 → 도메인별 컴포넌트 치환 → 에러/Mock 계약 변경 → LanguageSwitcher → en 번역 → BFF 계약 조율(별도 트랙).

---

## 목차
1. [요구사항과 제약](#1-요구사항과-제약)
2. [현황 진단 요약](#2-현황-진단-요약)
3. [핵심 설계 원칙 — "API 재호출 없음" 보장 전략](#3-핵심-설계-원칙--api-재호출-없음-보장-전략)
4. [기술 스택 선정](#4-기술-스택-선정)
5. [라우팅 전략](#5-라우팅-전략)
6. [아키텍처 설계](#6-아키텍처-설계)
7. [서버 응답 계약 변경](#7-서버-응답-계약-변경)
8. [Mock 데이터 대응](#8-mock-데이터-대응)
9. [도메인별 마이그레이션 매트릭스](#9-도메인별-마이그레이션-매트릭스)
10. [Phase 별 실행 계획](#10-phase-별-실행-계획)
11. [파일·모듈 체크리스트](#11-파일모듈-체크리스트)
12. [리스크 & 마이그레이션 주의사항](#12-리스크--마이그레이션-주의사항)
13. [오픈 이슈 / 팀 협의 필요](#13-오픈-이슈--팀-협의-필요)
14. [부록 A — 한국어 텍스트 분포 실사](#부록-a--한국어-텍스트-분포-실사)
15. [부록 B — 데이터 페칭/캐싱 실사](#부록-b--데이터-페칭캐싱-실사)
16. [부록 C — 네임스페이스/키 설계 초안](#부록-c--네임스페이스키-설계-초안)

---

## 1. 요구사항과 제약

### 1.1 비즈니스 요구

- **다국어 UI 지원**: 한국어 외 최소 1개 언어(영문) 추가. 향후 일/중 확장 가능한 구조로.
- **즉시성**: 사용자가 언어를 바꾸면 **즉시** 화면 전체가 해당 언어로 전환돼야 한다.
- **일관성**: 상태 라벨, 에러 메시지, 가이드 문단, 버튼, placeholder, aria-label, 날짜/숫자 포맷까지 모두 전환.
- **SEO**: 현재는 사내 도구 성격이라 검색 엔진 노출이 목적이 아님 → URL에 `/ko`, `/en` 세그먼트 굳이 필요하지 않다.

### 1.2 기술 제약

- **⛔ 언어 전환이 기존 API Call 재실행을 유발하지 않을 것** (사용자 명시 요구)
- **Next.js 14 App Router** + React 19 구조 유지
- `next.config.ts`의 `assetPrefix: '/integration'` 유지 — 서브경로 배포 제약
- **CLAUDE.md 규칙**: any 금지, 상대경로 import 금지, raw 색상 클래스 금지
- 데스크톱 전용, 한국어가 기본 locale (fallback)

### 1.3 비 목표(Non-goal)

- 서버사이드 SEO 최적화 (사내 도구이므로)
- 기존 API/BFF의 JSON 스키마를 필드 단위로 다국어화하는 거대한 백엔드 리팩토링 — **최소한의 계약만** 바꾸고 나머지는 클라이언트에서 흡수
- RTL 언어 지원 (현재 요구 범위 밖)
- 사용자별 언어 설정을 서버에 저장하는 영속 계층 (1차에서는 cookie로 충분)

---

## 2. 현황 진단 요약

### 2.1 프로젝트 구조 (요지)

- App Router: `app/integration/...`(관리자/프로젝트 목록 진입점), `app/projects/[projectId]/...`(상세), `app/components/{ui,layout,features}`, `app/api/...`(Route Handler)
- 도메인별 디렉터리: `aws/`, `azure/`, `gcp/`, `idc/`, `sdu/`, `common/` (프로바이더별 분리가 잘 되어 있음)
- `lib/`: `constants/`, `types/`, `validation/`, `api-client/`(CSR), `bff/`(SSR), `theme.ts`, `utils/`
- **i18n 라이브러리 없음** (`next-intl`, `next-i18next`, `react-i18next`, `lingui`, `formatjs` 모두 미설치)
- **middleware.ts 없음**, `[locale]` dynamic segment 없음, `<html lang="ko">` 하드코딩 (`app/layout.tsx:26`)
- 한글 전용 웹폰트 없음 (Geist latin subset만 로드)

### 2.2 한국어 텍스트 분포 (요약)

| 카테고리 | 발생 건수 | 대표 위치 |
|---|---|---|
| (a) JSX 리터럴 | ~181 | `app/projects/[projectId]/**/*.tsx` |
| (b) 속성값(placeholder/aria-label/title) | ~63 | `components/features/**`, `Modal.tsx:133` |
| (c) alert/error 메시지 | ~50 | Project 페이지들, `AdminDashboard.tsx` |
| (d) 상태 딕셔너리 (enum→라벨) | ~200+ | `lib/constants/labels.ts`, provider 상수들 |
| (e) Mock 응답 내 한국어 | ~100+ | `lib/api-client/mock/*.ts`, `lib/mock-*.ts` |
| (f) 날짜/숫자 포매팅 `ko-KR` 하드코딩 | ~16 | `lib/utils/date.ts:57`, 여러 파일 |
| (g) Validation 메시지 | ~10 | `lib/validation/infra-credentials.ts` |
| (h) **장문 가이드 문단** | **~400~500** | **`lib/constants/process-guides.ts` (526 LOC)** |
| (i) 이미지 내 텍스트 | 0 | — |
| (j) 이메일/알림 템플릿 | 0 (FE 범위) | — |

가장 큰 덩어리는 `process-guides.ts`. 나머지는 파일당 적은 수로 분산.

### 2.3 데이터 페칭·캐싱 구조 (요지)

- **페칭 라이브러리 없음** — 모든 데이터는 자체 훅 + `useState`
- CSR 훅: `useApiMutation`, `useAsync`, `usePollingBase`, `useScanPolling`, `useInstallationStatus`, `useTestConnectionPolling`, `useModal`
- SSR: `lib/bff/client.ts` (`server-only`), 일부 페이지의 `initial*` prop으로 주입
- 캐시 key: **도메인 id만 사용** (`targetSourceId` 등). locale 이나 전역 상태에 묶여 있지 않음 → **locale 바뀌어도 자동 refetch 안 일어남** ✓
- HTTP 캐시 설정 없음 (`fetch-json.ts`에서 헤더는 Content-Type만, `Accept-Language` 없음)
- 전역 상태(Redux/Zustand/Context) **전혀 없음**. 모든 상태는 컴포넌트 로컬

### 2.4 서버 응답의 locale 의존성 (핵심 문제)

현재 API 응답에 한국어 문자열이 섞여 있는 지점:

- `lib/constants/scan.ts:52-59` — `SCAN_ERROR_CODES.*.message`
- `lib/constants/history.ts`, `gcp.ts`, `azure.ts`, `sdu.ts`, `idc.ts` — 동일 패턴의 에러 message 들
- `lib/api-client/mock/**` — mock 응답의 message 필드
- Route Handler의 `withV1` 래퍼 → `transformLegacyError` → RFC 9457 `detail` 에 한국어 그대로 전달
- CSR `fetch-json.ts`의 `parseErrorResponse` 에서 `body.detail ?? body.title ?? 'HTTP ${status}'` 을 그대로 `AppError.message`로 보존 → 컴포넌트가 그대로 UI에 노출

> **결론**: 지금 상태로는 locale을 바꿔도 *클라이언트가 이미 받아서 들고 있는 메시지 문자열이 한국어* 다. 이걸 해결하는 방식이 바로 아래 §3의 핵심 전략이다.

---

## 3. 핵심 설계 원칙 — "API 재호출 없음" 보장 전략

### 3.1 문제 정의

> "locale 전환 시 기존 API 호출을 다시 하지 않아야 한다."

현재 구조에서 재호출을 유발할 수 있는 시나리오는 3가지다.

| # | 시나리오 | 현재 발생? | 이유 |
|---|---|---|---|
| S1 | locale 변경 이벤트가 훅의 key에 포함돼 자동 refetch | **미발생** | 훅 key가 `targetSourceId` 등으로 locale 변수 없음 |
| S2 | 이미 받은 응답에 한국어 문구가 들어 있어 재요청으로 번역본을 받아야 함 | **발생 가능** | `message`, `detail`, mock 메시지 등 |
| S3 | `<html lang>` 변경이 SSR rehydrate 유발 → initial data fetch 재실행 | **발생 가능** | Provider/레이아웃 재설계 필요 |

즉 **S2 와 S3를 제거**하면 요구사항을 구조적으로 달성한다.

### 3.2 핵심 원칙

#### 원칙 1 — **서버 응답은 locale-independent**

- 서버는 **코드(`code`)** 와 **사용자 데이터(이름, 타임스탬프, 숫자 등)** 만 반환
- 사용자에게 보여줄 **문장(sentence-level 텍스트)** 은 서버에서 오지 않음
- 오늘의 `message`, `detail` 은 점진적으로 제거하거나, 적어도 `code` 가 반드시 동반되도록 강제

#### 원칙 2 — **클라이언트에서 code → message 매핑**

- `AppError.code` (예: `UNAUTHORIZED`, `SCAN_TOO_RECENT`) 를 key로 i18n 메시지를 찾음
- 매핑표는 `lib/i18n/error-map.ts` 에 집중
- 미지정 code 는 `errors.unknown` 으로 fallback

#### 원칙 3 — **locale 상태는 전역 React Context + cookie** (외부 캐시 키에 편입되지 않음)

- `NEXT_LOCALE` 쿠키로 영속
- `NextIntlClientProvider` 로 컴포넌트 트리에 주입 → `t()` 훅이 locale 변경을 구독
- 훅(`useScanPolling` 등)은 locale을 의존성에 포함하지 않음 → **key 동일 → refetch 없음**

#### 원칙 4 — **날짜·숫자는 클라이언트에서만 포맷**

- 서버는 ISO 8601 timestamp / 숫자 raw value 반환 (이미 그렇게 되어 있음)
- 클라이언트는 현재 locale로 `Intl.DateTimeFormat`, `Intl.NumberFormat` 사용
- locale 바꿔도 data 는 그대로, 포매팅만 바꿔 다시 렌더

#### 원칙 5 — **사용자 입력 데이터는 원본 그대로**

- 리소스 이름, description, user 입력 문구는 **번역하지 않는다**
- 번역 대상은 **앱이 생성하는 UI 카피** 만

### 3.3 달성 구조 (도식)

```
 [Browser]
   ├─ LocaleProvider (cookie = "en")
   │    └─ NextIntlClientProvider (messages: en.json)
   │         ├─ useTranslations("errors") → "errors.unauthorized" → "Login required"
   │         └─ 컴포넌트들은 t(key) 만 호출. 데이터는 건드리지 않음.
   │
   └─ existing data store (컴포넌트 state / polling hooks)
        └─ 값: { code: "UNAUTHORIZED", resourceId: 42, ... }  ← locale과 무관
        └─ 언어 전환 → 리렌더만. fetch 트리거 없음.
```

### 3.4 재호출 유발 지점 제거 체크리스트

- [ ] `fetch-json.ts::parseErrorResponse` — `message` 대신 `code` 를 주력으로. message는 `rawDetail` 로 보존만
- [ ] `lib/errors.ts::AppError` — `messageKey?: string` 필드 도입(code 기반 매핑 우선)
- [ ] `app/api/_lib/handler.ts::transformLegacyError` — RFC 9457 `detail` 에 한국어 넣지 않음. `code` + `rawDetail`만
- [ ] `lib/api-client/mock/**` — mock 에러에 한국어 메시지 넣지 않음. code만
- [ ] 모든 훅의 의존성 배열에 locale 변수 추가 금지 (lint 규칙 검토)

---

## 4. 기술 스택 선정

### 4.1 라이브러리 비교

| 옵션 | App Router 친화도 | 런타임 비용 | 타입 안전 | 설치 부담 | 결론 |
|---|---|---|---|---|---|
| **next-intl** | 최상 (App Router 공식 권장 중 하나) | 작음 (서버/클라이언트 분리 지원) | TS 네임스페이스 타입 생성 가능 | middleware + Provider | ✅ **채택** |
| next-i18next | 중 (App Router 공식 지원 약함) | 중 | 약함 | pages Router 스타일 잔재 | ✗ |
| react-i18next | 중 | 작음 | 보통 | 보일러플레이트 많음, SSR 수작업 | ✗ |
| lingui | 상 | 작음 (ICU + 추출기) | 강함 | CLI 추출기 구축 필요, 학습 부담 | △ 장기 유리하지만 초기 비용 큼 |
| 직접 구현 | - | 최소 | 제어 가능 | 공통 기능을 전부 다시 구현 | ✗ |

**선택: `next-intl`**. 이유:
1. App Router의 server/client component 분리 모델에 자연스럽게 대응(`getRequestConfig`, `NextIntlClientProvider`).
2. Middleware 없이 cookie/header 기반 detection 가능 → **URL 경로 변경 없이 locale 전환** 요구에 맞음.
3. ICU MessageFormat 지원 — 복수형·보간 처리까지 한 번에.
4. 메시지 타입을 자동 도출해 `t("errors.unauthorized")` 오타 방지 (TS `declare module`).

### 4.2 부수 패키지

- 필요 시 `@formatjs/intl-localematcher` (브라우저 언어 감지 더 정확히)
- `@intl/icu-messageformat-parser` 는 next-intl 내부 포함
- 번역 관리 도구(Crowdin/Lokalise)는 이후 결정 (§13)

### 4.3 한글 웹폰트

- 현재 `Geist` 는 latin subset 만 → 한글이 시스템 폰트로 렌더 중
- 다국어 도입 기회에 `Pretendard` 를 self-host 혹은 cdn 으로 추가 검토
- 우선순위는 낮음 (시각적 일관성 개선 목적일 뿐, i18n 필수 아님)

---

## 5. 라우팅 전략

### 5.1 옵션 비교

| 옵션 | URL 예시 | SEO | SSR hydration | `assetPrefix: '/integration'` 충돌 | 구현량 |
|---|---|---|---|---|---|
| **A) `[locale]` 세그먼트** | `/integration/en/projects/42` | 유리 | locale 파라미터 명시적 | middleware 경로 재작성 필요, segment 위치 설계 시 충돌 가능 | 중 |
| **B) Cookie 기반 (URL 불변)** | `/integration/projects/42` | 무영향 | 쿠키 → `getRequestConfig` 에서 locale 주입 | 충돌 없음 | 소 |

**권장: 옵션 B (Cookie 기반)**. 이유:
1. 사내 도구라 SEO 무관 → URL 재구성 실익 없음.
2. 기존 라우트 전부 유지 → 기존 북마크, 문서, 링크 영향 없음.
3. `assetPrefix: '/integration'` + `[locale]` 조합에서 발생할 잠재 엣지케이스 회피 (예: `/integration/ko/ko`).
4. **언어 전환이 단순히 쿠키 변경 + `router.refresh()` 로 끝난다** → fetch 미발생 보장이 쉬움.
5. 향후 SEO 요구가 생기면 `[locale]` 로 이식 가능 (점진적 마이그레이션 여지 있음).

### 5.2 Locale 감지 우선순위

1. `NEXT_LOCALE` 쿠키 값 (있으면 최우선)
2. `Accept-Language` 헤더 (첫 접속 시 browser hint)
3. 기본값 `ko` (fallback)

→ SSR 시 쿠키를 읽어 `NextIntlClientProvider messages` 를 결정. 이후에는 cookie가 항상 존재하므로 deterministic.

### 5.3 언어 전환 UX 흐름

```
사용자: LanguageSwitcher 에서 "English" 선택
  ↓
클라이언트: document.cookie = "NEXT_LOCALE=en; path=/; max-age=31536000"
  ↓
클라이언트: router.refresh()  ← soft refresh, RSC 만 재전송 (이미 들고 있는 client state 유지)
  ↓
서버: 쿠키 읽어 messages:en 로 초기 RSC 다시 렌더
  ↓
클라이언트: NextIntlClientProvider 가 새 messages 받음
  ↓
모든 `t(...)` 호출이 영어 문자열 반환
  ↓
사용자 데이터는 컴포넌트 state 그대로 → 재호출 없음
```

중요: **`router.refresh()` 자체는 CSR 훅(`useScanPolling` 등)의 useEffect 의존성을 건드리지 않으므로 polling fetch 는 재시작되지 않는다**. 초기 RSC에서 SSR로 받은 `initialProject` 는 다시 전송되지만, 이건 네트워크 요청이라기보다 RSC payload 스트리밍이라 **HTTP API call은 아니다**. (※ §12.5에서 이 구분을 명시)

만약 `router.refresh()` 의 RSC 재전송조차 피하고 싶다면, §6.4의 대안으로 **pure CSR locale swap** (messages를 client-side 에서 동적 import 해서 교체) 을 쓸 수 있다.

---

## 6. 아키텍처 설계

### 6.1 디렉터리 구조 (신규/변경)

```
messages/                              # 신규 — 번역 리소스
├── ko/
│   ├── common.json                   # 공통(버튼, 네비, 라벨)
│   ├── errors.json                   # 에러 code → 메시지
│   ├── providers.json                # AWS/Azure/GCP/IDC/SDU 라벨·설명
│   ├── process.json                  # ProcessStatus, Step 라벨
│   ├── guides/                       # process-guides.ts 분해
│   │   ├── default-steps.json
│   │   ├── aws-auto.json
│   │   ├── aws-manual.json
│   │   ├── azure.json
│   │   ├── gcp.json
│   │   ├── idc.json
│   │   ├── sdu.json
│   │   └── prerequisites.json       # SCAN_ROLE, DB_CREDENTIAL, TF_EXECUTION_ROLE
│   ├── modals.json                   # 각종 모달의 title/description
│   └── validation.json              # zod / 수동 검증 메시지
└── en/                              # 동일 구조
    └── ...

lib/i18n/                             # 신규
├── config.ts                         # LOCALES 리스트, 기본 locale, display names
├── request.ts                        # next-intl getRequestConfig (RSC 진입점)
├── cookies.ts                        # NEXT_LOCALE read/write helpers (server/client)
├── error-map.ts                      # AppErrorCode → i18n key 매핑
├── format.ts                         # formatDate/Number 공용 헬퍼 (locale 주입)
└── types.d.ts                        # declare module for messages

app/
├── layout.tsx                        # <html lang={locale}> + <NextIntlClientProvider>
└── components/ui/LanguageSwitcher.tsx  # 신규

middleware.ts                         # 선택 — cookie 기본값 주입
```

### 6.2 `lib/i18n/config.ts`

```ts
export const LOCALES = ['ko', 'en'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'ko';

export const LOCALE_DISPLAY: Record<Locale, string> = {
  ko: '한국어',
  en: 'English',
};

export const isLocale = (value: string): value is Locale =>
  (LOCALES as readonly string[]).includes(value);
```

### 6.3 `lib/i18n/request.ts` (next-intl RSC 진입점)

```ts
import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { DEFAULT_LOCALE, isLocale, Locale } from './config';

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  const acceptLang = (await headers()).get('accept-language') ?? '';
  const headerLocale = acceptLang.split(',')[0]?.split('-')[0];

  const locale: Locale =
    (cookieLocale && isLocale(cookieLocale) && cookieLocale) ||
    (headerLocale && isLocale(headerLocale) && headerLocale) ||
    DEFAULT_LOCALE;

  const messages = (await import(`../../messages/${locale}/index.ts`)).default;
  return { locale, messages };
});
```

> `messages/{locale}/index.ts` 가 하위 JSON 을 병합해 하나의 객체로 export 한다. 이렇게 하면 번들 단계에서 tree-shake 가능하고, next-intl이 요구하는 단일 객체 구조를 만족한다.

### 6.4 `<html lang>` 동적화 및 Provider

`app/layout.tsx`:

```tsx
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale}>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
```

### 6.5 Language Switcher (CSR)

```tsx
'use client';
import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { LOCALES, LOCALE_DISPLAY, type Locale } from '@/lib/i18n/config';

export const LanguageSwitcher = () => {
  const locale = useLocale();
  const router = useRouter();

  const change = (next: Locale) => {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
    router.refresh(); // RSC만 다시 — CSR state는 유지
  };

  return (
    <select value={locale} onChange={(e) => change(e.target.value as Locale)}>
      {LOCALES.map((l) => (
        <option key={l} value={l}>{LOCALE_DISPLAY[l]}</option>
      ))}
    </select>
  );
};
```

> 대안: `router.refresh()` 도 피하고 싶으면 messages를 client-side 에서 동적 import 하고 `NextIntlClientProvider` 의 messages 를 `useState` 로 교체. 이 경우 SSR initial messages 와 분리돼 hydration mismatch 주의 필요.

### 6.6 서버/클라이언트 컴포넌트 사용 패턴

- RSC: `import { getTranslations } from 'next-intl/server'; const t = await getTranslations('common'); return <h1>{t('title')}</h1>`
- Client: `'use client'; import { useTranslations } from 'next-intl'; const t = useTranslations('errors'); return <p>{t('unauthorized')}</p>`
- ICU 보간: `t('scanTooRecent', { minutes: 5 })` → `"{minutes}분이 지나지 않았습니다."` 패턴

### 6.7 날짜·숫자 포매팅 (lib/i18n/format.ts)

```ts
import { getLocale } from 'next-intl/server'; // RSC
import { useLocale } from 'next-intl';        // CSR

export const formatDateTime = (iso: string, locale: string, opts?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale, opts ?? { dateStyle: 'medium', timeStyle: 'short' })
    .format(new Date(iso));

export const formatNumber = (n: number, locale: string) =>
  new Intl.NumberFormat(locale).format(n);
```

- 기존 `lib/utils/date.ts:57` 의 `'ko-KR'` 하드코딩을 이 헬퍼로 대체
- 훅에서 사용: `const locale = useLocale(); const text = formatDateTime(iso, locale);`

### 6.8 Middleware (선택, 최소 기능)

- next-intl 기본 제공 `createMiddleware` 는 `[locale]` 세그먼트 모델을 전제하므로 옵션 B(쿠키) 에서는 **필요 없음**.
- 필요하다면 **최초 접속 시 쿠키 미존재 → `Accept-Language` 기반으로 쿠키 seed** 하는 얇은 middleware 하나만 작성 (경로 재작성 없음).

```ts
// middleware.ts (선택)
export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  if (!req.cookies.get('NEXT_LOCALE')) {
    const accept = req.headers.get('accept-language') ?? '';
    const first = accept.split(',')[0]?.split('-')[0];
    const locale = isLocale(first) ? first : DEFAULT_LOCALE;
    res.cookies.set('NEXT_LOCALE', locale, { path: '/', maxAge: 60 * 60 * 24 * 365 });
  }
  return res;
}
```

`matcher`는 `'/((?!_next|favicon.ico).*)'` 정도로 설정. `assetPrefix: '/integration'` 환경에서 asset 경로에 간섭하지 않도록 주의.

---

## 7. 서버 응답 계약 변경

> 이 섹션이 **"API 재호출 없음"** 을 구조적으로 달성하는 핵심.

### 7.1 지금의 응답 형태 (문제)

```jsonc
// 401 응답 예시
{
  "status": 401,
  "code": "UNAUTHORIZED",
  "detail": "로그인이 필요합니다.",   // ← locale-dependent
  "retriable": false,
  "requestId": "abc123"
}
```

클라이언트 `fetch-json.ts:81-89`:
```ts
const message = body.detail ?? body.title ?? `HTTP ${res.status}`;
return new AppError({ ..., message, ... });
```

→ 이후 컴포넌트들이 `appErr.message` 를 UI에 직접 출력. **한국어 고정**.

### 7.2 목표 형태

```jsonc
{
  "status": 401,
  "code": "UNAUTHORIZED",
  "rawDetail": "로그인이 필요합니다.",    // ← optional, 디버깅·로그 용. UI에 직접 표시 금지.
  "retriable": false,
  "requestId": "abc123"
}
```

클라이언트:
```ts
return new AppError({ status, code, rawDetail, retriable, requestId });
```

UI 레이어:
```ts
const t = useTranslations('errors');
const message = t(appErr.code.toLowerCase(), { retryAfter: appErr.retryAfterMs });
```

`messages/ko/errors.json`:
```json
{
  "unauthorized": "로그인이 필요합니다.",
  "forbidden": "해당 프로젝트에 대한 권한이 없습니다.",
  "scan_too_recent": "최근 스캔 완료 후 {minutes}분이 지나지 않았습니다.",
  "unknown": "알 수 없는 오류가 발생했습니다."
}
```

### 7.3 변경 포인트 (서버 측)

| 지점 | 변경 내용 | 담당 |
|---|---|---|
| `lib/constants/{scan,history,azure,gcp,sdu,idc}.ts` | `*_ERROR_CODES.*.message` 필드 제거 또는 `rawDetail` 로 rename. 클라이언트는 code 만 참조. | FE |
| `lib/api-client/mock/**` | mock 에러에서 `message` 를 반환할 때는 `rawDetail` 로만 반환. code 가 항상 포함되도록 강제. | FE |
| `app/api/_lib/problem.ts` (`transformLegacyError`) | RFC 9457 `detail` 대신 `rawDetail` 필드 사용. `detail` 은 영문 간단한 fallback 만. | FE |
| `app/api/_lib/handler.ts` | 동일 | FE |
| 업스트림 BFF | 중장기. `Accept-Language` 를 넘기거나, 또는 `detail` 을 위한 code 기반 응답으로 전환 | BFF 팀 협의 필요 |

### 7.4 점진 전환 전략

**1단계 (FE 단독 완결)**: 클라이언트에서 `AppError.message` 를 **UI에 직접 표시하지 않는다**는 규약을 세운다. 컴포넌트는 `t(errorKey)` 를 쓴다. 이 시점엔 서버 응답 구조를 안 바꿔도 된다 (`message` 무시).

**2단계 (FE 서버 레이어)**: Route Handler(`app/api/_lib/*`), mock, `fetch-json.ts` 의 에러 변환에서 message 의존을 없애고 code 만 유지.

**3단계 (BFF 팀 협의)**: 실제 업스트림 BFF 가 한국어 `detail` 을 내려주는 엔드포인트를 식별해 (`docs/swagger/*.yaml` 참고) code 기반으로 전환 요청. 혹은 `Accept-Language` 전달하고 BFF가 해석.

**1단계만으로도 "언어 전환 시 API 재호출 없음" 은 달성 가능**하다. 이미 들고 있는 응답의 `message` 필드를 무시하기 때문. 단 `rawDetail` 에는 여전히 구 언어의 원문이 남아있으니 개발자 콘솔/디버깅 UI 에서 보일 뿐 최종 사용자 화면에는 노출 안 된다.

### 7.5 Accept-Language 전략은 채택하지 않음

- `Accept-Language` 기반으로 서버가 문구를 결정하는 모델은 **locale 변경 시 재요청을 강제** 하게 된다 → 요구사항 위배
- 따라서 이 경로는 의도적으로 배제 (혹 장기적으로 BFF가 code only 반환 시 고려 안 해도 됨)

---

## 8. Mock 데이터 대응

### 8.1 현재 구조

- `USE_MOCK_DATA=true` 시 `client = mockClient`, `bff = mockBff`
- mock handler 들이 한국어 message 를 직접 반환 (`lib/api-client/mock/scan.ts:20-27` 등)

### 8.2 변경 원칙

- Mock 도 **실제 BFF 계약을 모사** 해야 하므로, 동일하게 `code` 중심 응답으로 전환
- 한국어 `rawDetail` 은 남겨도 되지만, 클라이언트 UI는 code 만 참조
- Mock 내 성공 응답의 사용자 노출 텍스트(예: resource description) 는 "사용자 입력 데이터" 시뮬레이션이므로 **번역 안 함**. 그대로 둔다.

### 8.3 테스트 편의

- Jest에서 locale별 스냅샷 분기가 필요하면 `NextIntlClientProvider` 를 테스트 유틸로 감싸는 `renderWithLocale(ui, { locale: 'en' })` 헬퍼 추가
- 기존 `mock-idc.test.ts` 는 이미 jest babel 이슈로 skip 중 (MEMORY 참조) — i18n 도입 시 추가 영향 없음

---

## 9. 도메인별 마이그레이션 매트릭스

### 9.1 우선순위 매트릭스

| 영역 | 발생량 | 패턴 균일성 | 난이도 | 우선순위 |
|---|---|---|---|---|
| `lib/constants/labels.ts` | 많음 (Record 패턴) | 매우 균일 | 쉬움 | ⭐⭐⭐⭐⭐ (가장 먼저) |
| `lib/constants/messages.ts` | 적음 | 균일 | 쉬움 | ⭐⭐⭐⭐⭐ |
| `lib/validation/*` | 적음 | 함수 반환값 | 쉬움 | ⭐⭐⭐⭐ |
| `components/ui/*` | 적음 | 기본 prop 한국어 | 쉬움 | ⭐⭐⭐⭐ |
| `components/features/**` JSX 리터럴 | 많음 | 파일마다 다름 | 중 | ⭐⭐⭐ (도메인별 PR) |
| `lib/constants/process-guides.ts` | 매우 많음 | 구조화된 JSON | 중-어려움 | ⭐⭐⭐ (별도 PR) |
| 날짜/숫자 포매팅 | 중 | 일관 | 쉬움 | ⭐⭐⭐ |
| `lib/api-client/mock/*` 에러 | 중 | 균일 | 쉬움 | ⭐⭐ |
| Route Handler 응답 계약 | 중 | 균일 | 쉬움 | ⭐⭐ |
| 업스트림 BFF 응답 | 미지수 | 모름 | 어려움 | ⭐ (팀 협의) |

### 9.2 변환 패턴 가이드

**(a) Record 패턴 → 키 매핑** (가장 흔한 케이스)

Before:
```ts
export const PROCESS_STATUS_LABELS: Record<ProcessStatus, string> = {
  [ProcessStatus.WAITING_APPROVAL]: '승인 대기',
  ...
};
```

After (옵션 1 — 런타임에서 해석):
```ts
// lib/constants/process-status-keys.ts
export const PROCESS_STATUS_KEYS: Record<ProcessStatus, string> = {
  [ProcessStatus.WAITING_APPROVAL]: 'process.status.waitingApproval',
  ...
};

// 사용처
const t = useTranslations();
const label = t(PROCESS_STATUS_KEYS[status]);
```

After (옵션 2 — 훅으로 캡슐화, 권장):
```ts
// lib/hooks/useProcessStatusLabel.ts
export const useProcessStatusLabel = () => {
  const t = useTranslations('process.status');
  return (status: ProcessStatus) => t(STATUS_KEY[status]);
};
```

→ 옵션 2가 깨짐 시 lint 경고가 중앙 1곳에서 발생하므로 유지 보수 유리.

**(b) JSX 리터럴 → `t()`**

Before:
```tsx
<p className="text-gray-500">로딩 중...</p>
```

After:
```tsx
const t = useTranslations('common');
<p className="text-gray-500">{t('loading')}</p>
```

**(c) alert/error 메시지**

Before:
```ts
alert('최소 1개 이상의 리소스가 필요합니다.');
```

After:
```ts
const t = useTranslations('idc');
alert(t('resource.needsAtLeastOne'));
```

(※ 장기적으로 `alert()` 는 디자인 시스템 Toast로 대체 권장 — 별 이슈이지만 i18n 기회에 같이 검토할만함)

**(d) ICU 파라미터**

Before:
```ts
`다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n${unconfiguredVms.map(r => r.resourceId).join('\n')}`
```

After (en.json):
```json
"vm.databaseRequired": "Database settings required for the following VM resources:\n{list}"
```
```ts
t('vm.databaseRequired', { list: unconfiguredVms.map(r => r.resourceId).join('\n') })
```

**(e) 동적 조건부 라벨 (switch문)**

Before:
```ts
switch (status) {
  case 'COMPLETED': return { ..., label: '완료' };
  case 'FAILED': return { ..., label: '실패' };
}
```

After:
```ts
const t = useTranslations('terraform.status');
switch (status) {
  case 'COMPLETED': return { ..., label: t('completed') };
  case 'FAILED': return { ..., label: t('failed') };
}
```

또는 더 권장: **Record 기반으로 switch 제거** → 데이터 맵만 유지하고 라벨은 t() 에서.

**(f) aria-label / title / placeholder**

Before:
```tsx
<button aria-label="닫기">✕</button>
```

After:
```tsx
const t = useTranslations('common');
<button aria-label={t('close')}>✕</button>
```

**(g) process-guides.ts 분해**

현재:
```ts
const DEFAULT_STEP_GUIDES: Record<number, StepGuideContent> = {
  1: { heading: '...', summary: [...], bullets: [...] },
  ...
};
```

개선 방향: **JSON 리소스**로 옮기고 타입만 코드에 유지

```
messages/ko/guides/default-steps.json
{
  "1": {
    "heading": "연동 대상 DB를 선택해 주세요",
    "summary": ["...", { "strong": "연동 대상 승인 요청" }, " 버튼을 눌러 주세요."],
    "bullets": [[ "...", { "link": "가이드 문서", "href": "#" } ]]
  }
}
```

단 JSON만으로는 rich 문법(strong/link 토큰)을 표현하기 어렵다. 선택:
- 현재 tuple 구조를 그대로 JSON으로 직렬화 (번역팀이 구조 이해해야 함 — 부담)
- ICU의 `<strong>`, `<link>` 태그 + `t.rich()` 로 마크업 위임 (권장)

After (ICU rich):
```json
{
  "step1.summary": "Run Infra Scan으로 조회된 DB 리스트에서 PII 모니터링이 필요한 DB를 체크하고, 하단의 <strong>연동 대상 승인 요청</strong> 버튼을 눌러 주세요.",
  "step1.bullet0": "Scan은 평균 3~5분 내외 소요되며, 대상 리소스가 많을 경우 더 길어질 수 있습니다.",
  "step1.bullet1": "보안 설정 또는 권한 문제로 스캔이 실패했다면 <link>가이드 문서</link>를 확인해 주세요."
}
```

```tsx
t.rich('step1.summary', {
  strong: (chunks) => <strong>{chunks}</strong>,
})
t.rich('step1.bullet1', {
  link: (chunks) => <a href="#">{chunks}</a>,
})
```

- 장점: 번역가가 일반 문장처럼 번역 가능, 마크업 분리
- 단점: 현재 `{strong: '...'}` 배열 구조를 쓰는 모든 렌더 컴포넌트 수정 필요

> **권장 결정**: `process-guides.ts` 는 **별도 Wave PR** 로 분리. `t.rich` 기반 재설계.

---

## 10. Phase 별 실행 계획

### Phase 0 — 사전 협의 (비동기, 병행 가능)

- BFF 팀과 에러 응답 계약 논의 (§7.3 3단계 — code only / `Accept-Language` / 현상 유지 중 선택)
- 번역 운영 체계 결정 (JSON 직접 / Crowdin / 번역팀 프로세스)
- 지원 언어 스코프 확정 (1차: ko, en 권장)

### Phase 1 — 기반 설치 (PR 1개)

범위:
- `next-intl` 의존성 추가
- `lib/i18n/{config.ts, request.ts, cookies.ts, format.ts, error-map.ts, types.d.ts}` 생성
- `messages/ko/{common,errors}.json` + `messages/en/{common,errors}.json` 최소 시드 (빈 번들)
- `app/layout.tsx` 에 `NextIntlClientProvider` 와 `<html lang={locale}>` 도입
- 선택적 `middleware.ts` (§6.8)
- 문서: 본 설계서 + 기여 가이드 (`.claude/skills/i18n-migration/` 신규?)
- `next.config.ts` 확인 (i18n 필드 충돌 없음 재확인)

검증:
- `t('common.loading')` 같은 더미 호출로 dev/prod 빌드 통과
- cookie 변경 + `router.refresh()` 동작 확인
- `<html lang>` 이 쿠키 값에 따라 바뀜을 확인

### Phase 2 — 정적 상수 i18n 전환 (PR 3~5개)

순차 또는 병행 가능(파일 overlap 없음):
- **2-A**: `lib/constants/labels.ts` → `messages/*/common.json`, `providers.json` 이전 + 훅 `useLabel(key)` 혹은 직접 `t()`. 콜사이트 교체.
- **2-B**: `lib/constants/messages.ts`, `lib/validation/infra-credentials.ts` → `messages/*/validation.json`
- **2-C**: `lib/constants/{scan,history,azure,gcp,sdu,idc}.ts` 의 `*_ERROR_CODES.*.message` 필드 처리 — code만 남기고 message 는 `rawDetail` 로 rename 혹은 제거. `messages/*/errors.json` 에 해당 키 생성.
- **2-D**: `lib/utils/date.ts` → `format.ts` 로 locale 인자 받는 API로 바꾸고 모든 콜사이트(8+개 파일) 교체.
- **2-E**: `lib/constants/process-guides.ts` → `messages/*/guides/*.json` + `t.rich` 기반 렌더 재설계. **이 PR은 양이 크니 단독.**

### Phase 3 — 컴포넌트 마이그레이션 (PR 10+개, 도메인별)

각 PR은 한 도메인(segment)의 한국어만 처리:
- 3-A: `components/ui/*` (Modal, Table default, 기타 공용)
- 3-B: `app/components/features/dashboard/*`
- 3-C: `app/components/features/admin/*`
- 3-D: `app/components/features/process-status/aws/*`
- 3-E: `.../azure/*`
- 3-F: `.../gcp/*`
- 3-G: `.../idc/*`
- 3-H: `.../sdu/*`
- 3-I: `app/components/features/{scan,history,queue-board,resource-table}/*`
- 3-J: `app/projects/[projectId]/**` 페이지 레벨 (alert 메시지 등)
- 3-K: `app/integration/{admin,projects,task_admin}/*`

각 PR에서 수행:
- JSX 리터럴 → `t()`
- 속성(placeholder/aria-label/title) → `t()`
- `alert()/confirm()/throw Error` → i18n 키
- 스위치문 라벨 → `t()`
- `toLocaleString('ko-KR')` → `formatDateTime(iso, locale)`

### Phase 4 — 에러·Mock 응답 계약 (PR 1~2개)

- `fetch-json.ts::parseErrorResponse` — `message` 대신 `code+rawDetail` 로만 `AppError` 구성
- `AppError` 에 `messageKey?: string` 도입 또는 code 를 그대로 i18n key 로 사용 (`errors.[code.toLowerCase()]`)
- `app/api/_lib/problem.ts, handler.ts` — RFC 9457 응답에서 `detail` 제거 or `rawDetail`로 이동
- `lib/api-client/mock/**` — mock 에러에서 `message` 반환 중단 (`rawDetail` 로 rename 만)
- 컴포넌트들의 `err.message` 직접 노출 지점 모두 `t(errors.*)` 로 교체

### Phase 5 — LanguageSwitcher UI (PR 1개)

- `components/ui/LanguageSwitcher.tsx` 추가
- TopNav 또는 user menu에 배치
- cookie 저장 + `router.refresh()`
- aria-label, placeholder, 옵션 라벨도 i18n

### Phase 6 — 영문 번역 채우기 (PR 1~2개)

- 모든 `messages/ko/*.json` 키에 대응하는 `messages/en/*.json` 작성
- PR 단위는 네임스페이스별 분할 가능 (common, errors, guides, providers 각각)
- QA: 스크린 별로 영문 검수

### Phase 7 — BFF 계약 조율 (별도 트랙)

- BFF 팀이 사용자 노출 message 필드를 중단하거나 Accept-Language 기반으로 전환할 때까지는 FE가 `rawDetail` 을 무시하고 code 만 사용하는 방어적 태세 유지
- BFF 계약 변경되면 FE 어댑터 간소화

### 진행 중 QA

- 각 Phase 종료 시 스크린샷/녹화로 회귀 확인 (`/dev-server` 사용)
- 키 누락 감지: `next-intl` 은 missing key 에 대해 console warn + key name fallback. lint 규칙으로 `'[Korean regex]'` 포함된 라인 검출기 추가 고려

---

## 11. 파일·모듈 체크리스트

### 11.1 생성해야 할 파일

| 경로 | 역할 |
|---|---|
| `messages/ko/index.ts` | 모든 ko 네임스페이스 병합 export |
| `messages/ko/common.json` | 공통 버튼/네비/상태 라벨 |
| `messages/ko/errors.json` | code→메시지 |
| `messages/ko/providers.json` | AWS/Azure/GCP/IDC/SDU 공통 표시 |
| `messages/ko/process.json` | ProcessStatus, Step, 상태 전환 라벨 |
| `messages/ko/guides/*.json` | process-guides 분해 |
| `messages/ko/modals.json` | 모달 title/description |
| `messages/ko/validation.json` | 검증 메시지 |
| `messages/en/...` | 위와 동일 구조 |
| `lib/i18n/config.ts` | LOCALES, DEFAULT_LOCALE |
| `lib/i18n/request.ts` | next-intl getRequestConfig |
| `lib/i18n/cookies.ts` | NEXT_LOCALE read/write |
| `lib/i18n/format.ts` | formatDateTime, formatNumber |
| `lib/i18n/error-map.ts` | AppErrorCode ↔ i18n key |
| `lib/i18n/types.d.ts` | messages 타입 선언 |
| `app/components/ui/LanguageSwitcher.tsx` | 드롭다운 UI |
| `middleware.ts` (선택) | 초회 방문 쿠키 시드 |

### 11.2 수정해야 할 파일 (주요)

| 경로 | 변경 | 예상 난이도 |
|---|---|---|
| `app/layout.tsx` | `<html lang>` 동적화 + NextIntlClientProvider | 쉬움 |
| `next.config.ts` | 재확인 (i18n 필드 의도 없음) | — |
| `lib/utils/date.ts` | locale 인자 받도록 API 개편 | 쉬움 (+모든 콜사이트) |
| `lib/constants/labels.ts` | key 기반 또는 훅으로 전환 | 쉬움-중 |
| `lib/constants/messages.ts` | 제거 또는 key 참조 | 쉬움 |
| `lib/constants/scan.ts` | ERROR_CODES message → rawDetail | 쉬움 |
| `lib/constants/history.ts` | 동일 | 쉬움 |
| `lib/constants/azure.ts` | 동일 + `PRIVATE_ENDPOINT_STATUS_LABELS` 훅화 | 쉬움 |
| `lib/constants/gcp.ts` | 동일 + `SERVICE_STEP_LABELS`, `TF_STEP_STATUS_LABELS` 훅화 | 쉬움 |
| `lib/constants/sdu.ts`, `idc.ts` | 동일 | 쉬움 |
| `lib/constants/process-guides.ts` | guides JSON 분해 + t.rich 렌더로 이전 | **어려움** |
| `lib/validation/infra-credentials.ts` | 메시지 반환을 i18n key 반환으로 | 쉬움 |
| `lib/fetch-json.ts` | `AppError.message` 생성 로직 조정 | 쉬움 |
| `lib/errors.ts` | AppError 필드 `rawDetail` 추가, `messageKey` 옵션 도입 | 쉬움 |
| `lib/api-client/mock/**.ts` | mock 에러 body message 제거 | 쉬움 |
| `app/api/_lib/handler.ts` | transformLegacyError 에서 detail → rawDetail | 쉬움 |
| `app/api/_lib/problem.ts` | 동일 | 쉬움 |
| `app/components/ui/Modal.tsx` | `aria-label="닫기"` i18n | 쉬움 |
| `app/components/ui/Table.tsx` | 기본 emptyMessage i18n | 쉬움 |
| `app/components/features/**` (~100개) | JSX/속성/alert 변환 | 도메인별 분산 |
| `app/projects/[projectId]/**` | 페이지 레벨 alert/JSX 변환 | 도메인별 분산 |

### 11.3 변환 규모 추정 (Explore agent 보고 기반)

- 한국어 포함 파일: 약 131개
- 한국어 라인: 약 3,100 (중복 포함)
- 고유 문자열: 약 500~600개
- 문자열 집중도 최상위 파일:
  1. `lib/constants/process-guides.ts` (400~500 라인) — 독립 PR 권장
  2. `lib/constants/labels.ts`
  3. AWS/Azure/GCP 각각의 `*ProjectPage.tsx`, `*InfoCard.tsx`
  4. `app/components/features/admin/*.tsx`
  5. `app/components/features/process-status/**/*.tsx`

---

## 12. 리스크 & 마이그레이션 주의사항

### 12.1 `assetPrefix: '/integration'` 과의 상호작용

- cookie 기반 전략이므로 URL 재작성 없음 → assetPrefix와 충돌 여지 없음 ✓
- 단 middleware 를 쓸 때 matcher 가 `/_next/*` 등 asset 경로를 건너뛰도록 확인 필요
- 권장 matcher:
  ```
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
  ```

### 12.2 Polling 훅과 locale 의존성

- `useScanPolling(targetSourceId)` 의 `useCallback([targetSourceId])` 에 locale 넣으면 locale 변경 시 fetchOnce가 재생성되어 `usePollingBase` 의 `fetchRef` 가 바뀌면서 다음 interval 에서 재호출됨 → **재호출 유발**
- 따라서 **locale 은 polling 훅 dependency에 절대 넣지 않는다** 는 규칙 필요
- Lint 규칙: `react-hooks/exhaustive-deps` 의 훅 시그니처에 locale이 직접 쓰이지 않는 한 추가되지 않으므로 기본적으로 안전. 그러나 `formatDateTime(iso, locale)` 같이 훅 내부에서 locale 을 쓰게 되면 자동으로 deps에 들어가게 됨 → **format 호출은 렌더 body 에서만** 하는 규칙

### 12.3 SSR/CSR hydration mismatch

- `<html lang>` 가 서버/클라에서 달라지면 React hydration warning
- 방어: 서버에서 쿠키를 읽어 locale 확정 → 클라에 동일 messages 전달
- Dev 모드에서 처음 방문 시 쿠키 없음 → 서버는 DEFAULT_LOCALE('ko') 렌더 → middleware가 쿠키 set → 다음 요청부터 일치
- Initial request에도 middleware가 cookie 세팅 후 응답하면 CSR 에서도 동일 locale 로 시작 → 안전

### 12.4 번역 누락 감지

- `next-intl` 기본: missing key → 키 이름 반환 + console.error
- 빌드 실패로 잡으려면 `messages` 간 키 diff 스크립트 도입 권장:
  - `scripts/i18n-diff.ts` — ko.json 과 en.json 의 키 차이 리포트
  - CI 단계에서 0 diff 요구

### 12.5 `router.refresh()` 의 의미 재확인 (중요)

> "API Call 재실행 금지" 를 엄밀히 해석하면?

`router.refresh()` 는 RSC 페이로드를 서버에서 다시 가져온다. 이 과정에서:
- **Server Component 에서 `bff.*` 호출로 이뤄지는 fetch 는 재실행된다** (예: `app/integration/projects/[projectId]/page.tsx` 의 `bff.targetSources.get`)
- CSR 훅(`useScanPolling`, `useInstallationStatus`)의 fetch 는 영향 없음 (컴포넌트 state 유지)

사용자 요구 해석 선택지:
- (i) **모든 API call (SSR 초기 fetch 포함)** 을 막고 싶다 → pure CSR swap 방식 (§6.5 대안) 으로 messages 만 바꾸고 RSC 재요청 안 함
- (ii) **CSR 데이터 fetch (polling, mutation)** 만 막고 싶다 → `router.refresh()` 방식으로 충분

> **팀 협의 필요** (§13-O1). 
> - 보수적 기본안: **옵션 (ii)** — 일반적으로 "언어 바꾼다고 리소스 스캔을 다시 돌리지 말라" 는 의도로 해석. RSC 첫 렌더의 initial data 1회 재전송은 실사용 관점에서 무시 가능(이미 load 상태).
> - 엄격 기본안: **옵션 (i)** — RSC도 안 건드림. Provider를 CSR only로 만들고 dynamic import로 messages 교체. 대신 SSR 초기값이 항상 DEFAULT_LOCALE 로 렌더됐다가 CSR에서 다시 바뀜 → hydration flicker 발생.

> 권장: (ii). 이유 — 사용자가 실제로 시달리는 "언어 바꾸면 리스트 다시 로드됨" 은 CSR polling/mutation 이슈가 압도적이다. SSR initial fetch 1회 재현은 UX 영향 미미.

### 12.6 Third-party 위젯/외부 텍스트

- 현재 확인된 third-party 위젯 없음 (chart.js 등 이후 도입 시 재검토)
- 아이콘/이미지에 한국어 없음 확인됨 (Explore agent 보고)

### 12.7 Jest 테스트 영향

- 기존 테스트들의 한국어 스냅샷 / expected string 은 fixture 로 바뀜 → 대량 수정 발생 가능
- 권장: 테스트에서는 `renderWithLocale(ui, { locale: 'ko' })` 로 명시 + 한국어 검증 유지
- `lib/mock-idc.test.ts` 는 현재 babel 이슈로 skip 중 (MEMORY) — i18n과 무관

### 12.8 Tailwind 동적 클래스 이슈 재현 가능성

- 번역 키를 `cn()` 에 동적 결합해 Tailwind 클래스로 쓰지 않는 한 무관
- MEMORY: `hover:${변수}` 는 미작동 — i18n 도입 시에도 동일 원칙 준수

### 12.9 문서 마이그레이션

- `docs/**/*.md` 내 한국어는 사용자에게 보여지는 UI가 아니므로 대상 아님
- Contrib docs 는 한국어 유지 (현재 팀 사용 언어)
- 영문 UI 를 쓸 사용자가 문서를 필요로 하면 별도 번역 트랙 필요 — 본 설계 범위 외

---

## 13. 오픈 이슈 / 팀 협의 필요

| # | 이슈 | 결정권자 | 권장안 | 영향 |
|---|---|---|---|---|
| O1 | `router.refresh()` 로 RSC 재요청 허용? | PO + FE | 허용 (§12.5 옵션 ii) | Phase 5 구현 방식 결정 |
| O2 | 지원 언어 1차 범위 | PO | ko, en | messages 분량 |
| O3 | BFF 에러 응답 계약 | BFF팀 + FE | code 중심 반환, message 제거 | Phase 4 / 7 |
| O4 | 번역 운영 툴 | 운영 + PO | 1차 JSON 직접, 확장 시 Crowdin | 배포 파이프라인 |
| O5 | 사용자별 언어 설정 영속화 | PO | 1차 cookie only, 이후 user profile DB 가능 | BFF/Backend 변경 |
| O6 | 도메인 용어 사전 | 기획 + FE | 별도 `docs/i18n/glossary.md` 로 "연동 대상 → Target Source", "프로비저닝 → Provisioning" 등 고정 | 번역 일관성 |
| O7 | process-guides 분해 정책 | FE | ICU `t.rich` + 마크업 토큰 | Phase 2-E 구조 |
| O8 | LanguageSwitcher 배치 | 디자인 + UX | TopNav 우측, 사용자 메뉴 근처 | UI 변경 최소화 |
| O9 | 날짜/시간 기본 포맷 | 기획 | `dateStyle: 'medium'`, `timeStyle: 'short'` 기본 + 필요 시 per-locale override | 여러 콜사이트 |
| O10 | 한글 전용 웹폰트(Pretendard 등) 도입 | 디자인 | 별개 이슈로 분리 | i18n 과 무관 |

---

## 부록 A — 한국어 텍스트 분포 실사

### A-1. 파일 그룹별 집계 (Explore agent 보고 기반)

- `/app` 디렉토리: 1,212 라인 한국어
- `/lib` 디렉토리: 1,880 라인 한국어
- `/design` 디렉토리: 추가 집계 (프로토타입 / migration 완료분)
- 총 ~3,100 라인 (중복 포함)

### A-2. 카테고리별 대표 증거

> 모든 증거는 `main@dd0b17e` 기준 Explore agent 실사 결과. Phase 2 시작 전에 최신 브랜치에 대해 재실사 권장 (쉽게 stale 됨).

#### (a) JSX 리터럴
- `app/projects/[projectId]/idc/IdcProjectPage.tsx:268` — `<h3>리소스 목록</h3>`
- `app/projects/[projectId]/idc/IdcProjectPage.tsx:293-294` — 빈 상태 문구
- `app/integration/admin/dashboard/page.tsx:274` — 네트워크 에러 문구
- `app/components/features/TerraformStatusModal.tsx:39,49,56,151` — 상태/헤더
- `app/projects/[projectId]/common/ErrorState.tsx:20` — "오류가 발생했습니다"
- `app/projects/[projectId]/common/LoadingState.tsx:8` — "로딩 중..."
- `app/components/features/CredentialListTab.tsx:36` — 빈 상태
- `app/components/features/ProjectCreateModal.tsx:177` — "인프라 등록"
- `app/components/features/ConnectionDetailModal.tsx:72,76` — 레이블

#### (b) 속성값
- `app/components/ui/Modal.tsx:133` — `aria-label="닫기"`
- `app/components/features/idc/IdcResourceInputPanel.tsx:167,215,273,326` — placeholder "예: ..."
- `app/projects/[projectId]/common/ProjectIdentityCard.tsx:161` — `aria-label={`${identifier.label} 복사`}`
- `app/components/features/admin/infrastructure/ManagementSplitButton.tsx:84` — `aria-label="관리 메뉴 열기"`
- `app/components/features/idc/IdcPendingResourceList.tsx:55` — `title="삭제"`
- `app/components/features/sdu/SduInstallationProgress.tsx:81` — `title="새로고침"`
- `app/components/features/admin/ApprovalDetailModal.tsx:222` — `placeholder="반려 사유..."`
- `app/projects/[projectId]/sdu/SourceIpManageModal.tsx:73` — placeholder CIDR 예시

#### (c) alert/error
- `app/components/features/AdminDashboard.tsx:109,114` — alert 메시지
- `app/projects/[projectId]/idc/IdcProjectPage.tsx:79,120,191` — alert
- `app/projects/[projectId]/sdu/SduProjectPage.tsx:188` — alert
- `app/projects/[projectId]/gcp/GcpProjectPage.tsx:175` — alert with interpolation
- `app/projects/[projectId]/azure/AzureProjectPage.tsx:251` — 동일
- `app/projects/[projectId]/common/DeleteInfrastructureButton.tsx:17` — "기능 준비중입니다."
- `app/components/features/CredentialListTab.tsx:25,53` — alert (데모용 placeholder)

#### (d) Enum → 라벨 딕셔너리
- `lib/constants/labels.ts:32-40` — `PROCESS_STATUS_LABELS`
- `lib/constants/labels.ts:45-65` — `CONNECTION_STATUS_CONFIG`
- `lib/constants/labels.ts:70-75` — `REGION_LABELS`
- `lib/constants/labels.ts:109-121,126-132` — `PROVIDER_*`
- `app/components/features/StepIndicator.tsx:10-17` — steps 배열
- `app/components/features/TerraformStatusModal.tsx:11-30` — switch-case
- `lib/constants/azure.ts:1-50` — `PRIVATE_ENDPOINT_STATUS_LABELS`
- `lib/constants/gcp.ts:14-33` — TF step labels
- `design/components/features/admin/ProjectsTable.tsx` — switch-case (legacy)

#### (e) Mock 응답 한국어
- `lib/api-client/mock/scan.ts:20-27` — 에러 메시지
- `lib/mock-*.ts` 10+ 파일 — 상태 레이블, 리소스 설명 등
- `lib/api-client/mock/{projects,confirm,users,sdu,gcp,target-sources}.ts`

#### (f) 날짜·숫자 ko-KR 하드코딩
- `lib/utils/date.ts:57` — `toLocaleString('ko-KR', FORMAT_OPTIONS[format])`
- `design/components/features/dashboard/KpiCardGrid.tsx:38`
- `design/components/features/dashboard/SystemsTable.tsx:274`
- `app/components/features/admin/ApprovalDetailModal.tsx:38`
- `app/projects/[projectId]/common/RejectionAlert.tsx:27`
- `app/components/features/sdu/IamUserManageModal.tsx:60`
- `app/components/features/process-status/connection-test/ResultSummary.tsx:17`

#### (g) Validation
- `lib/validation/infra-credentials.ts:6,13` — '12자리 숫자를 입력하세요' 등

#### (h) 장문 가이드
- `lib/constants/process-guides.ts` 전체 (526 LOC)
  - `DEFAULT_STEP_GUIDES` 7 단계
  - `SCAN_ROLE_GUIDE`, `DB_CREDENTIAL_GUIDE`, `TF_EXECUTION_ROLE_GUIDE`
  - `AWS_AUTO_GUIDE`, `AWS_MANUAL_GUIDE`
  - `AZURE_GUIDE`, `GCP_GUIDE`, `IDC_GUIDE`, `SDU_GUIDE`

#### 에러 코드 메시지 상수
- `lib/constants/scan.ts:52-59` — 8개
- `lib/constants/history.ts:3-6` — 4개
- `lib/constants/azure.ts`, `gcp.ts`, `sdu.ts`, `idc.ts` — 각각 10~20개

---

## 부록 B — 데이터 페칭/캐싱 실사

### B-1. 훅 인벤토리

| 훅 | 파일 | 시그니처 (요약) | Key | locale 연동? |
|---|---|---|---|---|
| `useApiMutation` | `app/hooks/useApiMutation.ts:59-99` | `(fn, options) => { mutate, loading, error, ... }` | 없음 | ✗ |
| `useApiAction` | `app/hooks/useApiMutation.ts:112-131` | parameterless mutation | 없음 | ✗ |
| `useAsync` | `app/hooks/useAsync.ts:16-51` | 일반 async 래퍼 | 없음 | ✗ |
| `usePollingBase` | `app/hooks/usePollingBase.ts:21-106` | `{ interval, fetchOnce, shouldStop, ... }` → `{ start, stop, refresh, data, ... }` | session (number) | ✗ |
| `useScanPolling` | `app/hooks/useScanPolling.ts:49-138` | `(targetSourceId, options)` | targetSourceId | ✗ |
| `useInstallationStatus` | `app/hooks/useInstallationStatus.ts:26-71` | `{ targetSourceId, getFn, checkFn, ... }` | targetSourceId | ✗ |
| `useTestConnectionPolling` | `app/hooks/useTestConnectionPolling.ts:41-105` | `(targetSourceId, interval?)` | targetSourceId | ✗ |
| `useModal` | `app/hooks/useModal.ts` | UI 상태 (데이터 X) | — | — |

→ **모든 훅이 locale 을 dependency 에 포함하지 않는다**. locale 이 바뀌어도 useEffect 가 재실행되지 않으므로 fetch 재호출이 없다. 이 설계는 i18n 요구에 우연히 부합하며, §12.2 에 적힌 "locale 을 deps 에 넣지 말 것" 규칙만 지키면 유지된다.

### B-2. 파이프라인

```
CSR ─(fetchInfraCamelJson)→ /integration/api/v1/* (Next Route Handler)
                              └→ client = USE_MOCK_DATA ? mockClient : bffClient
                              └→ bffClient ─(fetch)→ ${BFF_API_URL}/install/v1/*

SSR (server component) ─(bff.*) → httpBff (`lib/bff/http.ts`, `server-only`)
                                     └→ ${BFF_API_URL}/install/v1/*
```

### B-3. locale 관련 헤더 / 쿠키 현황

- `fetch-json.ts:139-151` — 요청 헤더: Content-Type 만. `Accept-Language` 미설정
- `bff-client.ts` — 동일
- `lib/bff/http.ts:23-40` — `Accept: application/json` 만. `Accept-Language` 미설정
- 쿠키: 인증 쿠키만 서버 세팅. 클라이언트 JS 에서 읽는 건 없음
- `localStorage`, `sessionStorage` 미사용

### B-4. locale 전환 시 재호출 필요성 분류 (핵심 결론)

**재호출 필수 (서버 응답에 locale-dependent 필드 존재 시)**
- `AppError.message` (현재 `body.detail` 파싱)
- mock 에러 message
- ROUTE HANDLER 에러 detail
- BFF 업스트림이 내려주는 경우의 메시지 필드 (조사 안 됨)

→ §7 의 계약 변경으로 **모두 클라이언트 i18n 에서 해석** 하도록 바꾸면 **재호출 불필요**.

**재호출 불필요**
- 리소스 id, name, description (사용자 입력)
- 상태 enum 코드 (`SCANNING`, `PENDING` 등, 서버가 영문 code 반환 중)
- ProcessStatus 숫자
- ISO 8601 timestamp → 클라이언트 포매팅
- 수치 (카운트, 퍼센트 등)
- 프로바이더 enum (`AWS`, `AZURE` 등)

→ **§7 원칙 적용 후 전체가 "재호출 불필요" 로 통합된다.**

---

## 부록 C — 네임스페이스/키 설계 초안

### C-1. 네임스페이스 구조

```
common            # 버튼, 빈 상태, 로딩, 네비게이션
  .close
  .cancel
  .save
  .confirm
  .retry
  .loading
  .empty
  .back
  .add
  .delete
  .edit
  .next
  .previous
  .search

errors            # AppErrorCode 기반
  .unauthorized
  .forbidden
  .notFound
  .conflict
  .rateLimited
  .internalError
  .network
  .timeout
  .aborted
  .parseError
  .unknown
  .scanTooRecent        # "최근 스캔 완료 후 {minutes}분이 지나지 않았습니다."
  .scanInProgress
  .scanNotFound
  .scanNotSupported
  .maxResourcesReached
  .approvedIntegrationNotFound
  .confirmedIntegrationNotFound

validation
  .awsAccountId
  .guidFormat
  .requiredField
  .minLength
  .maxLength
  ...

process           # 프로세스 상태/단계
  .status
    .waitingTargetConfirmation
    .waitingApproval
    .applyingApproved
    .installing
    .waitingConnectionTest
    .connectionVerified
    .installationComplete
  .step
    .targetConfirmation
    .approval
    .applying
    ...

providers
  .aws.name
  .aws.description
  .azure.name
  .azure.description
  .gcp.name
  .gcp.description
  .idc.name
  .idc.description
  .sdu.name
  .sdu.description
  .region.apNortheast2
  ...

connection
  .status.connected.label
  .status.disconnected.label
  .status.pending.label

terraform
  .status.completed
  .status.failed
  .status.pending
  .firewall.notChecked
  .firewall.connected
  .firewall.failed

azure
  .privateEndpoint.notRequested
  .privateEndpoint.pendingApproval
  .privateEndpoint.approved
  .privateEndpoint.rejected

gcp
  .serviceStep.subnetCreation
  .serviceStep.serviceTfApply
  .serviceStep.bdcTfApply
  .stepStatus.completed
  .stepStatus.failed
  .stepStatus.inProgress
  .stepStatus.skip
  .installationStatus.completed
  .installationStatus.failed
  .installationStatus.inProgress

modals
  .projectCreate.title
  .connectionDetail.datetime
  .connectionDetail.result
  .approvalDetail.rejectPlaceholder
  .terraformStatus.title
  .sourceIp.cidrPlaceholder
  ...

idc
  .resource.placeholder.name
  .resource.placeholder.ip
  .resource.placeholder.host
  .resource.placeholder.port
  .resource.placeholder.serviceId
  .resource.emptyList
  .resource.addTitle
  .resource.addSubtitle
  .validation.minOne
  .credential.failed

scan
  .policy.idc
  .policy.sdu

guides
  .defaultSteps.1.heading
  .defaultSteps.1.summary
  .defaultSteps.1.bullet0
  .defaultSteps.1.bullet1
  .awsAuto.step1.label
  .awsAuto.step1.description
  .awsAuto.step1.procedure0
  ...
  .prerequisites.scanRole.label
  .prerequisites.scanRole.summary
  .prerequisites.scanRole.step0
  ...
```

### C-2. 네이밍 규칙

- camelCase 키 (`waitingApproval`), dot 구분 네임스페이스
- 동사는 infinitive 또는 현재 시제 (`close`, `retry`)
- 상태는 형용사/명사 (`pending`, `completed`)
- 파라미터는 `{name}` ICU 문법
- 마크업은 `<strong>`, `<link>` 등 토큰 + `t.rich`

### C-3. 파일 분할 기준

- 한 JSON 파일이 500 줄 넘으면 분할 (가이드 파일은 이미 세분화)
- 네임스페이스 1차 분기 기준: 도메인 / 기능
- 공용(common, errors) 은 독립 파일

---

## 변경 이력

| 일자 | 작성자 | 변경 |
|---|---|---|
| 2026-04-23 | @chulyong | 최초 작성 (초안) |
