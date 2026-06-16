# IDC v15-03 — IdcResourceTable + Steps 2~7 + Guide Slots

## Intent

IDC Step 2~7 의 읽기 전용 화면과 Step 4 설치(2-task + 방화벽 모달), 그리고 IDC guide slot 을 구현한다.
Step 2~7 은 컬럼 세트만 다른 동일 테이블이므로 **단일 `IdcResourceTable`(cols 가변)** 로 통일한다.
의존: `idc-v15-01`, `idc-v15-02`(cells.tsx 공유).

Source: `design/idc-implementation-plan.md` §3·§4(Step2~7)·§8 · `design/idc-flow-requirements.md` §3.3~3.6 ·
v15 HTML L6118~7240(step cards), L8151~8178(firewall modal), L9883~9943(renderIdcTargets), L10333~10347.

## Required Outcome

- `IdcResourceTable` 가 `cols` prop(`src`/`excl`/`fw`/`conn`/`health`)으로 Step 2~7 전부 렌더 (v15 `data-idc-cols` 1:1).
- Step 4: 2 install-task(`bdc_tf`/`firewall_opened`) + 방화벽 확인 모달(행별 Source IP→대상→오픈여부).
- Step 5: Run Test → Testing… → Success 전이(공용 test-connection async).
- guide slot `process.idc.1~7` 등록 + ko/en seed.
- 모든 step fetch 가 §DR(target 전환 오염 0).

## Scope

