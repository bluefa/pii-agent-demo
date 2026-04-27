# Target Source 상세 페이지 ServiceList 패널 추가 — 구현 계획 (v3)

작성일: 2026-04-27 (v3 revision: codex 추가 자문 반영, URL 방식 → module variable 방식 전환)

## Context

`/integration/target-sources/[targetSourceId]` 상세 페이지에 `/admin`과 동일한 좌측 ServiceList 패널(280px 풀하이트 사이드바)을 추가한다. 차이점은 다음과 같다.

1. 패널의 서비스를 클릭하면 즉시 선택되지 않고 "이동하시겠습니까?" 확인 모달이 뜬다.
2. 모달에서 "이동"을 누르면 `/admin`으로 이동하면서 **현재 검색어/페이지/클릭한 서비스**를 클라이언트 메모리(module variable)로 전달한다. URL에는 어떤 데이터도 노출되지 않는다.
3. `/admin`은 mount 시 1회 module variable에서 payload를 consume하여 reducer 초기 상태를 설정한다.

## v1 → v2 → v3 변경 이력

| 버전 | 접근 | 사유 |
|---|---|---|
| v1 | client `useSearchParams()` + Suspense | 초안 |
| v2 | server `searchParams` parsing → primitive props + `key` remount | codex-review 5 Major 반영 (Suspense 회피, 서버 검증) |
| **v3** | **client-only module variable + `useEffect` + `useRef` 가드** | **사용자 보안 우려 → codex 추가 자문 → URL 노출 자체 제거** |

## v2 → v3 변경 사유

v2의 URL 검색 파라미터 방식은 표준적이고 검증된 패턴이지만, 본 기능에서는 다음 정보가 URL에 노출됨:

- `service` (ServiceCode) → 브라우저 히스토리 / 자동완성에 잔존
- `query` (사용자 입력 자유 텍스트, 잠재적 민감) → Referer 헤더로 외부 링크 클릭 시 누출, 서버 액세스 로그·애널리틱스에 캡처
- `page` (덜 민감)

이 데이터는 라우트 이동 시 1회만 전달되면 충분하고 공유/북마크/F5 복원 요구사항이 없으므로, **URL에 노출하지 않고 클라이언트 메모리만 통해 전달**하는 게 정보 누출 표면을 최소화하는 합리적 선택.

codex 자문(2026-04-27)에 따른 옵션 랭킹:

1. **Module-level one-shot variable** — best fit (선택). 의존성/Provider 없음, ~15줄 코드.
2. One-shot sessionStorage — F5 복원이 필요할 때만 차선. 검색어가 소비 전까지 브라우저 스토리지에 남는다는 단점.
3. React Context / Zustand / Jotai — "구독 기능 붙은 더 큰 module variable". 본 기능엔 reactivity·cross-tree update·persistence·provider 모두 불필요.
4. URL search params (v2) — 공유/refresh-safe 요구가 있을 때 적합. 본 케이스 부적합.

## Caveat — leakage reduction이지 security boundary가 아님

이 변경으로 차단되는 것:
- 브라우저 주소창 노출 ✓
- 브라우저 히스토리 / 자동완성 ✓
- HTTP Referer 헤더 (외부 링크 누출) ✓
- 서버 액세스 로그의 URL 부분 ✓
- 애널리틱스 (구글애널리틱스 등) ✓

**여전히 남아있는 노출 (기존 동작 그대로)**:
- `getServicesPage()`는 BFF에 `GET /user/services/page?query=...&page=...` 형태로 검색어를 전송 → BFF 액세스 로그·중간 인프라(LB, WAF 등)에는 검색어가 캡처됨
- 진짜 민감한 검색어 처리가 필요하면 별도 작업(BFF API의 POST 전환, body 전송 등)으로 다뤄야 함

따라서 본 변경은 "front-end side 누출 표면 축소"이지 "검색어 보안 보장"이 아님을 명시.

## 결정 사항 (사용자 확인 완료)

