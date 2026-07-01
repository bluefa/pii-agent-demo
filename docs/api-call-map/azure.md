# Azure API Call Map

> 트리거 분류·호출 경로(SSR `/install/v1` 직접 vs CSR `/integration/api/v1` 프록시)·polling
> 규칙은 [README](./README.md) 참고. `{id}`=targetSourceId, `{resourceId}`=리소스 식별자.
>
> 컴포넌트 경로: `page.tsx` → `ProjectDetail` → `AzureProjectPage` → `CloudTargetSourceLayout`
> → (processStatus 분기) `*Step.tsx`. 설치 단계는 `InstallationStatusSlot` → `AzureInstallationStatus`
> → `AzureInstallationInline`. AWS/GCP 와 공유 레이아웃이며 설치·모달만 Azure 고유.

---

## Step 1 — WAITING_TARGET_CONFIRMATION (연동 대상 확정 대기)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/AZURE_TARGET_CONFIRM` | `useGuide` | `WaitingTargetConfirmationStep.tsx:52`; `useGuide.ts:50` |
| 화면진입 | 리소스 목록 | GET | `/integration/api/v1/target-sources/{id}/resources` | `getConfirmResources` | `CandidateResourceSection.tsx:68`; `api/index.ts:373` |
| 화면진입 | 스캔 상태 초기 조회 + polling 2s (SCANNING 동안) | GET | `/integration/api/v1/target-sources/{id}/scanJob/latest` | `useScanPolling` → `getLatestScanJob` | `ScanPanel.tsx:57`; `useScanPolling.ts:56`; `api/scan.ts:17` |
| 버튼클릭 | `Run Infra Scan` / 스캔 재시도 | POST | `/integration/api/v1/target-sources/{id}/scan` | `startScan` | `ScanPanel.tsx:61`; `api/scan.ts:8` |
| 버튼클릭 | 스캔 시작 직후 refresh (polling 시작) | GET | `/integration/api/v1/target-sources/{id}/scanJob/latest` | `refresh()` → `getLatestScanJob` | `ScanPanel.tsx:65`; `api/scan.ts:17` |
| 버튼클릭 | 리소스 목록 오류 `다시 시도` | GET | `/integration/api/v1/target-sources/{id}/resources` | `refetch` → `getConfirmResources` | `CandidateResourceSection.tsx:85`; `api/index.ts:373` |
| 모달진입 | 승인 요청 확인 모달(`IdcSubmitModal`) | (없음) | — | `approvalModal.open()` 만 | `CandidateResourceSection.tsx:139`; `IdcSubmitModal.tsx:52` |
| 모달진입 | VNet 연동 가이드 모달(`VnetIntegrationGuideModal`) | (없음) | — | 정적 콘텐츠 | `CandidateResourceTable.tsx:272` |
| 모달버튼 | 승인 요청 모달 `제출하기` | POST | `/integration/api/v1/target-sources/{id}/approval-requests` | `createApprovalRequest` | `CandidateResourceSection.tsx:93`; `api/index.ts:388` |
| 모달버튼 | `제출하기` 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `refreshProject` → `getProject` | `CandidateResourceSection.tsx:94`; `WaitingTargetConfirmationStep.tsx:39`; `api/index.ts:257` |

> 스캔 완료 side-effect: `onScanComplete` 가 리소스 목록 `refetch` + `refreshProject` 를 자동 발화
> (`CandidateResourceSection.tsx:142-147`). 위 `resources`/`target-sources/{id}` 호출과 동일.

---

