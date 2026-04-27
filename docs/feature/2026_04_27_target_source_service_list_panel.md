# Target Source 상세 페이지 ServiceList 패널 추가 — 구현 계획 (v2)

작성일: 2026-04-27 (v2 revision: 동일자 codex-review 피드백 + vercel-react-best-practices 반영)

## Context

`/integration/target-sources/[targetSourceId]` 상세 페이지에 `/admin`과 동일한 좌측 ServiceList 패널(280px 풀하이트 사이드바)을 추가한다. 차이점은 다음과 같다.

1. 패널의 서비스를 클릭하면 즉시 선택되지 않고 "이동하시겠습니까?" 확인 모달이 뜬다.
2. 모달에서 "이동"을 누르면 `/admin`으로 이동하면서 **현재 검색어/페이지 + 클릭한 서비스**를 URL 검색 파라미터로 전달한다.
3. `/admin` 페이지는 **Server Component에서 searchParams를 검증·파싱**하여 primitive props로 AdminDashboard에 전달한다. 이로써 `useSearchParams` / Suspense 경계가 불필요해지고, URL 변경 시 `key` 기반 remount로 동기화된다.

이 v2 계획은 v1에 대한 codex-review 피드백 5개 Major + 2 Minor 이슈를 모두 반영했고, 동시에 vercel-react-best-practices의 `server-serialization` / `rerender-derived-state-no-effect` / `rerender-dependencies` / `async-suspense-boundaries` 규칙을 따른다.

## v1 → v2 주요 변경 사항

| # | v1 접근 | v2 접근 | 근거 |
|---|---|---|---|
| 1 | client `useSearchParams()` + Suspense | **server `searchParams` prop → primitive props + `key` remount** | codex Major 1, 4 / vercel `server-serialization` |
| 2 | `Number(...) \|\| 0` (음수/소수 통과) | `parseNonNegativeInt()` helper + 응답 후 클램핑 | codex Major 2 |
| 3 | loading/error/race 핸들링 없음 | AbortController + loading/error state + debounce cleanup | codex Major 3 |
| 4 | `npm run lint` + `tsc` 만 | **`npm run test:run` + `npm run lint` + `npm run build`** + 단위 테스트 | codex Major 5 / AGENTS.md §5 |
| 5 | flex 하드닝 누락 | sidebar `shrink-0`, 우측 `min-w-0` | codex Minor 1 |
| 6 | 코드 주석 한국어 | 코드 주석 영문 (CLAUDE.md 준수) | codex Minor 2 |
| 7 | useEffect 의존성에서 initial* 제외 (잘못된 진단) | server-side 파싱으로 의존성 자체 제거 | codex Major 1 후속 |

## 결정 사항 (사용자 확인 완료)

| 항목 | 결정 |
|------|------|
| 상태 전달 | URL 검색 파라미터 |
| /admin 도착 시 선택 | 클릭한 서비스 자동 선택 |
| 상세 페이지 패널 초기 상태 | 선택 없음 (목록만 표시) |
| 레이아웃 | /admin과 동일: 280px 풀하이트 좌측 사이드바 |

## URL 계약 (`/integration/admin`)

모두 optional. `URLSearchParams`로 인코딩되어 한글/공백/특수문자 안전.

| Param | 타입 | 의미 | 검증 |
|-------|------|------|------|
| `service` | string | 사전 선택할 ServiceCode | 비어있지 않은 string. 응답 목록에 없어도 selectedService로 시드(우측 panel은 정상 fetch 시도) |
| `query` | string | 검색어 | 비면 생략 |
| `page` | string (0-base 정수) | 페이지 번호 | `parseNonNegativeInt()`로 정수화. 응답 후 `totalPages` 초과 시 0으로 리셋 |

예: `/integration/admin?service=A001&query=auth&page=2`

## 변경 파일

### NEW — `app/components/features/admin-dashboard/parseUrlState.ts`

URL 파라미터 검증/파싱 유틸. Server/Client 양쪽에서 재사용 가능한 순수 함수.

