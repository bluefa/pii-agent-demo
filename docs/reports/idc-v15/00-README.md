# IDC v15 — Wave Set (작업계획서)

> v15 HTML(`design/SIT Prototype Athena v15.html`) 의 IDC `data-prov-view="idc"` 플로우를
> 7-step SIT 앱에 재도입한다. (구 IDC 구현은 wave16-01 에서 제거됨 → 이번은 v15 기반 신규.)
> 설계/API/마이그레이션 정본: **`design/idc-implementation-plan.md`** (§은 본 README에서 그 문서 참조).
> 요구사항 원천: `design/idc-flow-requirements.md` (결정 #1~#58).

## 우선순위 (사용자 확정)

1. **HTML 우선** — UI·디자인·토큰·인터랙션·mock 데이터는 v15 HTML 그대로. HTML ↔ `docs/swagger/idc.yaml`
   충돌은 HTML을 따르고 yaml을 갱신(`design/idc-implementation-plan.md` §6 갭 G1~G7).
2. **승인 라이프사이클은 공용 confirm 플로우** (Step1→2→3→4). idc.yaml `confirm-targets`(INSTALLING 직행)는
   미채택 — 전이 없는 저장 용도로만 mock.
3. **데이터 무결성 최우선** — target source 전환·컴포넌트 재사용 시 이전 결과 오염 0건 (§DR).

## Wave 분할 (각 1 PR, `/wave-task <key>` 로 실행)

| Key | 제목 | 의존 | 핵심 |
|-----|------|------|------|
| `idc-v15-01` | Foundation — Design Tokens + API Set | — | 토큰 + 전체 API set(swagger·BFF types·http·mock·route·client mapper·hooks). UI 없음 |
| `idc-v15-02` | Provider Page + Layout + Step 1 | 01 | IdcProjectPage·IdcTargetSourceLayout(키링)·Step1 수동입력 + 5 모달 + 제외 popover |
| `idc-v15-03` | IdcResourceTable + Steps 2~7 + Guide | 01·02 | 공용 IDC 테이블(cols 가변)·Step4(2-task+방화벽 모달)·Step2/3/5/6/7·guide slots |

순차 실행 권장(01→02→03). 01 은 UI 무관이라 02 와 파일 overlap 없음 → 병렬 가능하나, 02·03 은 01 의
타입/API에 의존.

## ⛔ 공용 가드레일 — Design Token (DT)

`DESIGN.md` 강제. 모든 Wave 적용.

- **DT1** Raw 색상 클래스(`bg-blue-600` 등) 직접 사용 금지. `lib/theme.ts` 토큰 또는 `app/components/ui/*` 만.
- **DT2** v15 raw hex → 토큰 매핑은 `design/idc-implementation-plan.md` §8 표를 따른다. 신규 변형이
  필요하면(`btn soft`=Soft Primary, `btn warn-outline`) `lib/theme.ts` 에 추가하고 §8 갭에 기록 후 사용.
- **DT3** 간격 24/20/12/8/4 · radius 6/8/12/full · 타이포 named token + 9-stop scale 외 값 금지.
- **DT4** 뱃지/버튼/모달/툴팁/페이지네이션/copy-on-hover 는 기존 UI 컴포넌트 재사용. 신규 표 셀은 기존
  `res-id-cell`(ellipsis + copy-on-hover + floating tooltip) 패턴 그대로.
- **DT5** IDC accent = `providerColors.IDC`(gray-700). identity bar 는 IDC 간소화(이름 + Agent 칩만, 결정 #49).

## ⛔ 공용 가드레일 — Data Integrity (DR)  ← 사용자 핵심 요구

target source 전환 / 컴포넌트 재사용 시 **다른 target 의 API 결과가 화면을 오염시키지 않도록** 강제한다.
근거: `app/hooks/useInstallationStatus.ts` 는 `targetSourceId` 변경 시 stale-guard·reset 이 없고,
`app/hooks/useApiMutation.ts` 의 `onSuccess` 는 await 되지 않는(fire-and-forget) 구조.

- **DR1 — 모듈 전역 상태 금지 (포팅 위험 #1).** v15 HTML 의 `let idcTargets = [...]`(모듈 전역, 모든 step 이
  공유·변형)을 **그대로 옮기지 말 것.** IDC 작업 목록은 반드시 **컴포넌트 state**(useState/useReducer)로
  두고 `targetSourceId` 별로 API 에서 seed 한다. 모듈 레벨 `let` 에 target 데이터 보관 금지.
- **DR2 — target 전환 시 remount.** IDC 서브트리를 `targetSourceId` 로 key:
  `<IdcProjectPage key={targetSourceId} … />` (또는 layout 경계). 전환 시 로컬 state 전체 초기화 보장.
- **DR3 — AbortController.** 모든 fetch effect 는 `AbortController` 사용, cleanup 에서 `abort()`,
  `AbortError` 는 무시. dep array = `[targetSourceId, retryNonce]`. `let cancelled = false` 패턴 금지
  (wave16-02 가드레일과 동일). `app/lib/api/idc.ts` 의 GET 류는 `{ signal?: AbortSignal }` 받는다.
- **DR4 — fetch 전 reset.** `targetSourceId` 변경 시 즉시 `loading` 으로 전환하고 이전 데이터 비운다.
  새 응답 도착 전 **이전 target 데이터 렌더 금지**.
- **DR5 — stale-response guard.** abort 와 별개로, set-state 직전 응답이 **현재 `targetSourceId` 소속인지**
  확인(요청 시점 id 캡처 후 비교). 공용 `useInstallationStatus` 는 이 guard 가 없으므로 IDC 는 전용 훅
  (`useIdcInstallationStatus`)에서 guard 를 구현하거나, 사용처를 DR2 remount 로 감싼다 (둘 다 권장).
- **DR6 — mutation 은 `useApiMutation`.** `onSuccess` 는 fire-and-forget(await 안 됨). mutation 후
  refetch 가 다음 동작 전에 끝나야 하면 `onSuccess` 타이밍에 의존하지 말고 `await mutate(...)` 반환
  프로미스로 순서를 보장한다.
- **DR7 — 단계 간 공유 캐시 금지.** 각 step 은 자기 데이터를 `targetSourceId` scope 로 직접 fetch.
  fetch 결과를 모듈/싱글톤에 hoist 해 step·target 간 재사용 금지.

### DR 표준 fetch 패턴 (모든 IDC GET effect 가 따른다)

```tsx
useEffect(() => {
  const controller = new AbortController();
  const requestedId = targetSourceId;          // DR5: 요청 시점 id 캡처
  setState({ status: 'loading' });             // DR4: 이전 데이터 즉시 비움

  void getIdcResources(targetSourceId, { signal: controller.signal })
    .then((res) => {
      if (requestedId !== targetSourceIdRef.current) return; // DR5: stale 응답 폐기
      setState({ status: 'ready', data: toView(res) });
    })
    .catch((err) => {
      if (err instanceof DOMException && err.name === 'AbortError') return; // DR3
      setState({ status: 'error', message: getIdcErrorMessage(err) });
    });

  return () => controller.abort();             // DR3: 전환/언마운트 시 취소
}, [targetSourceId, retryNonce]);
```

> DR2(key remount)를 적용하면 `targetSourceIdRef` 없이도 안전하지만, **DR2 + DR5 를 둘 다** 적용해
> 단일 방어선에 의존하지 않는다(컴포넌트가 key 없이 재사용되는 경로가 추가돼도 안전).

## API 마이그레이션 (요약 — 정본 §5)

IDC API path/response 변경 충격을 격리: UI 는 **도메인 모델 `IdcResourceView` 만** 사용(wire snake 직접
접근 금지). path → `lib/bff/http.ts` 1곳 / 필드 rename → `lib/bff/types/idc.ts` + `app/lib/api/idc.ts`
mapper 1곳 / 구조 변경 → mapper 흡수, UI 무변경. 상세: `design/idc-implementation-plan.md` §5.

## 검증 (모든 Wave 공통)

```bash
npx tsc --noEmit
npm run lint -- <changed paths>
npm run build
# data-integrity grep gates
rg -n "let cancelled|cancelled = false" app/integration/target-sources/\[targetSourceId\]/_components/idc   # 0 hits
rg -n "^\s*let idc(Targets|Resources)\b" app/integration lib                                                 # 0 hits (모듈 전역 금지)
```

mock 모드(`USE_MOCK_DATA=true`) dev 서버에서 IDC target source 진입 → Step 1~7 이 v15 HTML 과 일치,
target source 전환 시 이전 데이터 잔상 0건.

## Parallel coordination

- 01 ↔ (02·03): 01 은 `lib/**`·`app/api/**`·`app/lib/api/**` 중심, UI 파일 미생성 → 02·03 의
  `_components/idc/**` 와 overlap 없음. 단 02·03 은 01 의 export 에 의존하므로 01 머지 후 진행 권장.
- ⛔ 단일 swagger endpoint 의 (mock + route + FE types)를 서브에이전트로 쪼개지 말 것 (wave-task Phase 2).
