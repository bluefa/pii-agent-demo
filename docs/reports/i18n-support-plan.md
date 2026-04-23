# i18n 도입 설계서 — Cloud Provider PII Agent

> 작성일: 2026-04-23
> 브랜치: `docs/i18n-support-plan`
> 작성 기준: `main@dd0b17e` (Wave 12 완료 시점)
> 상태: **초안(Draft)** — 팀 리뷰 및 BFF 팀 협의 대기

---

## TL;DR

- **지원 언어: ko / en 2개 확정** (O2 resolved).
- 프로젝트는 한국어 전용이고, 한국어는 `/app + /lib + /components` 범위에서 **2,660 라인 / 209 파일 / 고유 ~1,100 문자열** 로 분포 (design/ 제외 실측, 부록 D).
- i18n 라이브러리는 아직 없다. **`next-intl`** + **cookie 기반 locale 전환**(URL 불변, `assetPrefix: '/integration'` 호환)을 권장한다.
- 사용자 요구 **"언어 전환 시 API Call 재실행 금지"** 는 두 축으로 달성:
  - (i) 훅 cache key 에 locale 포함 금지 (이미 그런 구조). ESLint rule 로 회귀 방지.
  - (ii) 서버 응답에서 locale-dependent 텍스트(`detail`, `message`) 를 `rawDetail` 로 강등. UI는 code → i18n key 매핑만 참조.
- SWR / React Query 같은 중앙 캐시가 없고 훅 key 가 `targetSourceId` 만 쓰므로 **재호출 없음은 구조적 기본값**. 추가 로직 필요 없음.
- 가장 큰 덩어리는 `lib/constants/process-guides.ts` (526 LOC / 222 한국어 라인, 부록 E 전수 덤프). 별도 PR 로 분해 + ICU `t.rich` 변환.
- 실행 순서 (§10): 기반 설치 → 정적 상수 교체 → 도메인별 컴포넌트 치환 → 에러/Mock 계약 변경 → LanguageSwitcher → en 번역 → (BFF 계약 조율은 별도 트랙).
- **규모 요약** (부록 D 기반): JSX 리터럴 1,032 / Mock 응답 610 / 장문 가이드 244 / enum 라벨 116 / 속성 74 / alert·Error 46 / validation 39 / 로케일 포매팅 1. 주석 495, console 3 은 번역 대상 아님.
- **실행 공수**: ~80–130 FTE-hour (≈ 2–3 주 1명 or 1주 3명 병렬, §10.5).
- **리뷰어 동선**: §1→§3(원칙)→§7(서버 계약)→§10(Phase)→부록 J(용어 사전)→부록 K(번역 키 샘플). 나머지 부록은 참고.

---