```ts
export interface AdminUrlState {
  service: string | null;
  query: string;
  page: number;
}

export const parseNonNegativeInt = (raw: string | undefined): number => {
  if (!raw) return 0;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) return 0;
  return n;
};

export const parseAdminUrlState = (
  searchParams: { service?: string; query?: string; page?: string },
): AdminUrlState => ({
  service: searchParams.service?.trim() || null,
  query: searchParams.query ?? '',
  page: parseNonNegativeInt(searchParams.page),
});
```

### MODIFY — `app/integration/admin/page.tsx`

기존 client-only 진입점을 **Server Component**로 전환. searchParams를 await하여 검증된 primitive로 변환 후 AdminDashboard에 전달. `key`로 URL 변경 시 remount 강제.

```tsx
import { AdminDashboard } from '@/app/components/features/AdminDashboard';
import { parseAdminUrlState } from '@/app/components/features/admin-dashboard/parseUrlState';

interface AdminPageProps {
  searchParams: Promise<{ service?: string; query?: string; page?: string }>;
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  const initialUrlState = parseAdminUrlState(await searchParams);
  return (
    <AdminDashboard
      key={`${initialUrlState.service ?? ''}|${initialUrlState.query}|${initialUrlState.page}`}
      initialUrlState={initialUrlState}
    />
  );
}
```

> Vercel rule `server-serialization`: 클라이언트로 넘기는 prop은 primitive 3개로 최소화 (전체 searchParams 객체 직렬화 회피).
> Vercel rule `async-suspense-boundaries`: server-side 파싱이므로 Suspense 경계 불필요.

### MODIFY — `app/components/features/AdminDashboard.tsx`

`useSearchParams()` 대신 `initialUrlState` prop 수신. lazy `useReducer` 초기화로 시드. `service` 파라미터가 있으면 첫 결과 자동선택 스킵.

핵심 변경:
```tsx
import type { AdminUrlState } from './admin-dashboard/parseUrlState';

interface AdminDashboardProps {
  initialUrlState: AdminUrlState;
}

export const AdminDashboard = ({ initialUrlState }: AdminDashboardProps) => {
  const router = useRouter();
  const toast = useToast();

  const [serviceList, dispatch] = useReducer(
    serviceListReducer,
    undefined,
    () => ({
      ...buildInitialServiceListState(),
      selectedService: initialUrlState.service,
      query: initialUrlState.query,
      pageNum: initialUrlState.page,
    }),
  );

  // skipAutoSelect derived from initial state (page-level constant for this mount)
  const skipAutoSelectRef = useRef(initialUrlState.service !== null);

  // ... existing handlers unchanged

  const fetchServicesPage = useCallback(async (page: number, searchQuery?: string) => {
    const data = await getServicesPage(page, 10, searchQuery || undefined);
    dispatch({ type: 'SET_SERVICES', services: data.content, pageInfo: data.page });
    if (page === 0 && data.content.length > 0 && !skipAutoSelectRef.current) {
      dispatch({ type: 'SET_SELECTED', serviceCode: data.content[0].code });
    }
    skipAutoSelectRef.current = false;
  }, []);

  // Initial fetch uses seeded state. Empty deps + key-based remount handles URL changes.
  // Why this is safe: URL changes trigger server-side re-render → key changes → component remounts → effect runs once with fresh seed.
  useEffect(() => {
    fetchServicesPage(initialUrlState.page, initialUrlState.query || undefined);
  }, [fetchServicesPage, initialUrlState.page, initialUrlState.query]);

  // ... rest unchanged
};
```

> Vercel rule `rerender-dependencies`: 의존성을 primitive(`initialUrlState.page`, `initialUrlState.query`)로 명시. `key` remount로 mount당 한 번만 실행됨이 보장되므로 무한루프 위험 없음.
> Vercel rule `rerender-derived-state-no-effect`: `skipAutoSelectRef` 초기값을 prop에서 직접 도출, effect로 동기화하지 않음.
> Vercel rule `rerender-lazy-state-init`: `useReducer`의 lazy initializer 사용.

### NEW — `app/integration/target-sources/[targetSourceId]/_components/ServiceListPanel.tsx`

상세 페이지 전용 패널 컨테이너. `<ServiceSidebar>`를 그대로 재사용하지만 자체적으로 loading/error/abort 처리.

