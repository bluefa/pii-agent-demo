# IDC v15-02 — Provider Page + Layout + Step 1

## Intent

IDC provider 진입점과 Step 1(연동 대상 DB 수동 입력) 전체를 구현한다. Step 1 은 v15 IDC 의 가장 새로운
화면 — scan 대체 수동 입력 + 5개 모달 + 제외 사유 popover. 의존: `idc-v15-01`.

Source: `design/idc-implementation-plan.md` §2~3 · `design/idc-flow-requirements.md` §3.1~3.3-1 · §4 ·
v15 HTML L5803~5883(Step1 markup), L7952~8178(modals), L9802~10358(JS 동작).

## Required Outcome

- `ProjectDetail` 의 `cloudProvider` switch 에 `case 'IDC'` → `IdcProjectPage`.
- IDC 7-step 라우팅(`IdcTargetSourceLayout`)이 `processStatus` 로 step 렌더, 공용 chrome 재사용.
- Step 1 이 v15 와 픽셀 일치: 빈/목록 상태, 추가/수정/삭제, 제외(체크 해제→사유), 5개 모달, 승인요청 가드.
- **target source 전환 시 이전 입력 잔상 0건** (§DR).

## Scope

| 파일 (`app/integration/target-sources/[targetSourceId]/_components/idc/`) | 내용 |
|---|---|
| `IdcProjectPage.tsx` | identity 구성(이름 + Agent 칩만, 결정 #49) → `IdcTargetSourceLayout`. `AzureProjectPage` 미러 |
| `IdcTargetSourceLayout.tsx` | `processStatus`(1~7) switch → IDC step. `CloudTargetSourceLayout` 시그니처 동일 |
| `steps/IdcStep1TargetInput.tsx` | 공용 chrome(`ProjectPageMeta`+`ProcessStatusCard`+`GuideCardContainer`+`RejectionAlert`) + Step1 본문 |
| `IdcTargetListTable.tsx` | Step1 편집 테이블: ☑·구분·연동대상·Port·DBType·제외사유·연동완료여부·✎🗑 (v15 L5836~5880) |
| `IdcExclusionPopover.tsx` | 체크 해제 시 사유 선택(임시DB/StageDB/DevDB/직접입력). 외부클릭·ESC 시 체크 자동 복원 (v15 L10014~10058) |
| `modals/IdcTargetFormModal.tsx` | 연동 대상 추가/수정 — 입력방식(IP/Domain radio-card)·IP 다중(+추가,≤6,경고)·Domain(≤100)·DBType(7)·SID(Oracle)·Port(자동) (v15 L7952~8061, validate L10198~10254) |
| `modals/IdcLoadRequestModal.tsx` | 기존 요청 불러오기 — 미리보기 목록(pagination 5/page)·빈상태·경고. 확정 시 목록 전체 대체 (v15 L8063~8097, L10275~10330) |
| `modals/IdcSubmitModal.tsx` | 승인 요청 확인 — 전체/연동/미연동 3 stat, 머무르기/제출하기 (v15 L8099~8127) |
| `modals/IdcExclusionReasonModal.tsx` | 제외 사유 직접 입력 — textarea 200자, 취소 시 체크 복원 (v15 L8129~8149) |
| `cells.tsx` (신규, 03 와 공유) | `IdcKindBadge`·`IdcEndpointCell`(multi-IP toggle)·`IdcDbTypeCell`(SID)·`IdcSourceIpCell`. v15 idcKind/idcEndpoint/idcDbTag/idcSrcIpCell |
| `index.ts` | re-export |
| `ProjectDetail.tsx` (수정) | `case 'IDC': return <IdcProjectPage key={project.targetSourceId} … />` (DR2) |

## API Call Shape

Step 1 데이터는 `idc-v15-01` 의 `app/lib/api/idc.ts` 만 사용:

- 진입 로드: `getIdcResources(targetSourceId, { signal })` (DR3 표준 패턴)
- 추가/수정/삭제: 로컬 state 변경 후 `updateIdcResources(targetSourceId, views)` (임시 저장, DR6 `await mutate`)
- 불러오기: `getIdcPreviousRequest(...)`(공용 approval-history 래핑, mock 고정 7건) → 확정 시 로컬 목록 대체
- 승인 요청 제출: 공용 `createApprovalRequest(targetSourceId, { resource_inputs })` → 성공 후 `refreshProject()`
  (DR6: `await` 로 순서 보장, `onSuccess` 타이밍 의존 금지) → processStatus 2 로 전이

### Step 1 상태 모델 (⛔ DR1 — 모듈 전역 금지)

```tsx
// IdcStep1TargetInput 내부 — 컴포넌트 state. 모듈 레벨 let 금지.
const [targets, dispatch] = useReducer(idcTargetsReducer, []);  // seed: getIdcResources
// 각 target: IdcResourceView(+ 로컬 편집 필드 excluded/exclusionReason/exclusionCustom)
```

v15 의 전역 `let idcTargets`·`IDC_PREV_REQUEST` 는 각각 **컴포넌트 state** 와 **01 의 mock seed** 로 옮긴다.

## Guardrails

- §DR1(모듈 전역 금지)·DR2(key remount)·DR3(abort)·DR6(mutation await) 필수.
- §DT1~DT5: raw hex 0. 뱃지=`tagStyles`/`Badge`, 버튼=`buttonStyles`(soft/warnOutline/gray), 모달=`Modal`,
  copy-on-hover=`res-id-cell` 패턴, radio-card=기존 install-mode-seg 패턴.
- 검증 규칙 v15 그대로: IPv4(옥텟≤255)·IP 중복 차단(#55)·끝공백 경고+차단(#35)·Domain FQDN/≤100(#56)·
  Port 1~65535·Oracle SID 필수(#4). 인라인 에러만, toast 금지.
- 승인 요청 가드: 연동 대상 0건이면 버튼 disabled + 모달 진입 차단(이중 방어, v15 updateIdcCount/openIdcSubmitModal).
- DB Type 변경 시 기본 포트 자동(#54), 단 **수정 모드 프리필 시 미적용**(v15 onIdcDbTypeChange(false)).
- ⛔ 실 PII 하드코딩 금지 — seed 는 01 의 mock(예시 IP/도메인)만.

## Out Of Scope

- Step 2~7 화면, `IdcResourceTable`(읽기 전용 cols 가변), Step4 방화벽 모달 — `idc-v15-03`.
- guide slot 내용 — 03 (단, `GuideCardContainer` 호출부는 02 에 두되 slotKey null 허용).
- API/타입/mock/토큰 — 01.

## Acceptance Criteria

- IDC target source 진입(processStatus=1) → Step 1 이 v15 와 일치(빈/목록, 헤더 2버튼, 카운트, 페이지네이션).
- 추가/수정/삭제, 5개 모달 전부 동작. IP +추가(≤6 비활성), 주의배너, Domain 안내배너, Oracle SID 조건부.
- 체크 해제 → 사유 popover, 미선택 닫힘 시 체크 복원, 직접입력 모달, 칩 클릭 재오픈, 재체크 시 사유 제거.
- 불러오기: 미리보기 pagination·빈상태·확정 시 대체. 승인요청: 3 stat·제출 시 step2 전이.
- **target source A→B 전환 시 A 입력이 B 에 안 보임**(DR2/DR3/DR5).
- `npx tsc --noEmit`·`npm run lint`·`npm run build` 통과.

## Verification

```bash
npx tsc --noEmit
npm run lint -- app/integration/target-sources/\[targetSourceId\]/_components/idc
rg -n "^\s*let idc" app/integration/target-sources/\[targetSourceId\]/_components/idc        # 0 (DR1)
rg -n "key=\{.*targetSourceId" app/integration/target-sources/\[targetSourceId\]/_components/ProjectDetail.tsx  # DR2
rg -n "#[0-9A-Fa-f]{6}" app/integration/target-sources/\[targetSourceId\]/_components/idc     # 색상 hex 0
```

Manual QA (`USE_MOCK_DATA=true`):
- Step1 추가→목록, 수정(프리필, 포트 유지), 삭제→빈상태.
- 제외 popover 전 분기(preset/custom/취소복원/재체크), 불러오기 대체, 승인요청 0건 가드.
- **2개 IDC target source 왕복 → 입력 잔상 0**.

## Return

PR URL · 생성 컴포넌트 목록 · Step1 state owner(모듈 전역 부재 확인) · DR2 key 적용 위치 ·
DR3/DR5 적용 fetch · 토큰 매핑 deviation · tsc/lint/build.