## Step 2 — WAITING_APPROVAL (승인 대기)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/AZURE_APPROVAL_PENDING` | `useGuide` | `WaitingApprovalStep.tsx:53`; `useGuide.ts:50` |
| 화면진입 | 승인된 연동 대상 | GET | `/integration/api/v1/target-sources/{id}/approved-integration` | `getApprovedIntegration` | `WaitingApprovalCard.tsx:86`; `api/index.ts:439` |
| 화면진입 | 최신 승인 요청 요약 | GET | `/integration/api/v1/target-sources/{id}/approval-requests/latest` | `getApprovalRequestLatest` | `WaitingApprovalCard.tsx:106`; `api/index.ts:500` |
| 화면진입 | 프로세스 상태 polling 10s | GET | `/integration/api/v1/target-sources/{id}/process-status` | `ProcessStatusCard` → `getProcessStatus` | `ProcessStatusCard.tsx:47`; `api/index.ts:548` |
| 화면진입 | 상태 변경 감지 시 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `ProcessStatusCard` → `getProject` | `ProcessStatusCard.tsx:49`; `api/index.ts:257` |
| 버튼클릭 | 승인 정보 오류 `다시 시도` | GET | `/.../approved-integration` + `/.../approval-requests/latest` | `handleRetry` | `WaitingApprovalCard.tsx:118` |
| 버튼클릭 | `전체 요청 취소` → 확인 모달 오픈 | (없음) | — | `modal.open()` 만 | `WaitingApprovalCancelButton.tsx:40` |
| 모달진입 | `ConfirmStepModal`(취소 확인) | (없음) | — | — | `WaitingApprovalCancelButton.tsx:46` |
| 모달버튼 | 취소 모달 `요청 취소` | POST | `/integration/api/v1/target-sources/{id}/approval-requests/cancel` | `cancelApprovalRequest` | `WaitingApprovalCancelButton.tsx:28`; `api/index.ts:509` |
| 모달버튼 | 취소 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `onSuccess` → `refreshProject` → `getProject` | `WaitingApprovalCancelButton.tsx:32`; `WaitingApprovalStep.tsx:39`; `api/index.ts:257` |

---

## Step 3 — APPLYING_APPROVED (연동대상 반영 중)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/AZURE_APPLYING` | `useGuide` | `ApplyingApprovedStep.tsx:45`; `useGuide.ts:50` |
| 화면진입 | 반영 중 승인 리소스 | GET | `/integration/api/v1/target-sources/{id}/approved-integration` | `getApprovedIntegration` | `ApplyingApprovedCard.tsx:75`; `api/index.ts:439` |
| 화면진입 | 프로세스 상태 polling 10s | GET | `/integration/api/v1/target-sources/{id}/process-status` | `ProcessStatusCard` → `getProcessStatus` | `ProcessStatusCard.tsx:47`; `api/index.ts:548` |
| 화면진입 | 상태 변경 감지 시 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `ProcessStatusCard` → `getProject` | `ProcessStatusCard.tsx:49`; `api/index.ts:257` |
| 버튼클릭 | 반영 정보 오류 `다시 시도` | GET | `/integration/api/v1/target-sources/{id}/approved-integration` | `handleRetry` → `getApprovedIntegration` | `ApplyingApprovedCard.tsx:105`; `api/index.ts:439` |
| 모달진입 | (없음) | — | — | — | — |
| 모달버튼 | (없음) | — | — | — | — |

---