| 항목 | 결정 |
|------|------|
| 상태 전달 방식 | **Module-level one-shot variable (client-only)** |
| /admin 도착 시 선택 | 클릭한 서비스 자동 선택 |
| 상세 페이지 패널 초기 상태 | 선택 없음 (목록만 표시) |
| 레이아웃 | /admin과 동일: 280px 풀하이트 좌측 사이드바 |
| F5 / 새 탭 / 직접 URL 진입 | default 상태로 fallback (의도된 동작) |

## 데이터 흐름

```
[ServiceListPanel handleConfirm]
  └─ setPendingAdminNavigation({selectedService, searchQuery, pageNumber})
        ↓ (브라우저 JS 모듈 변수에 저장 — 같은 SPA 인스턴스 내에서만 유효)
  └─ router.push('/integration/admin')           ← URL은 깔끔, 파라미터 없음
        ↓
[Next.js soft navigation: /admin RSC payload 요청]
        ↓
[Server: app/integration/admin/page.tsx]
  └─ <AdminDashboard /> 렌더 (서버는 payload 존재 모름)
        ↓ (default 상태로 RSC 직렬화)
[Client: AdminDashboard mount]
  └─ useEffect + useRef 가드:
      const payload = consumePendingAdminNavigation();
      if (payload) {
        dispatch({ type: 'HYDRATE', payload });  ← reducer 상태 시드
        skipAutoSelectRef.current = true;        ← 첫 결과 자동선택 스킵
      }
      fetchServicesPage(pageToFetch, queryToFetch);
```

요점: 데이터는 같은 브라우저 JS 컨텍스트 안에서만 이동, 네트워크/서버 통과하지 않음.

## 변경 파일

### NEW — `app/components/features/admin-dashboard/pendingAdminNavigation.ts`

Client-only module. payload write/consume 전용. ~15줄.

```ts
import 'client-only';

export interface AdminNavigationPayload {
  selectedService: string;
  searchQuery: string;
  pageNumber: number;
}

let pendingAdminNavigation: AdminNavigationPayload | null = null;

export const setPendingAdminNavigation = (payload: AdminNavigationPayload): void => {
  pendingAdminNavigation = payload;
};

export const consumePendingAdminNavigation = (): AdminNavigationPayload | null => {
  const payload = pendingAdminNavigation;
  pendingAdminNavigation = null;
  return payload;
};
```

> `import 'client-only'` directive로 server bundle에 끌려가는 것을 차단 (Next.js 표준).

### MODIFY — `app/components/features/admin-dashboard/serviceListReducer.ts`

`HYDRATE` 액션 추가 (3개 필드 한 번에 시드).

```diff
 export type ServiceListAction =
   | { type: 'SET_SERVICES'; services: ServiceCode[]; pageInfo: ServicePageResponse['page'] }
   | { type: 'SET_SELECTED'; serviceCode: string | null }
   | { type: 'SET_QUERY'; query: string }
-  | { type: 'SET_PAGE'; pageNum: number };
+  | { type: 'SET_PAGE'; pageNum: number }
+  | { type: 'HYDRATE'; payload: { selectedService: string; searchQuery: string; pageNumber: number } };
```

```diff
   switch (action.type) {
     case 'SET_SERVICES':
       return { ...state, services: action.services, pageInfo: action.pageInfo };
     case 'SET_SELECTED':
       return { ...state, selectedService: action.serviceCode };
     case 'SET_QUERY':
       return { ...state, query: action.query };
     case 'SET_PAGE':
       return { ...state, pageNum: action.pageNum };
+    case 'HYDRATE':
+      return {
+        ...state,
+        selectedService: action.payload.selectedService,
+        query: action.payload.searchQuery,
+        pageNum: action.payload.pageNumber,
+      };
   }
```

### MODIFY — `app/integration/admin/page.tsx`

기존 그대로 단순 wrapper. v2에서 도입했던 server-side `searchParams` 파싱 / Suspense 추가는 모두 **불필요해짐**.

```tsx
import { AdminDashboard } from '@/app/components/features/AdminDashboard';

export default function AdminPage() {
  return <AdminDashboard />;
}
```