**State**
- `useReducer(serviceListReducer, undefined, buildInitialServiceListState)` — 초기: 선택 없음, 빈 검색어, page 0.
- `useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; message?: string }>({ status: 'idle' })` — fetch 라이프사이클.
- `useRef<ReturnType<typeof setTimeout> | null>(null)` — 검색 디바운스.
- `useRef<AbortController | null>(null)` — in-flight 요청 abort.
- `useModal<{ code: string; name: string }>()` — 확인 모달 상태.
- `useRouter()` from `next/navigation`.

**Fetch lifecycle (모든 핸들러가 공유)**
```tsx
const fetchServicesPage = useCallback(async (page: number, q?: string) => {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  setFetchState({ status: 'loading' });
  try {
    const data = await getServicesPage(page, 10, q || undefined, { signal: controller.signal });
    if (controller.signal.aborted) return;
    // Clamp out-of-range page to 0
    if (page > 0 && page >= data.page.totalPages) {
      dispatch({ type: 'SET_PAGE', pageNum: 0 });
      // Refetch page 0; do not commit current response
      void fetchServicesPage(0, q);
      return;
    }
    dispatch({ type: 'SET_SERVICES', services: data.content, pageInfo: data.page });
    setFetchState({ status: 'ready' });
  } catch (err) {
    if (controller.signal.aborted) return;
    setFetchState({ status: 'error', message: err instanceof Error ? err.message : 'Service list load failed' });
  }
}, []);
```

> 확인된 사실: 현재 `getServicesPage(page, size, query?)` 시그니처는 `AbortSignal`을 받지 않음. 동일 파일(`app/lib/api/index.ts`) 내 다른 함수들(line 237, 337, 359, 517, 610)은 이미 `options?: { signal?: AbortSignal }` 패턴을 사용함. **변경 필요**: `getServicesPage`에도 동일 패턴으로 `options?: { signal?: AbortSignal }` 추가 (하위 호환 — 기존 호출자 영향 없음). `fetchInfraCamelJson` 호출 시 옵션 전달.

**Cleanup**
```tsx
useEffect(() => {
  return () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  };
}, []);
```

**Mount fetch**
```tsx
useEffect(() => { void fetchServicesPage(0); }, [fetchServicesPage]);
```

**Click handler**
```tsx
const handleSelectService = useCallback((code: string) => {
  const svc = services.find((s) => s.code === code);
  if (!svc) return;
  confirmModal.open({ code: svc.code, name: svc.name });
}, [services, confirmModal]);
```

**Confirm handler**
```tsx
const handleConfirm = useCallback(() => {
  if (!confirmModal.data) return;
  const params = new URLSearchParams();
  params.set('service', confirmModal.data.code);
  if (query) params.set('query', query);
  if (pageInfo.number > 0) params.set('page', String(pageInfo.number));
  router.push(`${integrationRoutes.admin}?${params.toString()}`);
}, [confirmModal.data, query, pageInfo.number, router]);
```

**JSX**
```tsx
return (
  <>
    <ServiceSidebar
      services={services}
      selectedService={null}
      onSelectService={handleSelectService}
      projectCount={0}
      searchQuery={query}
      onSearchChange={handleSearchChange}
      pageInfo={pageInfo}
      onPageChange={handlePageChange}
      // Loading/error indicators handled inline below
    />
    {fetchState.status === 'error' && (
      <ServiceListErrorBanner message={fetchState.message} onRetry={() => fetchServicesPage(pageInfo.number, query)} />
    )}
    {confirmModal.data && (
      <ServiceMoveConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={confirmModal.close}
        onConfirm={handleConfirm}
        serviceCode={confirmModal.data.code}
        serviceName={confirmModal.data.name}
      />
    )}
  </>
);
```

> 빈 결과 vs loading 구분: `ServiceSidebar`는 `services.length === 0`일 때 "검색 결과가 없습니다"를 무조건 표시한다. 첫 fetch 응답 전 깜빡임 회피를 위해 `ServiceSidebar`에 prop 추가가 필요한지 확인. **결정**: 패널 컨테이너에서 `fetchState.status === 'loading' && services.length === 0`일 때 ServiceSidebar 자리에 skeleton(또는 spinner)을 보여주고, ready 이후 ServiceSidebar 렌더. ServiceSidebar 자체는 변경하지 않음.