## Step 4 — INSTALLING (설치 진행 중)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/AZURE_INSTALLING` | `useGuide` | `CloudInstallingStep.tsx:52`; `useGuide.ts:50` |
| 화면진입 | 확정된 연동 대상 | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` | `ConfirmedIntegrationDataProvider.tsx:41`; `api/index.ts:404` |
| 화면진입 | Azure 설치 상태 (1회 fetch, 완료 시 `onInstallComplete`) | GET | `/integration/api/v1/azure/target-sources/{id}/installation-status` | `useInstallationStatus` → `getAzureInstallationStatus` | `AzureInstallationInline.tsx:81`; `useInstallationStatus.ts:66`; `api/azure.ts:15` |
| 화면진입 | 모든 리소스 설치 완료 시 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `onInstallComplete` → `refreshProject` → `getProject` | `AzureInstallationInline.tsx:131`; `CloudInstallingStep.tsx:38`; `api/index.ts:257` |
| 버튼클릭 | 설치 상태 오류 `다시 시도` | GET | `/integration/api/v1/azure/target-sources/{id}/installation-status` | `InstallationErrorView` → `fetchStatus` | `AzureInstallationInline.tsx:136`; `useInstallationStatus.ts:60`; `api/azure.ts:15` |
| 버튼클릭 | 완료된 파이프라인 카드 클릭 → 상세 모달 오픈 | (없음) | — | `detailModal.open()` 만 | `AzureInstallationInline.tsx:144` |
| 모달진입 | 설치 작업 상세 모달(`InstallTaskDetailModal`) | (없음) | — | 이미 로드된 데이터 렌더링 | `AzureInstallationInline.tsx:176` |
| 모달버튼 | 상세 모달 `확인` | (없음) | — | close 만 | — |

---

## Step 5 — WAITING_CONNECTION_TEST (연결 테스트 필요)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/AZURE_CONNECTION_TEST` | `useGuide` | `WaitingConnectionTestStep.tsx:83`; `useGuide.ts:50` |
| 화면진입 | 확정된 연동 대상 | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` | `ConfirmedIntegrationDataProvider.tsx:41`; `api/index.ts:404` |
| 화면진입 | 최신 연결 테스트 + polling 4s (PENDING/RUNNING 동안) | GET | `/integration/api/v1/target-sources/{id}/test-connection/latest_version` | `useTestConnectionPolling` → `getTestConnectionLatest` | `ConnectionTestCard.tsx:63`; `useTestConnectionPolling.ts:52`; `api/index.ts:586` |
| 화면진입 | DB Credential 옵션 | GET | `/integration/api/v1/target-sources/{id}/secrets` | `getSecrets` | `ConnectionTestCard.tsx:74`; `api/index.ts:556` |
| 버튼클릭 | 확정 리소스 로드 오류 `다시 시도` | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `ErrorRow onRetry` → `retry` → `getConfirmedIntegration` | `WaitingConnectionTestStep.tsx:39`; `ConfirmedIntegrationDataProvider.tsx:59`; `api/index.ts:404` |
| 버튼클릭 | `Run Test` | POST | `/integration/api/v1/target-sources/{id}/test-connection/async` | `trigger` → `triggerTestConnection` | `ConnectionTestCard.tsx:126`; `useTestConnectionPolling.ts:88`; `api/index.ts:572` |
| 버튼클릭 | `Run Test` 직후 refresh + polling 시작 | GET | `/integration/api/v1/target-sources/{id}/test-connection/latest_version` | `baseRefresh()` → `getTestConnectionLatest` | `useTestConnectionPolling.ts:101`; `api/index.ts:586` |
| 버튼클릭 | DB Credential 드롭다운 변경 (행별) | PUT | `/integration/api/v1/target-sources/{id}/resources/credential` | `handleCredChange` → `updateResourceCredential` | `ConnectionTestCard.tsx:132`; `api/index.ts:622` |
| 버튼클릭 | `설정`(논리 DB 확인) → 모달 오픈 | (없음) | — | `LogicalDbModalLoader` 오픈 | `ConnectionTestCard.tsx:294` |
| 버튼클릭 | `완료 승인 요청` → 모달 오픈 | (없음) | — | `CloudReqApprovalModal` 오픈 | `ConnectionTestCard.tsx:330` |
| 모달진입 | 논리 DB 모달 — 테스트된 논리 DB | GET | `/integration/api/v1/target-sources/{id}/tested-logical-databases/by-resource-id?resourceId={resourceId}` | `useLogicalDatabases` → `getTestedLogicalDatabases` | `LogicalDbModalLoader.tsx:42`; `useLogicalDatabases.ts:47`; `api/logical-db.ts:66` |
| 모달진입 | 논리 DB 모달 — 제외 정책 | GET | `/integration/api/v1/target-sources/{id}/excluded-databases/by-resource-id?resourceId={resourceId}` | `useLogicalDatabases` → `getExcludedLogicalDatabases` | `LogicalDbModalLoader.tsx:42`; `useLogicalDatabases.ts:48`; `api/logical-db.ts:79` |
| 모달진입 | `완료 승인 요청` 모달(isOpen useEffect) | GET | `/integration/api/v1/target-sources/{id}/test-connection/latest-results` | `getLatestTestConnectionResultSummaries` | `CloudReqApprovalModal.tsx:51`; `api/index.ts:594` |
| 모달버튼 | 논리 DB 모달 `다시 시도` | GET | tested/excluded 논리 DB (위와 동일) | `LogicalDbModalLoader` retry | `LogicalDbModalLoader.tsx:97` |
| 모달버튼 | 논리 DB 모달 `저장` | PUT | `/integration/api/v1/target-sources/{id}/excluded-databases/by-resource-id?resourceId={resourceId}` | `updateExcludedLogicalDatabases` | `LogicalDbModalLoader.tsx:54`; `api/logical-db.ts:92` |
| 모달버튼 | 논리 DB `저장` 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `handleSaved` → `refreshProject` → `getProject` | `ConnectionTestCard.tsx:148`; `WaitingConnectionTestStep.tsx:70`; `api/index.ts:257` |
| 모달버튼 | 완료 승인 요청 모달 `요청하기` | PUT | `/integration/api/v1/target-sources/{id}/test-connection-acknowledgment` | `updateTestConnectionConfirmation(true)` | `CloudReqApprovalModal.tsx:66`; `api/index.ts:612` |
| 모달버튼 | `요청하기` 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `handleSubmitApproval` → `refreshProject` → `getProject` | `ConnectionTestCard.tsx:157`; `WaitingConnectionTestStep.tsx:70`; `api/index.ts:257` |

---

## Step 6 — CONNECTION_VERIFIED (연결 확인 완료 / 관리자 확정 대기)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/AZURE_ADMIN_APPROVAL` | `useGuide` | `ConnectionVerifiedStep.tsx:108`; `useGuide.ts:50` |
| 화면진입 | 확정된 연동 대상 | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` | `ConfirmedIntegrationDataProvider.tsx:41`; `api/index.ts:404` |
| 버튼클릭 | `연결 테스트 재실행` → 확인 모달 오픈 | (없음) | — | `setConfirmKind('retest')` 만 | `ConnectionVerifiedStep.tsx:67` |
| 모달진입 | `ConfirmRewindModal` | (없음) | — | — | `ConfirmRewindModal.tsx:51` |
| 모달버튼 | 재실행 확인 `되돌아가기` | PUT | `/integration/api/v1/target-sources/{id}/test-connection-acknowledgment` | `updateTestConnectionConfirmation(false)` | `ConnectionVerifiedStep.tsx:52`; `api/index.ts:612` |
| 모달버튼 | `되돌아가기` 성공 후 프로젝트 갱신 | GET | `/integration/api/v1/target-sources/{id}` | `onRolledBack` → `refreshProject` → `getProject` | `ConnectionVerifiedStep.tsx:54`; `api/index.ts:257` |

---

## Step 7 — INSTALLATION_COMPLETE (설치 완료)

| 트리거 | UI 요소 | Method | Endpoint | 경유 | 근거 (file:line) |
|---|---|---|---|---|---|
| 화면진입 | 페이지 SSR 로드 | GET | `/install/v1/target-sources/{id}` (SSR·상위 BFF 직접) | `bff.targetSources.get` | `page.tsx:17`; `lib/bff/http.ts:88` |
| 화면진입 | 가이드 카드 | GET | `/integration/api/v1/admin/guides/AZURE_COMPLETED` | `useGuide` | `InstallationCompleteStep.tsx:107`; `useGuide.ts:50` |
| 화면진입 | 확정된 연동 대상 | GET | `/integration/api/v1/target-sources/{id}/confirmed-integration` | `getConfirmedIntegration` | `ConfirmedIntegrationDataProvider.tsx:41`; `api/index.ts:404` |
| 화면진입 | 완료 테이블 논리 DB 요약 | GET | `/integration/api/v1/target-sources/{id}/test-connection/latest-results` | `ConfirmedIntegrationTable` → `getLatestTestConnectionResultSummaries` | `ConfirmedIntegrationTable.tsx:58`; `api/index.ts:594` |
| 버튼클릭 | `인프라 변경` / `연결 테스트 재실행` → 확인 모달 오픈 | (없음) | — | `setConfirmKind(...)` 만 | `InstallationCompleteStep.tsx:63`, `:68` |
| 모달진입 | `ConfirmRewindModal` | (없음) | — | — | `ConfirmRewindModal.tsx:51` |
| 모달버튼 | 확인 모달 `되돌아가기` | (없음) | — | **BFF 미연동** — `toast.info(…BFF 연동 후 활성화)` 만 | `InstallationCompleteStep.tsx:49-51` |
