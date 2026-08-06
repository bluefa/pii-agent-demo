# IDC API Call Map

> 트리거 분류·호출 경로(SSR `/install/v1` 직접 vs CSR `/integration/api/v1` 프록시)·polling
> 규칙은 [README](./README.md) 참고. `{id}`=targetSourceId, `{resourceId}`=리소스 식별자.
>
> IDC 는 공유 레이아웃을 쓰지 않고 독자 구조: `page.tsx` → `ProjectDetail` → `IdcProjectPage`
> → `IdcTargetSourceLayout` → `idc/steps/IdcStep1..7`. IDC 전용 엔드포인트는 `/idc/` prefix 의
> `previous-request`(Step1)·`installation-status`(Step4) 뿐이고, 나머지는 공유 target-source
> 엔드포인트를 재사용한다. 리소스 목록은 `useIdcResources` 가 `getApprovedIntegration`/
> `getConfirmedIntegration` 을 IDC 도메인으로 매핑해 가져온다.

---

## Step 1 — WAITING_TARGET_CONFIRMATION (연동 대상 확정 대기)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/IDC_TARGET_INPUT` | `useGuide` | `IdcStep1TargetInput.tsx:210`; `useGuide.ts:50` |
| 버튼클릭 | `불러오기`·`연동 대상 추가`·`승인 요청`·테이블 편집/삭제 | (없음) | — | 로컬 상태 변경 또는 모달 오픈만 | `IdcStep1TargetInput.tsx:221,227,280` |
| 모달진입 | `기존 연동 요청 정보 불러오기` 모달 | GET | `/integration/api/v1/idc/target-sources/{id}/previous-request` | `useIdcPreviousRequest` → `getIdcPreviousRequest` | `IdcLoadRequestModal.tsx:49`; `useIdcPreviousRequest.ts:37`; `api/idc.ts:408` |
| 모달버튼 | 불러오기 모달 `불러오기` | (없음) | — | 로드된 데이터를 로컬 rows 에 반영 | `IdcLoadRequestModal.tsx:83` |
| 모달버튼 | `IdcSubmitModal` `제출하기` | POST | `/integration/api/v1/target-sources/{id}/approval-requests` | `createApprovalRequest` | `IdcSubmitModal.tsx:73`; `IdcStep1TargetInput.tsx:196`; `api/index.ts:388` |
| 모달버튼 | `제출하기` 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `refreshProject` → `getProject` | `IdcStep1TargetInput.tsx:105`; `api/index.ts:257` |

---

## Step 2 — WAITING_APPROVAL (승인 대기)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/IDC_APPROVAL_PENDING` | `useGuide` | `IdcStep2WaitingApproval.tsx:35`; `useGuide.ts:50` |
| 화면진입 | 승인 대기 리소스 테이블 | GET | `/integration/api/v1/target-sources/{id}/approved-integration` | `useIdcResources` → `getIdcApprovalRequestResources` → `getApprovedIntegration` | `IdcStep2WaitingApproval.tsx:38`; `useIdcResources.ts:55`; `api/idc.ts:449`; `api/index.ts:439` |
| 화면진입 | 프로세스 상태 polling 10s | GET | `/integration/api/v1/target-sources/{id}/process-status` | `ProcessStatusCard` → `getProcessStatus` | `ProcessStatusCard.tsx:47`; `api/index.ts:548` |
| 화면진입 | 상태 변경 감지 시 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `ProcessStatusCard` → `getProject` | `ProcessStatusCard.tsx:49`; `api/index.ts:257` |
| 버튼클릭 | `전체 요청 취소` → 확인 모달 오픈 | (없음) | — | 모달 오픈만 | `IdcStep2WaitingApproval.tsx:76`; `WaitingApprovalCancelButton.tsx:40` |
| 모달진입 | `ConfirmStepModal`(취소 확인) | (없음) | — | — | `WaitingApprovalCancelButton.tsx:46` |
| 모달버튼 | 취소 모달 `요청 취소` | POST | `/integration/api/v1/target-sources/{id}/approval-requests/cancel` | `cancelApprovalRequest` | `WaitingApprovalCancelButton.tsx:28`; `api/index.ts:509` |
| 모달버튼 | 취소 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `onSuccess` → `getProject` | `IdcStep2WaitingApproval.tsx:78`; `api/index.ts:257` |

---