> 이 파일은 v2에서 추가했던 변경사항을 모두 되돌리고 기존 상태로 회귀.

### MODIFY — `app/components/features/AdminDashboard.tsx`

핵심: mount 시 1회 `consumePendingAdminNavigation()` 시도, payload 있으면 시드 후 fetch. `useRef` 가드로 StrictMode 더블 마운트 방어.

기존 초기 fetch effect를 hydration-aware로 교체.

```tsx
import { consumePendingAdminNavigation } from './admin-dashboard/pendingAdminNavigation';

export const AdminDashboard = () => {
  const router = useRouter();
  const toast = useToast();

  const [serviceList, dispatch] = useReducer(
    serviceListReducer,
    undefined,
    buildInitialServiceListState,
  );
  const { services, selectedService, query: serviceQuery, pageInfo: servicePageInfo } = serviceList;

  // skipAutoSelectRef: page 0 fetch 시 첫 결과 자동 선택을 건너뛸지 결정
  const skipAutoSelectRef = useRef(false);

  // hydratedRef: hydration effect의 1회 실행 보장 (StrictMode 더블 마운트 대비)
  const hydratedRef = useRef(false);

  const fetchServicesPage = useCallback(async (page: number, searchQuery?: string) => {
    const data = await getServicesPage(page, 10, searchQuery || undefined);
    dispatch({ type: 'SET_SERVICES', services: data.content, pageInfo: data.page });
    if (page === 0 && data.content.length > 0 && !skipAutoSelectRef.current) {
      dispatch({ type: 'SET_SELECTED', serviceCode: data.content[0].code });
    }
    skipAutoSelectRef.current = false;
  }, []);

  // Hydration + initial fetch (1회)
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    const payload = consumePendingAdminNavigation();
    let pageToFetch = 0;
    let queryToFetch: string | undefined;
    if (payload) {
      dispatch({ type: 'HYDRATE', payload });
      skipAutoSelectRef.current = true;
      pageToFetch = payload.pageNumber;
      queryToFetch = payload.searchQuery || undefined;
    }
    void fetchServicesPage(pageToFetch, queryToFetch);
  }, [fetchServicesPage]);

  // 기존 selectedService → projects fetch effect는 그대로 (hydration으로 selectedService가 시드되면 자동으로 projects 로드)
  // ... 나머지 핸들러 / JSX는 변경 없음
};
```

> Codex의 핵심 가이드 준수:
> - `consume()`은 render나 `useReducer` initializer가 아닌 **`useEffect` 내부**에서 호출
> - `useRef`로 1회 실행 보장 (StrictMode safe)
> - hydration과 initial fetch를 **같은 effect**에서 처리 → race 없음
> - default `fetchServicesPage(0)` 단독 호출 제거 (위 effect로 통합)

### NEW — `app/integration/target-sources/[targetSourceId]/_components/ServiceListPanel.tsx`

상세 페이지 전용 패널 컨테이너. v2 설계와 거의 동일. 차이는 `handleConfirm`에서 URL 빌드 대신 `setPendingAdminNavigation` 호출.

**State**
- `useReducer(serviceListReducer, undefined, buildInitialServiceListState)` — 초기: 선택 없음, 빈 검색어, page 0.
- `useState<{ status: 'idle' | 'loading' | 'ready' | 'error'; message?: string }>({ status: 'idle' })` — fetch 라이프사이클.
- `useRef<ReturnType<typeof setTimeout> | null>(null)` — 검색 디바운스.
- `useRef<AbortController | null>(null)` — in-flight 요청 abort.
- `useModal<{ code: string; name: string }>()` — 확인 모달 상태.
- `useRouter()` from `next/navigation`.