> 위 ServiceListErrorBanner는 인라인 토스트로 대체 가능. 구현 단계에서 기존 `useToast` 패턴(AdminDashboard와 동일)으로 통일하는 것을 권장.

### NEW — `app/integration/target-sources/[targetSourceId]/_components/ServiceMoveConfirmModal.tsx`

```ts
interface ServiceMoveConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  serviceCode: string;
  serviceName: string;
}
```

`<Modal size="sm" title="서비스 이동 확인">` 안에:
- 본문: `<p className={cn('text-sm', textColors.secondary)}>{serviceCode} {serviceName} 서비스 관리 페이지로 이동하시겠습니까?</p>`
- footer: `<><Button variant="secondary" onClick={onClose}>취소</Button><Button onClick={onConfirm}>이동</Button></>`

기존 `CancelApprovalModal` / `UnsavedChangesModal` 패턴 그대로 따름. `Modal`의 default `closeOnEscape: true` / `closeOnBackdropClick: true` 사용.

### MODIFY — `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx`

flex 2-column 레이아웃으로 감싸고, **shrink-0 / min-w-0 하드닝** 적용.

```tsx
const renderProvider = () => {
  switch (project.cloudProvider) {
    case 'AWS':   return <AwsProjectPage   project={project} onProjectUpdate={setProject} />;
    case 'Azure': return <AzureProjectPage project={project} onProjectUpdate={setProject} />;
    case 'GCP':   return <GcpProjectPage   project={project} onProjectUpdate={setProject} />;
    default:      return <ErrorState error="지원하지 않는 클라우드 프로바이더입니다." />;
  }
};

return (
  <div className="flex h-[calc(100vh-56px)]">
    <ServiceListPanel />
    <div className="flex-1 min-w-0 overflow-auto">
      {renderProvider()}
    </div>
  </div>
);
```

**주의 1:** provider 페이지들이 이미 내부에 `<main>`을 가지므로 우측 wrapper는 반드시 `<div>`로 (이중 `<main>` 방지).
**주의 2:** TopNav가 `h-14` (= 56px)임을 codex가 verify함.

### MODIFY — `app/components/features/admin/ServiceSidebar.tsx`

flex shrink 방어를 위해 `aside` className에 `shrink-0` 추가.

```diff
-    <aside className="w-[280px] bg-white shadow-sm flex flex-col">
+    <aside className="w-[280px] shrink-0 bg-white shadow-sm flex flex-col">
```

> 한 줄 변경. /admin과 새 패널 양쪽이 동일한 보호 효과를 얻음.

## 재사용 코드 (변경 없음)

| 컴포넌트 / 모듈 | 경로 |
|---|---|
| `serviceListReducer`, `buildInitialServiceListState` | `app/components/features/admin-dashboard/serviceListReducer.ts` |
| `Modal` | `app/components/ui/Modal.tsx` |
| `useModal` | `app/hooks/useModal.ts` |
| `Button` | `app/components/ui/Button.tsx` |
| `getServicesPage` | `app/lib/api/index.ts` |
| `integrationRoutes.admin` | `lib/routes.ts` |
| `useToast` | `app/components/ui/toast` |

## Hook 추출 여부

**추출하지 않는다.** 두 사용처가 의미있게 분기됨:
- AdminDashboard: 첫 결과 자동선택, URL 시드(prop 기반), selectedService 변경 시 projects fetch.
- ServiceListPanel: 자동선택 없음, URL 시드 없음, 클릭 시 모달 → confirm 후 navigate, abort/loading/error 핸들링.

공통 훅을 만들면 콜백/플래그가 누수되어 leaky abstraction 됨. 현재 중복은 ~40줄로 허용 가능. 세 번째 소비자가 생기면 그때 추출.

## Vercel React Best Practices 준수 검증