## Step 3 — APPLYING_APPROVED (연동대상 반영 중)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/IDC_APPLYING` | `useGuide` | `IdcStep3Applying.tsx:34`; `useGuide.ts:50` |
| 화면진입 | 반영 중 리소스 테이블 | GET | `/integration/api/v1/target-sources/{id}/approved-integration` | `useIdcResources` → `getIdcApprovedResources` → `getApprovedIntegration` | `IdcStep3Applying.tsx:37`; `useIdcResources.ts:55`; `api/idc.ts:452`; `api/index.ts:439` |
| 화면진입 | 프로세스 상태 polling 10s | GET | `/integration/api/v1/target-sources/{id}/process-status` | `ProcessStatusCard` → `getProcessStatus` | `ProcessStatusCard.tsx:47`; `api/index.ts:548` |
| 화면진입 | 상태 변경 감지 시 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `ProcessStatusCard` → `getProject` | `ProcessStatusCard.tsx:49`; `api/index.ts:257` |
| 버튼클릭 | (없음) | — | — | — | — |
| 모달진입 | (없음) | — | — | — | — |
| 모달버튼 | (없음) | — | — | — | — |

---

## Step 4 — INSTALLING (설치 진행 중)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/IDC_INSTALLING` | `useGuide` | `IdcStep4Installing.tsx:68`; `useGuide.ts:50` |
| 화면진입 | IDC 설치 상태 (1회 fetch) | GET | `/integration/api/v1/idc/target-sources/{id}/installation-status` | `useIdcInstallationStatus` → `getIdcInstallationStatus` | `IdcStep4Installing.tsx:69`; `useIdcInstallationStatus.ts:46`; `api/idc.ts:464` |
| 화면진입 | 설치 단계 리소스 테이블 | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `getIdcConfirmedResources` → `getConfirmedIntegration` | `IdcStep4Installing.tsx:79`; `api/idc.ts:455`; `api/index.ts:404` |
| 버튼클릭 | `방화벽 확인` 태스크 카드 → 모달 오픈 | (없음) | — | 모달 오픈만 | `IdcStep4Installing.tsx:123` |
| 모달진입 | `방화벽 확인` 모달(`IdcFirewallModal`) | (없음) | — | 이미 보유한 props 렌더 (자체 fetch 없음) | `IdcFirewallModal.tsx:35` |
| 모달버튼 | 방화벽 모달 `확인` | (없음) | — | 모달 닫기만 | `IdcFirewallModal.tsx:55` |

---

## Step 5 — WAITING_CONNECTION_TEST (연결 테스트 필요)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/IDC_CONNECTION_TEST` | `useGuide` | `IdcStep5ConnectionTest.tsx:72`; `useGuide.ts:50` |
| 화면진입 | 연결 테스트 리소스 테이블 | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `getIdcConfirmedResources` → `getConfirmedIntegration` | `IdcStep5ConnectionTest.tsx:94`; `api/idc.ts:455`; `api/index.ts:404` |
| 화면진입 | DB Credential 옵션 | GET | `/integration/api/v1/target-sources/{id}/secrets` | `getSecrets` | `IdcStep5ConnectionTest.tsx:117`; `api/index.ts:556` |
| 화면진입 | 최신 연결 테스트 + polling 4s (PENDING/RUNNING 동안) | GET | `/integration/api/v1/target-sources/{id}/test-connection/latest_version` | `useTestConnectionPolling` → `getTestConnectionLatest` | `IdcStep5ConnectionTest.tsx:86`; `useTestConnectionPolling.ts:52`; `api/index.ts:586` |
| 화면진입 | 결과 SUCCESS 시 완료 게이트 확인 | GET | `/integration/api/v1/target-sources/{id}/test-connection/completion-status` | `getTestConnectionCompletionStatus` (조건부) | `IdcStep5ConnectionTest.tsx:187`; `api/index.ts:604` |
| 버튼클릭 | `Run Test` | POST | `/integration/api/v1/target-sources/{id}/test-connection/async` | `trigger` → `triggerTestConnection` | `IdcStep5ConnectionTest.tsx:204`; `useTestConnectionPolling.ts:88`; `api/index.ts:572` |
| 버튼클릭 | `Run Test` 직후 refresh + polling 시작 | GET | `/integration/api/v1/target-sources/{id}/test-connection/latest_version` | `baseRefresh()` → `getTestConnectionLatest` | `useTestConnectionPolling.ts:101`; `api/index.ts:586` |
| 버튼클릭 | DB Credential 드롭다운 변경 (행별) | PUT | `/integration/api/v1/target-sources/{id}/resources/credential` | `handleCredChange` → `updateResourceCredential` | `cells.tsx:194`; `IdcStep5ConnectionTest.tsx:212`; `api/index.ts:622` |
| 버튼클릭 | `설정`(논리 DB)·`완료 승인 요청` → 모달 오픈 | (없음) | — | 모달 오픈만 | `cells.tsx:238`; `IdcStep5ConnectionTest.tsx:347` |
| 모달진입 | 논리 DB 모달 — 테스트된 논리 DB | GET | `/integration/api/v1/target-sources/{id}/tested-logical-databases/by-resource-id?resourceId={resourceId}` | `useLogicalDatabases` → `getTestedLogicalDatabases` | `LogicalDbModalLoader.tsx:42`; `useLogicalDatabases.ts:47`; `api/logical-db.ts:66` |
| 모달진입 | 논리 DB 모달 — 제외 정책 | GET | `/integration/api/v1/target-sources/{id}/excluded-databases/by-resource-id?resourceId={resourceId}` | `useLogicalDatabases` → `getExcludedLogicalDatabases` | `LogicalDbModalLoader.tsx:42`; `useLogicalDatabases.ts:48`; `api/logical-db.ts:79` |
| 모달진입 | `완료 승인 요청` 모달(`IdcReqApprovalModal`) | (없음) | — | 이미 보유한 `viewResources` 렌더 (cloud 와 달리 latest-results fetch 없음) | `IdcStep5ConnectionTest.tsx:354`; `IdcReqApprovalModal.tsx:28` |
| 모달버튼 | 논리 DB 모달 `저장` | PUT | `/integration/api/v1/target-sources/{id}/excluded-databases/by-resource-id?resourceId={resourceId}` | `updateExcludedLogicalDatabases` | `LogicalDbModalLoader.tsx:54`; `api/logical-db.ts:92` |
| 모달버튼 | 논리 DB `저장` 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `handleLogicalSaved` → `getProject` | `IdcStep5ConnectionTest.tsx:250`; `api/index.ts:257` |
| 모달버튼 | 완료 승인 요청 모달 `요청하기` | PUT | `/integration/api/v1/target-sources/{id}/test-connection-acknowledgment` | `handleSubmitApproval` → `updateTestConnectionConfirmation(true)` | `IdcReqApprovalModal.tsx:152`; `IdcStep5ConnectionTest.tsx:263`; `api/index.ts:612` |
| 모달버튼 | `요청하기` 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `handleSubmitApproval` → `getProject` | `IdcStep5ConnectionTest.tsx:264`; `api/index.ts:257` |