**Fetch lifecycle**
```tsx
const fetchServicesPage = useCallback(async (page: number, q?: string) => {
  abortRef.current?.abort();
  const controller = new AbortController();
  abortRef.current = controller;
  setFetchState({ status: 'loading' });
  try {
    const data = await getServicesPage(page, 10, q || undefined, { signal: controller.signal });
    if (controller.signal.aborted) return;
    if (page > 0 && page >= data.page.totalPages) {
      dispatch({ type: 'SET_PAGE', pageNum: 0 });
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

> `getServicesPage` 시그니처에 `options?: { signal?: AbortSignal }` 추가 필요 — 동일 파일(`app/lib/api/index.ts`) 내 다른 함수들이 이미 동일 패턴 사용.

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

**Confirm handler — v2와 다른 핵심 부분**
```tsx
import { setPendingAdminNavigation } from '@/app/components/features/admin-dashboard/pendingAdminNavigation';

const handleConfirm = useCallback(() => {
  if (!confirmModal.data) return;
  setPendingAdminNavigation({
    selectedService: confirmModal.data.code,
    searchQuery: serviceQuery,
    pageNumber: pageInfo.number,
  });
  router.push(integrationRoutes.admin);
}, [confirmModal.data, serviceQuery, pageInfo.number, router]);
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

> 빈 결과 vs loading 구분: 첫 fetch 응답 전 `services.length === 0`일 때 `ServiceSidebar`의 "검색 결과가 없습니다" 깜빡임 회피를 위해, `fetchState.status === 'loading' && services.length === 0`이면 ServiceSidebar 자리에 skeleton(또는 spinner) 표시. ServiceSidebar 자체는 변경하지 않음.

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

### MODIFY — `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx`

flex 2-column 레이아웃, `shrink-0` / `min-w-0` 하드닝.

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

### MODIFY — `app/lib/api/index.ts`

`getServicesPage`에 `options?: { signal?: AbortSignal }` 추가 (동일 파일 다른 함수들과 동일 패턴).

```diff
 export const getServicesPage = async (
   page = 0,
   size = 10,
   query?: string,
+  options?: { signal?: AbortSignal },
 ): Promise<ServicePageResponse> => {
   const params = new URLSearchParams({ page: String(page), size: String(size) });
   if (query) params.set('query', query);
   const data = await fetchInfraCamelJson<{
     content: Array<{ serviceCode: string; serviceName: string }>;
     page: { totalElements: number; totalPages: number; number: number; size: number };
-  }>(`/user/services/page?${params}`);
+  }>(`/user/services/page?${params}`, options?.signal ? { signal: options.signal } : undefined);
   return {
     content: data.content.map((s) => ({ code: s.serviceCode, name: s.serviceName })),
     page: data.page,
   };
 };
```

## 재사용 코드 (변경 없음)

| 컴포넌트 / 모듈 | 경로 |
|---|---|
| `Modal` | `app/components/ui/Modal.tsx` |
| `useModal` | `app/hooks/useModal.ts` |
| `Button` | `app/components/ui/Button.tsx` |
| `useToast` | `app/components/ui/toast` |
| `integrationRoutes.admin` | `lib/routes.ts` |

## v2 대비 단순해진 부분

- ❌ `parseUrlState.ts` 불필요
- ❌ `/admin/page.tsx` server-side 파싱 / Suspense 불필요 (기존 그대로 유지)
- ❌ `key`-based remount 불필요
- ❌ AdminDashboard `initialUrlState` prop 불필요
- ✅ NEW: `pendingAdminNavigation.ts` (~15줄)
- ✅ AdminDashboard에 hydration effect (`useEffect` + `useRef` 가드)

## Codex 가이드 + Vercel React rules 준수 검증

| 항목 | 적용 | 비고 |
|------|------|------|
| `import 'client-only'` | ✅ | `pendingAdminNavigation.ts` 최상단 |
| `consume()` in `useEffect`, not render | ✅ | hydration effect 안에서만 호출 |
| `useRef` 가드 (StrictMode safe) | ✅ | `hydratedRef` |
| Module을 server file에서 import 금지 | ✅ | server `/admin/page.tsx`는 prop 전달 없음, `pendingAdminNavigation` import 안 함 |
| `rerender-derived-state-no-effect` | ✅ | hydration은 mount 시 1회. 이후 prop sync 없음 |
| `rerender-dependencies` | ✅ | effect deps에 primitive (`fetchServicesPage`) |
| `rerender-lazy-state-init` | ✅ | reducer lazy init (default state로 init 후 effect에서 hydrate) |
| `server-serialization` | N/A | 서버에서 client로 전달되는 prop 없음 |
| `async-suspense-boundaries` | N/A | useSearchParams 미사용 → Suspense 불필요 |

