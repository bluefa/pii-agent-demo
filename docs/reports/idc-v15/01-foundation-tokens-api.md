# IDC v15-01 — Foundation: Design Tokens + API Set

## Intent

IDC UI 가 의존할 **디자인 토큰 + API 구현 set** 을 한 PR 로 완성한다. UI 컴포넌트는 만들지 않는다
(02·03 담당). 이 Wave 가 끝나면 02·03 은 `lib/theme.ts` 토큰과 `app/lib/api/idc.ts` 도메인 모델만
참조하면 된다.

Source: `design/idc-implementation-plan.md` §4(API 매핑)·§5(마이그레이션)·§6(갭)·§7(상수)·§8(토큰)·§9(mock).

## Required Outcome

1. v15 IDC 화면에 필요한 토큰/버튼 변형이 `lib/theme.ts` 에 존재(raw hex 0건으로 02·03 구현 가능).
2. IDC API set 이 `USE_MOCK_DATA=true` 에서 end-to-end 동작: route → `bff.idc.*` → mock → wire(snake)
   응답 → `app/lib/api/idc.ts` mapper → 도메인 모델(`IdcResourceView`).
3. 데이터 무결성 훅(`useIdcInstallationStatus`)이 §DR5 stale-guard + §DR3 abort 포함.
4. `docs/swagger/idc.yaml` 가 §6 갭(7 DB type, ips 6, firewall per-resource, exclusion_reason) 반영.

## Scope

### A. Design Tokens (`lib/theme.ts`, `DESIGN.md`)

