# v15 Audit — Empty Data (99)

## lib/mock-data.ts  (22)
- 스캔 상태 column variety: v15=`mix of 신규(blue) and 변경(orange) — row 3 is 변경` impl=`all rows 신규 (blue) — every 1005 resource has connectionStatus PENDING so deriveCandidateScanStatus always returns NEW_SCAN; no 변경 row ever appears`  _azure / step 1 (연동 대상 선택·입력) / targetSourc_
- Resource ID (rows 1-2): v15=`full ARM resource IDs /subscriptions/.../servers/mysql-prod-01` impl=`short ids vm-scan-001 / mysql-scan-001 (rows 1-2 use short resourceId; only vnet rows have full ARM path) — not blank but lower-fidelity than v15`  _azure / step 1 (연동 대상 선택·입력) / targetSourc_
- 전체 요청 stat: v15=`47건` impl=`0건`  _azure / step 2 (승인 대기) / targetSourceId 20_
- step-3 resource table rows (entire body): v15=`Paginated table, 1–10 / 전체 47건: e.g. MySQL /subscriptions/.../servers/mysql-prod-01, region ap-northeast-1, name sea-live-space-prod, 대상, scan-pill —; MySQL mysql-stg-02 Integrated; PostgreSQL pg-analytics-03 비대상 + reason-chip 'Stg 환경 DB · PII 데이터 미보유'; MariaDB mariadb-legacy-archive-2019 비대상 + reason-chip 'Legacy archive · 2024년 EOL 예정...'` impl=`'연동 대상 리소스 (0개)' header and empty-state '반영 중인 리소스가 없습니다.' — zero rows`  _azure / step 3 (반영 중, APPLYING_APPROVED) /_
- Region column (install-task-pipeline table): v15=`ap-northeast-1 for every row` impl=`— (em dash, empty) for every row`  _azure / step 4 (Agent 설치) / targetSourceId_
- Resource ID column: v15=`full ARM path /subscriptions/2867a4f9-.../servers/mysql-prod-01 (truncated with RTL ellipsis + copy button)` impl=`short ids synapse-dw-001 / vm-agent-001 (no truncation needed, copy button present)`  _azure / step 4 (Agent 설치) / targetSourceId_
- DB Type / row set: v15=`2 rows, both MySQL (blue tag), statuses 완료 / 진행중` impl=`3 rows: MSSQL / MSSQL / POSTGRESQL, all 진행중 — different db types and count vs v15`  _azure / step 4 (Agent 설치) / targetSourceId_
- Region column (모든 행): v15=`ap-northeast-1 (real region per row)` impl=`'-' for every row (region null)`  _azure / step 5 (연결 테스트) / targetSourceId 2_
- DB Credential column (모든 행): v15=`Key1 / Key2 (clickable credential links)` impl=`'-' for every row (credentialId null)`  _azure / step 5 (연결 테스트) / targetSourceId 2_
- Resource ID column: v15=`full Azure ARM path (/subscriptions/…/servers/mysql-prod-01) with copy button + ellipsis` impl=`short id 'mssql-prod-001' / 'pg-analytics-001' / 'mysql-app-001' (no ARM path)`  _azure / step 5 (연결 테스트) / targetSourceId 2_
- Confirmed integration table rows (entire table body): v15=`2 populated rows: MySQL | /subscriptions/2867a4f9-.../servers/mysql-prod-01 | ap-northeast-1 | sea-live-space-prod | Key1 | Success ; plus mysql-stg-02 / sea-live-space-stg / Key2 / Success` impl=`Empty state '확정된 연동 대상 DB 가 없습니다.' (confirmed.length === 0)`  _azure / step 6 (완료 여부 관리자 승인 대기 — CONNECTI_
- Region column: v15=`ap-northeast-1 (per row)` impl=`'-' even if rows existed — azure-res resources carry no region field; table reads resource.region ?? '-'`  _azure / step 6 (완료 여부 관리자 승인 대기 — CONNECTI_
- Resource Name column: v15=`sea-live-space-prod / sea-live-space-stg` impl=`'-' — resources have no resourceName; table reads resource.resourceName ?? '-'`  _azure / step 6 (완료 여부 관리자 승인 대기 — CONNECTI_
- DB Credential column: v15=`Key1 / Key2` impl=`'-' — resources have no credentialId; table reads resource.credentialId ?? '-'`  _azure / step 6 (완료 여부 관리자 승인 대기 — CONNECTI_
- resource columns Region / Resource Name / 연동이력 scan-pill: v15=`Region 'ap-northeast-1', Resource Name 'sea-live-space-prod', 연동 이력 'Integrated' / '—'` impl=`empty table so none rendered; additionally the impl table schema has no Region or Resource Name columns even when populated`  _gcp · step 3 (반영 중 / APPLYING_APPROVED) · _
- Confirmed integration table (all 6 columns: Database Type, Resource ID, Region, Resource Name, DB Credential, Connection Status): v15=`2 populated rows — MySQL | <full resource id w/ copy> | ap-northeast-1 | sea-live-space-prod | Key1 | Success(green); MySQL | ...mysql-stg-02 | ap-northeast-1 | sea-live-space-stg | Key2 | Success` impl=`Empty — renders '확정된 연동 대상 DB 가 없습니다.' (px-6 py-12 centered). GET /integration/api/v1/target-sources/2011/confirmed-integration returns 404 CONFIRMED_INTEGRATION_NOT_FOUND; DataProvider maps missing→[] (ConfirmedIntegrationDataProvider.tsx:48-50). Root cause: project 2011 has empty resources[] / no approvedIntegration / no snapshot, so lib/bff/mock/confirm.ts getConfirmedIntegration hits createEmptyConfirmedIntegration() (path 4, eligible=0); confirmed-integration route then 404s because resource_infos.length===0. No project with targetSourceId 2011 exists in lib/mock-data.ts (only GCP 1002 = WAITING_TARGET_CONFIRMATION).`  _gcp / step 6 (완료 여부 관리자 승인 대기, CONNECTION__
- DB Credential column values (Key1 / Key2): v15=`Key1, Key2` impl=`would be '-' even if rows existed — ConfirmedIntegrationTable renders resource.credentialId ?? '-' and mock resources carry no credentialId`  _gcp / step 6 (완료 여부 관리자 승인 대기, CONNECTION__
- DB Credential column: v15=`Key1 per row (v15 lines 7118, 7136, 7154)` impl=`would render '-' — gcpDemoResources have no selectedCredentialId, so credentialId is null → '-' (ConfirmedIntegrationTable.tsx:85)`  _provider=gcp · step=7 (연동 완료 / INSTALLATIO_
- 전체 요청 stat: v15=`47건` impl=`0 건`  _aws / step 2 (연동 대상 승인 대기) / targetSourceI_
- row count (연동 대상 정보 table): v15=`2 rows (1–2 / 전체 2건), both with status pills 완료 / 진행중` impl=`1 row only (MYSQL rds-003). The 2nd selected resource is filtered out (res-13 rs-003 isSelected:false), so the install screen shows a single row vs v15's 2-row populated table.`  _aws / step 4 (Agent 설치) / targetSourceId=1_
- Region column: v15=`ap-northeast-1 (mono, both rows)` impl=`— (dash, both rows)`  _aws / step 6 (완료 여부 관리자 승인 대기) / targetSou_
- DB Credential column: v15=`Key1 / Key2` impl=`— (dash, both rows)`  _aws / step 6 (완료 여부 관리자 승인 대기) / targetSou_

## lib/bff/mock/confirm.ts  (20)
- Region column (every row): v15=`ap-northeast-1 (mono, every row)` impl=`completely EMPTY cell — buildMetadata() hardcodes Azure region to '' (empty string), and region '' ?? '—' keeps '' so not even a dash renders`  _azure / step 1 (연동 대상 선택·입력) / targetSourc_
- approval resource table (all rows): v15=`47 rows: e.g. MySQL /subscriptions/2867a4f9.../mysql-prod-01 ap-northeast-1 sea-live-space-prod 대상; PostgreSQL pg-analytics-03 비대상 + reason chip; MariaDB legacy-archive-2019 비대상; etc.` impl=`empty — '표시할 리소스가 없습니다.'`  _azure / step 2 (승인 대기) / targetSourceId 20_
- 연동 대상 리소스 count badge: v15=`filter segments 전체 47 · 대상 38 · 비대상 9 (and pagination '전체 47건')` impl=`'연동 대상 리소스 (0개)'`  _azure / step 3 (반영 중, APPLYING_APPROVED) /_
- step-banner progress count '전체 47건 중 32건 완료': v15=`전체 47건 중 32건 완료 · 평균 5분 내외 소요` impl=`평균 5분 내외 소요 (no total, no completed count)`  _azure / step 3 (반영 중, APPLYING_APPROVED) /_
- Resource Name column (install-task-pipeline table): v15=`friendly DB names: sea-live-space-prod / sea-live-space-stg` impl=`resourceId echoed: synapse-dw-001 / vm-agent-001 / vm-agent-002 (no distinct name)`  _azure / step 4 (Agent 설치) / targetSourceId_
- DB Credential: v15=`Key1 for every row` impl=`table empty so nothing shown; impl would render resource.credentialId ?? '-'`  _provider=azure, step=7 (연동 완료 / INSTALLATI_
- approval table rows (entire table body): v15=`47 rows of DBs (Database Type tag, full Resource ID with copy-btn, Region, Resource Name, 대상/비대상 target-pill, 제외 사유 chip); page 1 = 10 rows incl. 2 excluded rows with reason chips` impl=`'표시할 리소스가 없습니다.' — empty table, 0 rows`  _gcp / step 2 (승인 대기) / targetSourceId=2007_
- 요청일시 / 승인자 in card subtitle: v15=`요청일시 2026-05-08 14:23 · 승인자 김보안 (kim.security)` impl=`subtitle truncated to '요청하신 DB 목록을 관리자가 확인하고 있어요.' (requestSummary null)`  _gcp / step 2 (승인 대기) / targetSourceId=2007_
- Cloud 리소스 table rows (the entire step-3 resource table): v15=`step-3 .approval-table shows 4+ real rows on page 1 (mysql-prod-01 / mysql-stg-02 / pg-analytics-03 / mariadb-legacy-archive-2019), total '1–10 / 47건', with Resource IDs, Region ap-northeast-1, Resource Names, 대상/비대상 pills, reason chips, Integrated/— scan pills` impl=`empty: header bar reads '연동 대상 리소스 (0개)' and body shows '반영 중인 리소스가 없습니다.'`  _gcp · step 3 (반영 중 / APPLYING_APPROVED) · _
- 승인일시 / 승인자 card-header meta line: v15=`card-header sub-line '승인일시 2026-05-09 09:12 · 승인자 김보안 (kim.security)'` impl=`absent — ApprovedIntegrationSection only renders the approvedAt line when view.approvedAt is truthy, and the 404 leaves it null; 승인자 is never rendered at all`  _gcp · step 3 (반영 중 / APPLYING_APPROVED) · _
- 연동 대상 논리 DB / 연동 제외 논리 DB columns: v15=`real counts per row: 12/3, 8/1, 5/2 (v15 lines 7119-7120, 7137-7138, 7155-7156)` impl=`hardcoded '—' placeholder (LOGICAL_DB_PLACEHOLDER) for every row (ConfirmedIntegrationTable.tsx:17, 86-87)`  _provider=gcp · step=7 (연동 완료 / INSTALLATIO_
- Resource Name column: v15=`human-readable names distinct from Resource ID (e.g. sea-live-space-prod, sea-analytics-prod)` impl=`identical to Resource ID on every row (rds-001, ath-001, ddb-001, rs-001, rds-legacy-dev, aurora-prod-01 ...)`  _aws / step 1 (연동 대상 선택·입력) / targetSourceI_
- 스캔 상태 variety (신규 vs 변경): v15=`mix of 신규 (blue) and 변경 (orange) — v15 data-stepc=1 shows 신규/신규/변경` impl=`every row shows 신규 only (no 변경/orange ever appears)`  _aws / step 1 (연동 대상 선택·입력) / targetSourceI_
- 연동 대상 stat: v15=`38건 · 80.9%` impl=`0 건 · 0.0%`  _aws / step 2 (연동 대상 승인 대기) / targetSourceI_
- 비대상 stat: v15=`9건 · 19.1%` impl=`0 건 · 0.0%`  _aws / step 2 (연동 대상 승인 대기) / targetSourceI_
- approved resource table (entire body): v15=`approval-table with 4+ visible rows of real resources (MySQL prod-01, MySQL stg-02, PostgreSQL analytics-03, MariaDB legacy-archive) with Resource IDs, Region ap-northeast-1, Resource Names, target/비대상 pills, scan-pills; pager says 전체 47건` impl=`'연동 대상 리소스 (0개)' and ' 반영 중인 리소스가 없습니다.' — zero rows`  _aws / step 3 (반영 중 · APPLYING_APPROVED) / _
- Region (연동 대상 정보 table): v15=`ap-northeast-1 (mono, populated for every row)` impl=`— (em dash). Mock resource res-6 (rds-003) has region:'us-west-2', so the served confirmed-integration row dropped database_region (rendered null).`  _aws / step 4 (Agent 설치) / targetSourceId=1_
- Resource Name (연동 대상 정보 table): v15=`sea-live-space-prod / sea-live-space-stg (real DB names)` impl=`— (em dash). resource_name maps to r.resourceId ('rds-003') so should at least show 'rds-003', not '—'. The served row has resource_name=null.`  _aws / step 4 (Agent 설치) / targetSourceId=1_
- Resource Name column: v15=`sea-live-space-prod / sea-live-space-stg` impl=`— (dash, both rows)`  _aws / step 6 (완료 여부 관리자 승인 대기) / targetSou_
- Resource Name column (entire column): v15=`live · default / live · analytics / prd · main` impl=`column does not exist in the impl table`  _aws / step 7 (연동 완료) / targetSourceId=1012_

## ConfirmedIntegrationTable.tsx  (17)
- Connection Status variety: v15=`mixed Success + Pending` impl=`all 'Success' (hardcoded), never Pending/Fail`  _azure / step 5 (연결 테스트) / targetSourceId 2_
- 연동 대상 논리 DB (target logical DB count): v15=`real numbers 12 / 8 / 5` impl=`hardcoded '—' (LOGICAL_DB_PLACEHOLDER) for every row`  _provider=azure, step=7 (연동 완료 / INSTALLATI_
- 연동 제외 논리 DB (excluded logical DB count): v15=`real numbers 3 / 1 / 2` impl=`hardcoded '—' (LOGICAL_DB_PLACEHOLDER) for every row`  _provider=azure, step=7 (연동 완료 / INSTALLATI_
- Region column: v15=`asia-northeast3 (mono) for every row` impl=`column absent entirely in impl complete-variant table`  _provider=azure, step=7 (연동 완료 / INSTALLATI_
- Resource Name column: v15=`live · default / live · analytics / prd · main (mono)` impl=`column absent entirely`  _provider=azure, step=7 (연동 완료 / INSTALLATI_
- DB Credential column: v15=`Key1 / Key2 (clickable credential links, font-size 12.5px)` impl=`— for every row`  _gcp / step5 (연결 테스트) / targetSourceId=2010_
- Connection Status column: v15=`row1 green Success, row2 orange Pending (per-row real status)` impl=`Hard-coded green 'Success' on every row (ignores connectionStatus='PENDING' in mock)`  _gcp / step5 (연결 테스트) / targetSourceId=2010_
- Region column: v15=`asia-northeast3 per row (v15 lines 7116, 7134, 7152)` impl=`column not rendered in complete variant at all (only present in the pre-install variant)`  _provider=gcp · step=7 (연동 완료 / INSTALLATIO_
- Resource Name column: v15=`live · default / live · analytics / prd · main (v15 lines 7117, 7135, 7153)` impl=`column not rendered in complete variant`  _provider=gcp · step=7 (연동 완료 / INSTALLATIO_
- DB Credential (연동 대상 정보 table): v15=`v15 step-4 table has no DB Credential column at all (it shows VPC Endpoint 상태). Impl invented this column and it is empty.` impl=`— (em dash). res-6 has no selectedCredentialId so credential_id is null.`  _aws / step 4 (Agent 설치) / targetSourceId=1_
- Connection Status column: v15=`Success (green) + Pending (orange) — real per-row status` impl=`'Success' (green) hardcoded for all rows, ignoring real connectionStatus (mock has DISCONNECTED + PENDING)`  _aws / step 5 (연결 테스트) / targetSourceId=101_
- Database Type pill styling: v15=`blue .tag pill 'MySQL'` impl=`plain text 'POSTGRESQL'/'DYNAMODB' (no pill, but value IS present)`  _aws / step 5 (연결 테스트) / targetSourceId=101_
- pagination row: v15=`표시 [10] 건씩 · 1–2 / 전체 2건 · |< < [1] > >| (.pagination-row, 05-tables §7)` impl=`absent (0 pagination markup in DOM)`  _aws / step 6 (완료 여부 관리자 승인 대기) / targetSou_
- Region column (entire column): v15=`asia-northeast3 (mono 12px) for every row` impl=`column does not exist in the impl table`  _aws / step 7 (연동 완료) / targetSourceId=1012_
- 연동 대상 논리 DB count: v15=`12 / 8 / 5` impl=`'—' (LOGICAL_DB_PLACEHOLDER hardcoded) for all rows`  _aws / step 7 (연동 완료) / targetSourceId=1012_
- 연동 제외 논리 DB count: v15=`3 / 1 / 2` impl=`'—' (LOGICAL_DB_PLACEHOLDER hardcoded) for all rows`  _aws / step 7 (연동 완료) / targetSourceId=1012_
- row count / pagination total: v15=`'1–3 / 전체 3건' pagination footer` impl=`3 rows render but NO pagination footer/total shown`  _aws / step 7 (연동 완료) / targetSourceId=1012_

## WaitingApprovalCard.tsx  (4)
- DB Type filter options: v15=`MySQL (28) / PostgreSQL (12) / MariaDB (5) / Oracle (2)` impl=`empty (collectOptions over [] yields no options)`  _azure / step 2 (승인 대기) / targetSourceId 20_
- pagination row: v15=`1–10 / 전체 47건, pages 1-5` impl=`hidden (filteredCount===0 so Pagination not rendered)`  _azure / step 2 (승인 대기) / targetSourceId 20_
- approval table rows: v15=`paged MySQL/PostgreSQL/MariaDB rows + grouped Athena DB sub-rows, Resource ID, Region ap-northeast-1, Resource Name, 대상/비대상 pills, 제외 사유 chips (HTML 5965-6067)` impl=`'표시할 리소스가 없습니다.' (empty) — WaitingApprovalTable DEFAULT_EMPTY_MESSAGE`  _aws / step 2 (연동 대상 승인 대기) / targetSourceI_
- DB Type filter option counts: v15=`MySQL (28), PostgreSQL (12), MariaDB (5), Oracle (2) (HTML 5937-5940)` impl=`empty select (dbTypeOptions derived from 0 resources)`  _aws / step 2 (연동 대상 승인 대기) / targetSourceI_

## mock-data.ts  (4)
- Resource Name column (모든 행): v15=`sea-live-space-prod / sea-live-space-stg (real names)` impl=`'-' for every row`  _azure / step 5 (연결 테스트) / targetSourceId 2_
- Resource Name column: v15=`sea-live-space-prod / sea-live-space-stg (real resource names)` impl=`— for every row`  _gcp / step5 (연결 테스트) / targetSourceId=2010_
- DB Credential column: v15=`Key1 / Key2 (link, 12.5px)` impl=`'-' for every row`  _aws / step 5 (연결 테스트) / targetSourceId=101_
- DB Credential column: v15=`Key1 for every row` impl=`'-' for all 3 rows (rds-006, rds-007, ddb-004)`  _aws / step 7 (연동 완료) / targetSourceId=1012_

## CandidateResourceTable.tsx  (3)
- 연동 완료 여부 column (every row): v15=`real values: 연동 완료 / 연동 진행중 / — (per row)` impl=`hardcoded '—' for every row (CandidateResourceTable.tsx:263 always renders dash)`  _azure / step 1 (연동 대상 선택·입력) / targetSourc_
- 연동 완료 여부 column: v15=`real values: 연동 완료 / 연동 진행중 / — per row (v15 data-stepc=1 rows, lines 5757/5779/5800)` impl=`hardcoded '—' on EVERY row`  _aws / step 1 (연동 대상 선택·입력) / targetSourceI_
- 비대상 / exclusion-reason chip rows: v15=`v15 step1 table has a 비대상(gray) row and the later scan table (stepc=3) shows reason-chip-inline tooltips for excluded DBs` impl=`1006 has res-excluded (isSelected:false) but it still renders as 대상 (green) because integrationCategory is 'TARGET', not INSTALL_INELIGIBLE — no 비대상 badge, no reason chip`  _aws / step 1 (연동 대상 선택·입력) / targetSourceI_

## app/components/features/process-status/install-task-pipeline/InstallResourceTable.tsx  (2)
- pagination row under the install table: v15=`always-visible pagination row ('표시 10 건씩 / 1–2 / 전체 2건' + pager)` impl=`no pagination shown (InstallResourceTable renders Pagination only when rows.length > pageSize(10); 3 rows -> hidden)`  _azure / step 4 (Agent 설치) / targetSourceId_
- per-resource VPC Endpoint 상태 pill: v15=`완료 (green tag) / 진행중 (orange tag) per resource row` impl=`No install-status column rendered; bottom table shows a static green 'Success' Connection Status pill instead.`  _aws / step 4 (Agent 설치) / targetSourceId=1_

## lib/mock-gcp.ts  (2)
- install-task pipeline status (all 3 cards = "대기" / pending): v15=`card1 Subnet 생성 진행 = 완료(done), card2 서비스 측 리소스 설치 진행 = 진행중(running), card3 BDC 측 리소스 설치 진행 = 진행중(running) (v15 lines 6552-6575)` impl=`all 3 cards render the pending pill "대기" (grey). API /api/v1/gcp/target-sources/2009/installation-status returns 2 resources both resourceSubType=BDC_PRIVATE_HOST_MODE, whose STEP_MATRIX entry is [false,false,false] -> every step = SKIP -> getGcpStepSummary returns activeCount=0 -> PENDING for all 3 steps.`  _gcp / step 4 (Agent 설치 / INSTALLING) / tar_
- install resource table status (both rows = 완료): v15=`row1 완료(green), row2 진행중(orange) (v15 lines 6663/6677) — mixed states` impl=`both rows installationStatus=COMPLETED (완료) because all steps SKIP -> deriveInstallationStatus returns COMPLETED`  _gcp / step 4 (Agent 설치 / INSTALLING) / tar_

## app/components/features/process-status/install-task-pipeline/join-installation-resources.ts  (2)
- install resource table Region column (= "—"): v15=`ap-northeast-1 for every row (v15 line 6661/6675; AWS variant ap-northeast-1/ap-northeast-2)` impl=`Region renders "—" for both rows because joinGcpResources hardcodes region: null`  _gcp / step 4 (Agent 설치 / INSTALLING) / tar_
- install resource table Resource Name (long path, not short name): v15=`short resource name e.g. sea-live-space-prod / sea-live-space-stg (v15 line 6662/6676)` impl=`full GCP path projects/pii-agent-prod-12345/instances/sql-prod-mysql-01 (joinGcpResources databaseName = r.resourceName which is the full installation resourceName)`  _gcp / step 4 (Agent 설치 / INSTALLING) / tar_

## /Users/study/pii-agent-demo-target-source-v15/lib/mock-data.ts  (2)
- Region column: v15=`ap-northeast-1 (real region per row)` impl=`— (em dash) for every row`  _gcp / step5 (연결 테스트) / targetSourceId=2010_
- entire confirmed-integration table body: v15=`3 real rows — MySQL projects/sea-bdp-prd/.../sea_bdp_prd (asia-northeast3, live·default, Key1, 12/3, Healthy); MySQL (live·analytics, Key1, 8/1, Healthy); PostgreSQL .../cloudsql-main (prd·main, Key1, 5/2, Unhealthy). Pager: 1–3 / 전체 3건` impl=`empty-state text '확정된 연동 대상 DB 가 없습니다.' — zero rows`  _provider=gcp · step=7 (연동 완료 / INSTALLATIO_

## lib/approval-bff.ts  (2)
- Region column (연동 대상 정보 table): v15=`ap-northeast-1 (mono 12px) for each row` impl=`'-' (dash) for every row`  _aws / step 5 (연결 테스트) / targetSourceId=101_
- Resource Name column: v15=`sea-live-space-prod / sea-live-space-stg` impl=`'-' for every row`  _aws / step 5 (연결 테스트) / targetSourceId=101_

## same source as above (selected resources)  (1)
- 연동 대상 stat: v15=`38건 · 80.9%` impl=`0건 0.0%`  _azure / step 2 (승인 대기) / targetSourceId 20_

## same source (excluded_resource_infos with exclusio  (1)
- 비대상 stat: v15=`9건 · 19.1%` impl=`0건 0.0%`  _azure / step 2 (승인 대기) / targetSourceId 20_

## derived from resources length in WaitingApprovalCa  (1)
- filter-seg counts (전체/대상/비대상): v15=`47 / 38 / 9` impl=`0 / 0 / 0`  _azure / step 2 (승인 대기) / targetSourceId 20_

## same — seed resources with database_region  (1)
- Region filter options: v15=`ap-northeast-1 / ap-northeast-2 / us-west-2` impl=`empty`  _azure / step 2 (승인 대기) / targetSourceId 20_

## seed excluded_resource_infos[].exclusion_reason in  (1)
- 제외 사유 reason chips: v15=`e.g. 'Stg 환경 DB · PII 데이터 미보유' with tooltip full reason + 등록자/날짜 meta` impl=`none (no excluded rows)`  _azure / step 2 (승인 대기) / targetSourceId 20_

## ApprovedIntegrationSection.tsx  (1)
- 승인일시 / 승인자 subtitle: v15=`승인일시 2026-05-09 09:12 · 승인자 김보안 (kim.security)` impl=`ApprovedIntegrationSection only renders 승인일시 when view.approvedAt is set; for 2003 approved-integration is 404 so approvedAt is null → subtitle not shown; 승인자 (approver) is never rendered by impl`  _azure / step 3 (반영 중, APPLYING_APPROVED) /_

## row count differs because impl pulls all azure-pro  (1)
- 논리 DB 확인 / DB Credential link targets: v15=`two rows (matching 2건 pagination)` impl=`three rows ('연동 대상 정보' and '논리 DB 확인' tables each show 3 rows: MSSQL/POSTGRESQL/MYSQL)`  _azure / step 5 (연결 테스트) / targetSourceId 2_

## confirmed-integration/route.ts  (1)
- entire confirmed-integration table (all 3 rows) — ROOT CAUSE: v15=`3 populated rows: (MySQL · asia-northeast3 · live·default · Key1 · 대상12 · 제외3 · Healthy), (MySQL · asia-northeast3 · live·analytics · Key1 · 8 · 1 · Healthy), (PostgreSQL · asia-northeast3 · prd·main · Key1 · 5 · 2 · Unhealthy)` impl=`empty state '확정된 연동 대상 DB 가 없습니다.' — 0 rows`  _provider=azure, step=7 (연동 완료 / INSTALLATI_

## lib/mock-store.ts  (1)
- Last Scan: 2026-04-21 09:30 timestamp pill (card header): v15=`Last Scan: 2026-04-21 09:30 (always present next to Run Infra Scan button, v15 line 5666-5669)` impl=`absent — header shows only Run Infra Scan button; lastScanAt is undefined because no SUCCESS scan job is seeded for 1002`  _provider=gcp · step=1 (연동 대상 선택/입력) · targ_

## lib/api  (1)
- Candidate DB scan-complete table (STATE D) — 3 rows: MySQL/PostgreSQL/MySQL with Resource ID, Region, Resource Name, 스캔 상태, 연동 완료 여부 tags: v15=`populated 3-row table (대상/대상/비대상 tags, ap-northeast-1 regions, sea-* names, 신규/변경 status, 연동 완료/연동 진행중/—) + footer '총 3건 · 2건 선택됨' + '연동 대상 승인 요청' button (v15 lines 5722-5797)` impl=`empty scan state '인프라 스캔을 진행해주세요 / Run Infra Scan을 통해 부위 DB를 조회할 수 있어요' — table never renders for 1002 until user clicks Run Infra Scan (getConfirmResources returns nothing pre-scan)`  _provider=gcp · step=1 (연동 대상 선택/입력) · targ_

## lib/bff/mock/confirm.ts.  (1)
- 전체 요청 / 연동 대상 / 비대상 stat numbers: v15=`47건 / 38건·80.9% / 9건·19.1%` impl=`0건 / 0건·0.0% / 0건·0.0%`  _gcp / step 2 (승인 대기) / targetSourceId=2007_

## Same root cause — populate approved_integration mo  (1)
- toolbar count + filter-seg counts + pagination: v15=`전체 47 / 대상 38 / 비대상 9; '1–10 / 47건'; pagination 1..5, 표시 10건씩` impl=`all 0; '0–0 / 0건'; no pagination rendered (filteredCount===0)`  _gcp / step 2 (승인 대기) / targetSourceId=2007_

## Downstream of empty data — resolved once approved_  (1)
- DB Type / Region filter dropdown options: v15=`MySQL (28), PostgreSQL (12), MariaDB (5), Oracle (2); ap-northeast-1/2, us-west-2` impl=`only the placeholder option (options derived from empty resources)`  _gcp / step 2 (승인 대기) / targetSourceId=2007_

## CloudInstallingStep.tsx  (1)
- extra "연동 대상 정보" card — Region / Resource Name / DB Credential columns all "-": v15=`n/a (card not in v15); but the rendered columns are empty placeholders` impl=`Region, Resource Name, DB Credential all render "-" (ConfirmedIntegrationTable.tsx:124-126) because resource.region/resourceName/credentialId are null in the confirmed-integration mock for 2009`  _gcp / step 4 (Agent 설치 / INSTALLING) / tar_

## lib/types/resources.ts  (1)
- Region + Resource Name columns: v15=`ap-northeast-1 / sea-live-space-prod etc.` impl=`no such columns and no such fields on ConfirmedResource`  _gcp / step 6 (완료 여부 관리자 승인 대기, CONNECTION__

## appears automatically once data seeded  (1)
- pagination row: v15=`1–10 / 47건 with page numbers (HTML 5949,6073+)` impl=`hidden (filteredCount===0 → Pagination not rendered, WaitingApprovalCard.tsx:296)`  _aws / step 2 (연동 대상 승인 대기) / targetSourceI_

## ApprovalApplyingBanner.tsx  (1)
- banner count '전체 47건 중 32건 완료': v15=`전체 47건 중 32건 완료` impl=`omitted (only '평균 5분 내외 소요')`  _aws / step 3 (반영 중 · APPLYING_APPROVED) / _

## approved/ApprovedIntegrationSection.tsx  (1)
- card subtitle 승인일시 / 승인자: v15=`승인일시 2026-05-09 09:12 · 승인자 김보안 (kim.security)` impl=`nothing (approvedAt null)`  _aws / step 3 (반영 중 · APPLYING_APPROVED) / _

## health-status.ts  (1)
- Status column — Unhealthy row: v15=`row 3 (PostgreSQL) is Unhealthy (#991B1B/#EF4444); 2 Healthy + 1 Unhealthy` impl=`all 3 rows Healthy`  _aws / step 7 (연동 완료) / targetSourceId=1012_