## Codex가 짚은 핵심 pitfalls — 반영 방법

1. **Consume in render/initializer 금지** → `useEffect` 안에서만 `consumePendingAdminNavigation()` 호출.
2. **Default `fetchServicesPage(0)` 분리 호출 시 race** → hydration과 initial fetch를 **같은 effect**로 통합. payload 유무에 따라 fetch 인자만 달라짐.
3. **Sensitive query는 backend log에 남음** → 본 plan의 caveat 섹션에 명시. 별도 작업으로 처리할 사안.
4. **F5/새 탭/직접 진입 시 fallback** → payload null이면 기존 default 동작 (`fetchServicesPage(0)` + 첫 결과 자동선택).
5. **Leakage reduction이지 security boundary가 아님** → caveat에 명시.

## 검증 (`npm run dev` + 자동 테스트)

### 자동 검증
1. `npm run lint` — 모든 ESLint 규칙 통과.
2. `npm run test:run` — 새 단위 테스트 + 기존 테스트 모두 통과.
3. `npm run build` — `import 'client-only'` 위반 시 즉시 실패하므로 server bundle 오염 자동 검출.

### 단위 테스트 추가
- `pendingAdminNavigation.test.ts`:
  - `set` 후 `consume` → payload 반환
  - `consume` 두 번째 호출 → null
  - `set` 두 번 → 마지막 값만 보존
  - 초기 상태에서 `consume` → null
- `serviceListReducer.test.ts` (HYDRATE 케이스 추가):
  - 기존 state에서 HYDRATE 적용 → selectedService/query/pageNum 갱신, services는 그대로
- `ServiceMoveConfirmModal.test.tsx`:
  - 렌더링 + 버튼 라벨 + 콜백 호출

### 수동 시나리오 검증
1. `/integration/admin` 직접 진입 — 기존처럼 첫 서비스 자동 선택, URL 파라미터 없음.
2. `/integration/target-sources/<AWS id>` 진입 — 좌측 280px 사이드바, 선택 없음, 검색어 빈 값, page 0. 첫 fetch 동안 skeleton 표시.
3. 검색어 입력 → 300ms 디바운스 후 결과 갱신, 선택 여전히 없음.
4. 페이지 2로 이동.
5. 임의 서비스 클릭 → 모달 표시. ESC / 배경 클릭 / 취소 모두 모달 닫힘.
6. 다시 클릭 후 "이동" → URL은 `/integration/admin` (파라미터 없음). /admin은 클릭한 서비스가 selected, 검색 입력에 `<q>`, 페이지 2, 해당 서비스의 프로젝트 목록 로드.
7. **F5 새로고침**: /admin이 default 상태(첫 서비스 자동 선택, 검색어 빈 값, page 0)로 리셋. URL 그대로 `/integration/admin`.
8. **새 탭에서 /admin 직접 진입**: default 상태.
9. **상세 페이지에서 클릭 → 이동 → 브라우저 뒤로가기 → 다시 앞으로가기**: forward 시 /admin이 default 상태 (payload는 이미 consume됨). 의도된 동작.
10. **악의적/오타 시나리오 X**: URL에 파라미터가 없으므로 v2의 `?page=-1` / `?service=BAD` 같은 케이스 자체가 발생하지 않음.
11. **fetch 실패 시뮬레이션**: 패널에서 네트워크 차단 → loading → error 상태 + 재시도 가능.
12. **빠른 연속 클릭**: 서비스 A 클릭 → 모달 → 닫지 않고 B 클릭 → useModal `data`가 B로 갱신되어 모달이 새 데이터 표시. 확인 후 B의 payload로 이동.
13. **모달 열린 채 페이지 이탈**: unmount 시 cleanup effect가 abort + debounce clear 실행. **`setPendingAdminNavigation`은 반드시 `router.push` 직전에만 호출**되므로 stale payload 위험 사실상 0.
14. **검색 중 네트워크 응답 지연**: AbortController로 stale response 차단.
15. **StrictMode 더블 마운트 (dev)**: `hydratedRef`가 두 번째 마운트에서 effect 본문 skip → consume 1회만 실행. 검증: dev console에서 fetch 호출 횟수 확인.
16. **HMR (dev)**: `pendingAdminNavigation.ts` 파일 저장 시 module 리셋. 시나리오에서 이런 일이 발생하면 그냥 default 상태가 되며 production에는 영향 없음.
17. Azure / GCP 상세 페이지에서도 동일 동작 확인.
18. 1280×800 뷰포트에서 `min-w-0` / `shrink-0` 효과 확인.