| 추가/확인 | 내용 |
|---|---|
| `buttonStyles.variants.soft` | Soft Primary(연한 파랑 배경 + 파란 글자) — v15 `.btn.soft` (결정 #58). 없으면 추가 |
| `buttonStyles.variants.warnOutline` | warn outline + 새로고침 아이콘용 — v15 `.btn.warn-outline` (결정 #42). 없으면 추가 |
| `buttonStyles.variants.gray` 확인 | 보조 회색 채움 — `.btn.gray`(결정 #51). `secondary` 로 충당 가능 시 매핑만 |
| 구분 뱃지 매핑 | Single→`tagStyles.blue` / Multiple IP→`tagStyles.orange` / Domain→indigo(info) — §8 표 |
| `providerColors.IDC` 확인 | gray-700 (이미 존재) |

DESIGN.md 에 신규 변형 추가 시 §"Buttons" 표에 1줄 기록.

### B. Types & Constants

| 파일 | 내용 |
|---|---|
| `lib/bff/types/idc.ts` (신규) | wire DTO — idc.yaml 1:1. `IdcInstallationStatusResponse`(`bdc_tf`,`firewall_opened`,per-resource `resources[]`=G6), `IdcResourceInput`(7 DB type=G5, ips≤6=G2, `exclusion_reason?`=G3), `SourceIpRecommendation`, `ConfirmFirewallResponse` |
| `lib/types.ts` (수정) | `IdcInputFormat='IP'\|'HOST'`, `IdcDatabaseType`(7종), `IdcResourceConfig`(inputFormat·ips·domain·sid·sourceIps·firewallOpen), `MockResource.idcConfig?: IdcResourceConfig` (vmDatabaseConfig 선례, 비침습) |
| `lib/constants/idc.ts` (신규) | `IDC_MAX_IPS=6`, `IDC_DOMAIN_MAXLEN=100`, `IDC_REASON_MAXLEN=200`, `IDC_EXCL_PRESETS`, `IDC_LOAD_PER=5`, `IDC_DB_TYPES`(label↔wire↔port, §7), `IDC_SOURCE_IP_TOOLTIP`, 검증 정규식(IPV4/DOMAIN) |

### C. Mock

| 파일 | 내용 |
|---|---|
| `lib/mock-idc.ts` (신규) | authorize→state→**wire(snake) 응답**. seed = v15 `idcTargets`(3건)·`IDC_PREV_REQUEST`(7건) (정본 §9). `getIdcInstallationStatus` 는 processStatus 기반 `bdc_tf`/`firewall_opened`(roll-up) + per-resource `{resource_id, source_ips, firewall_open}` 합성(G6/G7). `getIdcResources`/`updateIdcResources`(임시저장) |
| `lib/bff/mock/idc.ts` (신규) | `mockBff.idc` 핸들러 — `gcp.ts` 패턴(authorize → handleResult → NextResponse) |
| `lib/mock-data.ts`/store (수정) | IDC target source seed (processStatus 별 데모 1~7 진입용) |

### D. BFF Client

| 파일 | 내용 |
|---|---|
| `lib/bff/types.ts` (수정) | `BffClient.idc` namespace: `getInstallationStatus`,`checkInstallation`,`confirmFirewall`,`getResources`,`updateResources`,`getSourceIpRecommendation` |
| `lib/bff/http.ts` (수정) | `httpBff.idc` — upstream `/api/infra/v1/idc/...`. **path 는 여기만** (§5 격리) |
| `lib/bff/mock-adapter.ts` (수정) | `mockBff.idc` → `unwrap(await mockIdc.*)` |

### E. Routes + Client API

| 파일 | 내용 |
|---|---|
| `app/integration/api/v1/idc/target-sources/[targetSourceId]/resources/route.ts` | GET/PUT, `withV1` + `parseTargetSourceId` |
| `.../[targetSourceId]/installation-status/route.ts` | GET |
| `.../[targetSourceId]/check-installation/route.ts` | POST |
| `.../[targetSourceId]/confirm-firewall/route.ts` | POST |
| `app/integration/api/v1/idc/source-ip-recommendation/route.ts` | GET (`?ipType=`) |
| `app/lib/api/idc.ts` (신규) | client fn + **wire↔도메인 mapper**(`IdcResourceView`, 정본 §5.3). GET 류는 `{ signal?: AbortSignal }` |
| `app/hooks/useIdcInstallationStatus.ts` (신규) | §DR3 abort + §DR5 stale-guard 포함. `getFn=getIdcInstallationStatus`,`checkFn=checkIdcInstallation` |

### F. Swagger

`docs/swagger/idc.yaml` 갱신: DB type enum 7종, `ips.maxItems: 6`, `IdcResourceInput.exclusion_reason?`,
`IdcInstallationStatus.resources[]`(per-resource source_ips·firewall_open), `confirm-targets` description 에서
"INSTALLING 전이" 문구 제거(G1). **Contract-First: swagger 갱신 → 타입 도출** 순서.

## API Call Shape

`app/lib/api/idc.ts` 가 유일한 wire↔도메인 경계 (정본 §5.1):

```ts
// wire(snake) → 도메인(camel). UI 는 IdcResourceView 만 본다.
export async function getIdcResources(
  targetSourceId: number, opts?: { signal?: AbortSignal },
): Promise<IdcResourceView[]> {
  const res = await fetchInfraJson<{ resources: IdcResourceInput[] }>(
    `/idc/target-sources/${targetSourceId}/resources`, { signal: opts?.signal },
  );
  return res.resources.map(toIdcResourceView);   // 필드 rename 시 이 함수만 수정
}
```

`useIdcInstallationStatus` 는 §DR 표준 패턴(README) — `requestedId` 캡처 + stale 폐기 + abort.

## Guardrails

- §DT1~DT5 (raw hex 0건), §DR3·DR5·DR6 (abort·stale·mutation) 준수.
- ⛔ 단일 endpoint 의 (swagger + types + mock + route + client)를 서브에이전트로 분리 금지.
- `any` 0건, 상대경로 import 0건(`@/` 만).
- mock 은 **wire 형태(snake)** 반환 — 도메인 변환은 `app/lib/api/idc.ts` 에서만.
- UI 파일(`_components/idc/**`) 생성 금지 — 이 Wave 범위 아님.

## Out Of Scope

- 모든 IDC UI 컴포넌트/페이지/모달 (02·03).
- guide slot 등록 (03).
- 공용 `useInstallationStatus` 수정 — IDC 는 전용 훅 사용(공용 변경 blast radius 회피).

## Acceptance Criteria

- `bff.idc.*` 6개 메서드가 mock·http 양쪽 구현. mock 응답 snake → mapper → 도메인 통과.
- `app/lib/api/idc.ts` 가 도메인 모델만 export, wire 타입은 `lib/bff/types/idc.ts` 에 격리.
- `useIdcInstallationStatus` 가 target 전환 시 stale 응답을 폐기(테스트 또는 수동 확인).
- `docs/swagger/idc.yaml` 가 §6 갭 반영, README 의 swagger 표와 일치.
- `npx tsc --noEmit`, `npm run lint`, `npm run build` 통과.

## Verification

```bash
npx tsc --noEmit
npm run lint -- lib app/integration/api/v1/idc app/lib/api/idc.ts app/hooks/useIdcInstallationStatus.ts
rg -n "let cancelled|cancelled = false" app/hooks/useIdcInstallationStatus.ts app/lib/api/idc.ts   # 0
rg -n "#[0-9A-Fa-f]{6}" lib/bff/mock/idc.ts lib/mock-idc.ts                                         # 색상 hex 0 (IP 아님 주의)
rg -n "idc" lib/bff/types.ts lib/bff/http.ts lib/bff/mock-adapter.ts                                # namespace 연결 확인
# mock smoke (dev 서버):
USE_MOCK_DATA=true npm run dev &  # 후 /integration/api/v1/idc/target-sources/<id>/installation-status 200
```

## Return

PR URL · 추가한 토큰 변형(soft/warnOutline) · `IdcResourceView` 필드 · swagger 갱신 항목(G별) ·
stale-guard 구현 방식 · tsc/lint/build 결과 · 02·03 가 의존할 export 목록.