---

## Step 6 — CONNECTION_VERIFIED (연결 확인 완료 / 관리자 확정 대기)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/IDC_CONNECTION_VERIFIED` | `useGuide` | `IdcStep6ConnectionVerified.tsx:83`; `useGuide.ts:50` |
| 화면진입 | 연결 확인 리소스 테이블 | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `useIdcResources` → `getIdcConfirmedResources` → `getConfirmedIntegration` | `IdcStep6ConnectionVerified.tsx:86`; `useIdcResources.ts:55`; `api/idc.ts:455`; `api/index.ts:404` |
| 버튼클릭 | `연결 테스트 재실행` → 확인 모달 오픈 | (없음) | — | 모달 오픈만 | `IdcStep6ConnectionVerified.tsx:56` |
| 모달진입 | `ConfirmRewindModal` | (없음) | — | — | `ConfirmRewindModal.tsx:51` |
| 모달버튼 | 확인 모달 `되돌아가기` | PUT | `/integration/api/v1/target-sources/{id}/test-connection-acknowledgment` | `updateTestConnectionConfirmation(false)` | `IdcStep6ConnectionVerified.tsx:44`; `api/index.ts:612` |
| 모달버튼 | `되돌아가기` 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `handleConfirm` → `getProject` | `IdcStep6ConnectionVerified.tsx:45`; `api/index.ts:257` |

---

## Step 7 — INSTALLATION_COMPLETE (설치 완료)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/IDC_COMPLETE` | `useGuide` | `IdcStep7Complete.tsx:74`; `useGuide.ts:50` |
| 화면진입 | 완료 리소스 테이블 | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `useIdcResources` → `getIdcConfirmedResources` → `getConfirmedIntegration` | `IdcStep7Complete.tsx:77`; `useIdcResources.ts:55`; `api/idc.ts:455`; `api/index.ts:404` |
| 버튼클릭 | `인프라 변경` / `연결 테스트 재실행` → 확인 모달 오픈 | (없음) | — | 모달 오픈만 | `IdcStep7Complete.tsx:43,47` |
| 모달진입 | `ConfirmRewindModal` | (없음) | — | — | `ConfirmRewindModal.tsx:51` |
| 모달버튼 | 확인 모달 `되돌아가기` | (없음) | — | **BFF 미연동** — 안내 toast 만 표시 | `IdcStep7Complete.tsx:32-34` |