| Rule | 적용 | 비고 |
|------|------|------|
| `server-serialization` | ✅ | server에서 searchParams 파싱 → 3개 primitive prop만 직렬화 |
| `async-suspense-boundaries` | ✅ | useSearchParams 제거로 Suspense 불필요. 필요해진다면 fallback에 skeleton 사용 |
| `rerender-derived-state-no-effect` | ✅ | `skipAutoSelectRef` 초기값을 prop에서 직접 도출, effect 동기화 없음 |
| `rerender-dependencies` | ✅ | useEffect deps에 primitive만 사용 (`initialUrlState.page`, `.query`) |
| `rerender-lazy-state-init` | ✅ | `useReducer`의 lazy initializer로 prop을 시드 |
| `rendering-conditional-render` | ✅ | 조건부 렌더링은 `{condition && <X />}` 대신 의미상 ternary가 필요한 곳은 ternary 사용 (단순 조건은 `&&` 허용) |
| `bundle-barrel-imports` | ⚠️ 확인필요 | `from './admin'`, `from './admin-dashboard'` barrel 사용 중. 기존 패턴 유지 (surgical principle). 추후 별도 cleanup. |
| `client-swr-dedup` | N/A | 단일 패널 인스턴스, dedup 필요 없음 |

## 검증 (`npm run dev` + 자동 테스트)

### 자동 검증
1. `npm run lint` — 모든 ESLint 규칙 통과.
2. `npm run test:run` — 새 단위 테스트 + 기존 테스트 모두 통과.
3. `npm run build` — Suspense 제거로 build CSR bailout 경고 없음. /admin, /target-sources/[id] 라우트 모두 빌드.

### 단위 테스트 추가 (vitest 가정)
- `parseUrlState.test.ts`:
  - `parseNonNegativeInt('-1')` → 0
  - `parseNonNegativeInt('1.5')` → 0
  - `parseNonNegativeInt('abc')` → 0
  - `parseNonNegativeInt(undefined)` → 0
  - `parseNonNegativeInt('2')` → 2
  - `parseAdminUrlState({ service: 'A001', query: 'x', page: '2' })` → 정상 파싱
  - `parseAdminUrlState({ service: '   ' })` → service: null (trim+empty)
  - `parseAdminUrlState({})` → 모두 default
- `ServiceMoveConfirmModal.test.tsx`:
  - 렌더링: title / message / 버튼 라벨
  - "취소" 클릭 → onClose 호출
  - "이동" 클릭 → onConfirm 호출

### 수동 시나리오 검증
1. `/integration/admin` 직접 진입 — 기존처럼 첫 서비스 자동 선택, URL 파라미터 없음 (회귀 없음).
2. `/integration/target-sources/<AWS id>` 진입 — 좌측 280px 사이드바, 선택 없음, 검색어 빈 값, page 0. 첫 fetch 동안 skeleton 표시.
3. 검색어 입력 → 300ms 디바운스 후 결과 갱신, 선택 여전히 없음.
4. 페이지 2로 이동.
5. 임의 서비스 클릭 → 모달 표시: `{code} {name} 서비스 관리 페이지로 이동하시겠습니까?`. ESC / 배경 클릭 / 취소 모두 모달 닫힘.
6. 다시 클릭 후 "이동" → URL이 `/integration/admin?service=<code>&query=<q>&page=2`.
7. /admin: 해당 서비스가 하이라이트, 검색 입력에 `<q>`, 페이지 2, 해당 서비스의 프로젝트 목록 로드.
8. **브라우저 뒤로가기** → 상세 페이지로 복귀. 패널 상태는 reset됨(예상 동작).
9. **브라우저 앞으로가기** → /admin로 다시 이동, 동일 URL이므로 동일 상태로 복원 (`key` remount).
10. **악의적 URL 직접 입력**: `/integration/admin?page=-1` / `?page=abc` / `?page=999` / `?service=NONEXISTENT` — 빈 결과/에러가 graceful하게 표시되고 crash 없음.
11. **fetch 실패 시뮬레이션**: 네트워크 차단 → loading 상태 → error 상태 + 재시도 가능.
12. **빠른 연속 클릭**: 서비스 A 클릭 → 모달 열림 → 닫지 않고 서비스 B 클릭 → 모달 데이터가 B로 갱신되거나(useModal 동작 확인) A 모달 닫고 B 모달 열림. **결정**: useModal `data` 상태가 갱신되어 동일 모달이 새 데이터를 보여주는 형태가 되도록 검증.
13. **모달 열린 채 페이지 이탈**: 우측 콘텐츠에서 다른 라우트로 이동 → unmount 시 useEffect cleanup이 abort + debounce clear 실행 (memory leak 없음).
14. **검색 중 네트워크 응답 지연**: 빠른 추가 입력 → 이전 요청 abort → 마지막 입력만 결과 반영 (race 방지).
15. **StrictMode 더블 마운트 (dev)**: 첫 fetch가 두 번 호출되더라도 abort로 첫 호출이 취소되므로 stale response가 dispatch되지 않음.
16. Azure / GCP 상세 페이지에서도 동일 동작 확인.
17. 1280×800 뷰포트에서 우측 콘텐츠(`max-w-[1200px]`)가 280px 사이드바와 함께 잘림 없이 표시되고 horizontal overflow 없음 (`min-w-0` 효과).