| 파일 | 내용 |
|---|---|
| `idc/IdcResourceTable.tsx` | 읽기 전용 표. cols: `src`(Source IP + 헤더 ⓘ tooltip, 결정 #19·40), `excl`(대상여부 pill+사유칩, Step2·3 제외행 포함), `fw`(방화벽 오픈/오픈되지 않음), `conn`(Success/Pending), `health`(Healthy/Unhealthy). live/excluded 필터 = cols 에 `excl` 유무 (v15 renderIdcTargets L9920~9942) |
| `idc/cells.tsx` (02 와 공유, 확장) | `IdcFirewallBadge`·`IdcConnBadge`·`IdcHealthBadge` 추가 |
| `steps/IdcStep2WaitingApproval.tsx` | chrome + `<IdcResourceTable cols={['src','excl']}>` 읽기 |
| `steps/IdcStep3Applying.tsx` | 동일 (`src`,`excl`) |
| `steps/IdcStep4Installing.tsx` | 2 install-task(완료/진행중 pill) + 방화벽 task 클릭→모달 + `<IdcResourceTable cols={['src','fw']}>`. `useIdcInstallationStatus`(01) |
| `steps/IdcStep5ConnectionTest.tsx` | `<IdcResourceTable cols={['src','conn']}>` + Run Test 버튼(공용 testConnection) |
| `steps/IdcStep6ConnectionVerified.tsx` | `<IdcResourceTable cols={['src','conn']}>` |
| `steps/IdcStep7Complete.tsx` | `<IdcResourceTable cols={['src','health']}>` |
| `modals/IdcFirewallModal.tsx` | 행별 Source IP→연동대상→Port→오픈여부. 연동 대상 1건=1행(결정 #18), multi-IP 대표+토글, 2종 뱃지(#21) (v15 L8151~8178, openIdcFirewallModal L10333) |
| `lib/constants/guide-registry.ts` (수정) | `process.idc.1~7` slot + IDC guide names |
| `app/components/features/process-status/GuideCard/resolve-step-slot.ts` (수정) | `if (provider === 'IDC') key = process.idc.${step}` 분기 |
| `lib/bff/mock/guides.ts` seed (수정) | IDC 가이드 ko/en seed (7 step) |

## API Call Shape

- Step 2·3: 공용 approval 스냅샷(`getApprovedIntegration`/`getApprovalRequestLatest`) → 도메인 매핑. 제외행
  포함. Source IP 는 `getIdcInstallationStatus` per-resource(G6).
- Step 4: `useIdcInstallationStatus({ targetSourceId, getFn: getIdcInstallationStatus, checkFn: checkIdcInstallation })`
  — DR3 abort + DR5 stale guard(01 구현). task1=`bdc_tf`, task2=`firewall_opened`. 방화벽 완료 보고 시
  `confirmIdcFirewall` (DR6 `await`).
- Step 5/6: 공용 `testConnection`(POST 202 `{id}`) → `getTestConnectionLatest` 폴링. v15 runIdcConnTest 흐름.
- Step 7: `getProject`/confirmed health.

모든 GET effect 는 README §DR 표준 패턴(abort + `requestedId` stale 폐기, deps `[targetSourceId, retryNonce]`).

### IdcResourceTable 계약 (재사용 안전)

```tsx
interface IdcResourceTableProps {
  resources: IdcResourceView[];   // 부모(step)가 targetSourceId scope 로 fetch 해 전달 — DR7
  cols: ReadonlyArray<'src' | 'excl' | 'fw' | 'conn' | 'health'>;
}
// 순수 프레젠테이션. 자체 fetch/모듈 캐시 금지(DR1·DR7). excluded 행 노출은 cols.includes('excl') 로만.
```

## Guardrails

- §DR1·DR3·DR5·DR7: `IdcResourceTable` 은 fetch 안 함(부모가 주입). 각 step 이 자기 fetch + abort + stale guard.
- §DT1~DT5: 방화벽/Conn/Health 뱃지 = `Badge`/`statusColors`(green=오픈/Success/Healthy, red=오픈되지 않음/Unhealthy,
  orange=Pending). Source IP ⓘ = `InfoTooltip` 헤더 1개(행별 ⓘ 금지, #19). host/SID/SourceIP = `res-id-cell`
  copy-on-hover + floating tooltip.
- 방화벽 다중 경로 집계: 행 내 모든 경로 open 이어야 `방화벽 오픈`, 하나라도 closed 면 `오픈되지 않음`(#22).
- multi-IP: 기본 접힘 + `IP N개 더보기/접기` 토글(#25). Port 별도 컬럼(#32). SID 항상 아래 줄(#57).
- ⛔ Step2·3 만 제외행 노출, Step4~7·방화벽 모달은 연동 대상만(#39).

## Out Of Scope

- Step 1, 모달 5종(02), provider page/layout(02).
- API/타입/mock/토큰(01).
- 공용 `useInstallationStatus`/test-connection 내부 수정(IDC 는 래핑/전용 훅).

## Acceptance Criteria

- Step 2~7 진입 시 각 v15 화면과 일치(컬럼 세트, 제외행 노출 범위, 뱃지).
- Step 4: 2 task pill, 방화벽 task 클릭→모달(행별 매핑·2종 뱃지·multi-IP 토글), check-installation 갱신.
- Step 5: Run Test → Testing… → Success.
- guide slot `process.idc.1~7` 해소(`resolveStepSlot('IDC', n)` non-null), ko/en seed 표시.
- target 전환 시 step 데이터 오염 0(DR2 remount + DR3/DR5).
- `npx tsc --noEmit`·`npm run lint`·`npm run build` 통과.

## Verification

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/\[targetSourceId\]/_components/idc lib/constants/guide-registry.ts app/components/features/process-status/GuideCard/resolve-step-slot.ts
rg -n "useEffect" app/integration/target-sources/\[targetSourceId\]/_components/idc/steps   # 각 fetch effect abort 포함 확인
rg -n "#[0-9A-Fa-f]{6}" app/integration/target-sources/\[targetSourceId\]/_components/idc/IdcResourceTable.tsx app/integration/target-sources/\[targetSourceId\]/_components/idc/modals/IdcFirewallModal.tsx  # 0
rg -n "process\.idc\." lib/constants/guide-registry.ts                                       # 7 slots
```

Manual QA (`USE_MOCK_DATA=true`): Step2~7 순회(processStatus 2~7 진입), Step4 방화벽 모달, Step5 Run Test,
multi-IP 토글, 제외행 Step2·3 노출/Step4~7 미노출, **2 target 왕복 잔상 0**.

## Return

PR URL · `IdcResourceTable` cols 계약 · Step4 install-status 매핑 · guide slot/이름 · DR 적용 fetch 목록 ·
토큰 deviation · tsc/lint/build.