## 목차
1. [요구사항과 제약](#1-요구사항과-제약)
2. [현황 진단 요약](#2-현황-진단-요약)
3. [핵심 설계 원칙 — "API 재호출 없음" 보장 전략](#3-핵심-설계-원칙--api-재호출-없음-보장-전략)
4. [기술 스택 선정](#4-기술-스택-선정)
5. [라우팅 전략](#5-라우팅-전략)
6. [아키텍처 설계](#6-아키텍처-설계)
7. [서버 응답 계약 변경](#7-서버-응답-계약-변경) — §7.6 Before/After diff, §7.7 rawDetail 정책
8. [Mock 데이터 대응](#8-mock-데이터-대응)
9. [도메인별 마이그레이션 매트릭스](#9-도메인별-마이그레이션-매트릭스)
10. [Phase 별 실행 계획](#10-phase-별-실행-계획) — §10.5 공수, §10.6 테스트 전략
11. [파일·모듈 체크리스트](#11-파일모듈-체크리스트)
12. [리스크 & 마이그레이션 주의사항](#12-리스크--마이그레이션-주의사항) — §12.10 검증 인프라
13. [오픈 이슈 / 팀 협의 필요](#13-오픈-이슈--팀-협의-필요)
14. [부록 A — 한국어 텍스트 분포 실사](#부록-a--한국어-텍스트-분포-실사) (초안 — PR #319 시점 `/design` 포함)
15. [부록 B — 데이터 페칭/캐싱 실사](#부록-b--데이터-페칭캐싱-실사)
16. [부록 C — 네임스페이스/키 설계 초안](#부록-c--네임스페이스키-설계-초안)
17. [부록 D — 전수 조사 매트릭스](#부록-d--전수-조사-매트릭스-2026-04-23-main9b5b6ab-기준) (main@9b5b6ab, /design 제외)
18. [부록 E — process-guides.ts 완전 덤프](#부록-e--process-guidests-완전-덤프)
19. [부록 F — enum/라벨 맵 전수 카탈로그](#부록-f--enum라벨-맵-전수-카탈로그)
20. [부록 G — 에러 코드 전수 카탈로그](#부록-g--에러-코드-전수-카탈로그)
21. [부록 H — Mock 응답 한국어 카탈로그](#부록-h--mock-응답-한국어-카탈로그)
22. [부록 I — 날짜·숫자 포매팅 실사](#부록-i--날짜숫자-포매팅-실사)
23. [부록 J — 도메인 용어 사전 (ko→en, v0)](#부록-j--도메인-용어-사전-ko--en-v0)
24. [부록 K — 번역 키 사전 테이블 (우선순위 v0)](#부록-k--번역-키-사전-테이블-우선순위-v0)

---

## 1. 요구사항과 제약

### 1.1 비즈니스 요구

- **다국어 UI 지원**: **한국어 / 영어 2개 언어만 지원** (확정 범위). 그 외 언어(일/중 등) 추가는 본 범위 외 — 다만 구현은 확장 가능한 구조로 하되 초기 번역·QA·운영 비용은 ko/en 두 로케일로만 계획한다.
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
// 지원 범위: 한국어(ko), 영어(en) 2개로 확정. 그 외 locale 확장은 별도 트랙.
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

### 7.6 계약 변경 Before / After (실행 가능 수준)

`lib/errors.ts` — `AppError` 타입 확장:

```ts
// Before
export class AppError extends Error {
  constructor(public readonly payload: {
    status: number;
    code: AppErrorCode;
    message: string;          // ← 한국어 포함됨
    retriable?: boolean;
    retryAfterMs?: number;
    requestId?: string;
  }) { super(payload.message); }
}

// After
export class AppError extends Error {
  constructor(public readonly payload: {
    status: number;
    code: AppErrorCode;
    rawDetail?: string;                        // 서버 원문(로그/디버그 전용). UI 노출 금지.
    messageKey?: string;                       // i18n key override (기본: `errors.${code.toLowerCase()}`)
    interpolation?: Record<string, string | number>;  // ICU 보간 파라미터
    retriable?: boolean;
    retryAfterMs?: number;
    requestId?: string;
  }) { super(payload.rawDetail ?? payload.code); }  // Error.message 는 로그 용도 유지
}
```

`lib/fetch-json.ts` — `parseErrorResponse`:

```ts
// Before
const message = body.detail ?? body.title ?? `HTTP ${res.status}`;
return new AppError({
  status: res.status,
  code: body.code ?? statusToCode(res.status),
  message,   // ← 한국어 그대로 전달
  retriable: body.retriable ?? ...,
  retryAfterMs: body.retryAfterMs,
  requestId: body.requestId ?? requestId,
});

// After
return new AppError({
  status: res.status,
  code: body.code ?? statusToCode(res.status),
  rawDetail: body.detail,                         // 원문 보존 (디버깅)
  interpolation: body.params,                     // 서버 구조화 파라미터 (e.g. { minutes: 5 })
  retriable: body.retriable ?? (res.status === 429 || res.status >= 500),
  retryAfterMs: Number.isFinite(Number(body.retryAfterMs)) ? Number(body.retryAfterMs) : undefined,
  requestId: body.requestId ?? requestId,
});
```

컴포넌트 에러 표시:

```tsx
// Before
<p>{appErr.message}</p>   // 한국어 고정

// After
import { useTranslations } from 'next-intl';
const t = useTranslations();
const key = appErr.payload.messageKey ?? `errors.${appErr.payload.code.toLowerCase()}`;
<p>{t(key, appErr.payload.interpolation)}</p>
```

Route Handler — `app/api/_lib/problem.ts` / `handler.ts`:

```ts
// Before — transformLegacyError 응답 body
{
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  code: 'UNAUTHORIZED',
  detail: SCAN_ERROR_CODES.UNAUTHORIZED.message,   // ← '로그인이 필요합니다.'
  requestId,
}

// After
{
  type: 'about:blank',
  title: 'Unauthorized',
  status: 401,
  code: 'UNAUTHORIZED',
  rawDetail: legacyBody.message,   // BFF 원문 보존(로그용). UI 는 code 로 i18n.
  params: legacyBody.params,       // (optional) 구조화 파라미터
  requestId,
}
```

Mock — `lib/api-client/mock/scan.ts`:

```ts
// Before
return NextResponse.json(
  { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
  { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
);

// After
return NextResponse.json(
  { code: 'UNAUTHORIZED' },   // message 필드 삭제 — 프로덕션 계약과 일치
  { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
);
```

영향 파일 수:

| 카테고리 | 대상 | 파일 수 |
|---|---|---|
| 타입 정의 | `lib/errors.ts` | 1 |
| 클라이언트 에러 파싱 | `lib/fetch-json.ts` | 1 |
| Route Handler 공용 | `app/api/_lib/problem.ts`, `handler.ts` | 2 |
| Mock handler | `lib/api-client/mock/*.ts` | ~8 |
| 에러 코드 상수 | `lib/constants/{scan,history,azure,gcp,sdu,idc,messages}.ts` | 7 |
| UI 에러 표시 콜사이트 | `err.message` / `appErr.message` 직접 노출 지점 | **Phase 4 grep 확정 필요** |
| **합계** | — | **~19 + 콜사이트** |

콜사이트 grep:
```
grep -rn "err\.message\|appErr\.message\|error\.message" app lib components \
  --include="*.ts" --include="*.tsx" | grep -v "__tests__\|node_modules"
```

### 7.7 rawDetail 보존 정책

- **서버 로그에만 노출**. `console.error` 에만 기록. UI 렌더 금지.
- **개발자 도구**: React DevTools 로 `AppError.payload.rawDetail` 확인 가능 (디버깅 의도).
- **장기**: BFF 가 code 중심 응답 정착하면 `rawDetail` 도 제거 (Phase 7).

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
- ~~지원 언어 스코프 확정~~ **결정: ko, en 2개** (2026-04-23)

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

### 10.5 공수·타임라인 추정

| Phase | 내용 | 공수 (FTE-hour) | 병렬 가능 | 완료 기준 |
|---|---|---|---|---|
| 0 | BFF 협의, 번역 운영 체계 합의 | 4–8 | ✅ | O1/O3/O4/O5 resolved |
| 1 | `next-intl` 설치, LocaleProvider, `<html lang>`, messages 시드 | 4–6 | ✗ (이후 Phase 의 전제) | dev 빌드 통과 + cookie 전환 동작 |
| 2-A | `labels.ts` 훅 기반 전환 | 2–3 | ✅ | 16개 라벨 맵 전부 훅으로 |
| 2-B | `messages.ts`, `validation/infra-credentials.ts` | 1–2 | ✅ | — |
| 2-C | `*_ERROR_CODES` message 제거 | 3–4 | ✗ (Phase 4 선행 조건) | 상수에서 message 제거, rawDetail 강등 |
| 2-D | `lib/utils/date.ts` locale 인자 추가 + 1 콜사이트 | 2–4 | ✅ | `formatDate(iso, locale)` 시그니처 |
| 2-E | **`process-guides.ts` 분해 + `t.rich` 변환** (별 PR) | **8–12** | ✗ (ProcessGuideStepCard 구조 변경 동반) | guides JSON 리소스화 + 렌더 교체 |
| 3-A | `components/ui/*` (Modal/Table/Breadcrumb default) | 1–2 | ✅ | — |
| 3-B | `components/features/dashboard/*` | 3–5 | ✅ | — |
| 3-C | `components/features/admin/*` | 4–6 | ✅ (파일 overlap 없을 때) | — |
| 3-D | AWS 도메인 (process-status/aws, projects/[id]/aws) | 4–6 | ✅ | — |
| 3-E | Azure 도메인 | 4–6 | ✅ | — |
| 3-F | GCP 도메인 | 3–5 | ✅ | — |
| 3-G | IDC 도메인 (IdcResourceInputPanel 등) | 4–6 | ✅ | — |
| 3-H | SDU 도메인 | 3–5 | ✅ | — |
| 3-I | `features/{scan,history,queue-board,resource-table}/*` | 4–6 | ✅ | — |
| 3-J | `projects/[projectId]/**` 페이지 레벨 (alert 등) | 3–5 | △ (3-D~3-H 와 파일 중첩 주의) | — |
| 3-K | `integration/{admin,projects,task_admin}/*` | 2–4 | ✅ | — |
| 4 | fetch-json + Route Handler + mock 계약 변경 | 6–10 | ✗ (2-C 이후) | code 중심 응답, UI `err.message` 미사용 |
| 5 | LanguageSwitcher UI (TopNav 배치) | 1–2 | ✅ | cookie 변경 + `router.refresh()` 동작 |
| 6 | en 번역 전체 채우기 + 스크린별 QA | **16–24** | ✗ (Phase 1~5 이후) | 모든 키 영문 대응 + 수동 검수 완료 |
| 7 | BFF code-only 계약 정착 시 FE 어댑터 간소화 | 2–4 | ✅ (BFF 준비 후) | `rawDetail` 의존 제거 |
| **합계** | | **~80–130 시간** (≈ **2~3주 FTE**) | | |

**가정**: ko/en 2 개 범위. 개발자 1명 풀타임 기준. 디자인 변경 없음. BFF 코드 변경 요청 분량은 별도 트랙(Phase 7).

**분할**: 3-A ~ 3-K 는 파일 overlap 이 적어 2~3명이 병렬 작업 가능. 동시 3명이 진행하면 Phase 3 블록 5~8 일 내 완료 가능.

**리스크 버퍼**: +20% 권장 (용어 사전 합의 지연, 번역 재검수 등).

### 10.6 테스트 전략 상세

#### 10.6.1 기존 테스트 내 한국어 expected string 실사

```bash
grep -rn "'[^']*[가-힣][^']*'\|\"[^\"]*[가-힣][^\"]*\"" __tests__ app/**/__tests__ \
  --include="*.test.ts" --include="*.test.tsx" | head -30
```

- 예상: 수십~100 행. 대부분 `expect(screen.getByText('…')).toBeVisible()` 같은 단언.
- Phase 1 착수 전 실측해서 Phase 6 스코프에 포함.

#### 10.6.2 Test helper

```tsx
// test/renderWithLocale.tsx
import { render } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import koMessages from '@/messages/ko';
import enMessages from '@/messages/en';

export const renderWithLocale = (
  ui: React.ReactElement,
  { locale = 'ko' }: { locale?: 'ko' | 'en' } = {}
) =>
  render(
    <NextIntlClientProvider locale={locale} messages={locale === 'ko' ? koMessages : enMessages}>
      {ui}
    </NextIntlClientProvider>
  );
```

#### 10.6.3 Locale parametrize 패턴

```tsx
describe.each(['ko', 'en'] as const)('ProjectCreateModal (%s)', (locale) => {
  it('renders title', () => {
    renderWithLocale(<ProjectCreateModal open />, { locale });
    const expected = locale === 'ko' ? '인프라 등록' : 'Register Infrastructure';
    expect(screen.getByText(expected)).toBeVisible();
  });
});
```

#### 10.6.4 Snapshot 전략

- Snapshot 은 locale 별 suffix (`Component.ko.snap`, `Component.en.snap`) — `toMatchSpecificSnapshot(locale)` 헬퍼로 감싸기.
- Phase 3 PR 단위로 `ko` snapshot 은 유지, `en` snapshot 은 Phase 6 에 일괄 생성.

#### 10.6.5 CI 게이트

`.github/workflows/i18n.yml` (신규):

```yaml
name: i18n verification
on: [pull_request]
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run i18n:hunt          # scripts/i18n-hunt.ts
      - run: npm run i18n:diff          # scripts/i18n-diff.ts
      - run: npm run lint               # 커스텀 ESLint rule 포함
      - run: npm test                   # 기존 + renderWithLocale 기반 테스트
```

세부 스크립트는 §12.10 참조.

#### 10.6.6 수동 QA 체크리스트 (Phase 6)

- [ ] 각 도메인 페이지(AWS/Azure/GCP/IDC/SDU) 에서 ko → en 전환 후 **Network 탭 재호출 0** 확인 (요구사항 1차 검증)
- [ ] 각 모달의 title/description/버튼 영문 자연스러움
- [ ] aria-label 영문 (스크린리더 QA)
- [ ] `process-guides` 7단계 영문 문장 자연스러움 (기획 검수)
- [ ] 에러 상황 시 영문 메시지 표시 (401/403/404/409/429/500 시나리오)
- [ ] 날짜/숫자 포맷 locale 따라 변경 확인
- [ ] `<html lang>` 가 현재 locale 과 일치
- [ ] LanguageSwitcher 전환 후 새로고침 해도 cookie 로 locale 유지
- [ ] 장문 가이드의 `<strong>`, `<link>` 마크업이 깨지지 않음
- [ ] 빈 번역 키 없음 (CI 통과 재확인)

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

### 12.10 검증 인프라 설계

사용자 노출 한국어가 **점진적 마이그레이션 중에도 재발하지 않도록** 빌드·CI 레벨 가드를 구축한다.

#### 12.10.1 `scripts/i18n-hunt.ts` — 한국어 리터럴 헌터

```ts
// scripts/i18n-hunt.ts
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';

const KOREAN = '[가-힣]';
const SCAN_ROOTS = ['app', 'lib', 'components'];
const EXCLUDE = ['__tests__', 'node_modules', '.next', 'design'];

const allowlistPath = 'scripts/i18n-hunt.allowlist';
const allow = existsSync(allowlistPath)
  ? new Set(readFileSync(allowlistPath, 'utf-8').split('\n').filter(Boolean))
  : new Set<string>();

const cmd = `grep -rn "${KOREAN}" ${SCAN_ROOTS.join(' ')} ` +
  `--include="*.ts" --include="*.tsx" | ` +
  EXCLUDE.map((e) => `grep -v "${e}"`).join(' | ');

const out = execSync(cmd, { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] })
  .split('\n').filter(Boolean);

const violations = out.filter((line) => {
  const [file, lineNum] = line.split(':');
  return !allow.has(`${file}:${lineNum}`);
});

if (violations.length) {
  console.error(`✗ ${violations.length} Korean literal(s) outside allowlist:\n${violations.slice(0, 30).join('\n')}`);
  process.exit(1);
}
console.log('✓ i18n-hunt: no uncovered Korean literals.');
```

- **allowlist** (`scripts/i18n-hunt.allowlist`): `file.ts:lineN` 형태. Phase 2/3 진행 중 아직 마이그레이션 안 된 파일 라인 명시.
- Phase 6 완료 후 allowlist 는 **빈 파일** 유지. 그 이후 새 한국어가 들어오면 CI 실패.
- **주석·console 예외**: lint 규칙으로 주석만 허용하거나, allowlist 패턴으로 처리.

#### 12.10.2 `scripts/i18n-diff.ts` — 번역 키 다이프

```ts
// scripts/i18n-diff.ts
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const flatten = (obj: unknown, prefix = ''): string[] => {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj).flatMap(([k, v]) => flatten(v, prefix ? `${prefix}.${k}` : k));
};

const load = (locale: string): Set<string> => {
  const root = path.join('messages', locale);
  const files = readdirSync(root, { recursive: true })
    .filter((f) => String(f).endsWith('.json'))
    .map((f) => path.join(root, String(f)));
  return new Set(files.flatMap((f) => flatten(JSON.parse(readFileSync(f, 'utf-8')))));
};

const ko = load('ko');
const en = load('en');

const missingInEn = [...ko].filter((k) => !en.has(k));
const missingInKo = [...en].filter((k) => !ko.has(k));

if (missingInEn.length || missingInKo.length) {
  if (missingInEn.length) console.error(`✗ missing in en (${missingInEn.length}):\n  ` + missingInEn.slice(0, 20).join('\n  '));
  if (missingInKo.length) console.error(`✗ missing in ko (${missingInKo.length}):\n  ` + missingInKo.slice(0, 20).join('\n  '));
  process.exit(1);
}
console.log(`✓ i18n-diff: ${ko.size} keys balanced across ko/en.`);
```

- Phase 6 까지는 en 에 미완 번역이 있을 수 있으므로 `--allow-missing-en` 플래그로 완화 모드 제공.
- Phase 6 완료 시 flag 제거 → strict 모드.

#### 12.10.3 ESLint 커스텀 rule — `i18n/no-locale-in-hook-deps`

```js
// eslint-rules/no-locale-in-hook-deps.js
module.exports = {
  meta: {
    type: 'problem',
    docs: {
      description: 'locale 을 useEffect/useCallback/useMemo deps 에 포함하면 locale 변경 시 불필요한 재요청 발생 — i18n 설계 위반.',
    },
  },
  create(context) {
    return {
      'CallExpression[callee.name=/^(useCallback|useMemo|useEffect)$/]'(node) {
        const deps = node.arguments[1];
        if (!deps || deps.type !== 'ArrayExpression') return;
        deps.elements.forEach((el) => {
          if (el?.type === 'Identifier' && el.name === 'locale') {
            context.report({
              node: el,
              message: 'locale 을 hook deps 에 넣지 마세요. 렌더 body 에서 t() 호출하세요. (§12.2 참조)',
            });
          }
        });
      },
    };
  },
};
```

`.eslintrc.js` 에 rule 등록 (`rules: { 'i18n/no-locale-in-hook-deps': 'error' }`).

#### 12.10.4 ESLint 커스텀 rule — `i18n/no-korean-in-jsx` (선택)

JSX 내 직접 한국어 문자열 금지 (Phase 6 이후 재발 방지):

```js
// eslint-rules/no-korean-in-jsx.js
const KOREAN_RX = /[가-힣]/;
module.exports = {
  meta: { type: 'problem' },
  create(context) {
    return {
      JSXText(node) {
        if (KOREAN_RX.test(node.value)) {
          context.report({ node, message: 'JSX 내 한국어 리터럴 금지. t() 를 사용하세요.' });
        }
      },
      Literal(node) {
        if (typeof node.value === 'string' && KOREAN_RX.test(node.value)) {
          // 속성에 들어간 한국어도 감시 (placeholder, aria-label 등)
          if (node.parent?.type === 'JSXAttribute') {
            context.report({ node, message: 'JSX 속성 내 한국어 리터럴 금지. t() 를 사용하세요.' });
          }
        }
      },
    };
  },
};
```

#### 12.10.5 package.json 스크립트

```json
{
  "scripts": {
    "i18n:hunt": "tsx scripts/i18n-hunt.ts",
    "i18n:diff": "tsx scripts/i18n-diff.ts",
    "i18n:diff:strict": "tsx scripts/i18n-diff.ts --strict",
    "lint:i18n": "eslint . --rulesdir eslint-rules --rule 'i18n/no-locale-in-hook-deps: error' --rule 'i18n/no-korean-in-jsx: error'"
  }
}
```

#### 12.10.6 CI 통합

`.github/workflows/i18n.yml`:

```yaml
name: i18n verification
on:
  pull_request:
    paths:
      - 'app/**'
      - 'lib/**'
      - 'components/**'
      - 'messages/**'
      - 'scripts/i18n-*.ts'
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run i18n:hunt
      - run: npm run i18n:diff    # Phase 6 완료 후 :strict 로 변경
      - run: npm run lint:i18n
```

#### 12.10.7 번역 키 커버리지 리포트 (선택)

- `unimported` + 커스텀 스크립트로 `t('key')` 의 실제 호출 여부 추출
- 미사용 키 → `i18n:unused` warning (삭제 유도)
- 사용 빈도 heatmap 으로 priority 조정

#### 12.10.8 mock 응답 한국어 감시

```
grep -rn "[가-힣]" lib/api-client/mock lib/mock-*.ts \
  | grep -v "// @i18n-mock-ok"   # 의도적 사용자 입력 시뮬레이션은 주석으로 마킹
```

Phase 4 완료 후 CI 에 추가.

#### 12.10.9 도입 타임라인

| Phase | 관련 가드 |
|---|---|
| 1 | `i18n:diff` 도입 (초기 시드 1~2개 키만) |
| 2 | `i18n:hunt` 도입 + allowlist 로 점진 축소 |
| 3 | ESLint `no-locale-in-hook-deps` rule 활성화 |
| 4 | mock 응답 한국어 감시 추가 |
| 6 | `no-korean-in-jsx` rule 활성화 + `i18n:diff:strict` |
| 7 | allowlist 비움, rawDetail 제거 감시 |

---

## 13. 오픈 이슈 / 팀 협의 필요

| # | 이슈 | 결정권자 | 권장안 | 영향 |
|---|---|---|---|---|
| O1 | `router.refresh()` 로 RSC 재요청 허용? | PO + FE | 허용 (§12.5 옵션 ii) | Phase 5 구현 방식 결정 |
| ~~O2~~ | ~~지원 언어 1차 범위~~ | ~~PO~~ | **✅ 결정: ko, en (2026-04-23)** | — |
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

## 부록 D — 전수 조사 매트릭스 (2026-04-23, main@9b5b6ab 기준)

### D-1. 스코프 및 방법

- 범위: `/app`, `/lib`, `/components`
- 제외: `/docs`(문서), `/design`(SIT 프로토타입 legacy), `__tests__`, `node_modules`, `.next`
- 검출 패턴: `[가-힣]` 유니코드 포함 라인
- 재현 명령: 부록 D-5

> 이전 PR #319 초안의 "3,100 라인"은 `/design` 포함 값. 본 보강에서는 **실제 프로덕션 경로만** 집계했고 그래서 2,660 으로 내려갔다. 후속 번역 규모 산정에 이 수치를 사용하라.

### D-2. 총량 요약

| 지표 | 값 |
|---|---|
| 한국어 포함 파일 수 | **209** |
| 한국어 라인 수 (총) | **2,660** |
| 번역 대상 라인 (주석·console 제외) | **2,162** |
| 고유 한국어 문자열 근사치 | **~1,100** (보수적) |
| 라벨 맵 상수 | **16 종**, 라벨값 **81 개** |
| 에러 코드 엔트리 | **44 개** (중복 포함) / **~15 고유 code** |

### D-3. 카테고리별 총계

| # | 카테고리 | 건수 | 비율 | 번역 대상 |
|---|---|---|---|---|
| (a) | JSX 텍스트 리터럴 | 1,032 | 38.8% | ✅ |
| (e) | Mock 응답 한국어 | 610 | 22.9% | ✅ (mock 계약 정리) |
| (j) | 주석 | 495 | 18.6% | — 번역 대상 아님 |
| (h) | 장문 가이드 (process-guides) | 244 | 9.2% | ✅ |
| (d) | enum/라벨 맵 | 116 | 4.4% | ✅ |
| (b) | JSX 속성(placeholder/aria-label/title/alt) | 74 | 2.8% | ✅ |
| (c) | alert/toast/Error 메시지 | 46 | 1.7% | ✅ |
| (g) | validation/에러 상수 메시지 | 39 | 1.5% | ✅ |
| (i) | console.log 한국어 | 3 | 0.1% | — 로그용 |
| (f) | 로케일 포매팅 `'ko-KR'` | 1 | 0.04% | ✅ |
| **번역 영향 합계 (주석·console 제외)** | — | **2,162** | 81.3% | — |

### D-4. 상위 30개 핫스팟 파일 (소계 내림차순)

| 파일 | a | b | c | d | e | f | g | h | i | j | 소계 |
|---|---|---|---|---|---|---|---|---|---|---|---|
| lib/constants/process-guides.ts | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 222 | 0 | 0 | 222 |
| lib/api-client/mock/confirm.ts | 0 | 0 | 0 | 14 | 82 | 0 | 0 | 0 | 0 | 0 | 96 |
| lib/types.ts | 8 | 0 | 0 | 0 | 2 | 0 | 0 | 0 | 0 | 78 | 88 |
| lib/mock-data.ts | 0 | 0 | 0 | 2 | 78 | 0 | 0 | 0 | 0 | 0 | 80 |
| lib/mock-dashboard.ts | 0 | 0 | 0 | 25 | 38 | 0 | 0 | 0 | 0 | 0 | 63 |
| lib/api-client/mock/projects.ts | 0 | 0 | 0 | 0 | 57 | 0 | 0 | 0 | 0 | 0 | 57 |
| lib/mock-sdu.ts | 0 | 0 | 0 | 0 | 49 | 0 | 0 | 0 | 0 | 0 | 49 |
| lib/mock-azure.ts | 0 | 0 | 0 | 13 | 35 | 0 | 0 | 0 | 0 | 0 | 48 |
| lib/mock-service-settings.ts | 0 | 0 | 0 | 0 | 45 | 0 | 0 | 0 | 0 | 0 | 45 |
| lib/constants/labels.ts | 29 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 13 | 42 |
| app/components/features/process-status/aws/AwsInstallationInline.tsx | 39 | 1 | 0 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 41 |
| lib/theme.ts | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 29 | 39 |
| app/components/features/history/ProjectHistoryDetailModal.tsx | 22 | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 7 | 38 |
| lib/mock-installation.ts | 0 | 0 | 0 | 0 | 38 | 0 | 0 | 0 | 0 | 0 | 38 |
| lib/mock-idc.ts | 0 | 0 | 0 | 4 | 32 | 0 | 0 | 0 | 0 | 0 | 36 |
| lib/constants/sdu.ts | 18 | 0 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 8 | 35 |
| app/components/features/process-status/ApprovalRequestDetailModal.tsx | 32 | 1 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 33 |
| app/integration/projects/[targetSourceId]/_components/idc/IdcProcessStatusCard.tsx | 19 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 11 | 30 |
| lib/api-client/mock/queue-board.ts | 0 | 0 | 0 | 0 | 30 | 0 | 0 | 0 | 0 | 0 | 30 |
| app/components/features/process-status/azure/AzureInstallationInline.tsx | 19 | 5 | 0 | 4 | 0 | 0 | 0 | 0 | 0 | 1 | 29 |
| lib/process/calculator.ts | 9 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 19 | 28 |
| app/integration/admin/dashboard/page.tsx | 17 | 0 | 0 | 10 | 0 | 0 | 0 | 0 | 0 | 0 | 27 |
| app/integration/projects/[targetSourceId]/_components/sdu/SduProcessStatusCard.tsx | 23 | 0 | 0 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 26 |
| app/components/features/admin/ApprovalDetailModal.tsx | 24 | 2 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 26 |
| lib/fetch-json.ts | 8 | 0 | 0 | 0 | 0 | 0 | 3 | 0 | 1 | 14 | 26 |
| lib/mock-scan.ts | 0 | 0 | 0 | 0 | 25 | 0 | 0 | 0 | 0 | 0 | 25 |
| app/components/features/idc/IdcResourceInputPanel.tsx | 16 | 4 | 0 | 0 | 0 | 0 | 2 | 0 | 0 | 1 | 23 |
| app/components/features/resource-table/VmDatabaseConfigPanel.tsx | 11 | 3 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 9 | 23 |
| lib/constants/idc.ts | 7 | 0 | 0 | 0 | 0 | 0 | 9 | 0 | 0 | 7 | 23 |
| app/components/ui/Table.tsx | 7 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 15 | 22 |

나머지 179 파일 누적 **~1,290 라인**.

### D-5. 재현 명령

```bash
# 한국어 라인 총계
grep -rn "[가-힣]" app lib components \
  --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__\|node_modules\|\.next\|^design/" \
  | wc -l
# → 2660

# 한국어 포함 파일 수
grep -rl "[가-힣]" app lib components \
  --include="*.ts" --include="*.tsx" \
  | grep -v "__tests__\|node_modules\|\.next\|^design/" \
  | wc -l
# → 209
```

### D-6. 주요 발견

1. **`toLocaleString('ko-KR')` 하드코딩이 거의 없음(1건)**. 날짜·숫자 포매팅 수정 범위가 예상보다 훨씬 적다. Phase 2-D 공수 2~4h 로 하향.
2. **`lib/types.ts` 88줄 중 78줄은 주석**. 번역 착시 주의 — 실제 번역 대상은 10줄.
3. **Mock 계층 610줄이 프로덕션 코드와 무관하지만 UI 직접 노출 경로**. 그대로 두면 개발/QA 환경에서 i18n 인상 단절. §8, 부록 H.
4. **`process-guides.ts` 단일 파일이 (h) 카테고리의 91%**. 별도 PR 분리 정당성 유지.
5. **에러 코드가 6 파일에 걸쳐 중복 정의됨** (UNAUTHORIZED, FORBIDDEN, NOT_FOUND 는 값도 불일치). 부록 G-2 에서 통합 가능 케이스 표시.

---

## 부록 E — `process-guides.ts` 완전 덤프

파일: `lib/constants/process-guides.ts` (526 LOC, 한국어 222 라인).

> Phase 2-E 번역 작업 초안 입력 자료. 실제 키 할당과 JSON 분해는 해당 PR 에서 수행.

### E-1. `DEFAULT_STEP_GUIDES` 32 필드

| key path | 원문 | 길이 | 라인 | rich token |
|---|---|---|---|---|
| 1.heading | 연동 대상 DB를 선택해 주세요 | 17 | 12 | — |
| 1.summary[0] | Run Infra Scan을 통해 조회된 DB 리스트에서 PII 모니터링이 필요한 DB를 체크하고, 하단의 | 62 | 14 | — |
| 1.summary[1].strong | 연동 대상 승인 요청 | 10 | 15 | `<strong>` |
| 1.summary[2] | ` 버튼을 눌러 주세요.` | 10 | 16 | — |
| 1.bullets[0][0] | Scan은 평균 3~5분 내외 소요되며, 대상 리소스가 많을 경우 더 길어질 수 있습니다. | 48 | 19 | — |
| 1.bullets[1][0] | 보안 설정 또는 권한 문제로 스캔이 실패했다면 | 28 | 21 | — |
| 1.bullets[1][1].link | 가이드 문서 | 7 | 22 | `<link>` |
| 1.bullets[1][2] | 를 확인해 주세요. | 10 | 23 | — |
| 2.heading | 승인자의 검토를 기다리고 있어요 | 17 | 28 | — |
| 2.summary[0] | 요청하신 DB 연동 대상 목록은 보안팀 및 데이터 관리자의 검토를 받고 있습니다. 승인 결과는 메일과 Slack으로 안내됩니다. | 74 | 30 | — |
| 2.bullets[0][0] | 평균 1영업일 이내 검토가 완료됩니다. | 22 | 33 | — |
| 2.bullets[1][0] | 3영업일 이상 지연 시 | 15 | 35 | — |
| 3.heading | 승인된 DB를 시스템에 반영하고 있어요 | 21 | 42 | — |
| 3.summary[0] | 승인된 DB에 대한 메타 정보가 PII Agent 관리 시스템에 동기화되는 중입니다. 이 과정은 자동으로 진행되며 별도 조치가 필요하지 않습니다. | 85 | 44 | — |
| 3.bullets[0][0] | 반영 완료까지 최대 10분가량 소요될 수 있습니다. | 30 | 47 | — |
| 3.bullets[1][0] | 이 단계에서는 실제 데이터가 전송되지 않으며, 메타데이터만 동기화됩니다. | 42 | 48 | — |
| 4.heading | PII Agent를 설치해 주세요 | 18 | 52 | — |
| 4.summary[0] | 발급된 Credential과 설치 스크립트를 사용해 대상 인프라에 PII Agent를 배포합니다. Agent 설치 후 자동으로 다음 단계로 넘어갑니다. | 78 | 54 | — |
| 4.bullets[0][0] | Credential은 | 9 | 58 | — |
| 4.bullets[0][1].link | Credentials 메뉴 | 10 | 59 | `<link>` |
| 4.bullets[1][0] | Docker / Helm / Binary 설치 방식은 | 19 | 63 | — |
| 4.bullets[1][1].link | 설치 가이드 | 7 | 64 | `<link>` |
| 4.bullets[2][0] | Agent는 설치 환경의 최소 사양(2 vCPU / 4GB RAM) 이상을 권장합니다. | 49 | 67 | — |
| 5.heading | Agent와 N-IRP 간 통신을 확인하고 있어요 | 27 | 71 | — |
| 5.summary[0] | 설치된 Agent가 N-IRP(개인정보 리스크 플랫폼)와 정상적으로 통신하는지 자동으로 점검합니다. 네트워크 ACL과 방화벽 정책이 올바른지 확인해 주세요. | 89 | 73 | — |
| 5.bullets[0][0] | 테스트 실패 시 네트워크 구간(443, 8443 포트)을 우선 점검해 주세요. | 42 | 76 | — |
| 5.bullets[1][0] | 재시도는 최대 5회까지 자동 수행됩니다. | 26 | 77 | — |
| 6.heading | 최종 관리자 승인을 기다리고 있어요 | 19 | 81 | — |
| 6.summary[0] | PII Agent 운영팀의 최종 승인이 완료되면 모니터링이 시작됩니다. 승인 결과는 메일로 전달됩니다. | 55 | 83 | — |
| 6.bullets[0][0] | 긴급 건은 | 7 | 87 | — |
| 6.bullets[1][0] | 승인 취소 또는 설정 변경이 필요하다면 이 단계에서 요청 가능합니다. | 38 | 91 | — |
| 7.heading | 모든 연동이 완료되었습니다 | 14 | 95 | — |
| 7.summary[0] | PII Agent가 정상 동작 중이며, 탐지 결과는 PII Map 및 대시보드에서 확인할 수 있습니다. | 47 | 97 | — |
| 7.bullets[0][0] | 탐지 리포트는 매일 09:00에 자동 발송됩니다. | 26 | 100 | — |
| 7.bullets[1][0] | 인프라 변경 발생 시 다시 이 화면에서 재연동을 진행해 주세요. | 32 | 101 | — |

### E-2. 사전 조치 가이드 3종

| 상수 | label | summary (요약) | steps | warnings | notes |
|---|---|---|---|---|---|
| `SCAN_ROLE_GUIDE` (L108-128) | 스캔 Role 등록 | AWS IAM Role을 생성하고, PII Agent가 리소스를 스캔할 수 있도록 권한을 부여합니다 | 8 | 2 | 2 |
| `DB_CREDENTIAL_GUIDE` (L130-152) | DB Credential 등록 | 연동 대상 데이터베이스의 접속 정보를 등록합니다 | 8 | 3 | 2 |
| `TF_EXECUTION_ROLE_GUIDE` (L154-176) | TerraformExecutionRole 등록 | 자동 설치에 필요한 Terraform 실행 Role을 AWS 계정에 생성합니다 | 8 | 3 | 2 |

필드별 키 수: 3 × (label + summary + 8 steps + 2.5 warnings + 2 notes) ≈ **44 키**.

### E-3. Provider 별 가이드

| 상수 | 라인 | 단계 | 고유 번역량 |
|---|---|---|---|
| `AWS_AUTO_GUIDE` | L186-280 (~95줄) | 7 | 각 단계 label/description/procedures(~4)/warnings(~2)/notes(~2) 모두 고유. ~70 키 |
| `AWS_MANUAL_GUIDE` | L287-409 (~120줄) | 7 | 거의 동일하지만 Step 4 가 "TF Script 수동 설치". ~70 키 (중복 가능성 50% 이상) |
| `AZURE_GUIDE` | L472-478 | 7 | `buildSimpleProviderGuide` 헬퍼로 공용 템플릿 + Step 4 `Azure 연동`/`Agent 설치`만 override |
| `GCP_GUIDE` | L480-486 | 7 | 동일, Step 4 `GCP 연동`/`Agent 설치` |
| `IDC_GUIDE` | L488-494 | 7 | 동일, Step 4 `IDC 연동`/`Agent 설치` |
| `SDU_GUIDE` | L496-502 | 7 | 동일, Step 4 `SDU 연동`/`Athena 환경 구성` (다른 단계 과 의미 상이하므로 검토 필요) |

**키 수 종합**: DEFAULT 32 + 사전조치 44 + AWS 2종 ~140 + simple provider ~16 + helper template ~40 = **~272 키** (process-guides 단일 파일).

### E-4. `t.rich` 변환 스펙

Before (현재 구조):
```ts
summary: [
  'Run Infra Scan을 통해 조회된 DB 리스트에서 PII 모니터링이 필요한 DB를 체크하고, 하단의 ',
  { strong: '연동 대상 승인 요청' },
  ' 버튼을 눌러 주세요.',
],
bullets: [
  [
    '보안 설정 또는 권한 문제로 스캔이 실패했다면 ',
    { link: '가이드 문서', href: '#' },
    '를 확인해 주세요.',
  ],
],
```

After (`messages/ko/guides/default-steps.json`):
```json
{
  "step1": {
    "heading": "연동 대상 DB를 선택해 주세요",
    "summary": "Run Infra Scan을 통해 조회된 DB 리스트에서 PII 모니터링이 필요한 DB를 체크하고, 하단의 <strong>연동 대상 승인 요청</strong> 버튼을 눌러 주세요.",
    "bullet0": "Scan은 평균 3~5분 내외 소요되며, 대상 리소스가 많을 경우 더 길어질 수 있습니다.",
    "bullet1": "보안 설정 또는 권한 문제로 스캔이 실패했다면 <link>가이드 문서</link>를 확인해 주세요."
  }
}
```

After (`messages/en/guides/default-steps.json`):
```json
{
  "step1": {
    "heading": "Select the target databases for integration",
    "summary": "From the DB list returned by Run Infra Scan, check the databases that require PII monitoring, then click <strong>Request Target Approval</strong> at the bottom.",
    "bullet0": "A scan typically takes 3–5 minutes; it may take longer with many resources.",
    "bullet1": "If the scan fails due to security settings or permissions, see the <link>guide</link>."
  }
}
```

Render:
```tsx
const t = useTranslations('guides.defaultSteps.step1');
<h3>{t('heading')}</h3>
<p>{t.rich('summary', { strong: (c) => <strong>{c}</strong> })}</p>
<ul>
  <li>{t('bullet0')}</li>
  <li>{t.rich('bullet1', { link: (c) => <a href="/docs/scan-guide">{c}</a> })}</li>
</ul>
```

### E-5. 기존 콜사이트 재설계

- `app/components/features/process-status/ProcessGuideStepCard.tsx` — 현재 `content: StepGuideContent` prop 수용. After: `step: number` prop 만 받고 내부에서 `useTranslations` 호출.
- `app/components/features/GuideCard.tsx` — 사전조치 가이드 렌더. 동일 변경.
- `lib/types/process-guide.ts` — `StepGuideContent` union(`string | { strong: string } | { link: string; href: string }`)을 제거. 타입 축소.
- `app/components/features/process-status/**/*Guide*.tsx` — AWS/Azure/GCP/IDC/SDU 별 info card 내부의 가이드 소비부.

---

## 부록 F — enum/라벨 맵 전수 카탈로그

> 라벨 맵 상수 **16 종**, 한국어 라벨값 **81 개**. Phase 2-A 스코프의 근간.

### F-1. `lib/constants/labels.ts`

#### `ERROR_TYPE_LABELS` (L21-27)
| key | ko |
|---|---|
| AUTH_FAILED | 인증 실패 |
| PERMISSION_DENIED | 권한 부족 |
| NETWORK_ERROR | 네트워크 오류 |
| TIMEOUT | 연결 타임아웃 |
| UNKNOWN_ERROR | 알 수 없는 오류 |

#### `PROCESS_STATUS_LABELS` (L32-40)
| key (enum ProcessStatus) | ko |
|---|---|
| WAITING_TARGET_CONFIRMATION | 연동 대상 확정 대기 |
| WAITING_APPROVAL | 승인 대기 |
| APPLYING_APPROVED | 연동대상 반영 중 |
| INSTALLING | 설치 진행 중 |
| WAITING_CONNECTION_TEST | 연결 테스트 필요 |
| CONNECTION_VERIFIED | 연결 확인 완료 |
| INSTALLATION_COMPLETE | 설치 완료 |

#### `CONNECTION_STATUS_CONFIG.label` (L45-65)
| key | ko |
|---|---|
| CONNECTED | 연결됨 |
| DISCONNECTED | 연결 끊김 |
| PENDING | 대기중 |

#### `REGION_LABELS` (L70-75)
| key | ko |
|---|---|
| ap-northeast-2 | 서울 (ap-northeast-2) |
| ap-northeast-1 | 도쿄 (ap-northeast-1) |

#### `PROVIDER_DESCRIPTIONS` (L126-132)
| key | ko |
|---|---|
| AWS | Amazon Web Services 환경의 RDS, DynamoDB 등 데이터 리소스를 자동 스캔합니다. |
| Azure | Microsoft Azure 클라우드 환경의 데이터베이스 리소스를 스캔하고 PII Agent를 연동합니다. |
| GCP | Google Cloud Platform의 Cloud SQL, BigQuery 등 데이터 리소스를 관리합니다. |
| IDC | 온프레미스 데이터센터의 데이터베이스 리소스를 수동 등록하여 관리합니다. |
| SDU | 삼성 SDS 데이터 유니버스 환경의 데이터 리소스를 연동합니다. |

#### Fallback reducer 함수 (default 반환값)
| 함수 | 라인 | default |
|---|---|---|
| `getServiceCodeDisplay` | L200 | 서비스 코드 미제공 |
| `getErrorTypeLabel` | L88 | 알 수 없는 오류 |
| `getProcessStatusLabel` | L95 | 알 수 없는 상태 |

### F-2. `lib/constants/azure.ts`

#### `PRIVATE_ENDPOINT_STATUS_LABELS` (L3-8)
| key | ko |
|---|---|
| NOT_REQUESTED | BDC측 확인 필요 |
| PENDING_APPROVAL | Azure Portal에서 승인 필요 |
| APPROVED | 승인 완료 |
| REJECTED | BDC측 재신청 필요 |

### F-3. `lib/constants/gcp.ts`

#### `GCP_STEP_LABELS` (L13-17)
| key | ko |
|---|---|
| serviceSideSubnetCreation | Subnet 생성 |
| serviceSideTerraformApply | Service TF 설치 |
| bdcSideTerraformApply | BDC TF 설치 |

#### `GCP_STEP_STATUS_LABELS` (L21-26)
| key | ko |
|---|---|
| COMPLETED | 완료 |
| FAIL | 실패 |
| IN_PROGRESS | 진행중 |
| SKIP | 해당없음 |

#### `GCP_INSTALLATION_STATUS_LABELS` (L30-34)
| key | ko |
|---|---|
| COMPLETED | 설치 완료 |
| FAIL | 설치 실패 |
| IN_PROGRESS | 설치 진행 중 |

### F-4. `lib/constants/sdu.ts`

#### `SDU_STEP_LABELS` (L60-65)
| key | ko |
|---|---|
| s3Upload | S3 업로드 |
| installation | 설치 |
| connectionTest | 테스트 |
| complete | 완료 |

#### `SDU_PROCESS_STATUS_LABELS` (L69-76)
| key | ko |
|---|---|
| S3_UPLOAD_PENDING | S3 업로드 대기 |
| S3_UPLOAD_CONFIRMED | S3 업로드 확인 완료 |
| INSTALLING | 환경 구성 중 |
| WAITING_CONNECTION_TEST | 연결 테스트 대기 |
| CONNECTION_VERIFIED | 연결 확인 완료 |
| INSTALLATION_COMPLETE | 설치 완료 |

#### `CRAWLER_RUN_STATUS_LABELS` (L80-84)
| key | ko |
|---|---|
| NONE | 미실행 |
| SUCCESS | 성공 |
| FAILED | 실패 |

#### `ATHENA_SETUP_STATUS_LABELS` (L88-92)
| key | ko |
|---|---|
| PENDING | 대기 |
| IN_PROGRESS | 진행 중 |
| COMPLETED | 완료 |

#### `SOURCE_IP_STATUS_LABELS` (L96-99)
| key | ko |
|---|---|
| PENDING | 등록 대기 |
| CONFIRMED | 확인 완료 |

### F-5. `lib/constants/idc.ts`

#### `IDC_TF_STATUS_LABELS` (L12-17)
| key | ko |
|---|---|
| PENDING | TF 설치 대기 |
| IN_PROGRESS | TF 설치 중 |
| COMPLETED | TF 설치 완료 |
| FAILED | TF 설치 실패 |

#### `IDC_SOURCE_IP_RECOMMENDATIONS.*.description` (L87-103)
| key | ko |
|---|---|
| public | Public IP 환경에서 사용하는 BDC 서버 IP입니다. |
| private | Private IP (사내망) 환경에서 사용하는 BDC 서버 IP입니다. |
| vpc | VPC 연동 환경에서 사용하는 BDC 서버 IP입니다. |

### F-6. 인라인 switch-case 한국어 라벨 (별도 refactor 필요)

| 파일 | 라인 | 대상 | 권장 |
|---|---|---|---|
| `app/components/features/TerraformStatusModal.tsx` | 11-30 | `getTerraformStatusStyle` / `getFirewallStatusStyle` 의 switch-case | `terraform.status.*` / `terraform.firewall.*` 맵 상수로 추출 후 i18n |
| `app/components/features/StepIndicator.tsx` | 10-17 | `steps` 배열의 인라인 label | `PROCESS_STATUS_LABELS` 재사용 |

### F-7. Phase 2-A 전환 전략

1. 각 맵의 key 는 그대로 유지 → `messages/ko/*.json` 값 이전
2. 훅 래퍼 제공:
   ```ts
   // lib/i18n/hooks.ts
   export const useProcessStatusLabel = () => {
     const t = useTranslations('process.status');
     return (status: ProcessStatus) => t(STATUS_TO_KEY[status]);
   };
   export const useConnectionStatusLabel = () => { /* ... */ };
   ```
3. 기존 `PROCESS_STATUS_LABELS[status]` 콜사이트 → `useProcessStatusLabel()(status)` 로 교체
4. Record 상수 자체는 제거 대신 key 맵으로 강등 (아래):
   ```ts
   // lib/constants/labels.ts (After)
   export const PROCESS_STATUS_KEY: Record<ProcessStatus, string> = {
     [ProcessStatus.WAITING_TARGET_CONFIRMATION]: 'waitingTargetConfirmation',
     // ...
   };
   ```

---

## 부록 G — 에러 코드 전수 카탈로그

### G-1. 통합 테이블 (44 엔트리)

| # | 파일 | code | status | ko message | 중복/상이 |
|---|---|---|---|---|---|
| 1 | azure.ts:14 | UNAUTHORIZED | 401 | 인증이 필요합니다. | ⟲ gcp/sdu/idc 동일 |
| 2 | azure.ts:19 | FORBIDDEN | 403 | 접근 권한이 없습니다. | ⟲ gcp/sdu/idc 동일 |
| 3 | azure.ts:24 | NOT_FOUND | 404 | 리소스를 찾을 수 없습니다. | ⟲ gcp/sdu/idc 동일 |
| 4 | azure.ts:29 | NOT_AZURE_PROJECT | 400 | Azure 프로젝트가 아닙니다. | 고유 |
| 5 | azure.ts:34 | SERVICE_NOT_FOUND | 404 | 서비스를 찾을 수 없습니다. | ⟲ gcp/idc 동일 |
| 6 | azure.ts:39 | NO_VM_RESOURCES | 400 | VM 리소스가 없습니다. | 고유 |
| 7 | azure.ts:44 | VALIDATION_FAILED | 400 | 검증에 실패했습니다. | ⟲ gcp/sdu/idc 동일 |
| 8 | gcp.ts:78 | UNAUTHORIZED | 401 | 인증이 필요합니다. | ⟲ |
| 9 | gcp.ts:83 | FORBIDDEN | 403 | 접근 권한이 없습니다. | ⟲ |
| 10 | gcp.ts:88 | NOT_FOUND | 404 | 리소스를 찾을 수 없습니다. | ⟲ |
| 11 | gcp.ts:93 | NOT_GCP_PROJECT | 400 | GCP 프로젝트가 아닙니다. | 고유 |
| 12 | gcp.ts:98 | SERVICE_NOT_FOUND | 404 | 서비스를 찾을 수 없습니다. | ⟲ |
| 13 | gcp.ts:103 | VALIDATION_FAILED | 400 | 검증에 실패했습니다. | ⟲ |
| 14 | sdu.ts:12 | UNAUTHORIZED | 401 | 인증이 필요합니다. | ⟲ |
| 15 | sdu.ts:17 | FORBIDDEN | 403 | 접근 권한이 없습니다. | ⟲ |
| 16 | sdu.ts:22 | NOT_FOUND | 404 | 리소스를 찾을 수 없습니다. | ⟲ |
| 17 | sdu.ts:27 | NOT_SDU_PROJECT | 400 | SDU 프로젝트가 아닙니다. | 고유 |
| 18 | sdu.ts:32 | VALIDATION_FAILED | 400 | 검증에 실패했습니다. | ⟲ |
| 19 | sdu.ts:37 | INVALID_CIDR | 400 | 유효하지 않은 CIDR 형식입니다. | 고유 |
| 20 | sdu.ts:42 | S3_NOT_UPLOADED | 400 | S3에 데이터가 업로드되지 않았습니다. | 고유 |
| 21 | sdu.ts:47 | IAM_USER_NOT_FOUND | 404 | IAM USER를 찾을 수 없습니다. | 고유 |
| 22 | sdu.ts:51 | SOURCE_IP_NOT_REGISTERED | 400 | SourceIP가 등록되지 않았습니다. | 고유 |
| 23 | idc.ts:23 | UNAUTHORIZED | 401 | 인증이 필요합니다. | ⟲ |
| 24 | idc.ts:28 | FORBIDDEN | 403 | 접근 권한이 없습니다. | ⟲ |
| 25 | idc.ts:33 | NOT_FOUND | 404 | 리소스를 찾을 수 없습니다. | ⟲ |
| 26 | idc.ts:38 | NOT_IDC_PROJECT | 400 | IDC 프로젝트가 아닙니다. | 고유 |
| 27 | idc.ts:43 | SERVICE_NOT_FOUND | 404 | 서비스를 찾을 수 없습니다. | ⟲ |
| 28 | idc.ts:48 | VALIDATION_FAILED | 400 | 검증에 실패했습니다. | ⟲ |
| 29 | idc.ts:53 | INVALID_IP_TYPE | 400 | 유효하지 않은 IP 타입입니다. | 고유 |
| 30 | idc.ts:58 | ORACLE_REQUIRES_SERVICE_ID | 400 | Oracle DB는 ServiceId가 필수입니다. | 고유 |
| 31 | idc.ts:63 | FIREWALL_NOT_OPENED | 400 | 방화벽이 아직 오픈되지 않았습니다. | 고유 |
| 32 | scan.ts:52 | UNAUTHORIZED | 401 | 로그인이 필요합니다. | ⚠ azure 등과 문구 상이 |
| 33 | scan.ts:53 | FORBIDDEN | 403 | 해당 프로젝트에 대한 권한이 없습니다. | ⚠ azure 등과 문구 상이 |
| 34 | scan.ts:54 | NOT_FOUND | 404 | 프로젝트를 찾을 수 없습니다. | ⚠ azure 등과 문구 상이 |
| 35 | scan.ts:55 | SCAN_NOT_FOUND | 404 | 해당 스캔을 찾을 수 없습니다. | 고유 |
| 36 | scan.ts:56 | SCAN_NOT_SUPPORTED | 400 | 스캔을 지원하지 않는 Provider입니다. | 고유 |
| 37 | scan.ts:57 | SCAN_IN_PROGRESS | 409 | 이미 스캔이 진행 중입니다. | 고유 |
| 38 | scan.ts:58 | SCAN_TOO_RECENT | 429 | 최근 스캔 완료 후 5분이 지나지 않았습니다. | 고유 · 5분이 하드코딩. ICU `{minutes}` 도입 권장 |
| 39 | scan.ts:59 | MAX_RESOURCES_REACHED | 400 | 리소스가 최대 개수(10개)에 도달했습니다. | 고유 · 10개 하드코딩. ICU `{max}` 도입 권장 |
| 40 | history.ts:3 | UNAUTHORIZED | 401 | 로그인이 필요합니다. | ⟲ scan 과 동일 |
| 41 | history.ts:4 | FORBIDDEN | 403 | 해당 프로젝트에 대한 권한이 없습니다. | ⟲ scan 과 동일 |
| 42 | history.ts:5 | NOT_FOUND | 404 | 프로젝트를 찾을 수 없습니다. | ⟲ scan 과 동일 |
| 43 | history.ts:6 | INVALID_TYPE | 400 | 유효하지 않은 type 파라미터입니다. (all, approval) | 고유 |
| 44 | messages.ts:8 | STATUS_FETCH_FAILED | — | 상태 조회에 실패했습니다. | 고유 |

### G-2. 중복 / 불일치 분석

| code | Provider 계열 문구 | Scan/History 계열 문구 | 통합 전략 |
|---|---|---|---|
| UNAUTHORIZED | 인증이 필요합니다. | 로그인이 필요합니다. | 문맥 분리: `errors.unauthorizedAuth` / `errors.unauthorizedLogin` |
| FORBIDDEN | 접근 권한이 없습니다. | 해당 프로젝트에 대한 권한이 없습니다. | 문맥 분리 |
| NOT_FOUND | 리소스를 찾을 수 없습니다. | 프로젝트를 찾을 수 없습니다. | 문맥별 키 (`errors.notFound.resource` / `errors.notFound.project`) |
| VALIDATION_FAILED | 4 파일 동일 | — | 단일 키 통합 가능 |
| SERVICE_NOT_FOUND | 3 파일 동일 | — | 단일 키 통합 가능 |

### G-3. i18n 전환 방침

1. **중앙 키 스토어** `messages/{ko,en}/errors.json` 로 이전 (§K-2)
2. **code → key 매핑** `lib/i18n/error-map.ts`:
   ```ts
   export const ERROR_KEY_BY_CODE: Record<AppErrorCode | string, string> = {
     UNAUTHORIZED: 'errors.unauthorized',  // 컨텍스트별 override 는 콜사이트에서
     FORBIDDEN: 'errors.forbidden',
     NOT_FOUND: 'errors.notFound.resource',
     SCAN_TOO_RECENT: 'errors.scan.tooRecent',
     // ... 44 엔트리
   };
   ```
3. **ERROR_CODES 상수의 `message` 필드 제거**:
   ```ts
   // Before
   UNAUTHORIZED: { status: 401, message: '로그인이 필요합니다.' }
   // After
   UNAUTHORIZED: { status: 401 }        // code 는 바깥 키로 이미 표현
   ```
4. **ICU 보간 도입** (SCAN_TOO_RECENT, MAX_RESOURCES_REACHED 처럼 숫자 하드코딩): 서버 응답에서 `params: { minutes: 5 }` 같은 구조화 필드로 넘기도록 BFF 계약 확장 (O3 이슈).
5. **Mock/Route Handler** 는 `message` 필드 응답 중단 — §7, §K-2, 부록 G-1 의 `message` 가 클라 i18n 으로 이관되므로.

---

## 부록 H — Mock 응답 한국어 카탈로그

### H-1. 파일별 집계

| 파일 | 총 한국어 라인 | (d) 라벨 | (e) mock 응답 | UI 직접 노출 경로 |
|---|---|---|---|---|
| `lib/api-client/mock/confirm.ts` | 96 | 14 | 82 | 승인 요청/큐 보드, 승인 상태 |
| `lib/mock-data.ts` | 80 | 2 | 78 | 리소스 테이블, dashboard |
| `lib/mock-dashboard.ts` | 63 | 25 | 38 | KPI, 시스템 테이블 |
| `lib/api-client/mock/projects.ts` | 57 | 0 | 57 | 프로젝트 리스트, 서비스명·담당자명 |
| `lib/mock-sdu.ts` | 49 | 0 | 49 | SDU 프로세스 상태 카드 |
| `lib/mock-azure.ts` | 48 | 13 | 35 | Azure 프로세스 상태 카드 |
| `lib/mock-service-settings.ts` | 45 | 0 | 45 | 서비스 설정 패널 |
| `lib/mock-installation.ts` | 38 | 0 | 38 | 설치 상태 카드 |
| `lib/mock-idc.ts` | 36 | 4 | 32 | IDC 리소스 목록 |
| `lib/api-client/mock/queue-board.ts` | 30 | 0 | 30 | 큐 보드 |
| `lib/mock-scan.ts` | 25 | 0 | 25 | 스캔 결과 |
| 기타 (mock-test-connection, mock-history 등) | ~43 | ~0 | ~43 | — |
| **합계** | **610** | **58** | **552** | — |

### H-2. 유형별 처리 방침

| 유형 | 예시 | 방침 |
|---|---|---|
| 사용자 입력 시뮬레이션 | `service_name: '주문 서비스'`, `manager.name: '홍길동'` | **번역 안 함** — 프로덕션에서도 원본 표시 |
| 상태 라벨 (문자열) | `installationStatus: '설치 완료'` | **mock 에서도 code 반환** (`installationStatus: 'COMPLETED'`). 클라에서 i18n. |
| 에러 message | `message: '로그인이 필요합니다.'` | **제거**. code 만 반환. |
| 가이드 텍스트 | 없음 (가이드는 mock 의존 X) | — |

### H-3. 변경 규모

- 파일 수: **13**
- 총 라인: **610** 중 약 **350** (상태 라벨 + 에러 message) 을 code 중심으로 재작성
- 1 PR 스코프 적합 (Phase 4 내)

### H-4. 변경 샘플 — `lib/api-client/mock/scan.ts`

```ts
// Before
if (!user) {
  return NextResponse.json(
    { error: 'UNAUTHORIZED', message: SCAN_ERROR_CODES.UNAUTHORIZED.message },
    { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
  );
}

// After
if (!user) {
  return NextResponse.json(
    { code: 'UNAUTHORIZED' },
    { status: SCAN_ERROR_CODES.UNAUTHORIZED.status }
  );
}
```

### H-5. 리스크

- 기존 UI가 mock 응답의 `status` / `label` 필드를 "한국어 문자열로 바로 표시" 하고 있다면 **스샷 테스트 깨짐**. 각 mock 파일 수정 시 대응 컴포넌트가 code 를 해석하도록 되어 있는지 확인 필요.
- IDC/SDU 처럼 프로비저닝 시뮬레이션이 상태 문자열을 내보내는 코드(`lib/mock-store.ts` 관련) 도 동시 수정해야 함.

---

## 부록 I — 날짜·숫자 포매팅 실사

### I-1. 실측 결과

```
grep -rn "'ko-KR'\|\"ko-KR\"\|Intl\.DateTimeFormat\|Intl\.NumberFormat" app lib components \
  --include="*.ts" --include="*.tsx" | grep -v "__tests__\|node_modules\|\.next\|^design/"
```

→ **1 건** 수준. 주로 `lib/utils/date.ts` 의 공용 헬퍼에 집중 (PR #319 초안에서 추정한 16건은 `/design` 포함 수치였음).

### I-2. 해석

- 콜사이트들은 이미 `formatDate(iso)` 같은 공용 함수를 통해 호출 → 수정 포인트가 **한 파일로 수렴**.
- `toLocaleString()` 을 인자 없이 호출 (브라우저 locale 따라감)하는 지점은 별도 grep 필요. 있다면 SSR/CSR locale 불일치 위험.

### I-3. 권장 변경

```ts
// lib/utils/date.ts — Before
const FORMAT_OPTIONS: Record<Format, Intl.DateTimeFormatOptions> = { /* ... */ };
export const formatDate = (iso: string, format: Format = 'long'): string =>
  new Date(iso).toLocaleString('ko-KR', FORMAT_OPTIONS[format]);

// After
export const formatDate = (iso: string, locale: string, format: Format = 'long'): string =>
  new Date(iso).toLocaleString(locale, FORMAT_OPTIONS[format]);

// 콜사이트
const locale = useLocale();        // CSR
// 또는 const locale = await getLocale();  // RSC
formatDate(iso, locale)
```

- 공수 추정: **2~4 시간** (§10.5 Phase 2-D)
- FORMAT_OPTIONS 는 locale 독립. 필요 시 `{ ko: { long: ... }, en: { long: ... } }` 형태로 per-locale override 가능.

### I-4. 재실사 권장

Phase 2 착수 직전, 아래 두 패턴도 확인:
- `new Intl\.DateTimeFormat\(` (locale 생략 포함)
- `new Intl\.NumberFormat\(` (locale 생략 포함)
- `\.toLocaleString\(\)` (인자 없이) — 브라우저 기본 locale 사용 — hydration mismatch 잠재

---

## 부록 J — 도메인 용어 사전 (ko → en, v0)

> Phase 6 번역 작업 직전 기획/FE 리뷰로 확정. 번역 PR 간 용어 drift 방지 목적.
> **상태: 초안 (Draft)** — 합의 전. 각 행의 en 번역은 검토 대상.

### J-1. 프로세스·상태

| ko | en | 비고 |
|---|---|---|
| 연동 | Integration | |
| 연동 대상 | Target Source | 코드에서 이미 `targetSourceId` |
| 연동 대상 확정 | Target Confirmation | |
| 연동 대상 승인 요청 | Request Target Approval | CTA |
| 연동대상 반영 중 | Applying Approved Targets | `APPLYING_APPROVED` |
| 승인 | Approval | |
| 승인 대기 | Awaiting Approval | |
| 승인 요청 | Approval Request | |
| 승인자 | Approver | |
| 승인 완료 | Approved | |
| 반려 | Rejected | |
| 반려 사유 | Rejection Reason | |
| 설치 진행 중 | Installing | |
| 설치 완료 | Installation Complete | |
| 설치 실패 | Installation Failed | |
| 연결 테스트 | Connection Test | |
| 연결 테스트 필요 | Connection Test Required | |
| 연결 확인 완료 | Connection Verified | |
| 연결됨 | Connected | |
| 연결 끊김 | Disconnected | |
| 대기중 | Pending | |
| 진행 중 | In Progress | |
| 완료 | Completed | |
| 실패 | Failed | |
| 해당없음 | Not Applicable | |

### J-2. 리소스·인프라

| ko | en | 비고 |
|---|---|---|
| 리소스 | Resource | |
| 리소스 스캔 | Resource Scan | |
| 데이터베이스 | Database | |
| 인프라 | Infrastructure | |
| 인프라 등록 | Register Infrastructure | `ProjectCreateModal` 제목 |
| 방화벽 | Firewall | |
| 방화벽 오픈 | Firewall Opened | |
| 서브넷 | Subnet | |
| 프라이빗 엔드포인트 | Private Endpoint | |
| VPC 연동 | VPC Integration | |
| 온프레미스 | On-premises | |
| 클라우드 | Cloud | |
| 로드밸런서 | Load Balancer | |
| NIC | NIC | |

### J-3. 사용자·역할

| ko | en | 비고 |
|---|---|---|
| 관리자 | Administrator | |
| 프로젝트 | Project | |
| 서비스 | Service | |
| 서비스 코드 | Service Code | |
| 담당자 | Manager | `projects.manager.name` 필드 |
| 사용자 | User | |
| 인증 | Authentication | |
| 인증 실패 | Authentication Failed | |
| 인증 필요 | Authentication required | `errors.unauthorizedAuth` |
| 로그인 필요 | Login required | `errors.unauthorizedLogin` |
| 권한 | Permission / Authorization | 문맥별 |
| 권한 부족 | Permission Denied | |
| 접근 권한 없음 | Access denied | |

### J-4. 오류·피드백

| ko | en | 비고 |
|---|---|---|
| 오류가 발생했습니다 | An error occurred | |
| 알 수 없는 오류 | Unknown error | |
| 네트워크 오류 | Network error | |
| 연결 타임아웃 | Connection timeout | |
| 로딩 중... | Loading… | 3 dot → horizontal ellipsis |
| 데이터가 없습니다 | No data | Table empty state |
| 기능 준비중입니다 | Feature not available yet | |
| 재시도 | Retry | |
| 새로고침 | Refresh | |
| 다시 시도해 주세요 | Please try again | |
| 상태 조회에 실패했습니다 | Failed to fetch status | |

### J-5. 액션·UI

| ko | en | 비고 |
|---|---|---|
| 닫기 | Close | Modal aria-label |
| 취소 | Cancel | |
| 저장 | Save | |
| 확인 | Confirm | |
| 삭제 | Delete | |
| 편집 | Edit | |
| 추가 | Add | |
| 리소스 추가 | Add Resource | |
| 다음 | Next | |
| 이전 | Previous | |
| 검색 | Search | |
| 복사 | Copy | aria-label |
| 관리 메뉴 열기 | Open management menu | aria-label |
| 설치 진행 상태 | Installation Progress | Modal 제목 |
| 실행 일시 | Executed at | |
| 결과 | Result | |
| 반려 사유를 입력하세요 | Enter rejection reason | placeholder |
| 리소스 목록 | Resource list | |
| 등록된 리소스가 없습니다 | No resources registered | |

### J-6. 도메인 전문 용어

| ko | en | 비고 |
|---|---|---|
| PII | PII | 고유명사 |
| PII Agent | PII Agent | 고유명사 |
| PII Map | PII Map | 고유명사 |
| N-IRP | N-IRP | 고유명사 (개인정보 리스크 플랫폼) |
| BDC | BDC | 고유명사 |
| SDU | SDU | 고유명사 |
| IDC | IDC | 고유명사 |
| Credential | Credential | |
| DB Credential 등록 | Register DB Credential | |
| 스캔 Role 등록 | Register Scan Role | AWS IAM Role |
| TerraformExecutionRole 등록 | Register TerraformExecutionRole | 고유 IAM Role 명 |
| 프로세스 | Process | |
| 프로비저닝 | Provisioning | |
| 에이전트 | Agent | |
| 탐지 리포트 | Detection Report | |
| 크롤러 | Crawler | SDU |
| 아테나 환경 | Athena Environment | SDU |
| S3 업로드 | S3 Upload | |
| 스캔 쿨다운 | Scan Cooldown | |
| 자동 설치 | Auto-install | AWS_AUTO_GUIDE |
| 수동 설치 | Manual install | AWS_MANUAL_GUIDE |

### J-7. 지역·시간·분량

| ko | en | 비고 |
|---|---|---|
| 서울 (ap-northeast-2) | Seoul (ap-northeast-2) | |
| 도쿄 (ap-northeast-1) | Tokyo (ap-northeast-1) | |
| 영업일 | business day | |
| 평균 N분 | avg N minutes | |
| 최대 N분 | up to N minutes | |
| N영업일 이내 | within N business day(s) | |

### J-8. 합계 및 프로세스

총 **~95 용어**.

- Phase 6 착수 전 기획팀 + FE 리더 1차 리뷰 → 확정본은 `docs/i18n/glossary.md` 로 별도 분리(후속 PR).
- 번역 PR 에서 이 사전과 불일치하면 **리뷰 블록**.

---

## 부록 K — 번역 키 사전 테이블 (우선순위 v0)

> 전체 예상치 ~**870 키**. 본 부록은 Phase 2 ~ Phase 3 초기에 필요한 **상위 150 여 키** 의 ko→en draft 와 출처(file:line). 나머지 guides 240 + 도메인별 500+ 는 실행 PR 에서 확장 및 CI 자동 추출.
>
> 형식: `namespace.key | ko | en draft | 출처`. en draft 는 부록 J 용어 사전과 정합.

### K-1. `common` (공통 UI) — 20 키

| key | ko | en | 출처 |
|---|---|---|---|
| common.close | 닫기 | Close | `components/ui/Modal.tsx:133` (aria-label) |
| common.cancel | 취소 | Cancel | 다수 |
| common.save | 저장 | Save | 다수 |
| common.confirm | 확인 | Confirm | 다수 |
| common.retry | 재시도 | Retry | 다수 |
| common.refresh | 새로고침 | Refresh | `features/sdu/SduInstallationProgress.tsx:81` |
| common.loading | 로딩 중... | Loading… | `projects/[projectId]/common/LoadingState.tsx:8` |
| common.empty | 데이터가 없습니다. | No data. | `components/ui/Table.tsx` default |
| common.back | 뒤로 | Back | — |
| common.add | 추가 | Add | — |
| common.delete | 삭제 | Delete | `features/idc/IdcPendingResourceList.tsx:55` (title) |
| common.edit | 편집 | Edit | — |
| common.next | 다음 | Next | — |
| common.previous | 이전 | Previous | — |
| common.search | 검색 | Search | — |
| common.copy | 복사 | Copy | `projects/[projectId]/common/ProjectIdentityCard.tsx:161` (aria-label `${label} 복사`) |
| common.errorOccurred | 오류가 발생했습니다 | An error occurred | `projects/[projectId]/common/ErrorState.tsx:20` |
| common.networkRetry | 네트워크 연결을 확인하고 다시 시도해 주세요 | Check your network and try again | `integration/admin/dashboard/page.tsx:274` |
| common.notReadyYet | 기능 준비중입니다. | Feature not available yet. | `projects/[projectId]/common/DeleteInfrastructureButton.tsx:17` |
| common.openManagementMenu | 관리 메뉴 열기 | Open management menu | `features/admin/infrastructure/ManagementSplitButton.tsx:84` |

### K-2. `errors` (에러 메시지) — 27 키

| key | ko | en | 출처 |
|---|---|---|---|
| errors.unauthorizedLogin | 로그인이 필요합니다. | Login required. | `constants/scan.ts:52`, `history.ts:3` |
| errors.unauthorizedAuth | 인증이 필요합니다. | Authentication required. | `azure.ts:14`, `gcp.ts:78`, `sdu.ts:12`, `idc.ts:23` |
| errors.forbiddenProject | 해당 프로젝트에 대한 권한이 없습니다. | You don't have access to this project. | `scan.ts:53`, `history.ts:4` |
| errors.forbiddenGeneric | 접근 권한이 없습니다. | Access denied. | `azure.ts:19`, `gcp.ts:83`, `sdu.ts:17`, `idc.ts:28` |
| errors.notFound.resource | 리소스를 찾을 수 없습니다. | Resource not found. | `azure.ts:24`, `gcp.ts:88`, `sdu.ts:22`, `idc.ts:33` |
| errors.notFound.project | 프로젝트를 찾을 수 없습니다. | Project not found. | `scan.ts:54`, `history.ts:5` |
| errors.notFound.service | 서비스를 찾을 수 없습니다. | Service not found. | `azure.ts:34`, `gcp.ts:98`, `idc.ts:43` |
| errors.notFound.scan | 해당 스캔을 찾을 수 없습니다. | Scan not found. | `scan.ts:55` |
| errors.notFound.iamUser | IAM USER를 찾을 수 없습니다. | IAM user not found. | `sdu.ts:47` |
| errors.validation.failed | 검증에 실패했습니다. | Validation failed. | `azure.ts:44`, `gcp.ts:103`, `sdu.ts:32`, `idc.ts:48` |
| errors.validation.invalidCidr | 유효하지 않은 CIDR 형식입니다. | Invalid CIDR format. | `sdu.ts:37` |
| errors.validation.invalidIpType | 유효하지 않은 IP 타입입니다. | Invalid IP type. | `idc.ts:53` |
| errors.validation.invalidHistoryType | 유효하지 않은 type 파라미터입니다. (all, approval) | Invalid type parameter. (all, approval) | `history.ts:6` |
| errors.validation.oracleRequiresServiceId | Oracle DB는 ServiceId가 필수입니다. | Oracle DB requires ServiceId. | `idc.ts:58` |
| errors.azure.notAzureProject | Azure 프로젝트가 아닙니다. | Not an Azure project. | `azure.ts:29` |
| errors.azure.noVmResources | VM 리소스가 없습니다. | No VM resources. | `azure.ts:39` |
| errors.gcp.notGcpProject | GCP 프로젝트가 아닙니다. | Not a GCP project. | `gcp.ts:93` |
| errors.sdu.notSduProject | SDU 프로젝트가 아닙니다. | Not an SDU project. | `sdu.ts:27` |
| errors.sdu.s3NotUploaded | S3에 데이터가 업로드되지 않았습니다. | Data has not been uploaded to S3. | `sdu.ts:42` |
| errors.sdu.sourceIpNotRegistered | SourceIP가 등록되지 않았습니다. | Source IP is not registered. | `sdu.ts:51` |
| errors.idc.notIdcProject | IDC 프로젝트가 아닙니다. | Not an IDC project. | `idc.ts:38` |
| errors.idc.firewallNotOpened | 방화벽이 아직 오픈되지 않았습니다. | Firewall is not yet opened. | `idc.ts:63` |
| errors.scan.notSupported | 스캔을 지원하지 않는 Provider입니다. | Scan is not supported by this provider. | `scan.ts:56` |
| errors.scan.inProgress | 이미 스캔이 진행 중입니다. | A scan is already in progress. | `scan.ts:57` |
| errors.scan.tooRecent | 최근 스캔 완료 후 {minutes}분이 지나지 않았습니다. | The last scan finished less than {minutes} minutes ago. | `scan.ts:58` — ICU `{minutes}` |
| errors.scan.maxResources | 리소스가 최대 개수({max}개)에 도달했습니다. | Maximum of {max} resources reached. | `scan.ts:59` — ICU `{max}` |
| errors.statusFetchFailed | 상태 조회에 실패했습니다. | Failed to fetch status. | `constants/messages.ts:8` |

### K-3. `process.status` / `connection.status` — 10 키

| key | ko | en |
|---|---|---|
| process.status.waitingTargetConfirmation | 연동 대상 확정 대기 | Awaiting Target Confirmation |
| process.status.waitingApproval | 승인 대기 | Awaiting Approval |
| process.status.applyingApproved | 연동대상 반영 중 | Applying Approved Targets |
| process.status.installing | 설치 진행 중 | Installing |
| process.status.waitingConnectionTest | 연결 테스트 필요 | Connection Test Required |
| process.status.connectionVerified | 연결 확인 완료 | Connection Verified |
| process.status.installationComplete | 설치 완료 | Installation Complete |
| connection.status.connected | 연결됨 | Connected |
| connection.status.disconnected | 연결 끊김 | Disconnected |
| connection.status.pending | 대기중 | Pending |

### K-4. `providers` — 7 키

| key | ko | en |
|---|---|---|
| providers.aws.description | Amazon Web Services 환경의 RDS, DynamoDB 등 데이터 리소스를 자동 스캔합니다. | Automatically scans data resources such as RDS and DynamoDB in Amazon Web Services. |
| providers.azure.description | Microsoft Azure 클라우드 환경의 데이터베이스 리소스를 스캔하고 PII Agent를 연동합니다. | Scans database resources in Microsoft Azure and integrates PII Agent. |
| providers.gcp.description | Google Cloud Platform의 Cloud SQL, BigQuery 등 데이터 리소스를 관리합니다. | Manages data resources such as Cloud SQL and BigQuery in Google Cloud Platform. |
| providers.idc.description | 온프레미스 데이터센터의 데이터베이스 리소스를 수동 등록하여 관리합니다. | Manually register and manage database resources in on-premises data centers. |
| providers.sdu.description | 삼성 SDS 데이터 유니버스 환경의 데이터 리소스를 연동합니다. | Integrates data resources in the Samsung SDS Data Universe environment. |
| providers.region.apNortheast2 | 서울 (ap-northeast-2) | Seoul (ap-northeast-2) |
| providers.region.apNortheast1 | 도쿄 (ap-northeast-1) | Tokyo (ap-northeast-1) |

### K-5. `terraform` / `install` — 11 키

| key | ko | en |
|---|---|---|
| terraform.status.completed | 완료 | Completed |
| terraform.status.failed | 실패 | Failed |
| terraform.status.pending | 대기 | Pending |
| terraform.firewall.notChecked | 확인 전 | Not checked |
| terraform.firewall.connected | 연결됨 | Connected |
| terraform.firewall.failed | 연결 실패 | Connection failed |
| install.gcp.completed | 설치 완료 | Installation complete |
| install.gcp.failed | 설치 실패 | Installation failed |
| install.gcp.inProgress | 설치 진행 중 | Installing |
| install.gcp.skip | 해당없음 | Not applicable |
| install.gcp.stepFail | 실패 | Failed |

### K-6. Provider 상태 (Azure/GCP/SDU/IDC) — 29 키

(부록 F 전체가 1:1 키화 — 축약 표기)

- `azure.privateEndpoint.{notRequested|pendingApproval|approved|rejected}` — 4 키
- `gcp.step.{serviceSideSubnetCreation|serviceSideTerraformApply|bdcSideTerraformApply}` — 3 키
- `gcp.stepStatus.{completed|fail|inProgress|skip}` — 4 키
- `gcp.installationStatus.{completed|fail|inProgress}` — 3 키
- `sdu.step.{s3Upload|installation|connectionTest|complete}` — 4 키
- `sdu.processStatus.*` — 6 키 (부록 F-4)
- `sdu.crawler.{none|success|failed}` — 3 키
- `sdu.athena.{pending|inProgress|completed}` — 3 키
- `sdu.sourceIp.{pending|confirmed}` — 2 키
- `idc.tf.{pending|inProgress|completed|failed}` — 4 키
- `idc.sourceIp.{public|private|vpc}.description` — 3 키

→ 합 **29 키** (번역: 부록 F 원문을 en 로 1:1 변환)

### K-7. `modals` — 10 키

| key | ko | en | 출처 |
|---|---|---|---|
| modals.projectCreate.title | 인프라 등록 | Register Infrastructure | `features/ProjectCreateModal.tsx:177` |
| modals.terraformStatus.title | 설치 진행 상태 | Installation Progress | `features/TerraformStatusModal.tsx:151` |
| modals.connectionDetail.datetime | 실행 일시 | Executed at | `features/ConnectionDetailModal.tsx:72` |
| modals.connectionDetail.result | 결과 | Result | `features/ConnectionDetailModal.tsx:76` |
| modals.approvalDetail.rejectPlaceholder | 반려 사유를 입력하세요... | Enter rejection reason… | `features/admin/ApprovalDetailModal.tsx:222` |
| modals.sourceIp.cidrPlaceholder | 예: 10.0.0.0/24 | e.g. 10.0.0.0/24 | `projects/[projectId]/sdu/SourceIpManageModal.tsx:73` |
| modals.iamUserManage.datetime | (N/A — ko-KR format) | (locale format) | `features/sdu/IamUserManageModal.tsx:60` |
| modals.approval.detail.datetime | (N/A — ko-KR format) | (locale format) | `features/admin/ApprovalDetailModal.tsx:38` |
| modals.connectionTest.resultDatetime | (N/A — ko-KR format) | (locale format) | `features/process-status/connection-test/ResultSummary.tsx:17` |
| modals.rejectionAlert.datetime | 반려일시 | Rejected at | `projects/[projectId]/common/RejectionAlert.tsx:27` |

### K-8. `idc.resource` — 12 키

| key | ko | en | 출처 |
|---|---|---|---|
| idc.resource.listTitle | 리소스 목록 | Resource list | `projects/[projectId]/idc/IdcProjectPage.tsx:268` |
| idc.resource.empty | 등록된 리소스가 없습니다 | No resources registered | `IdcProjectPage.tsx:293` |
| idc.resource.emptyHint | 위의 "리소스 추가" 버튼을 클릭하여 데이터베이스를 등록하세요 | Click "Add Resource" above to register a database | `IdcProjectPage.tsx:294` |
| idc.resource.addTitle | 리소스 추가 | Add Resource | `IdcProjectPage.tsx:304` |
| idc.resource.addSubtitle | 데이터베이스 연결 정보를 입력하세요 | Enter the database connection information | `IdcProjectPage.tsx:305` |
| idc.resource.placeholder.name | 예: 주문 DB | e.g. Orders DB | `features/idc/IdcResourceInputPanel.tsx:167` |
| idc.resource.placeholder.ip | 예: 192.168.1.100 | e.g. 192.168.1.100 | `IdcResourceInputPanel.tsx:215` |
| idc.resource.placeholder.host | 예: db.example.com | e.g. db.example.com | `IdcResourceInputPanel.tsx:273` |
| idc.resource.placeholder.serviceId | 예: ORCL | e.g. ORCL | `IdcResourceInputPanel.tsx:326` |
| idc.resource.validation.minOne | 최소 1개 이상의 리소스가 필요합니다. | At least one resource is required. | `IdcProjectPage.tsx:120` |
| idc.resource.validation.beforeConfirm | 확정할 리소스가 없습니다. 먼저 리소스를 추가해주세요. | No resources to confirm. Please add resources first. | `IdcProjectPage.tsx:191` |
| idc.resource.credentialFailed | Credential 변경에 실패했습니다. | Failed to change credential. | `IdcProjectPage.tsx:79` |

### K-9. 기타 도메인별 핵심 (~20 키 샘플)

| key | ko | en | 출처 |
|---|---|---|---|
| sdu.connectionTest.success | 연결 테스트가 성공했습니다. | Connection test succeeded. | `projects/[projectId]/sdu/SduProjectPage.tsx:188` |
| scan.policy.idc | IDC는 스캔을 지원하지 않습니다. 리소스를 직접 입력하세요. | Scan is not supported for IDC. Enter resources directly. | `constants/scan.ts:31` |
| scan.policy.sdu | SDU는 Crawler를 통해 리소스가 수집됩니다. | Resources are collected by the Crawler for SDU. | `constants/scan.ts:35` |
| validation.awsAccountId | 12자리 숫자를 입력하세요 | Please enter a 12-digit number. | `validation/infra-credentials.ts:6` |
| validation.guidFormat | GUID 형식이 올바르지 않습니다 (예: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) | Invalid GUID format (e.g. xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx) | `validation/infra-credentials.ts:13` |
| azure.vm.databaseRequired | 다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n{list} | Database settings required for these VM resources:\n{list} | `projects/[projectId]/azure/AzureProjectPage.tsx:251` — ICU `{list}` |
| gcp.vm.databaseRequired | 다음 VM 리소스의 데이터베이스 설정이 필요합니다:\n{list} | Database settings required for these VM resources:\n{list} | `projects/[projectId]/gcp/GcpProjectPage.tsx:175` — ICU `{list}` |
| admin.approval.noHistory | 승인 요청 이력이 없습니다. | No approval request history. | `features/AdminDashboard.tsx:109` |
| admin.approval.fetchFailed | 승인 요청 조회 실패 | Failed to fetch approval requests | `features/AdminDashboard.tsx:114` |
| sdu.process.s3UploadConfirmation | S3 버킷 경로 확인 | Verifying S3 bucket path | `projects/[projectId]/sdu/SduProcessStatusCard.tsx:122` |
| sdu.process.dataUpload | 데이터 업로드 | Data upload | `SduProcessStatusCard.tsx:127` |
| sdu.process.waitUpload | 업로드 완료 대기 | Awaiting upload completion | `SduProcessStatusCard.tsx:132` |

### K-10. 집계 표

| 네임스페이스 | 키 수 (이 테이블) | 예상 합계 | 주요 출처 |
|---|---|---|---|
| common | 20 | ~30 | UI 공용 |
| errors | 27 | ~30 | constants/*.ts |
| process.status / connection.status | 10 | 10 | labels.ts |
| providers | 7 | ~10 | labels.ts |
| terraform / install | 11 | ~15 | TerraformStatusModal, gcp.ts |
| azure/gcp/sdu/idc 상태 | 29 | ~35 | 부록 F |
| modals | 10 | ~30 | 다수 모달 |
| idc.resource | 12 | ~20 | IDC 입력 패널 |
| guides | 0 (이 테이블에는 미포함) | **~272** | process-guides.ts (부록 E 분해) |
| 도메인 JSX 리터럴 (AWS/Azure/GCP/SDU installation inline, ApprovalRequest 등) | 0 (미포함) | **~400+** | 부록 D Top 30 파일 유입 |
| **합계** | **126** | **~870** | — |

### K-11. 실행 방침

1. 본 부록의 126 키는 **Phase 1 종료 시점에 시드** (`messages/ko/*.json`, `messages/en/*.json` 에 선반영)
2. Phase 2~3 도메인 PR 마다 필요 키를 증분 추가
3. CI의 `scripts/i18n-diff` 가 ko/en 키 차이 0 을 보장 (§12.10)
4. Phase 6 에서 누적 키 ~870 전부 영문화 검수

---

## 변경 이력

| 일자 | 작성자 | 변경 |
|---|---|---|
| 2026-04-23 | @chulyong | 최초 작성 (초안) |
| 2026-04-23 | @chulyong | 지원 언어 범위 확정 — ko/en 2개 (O2 resolved) |
| 2026-04-23 | @chulyong | 후속 보강 — 부록 D~K 전수 조사·번역키·용어사전, §7.6 계약 diff, §10.5/10.6 공수·테스트, §12.10 검증 인프라 |