## 위험 / 엣지 케이스 (정리)

- **Server bundle 오염**: `pendingAdminNavigation.ts`를 server 파일에서 import하면 `'client-only'` directive로 build-time 에러. 자동 검출.
- **StrictMode 더블 마운트**: `useRef` 가드로 1회 실행 보장.
- **Stale module state**: `setPendingAdminNavigation` → `router.push` 사이에 다른 코드 실행 안 함 (동기 호출 직후). 따라서 stale 위험 사실상 0.
- **page 응답 out-of-range**: ServiceListPanel의 fetch 내부에서 `totalPages` 초과 시 0으로 리셋 + 재요청.
- **debounce ref unmount leak**: cleanup effect에서 `clearTimeout`.
- **AbortSignal 미지원 호출자**: `getServicesPage`에 `options?: { signal?: AbortSignal }` 추가 필요. 기존 호출자는 옵션 없이도 동작 (하위 호환).
- **TypeScript**: `any` 미사용, 모든 함수/payload 타입 명시.

## Critical Files

- `app/components/features/admin-dashboard/pendingAdminNavigation.ts` (new — `client-only` module + 3 함수)
- `app/components/features/admin-dashboard/serviceListReducer.ts` (modify — `HYDRATE` 액션 추가)
- `app/components/features/AdminDashboard.tsx` (modify — hydration effect, `consume` 호출, `skipAutoSelectRef`)
- `app/integration/target-sources/[targetSourceId]/_components/ProjectDetail.tsx` (modify — flex layout)
- `app/integration/target-sources/[targetSourceId]/_components/ServiceListPanel.tsx` (new)
- `app/integration/target-sources/[targetSourceId]/_components/ServiceMoveConfirmModal.tsx` (new)
- `app/components/features/admin/ServiceSidebar.tsx` (modify — `shrink-0` 한 줄)
- `app/lib/api/index.ts` (modify — `getServicesPage`에 AbortSignal 옵션)
- 테스트: `pendingAdminNavigation.test.ts`, `serviceListReducer.test.ts` (HYDRATE 케이스), `ServiceMoveConfirmModal.test.tsx`

## 작업 단계 (구현 순서)

1. `pendingAdminNavigation.ts` + 단위 테스트.
2. `serviceListReducer.ts`에 `HYDRATE` 액션 추가 + 테스트.
3. `AdminDashboard.tsx` hydration effect 도입 (단독 검증 — 직접 콘솔에서 `setPendingAdminNavigation` 호출 후 `/admin` navigate 시 정상 hydrate되는지).
4. `app/lib/api/index.ts`의 `getServicesPage`에 AbortSignal 옵션 추가.
5. `ServiceSidebar.tsx`에 `shrink-0` 추가.
6. `ServiceMoveConfirmModal.tsx` + 테스트.
7. `ServiceListPanel.tsx` (loading/error/abort + handleConfirm에서 `setPendingAdminNavigation` + `router.push`).
8. `ProjectDetail.tsx` 레이아웃 수정.
9. 검증 — 자동(lint/test/build) → 수동 시나리오 1~18 순차 실행.