## 위험 / 엣지 케이스 (정리)

- **이중 `<main>`**: provider 페이지들이 이미 내부에 `<main>`을 가지므로 `ProjectDetail` 우측 wrapper는 반드시 `<div>`로.
- **`page` out-of-range**: 응답의 `totalPages` 초과 시 `fetchServicesPage` 내부에서 0으로 리셋 후 재요청.
- **`service` 미존재**: 사이드바엔 하이라이트 없음. 우측 콘텐츠는 `getProjects(<bad code>)` 실패로 기존 에러 토스트 경로 사용 (AdminDashboard 기존 동작).
- **URL 인코딩**: `URLSearchParams`가 한글/공백/`&` 자동 처리.
- **back/forward**: `key` remount로 URL 변경마다 client component가 재마운트 → 시드 prop 갱신 반영. effect 의존성 누락 위험 없음.
- **stale response**: AbortController로 차단. 시그널 전달이 어렵다면 `controller.signal.aborted` 가드로 dispatch 자체를 막음.
- **debounce ref unmount leak**: cleanup effect에서 `clearTimeout` 호출.
- **TypeScript**: `any` 미사용. `parseNonNegativeInt` / `parseAdminUrlState` 모두 타입 명시.

## Critical Files

- `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx` (modify)
- `app/integration/target-sources/[targetSourceId]/_components/ServiceListPanel.tsx` (new)
- `app/integration/target-sources/[targetSourceId]/_components/ServiceMoveConfirmModal.tsx` (new)
- `app/components/features/AdminDashboard.tsx` (modify — accept `initialUrlState` prop)
- `app/components/features/admin/ServiceSidebar.tsx` (modify — `shrink-0` 한 줄)
- `app/components/features/admin-dashboard/parseUrlState.ts` (new)
- `app/integration/admin/page.tsx` (modify — server component으로 전환)
- `app/lib/api/index.ts` (modify — `getServicesPage`에 `options?: { signal?: AbortSignal }` 추가, 동일 파일 내 다른 함수와 동일 패턴)
- 테스트: `app/components/features/admin-dashboard/parseUrlState.test.ts` (new), `ServiceMoveConfirmModal.test.tsx` (new)

## 작업 단계 (구현 순서)

1. `parseUrlState.ts` + 단위 테스트 추가.
2. `admin/page.tsx` 를 server component로 전환, AdminDashboard에 `initialUrlState` prop 전달.
3. `AdminDashboard.tsx` 수정 — `useSearchParams`/Suspense 제거, prop 기반 lazy init, `skipAutoSelectRef` 도입. 단독 검증.
4. `app/lib/api/index.ts` 의 `getServicesPage`에 `options?: { signal?: AbortSignal }` 추가.
5. `ServiceSidebar.tsx` 에 `shrink-0` 추가.
6. `ServiceMoveConfirmModal.tsx` 생성 + 테스트.
7. `ServiceListPanel.tsx` 생성 (loading/error/abort 포함).
8. `ProjectDetail.tsx` 레이아웃 수정.
9. 검증 — 자동(lint/test/build) → 수동 시나리오 1~17 순차 실행.
