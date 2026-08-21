# 관리자 승인 탭 — 근거 리포트 행 (시안 C)

- 날짜: 2026-08-20
- 대상 화면: `/admin/pipelines/ops/target-sources/{id}?tab=approval` (관리자 승인 탭)
- 아티팩트: https://claude.ai/code/artifact/ac344770-ec0a-42ee-a144-0327ea2a9a48
- 구현 PR: #743 (#741 `fix/single-agent-table` 위에 스택 — #741 먼저 머지)

## 문제 요약 (진단 P1–P6, 실측 기준 1511·1642)

| # | 문제 | 증거 등급 |
|---|------|-----------|
| P1 | 선언한 우선순위(승인 조건 ▸ TC = 모니터링 동급)와 화면 계층이 어긋남 — TC 결과는 110px 서브블록, 모니터링은 최상위 카드 3장 656px | 수치 위반 |
| P2 | 결정 CTA(y 341–373)와 DAG 표(y 976–1371)가 어떤 스크롤 위치에서도 같이 보이지 않음(교집합 0, 169px 부족). 마스트헤드·탭띠가 `position: static`이라 스크롤하면 탭도 사라짐 | 수치 위반 |
| P3 | 카드 4장 중 3장(헬스 요약·리소스별 DAG·논리 DB 현황)이 같은 주제 "모니터링 결과" — 카드 경계가 행위가 아니라 정보 덩어리를 자름 | UX 원칙 |
| P4 | 맨 아래 95px 카드(논리 DB 현황 요약)는 새 숫자를 하나도 말하지 않음 | 수치 위반 |
| P5 | 같은 이름의 숫자가 두 값 — `논리 DB 52`(확정 정보) vs `논리 DB 14`(DAG 관측). 라벨 분리 없이는 버그로 읽힘 | UX 원칙 |
| P6 | 모니터링 쪽은 기준·시각·타임존을 밝히는데 TC 쪽만 출처를 밝히지 않음 | 제안 |

## 실제 사용한 레퍼런스

- **GitLab — Merge request widgets** · https://docs.gitlab.com/development/fe_guide/merge_request_widgets/ — 시안 C의 뼈대. 접힌 리포트 행(제목+보조+판정) 스택이 결정 버튼 위에 서고, `fetchCollapsedData`/`fetchExpandedData` — 접힌 줄이 판정을 나르고 펼쳐야 본문이 열린다.
- **GitHub — Pull request status checks** · https://docs.github.com/en/pull-requests/reference/status-checks — 판정 아이콘과 근거 행의 분리(체크는 게이트, 상세는 펼침).
- **AWS Cloudscape — Details page with tabs** · https://cloudscape.design/patterns/resource-management/details/details-page-with-tabs/ — "Don't use tabs if users need to compare or access information in each tab simultaneously" → 탭 안의 탭(시안 B) 기각 근거 ①.
- **Nielsen Norman Group — Tabs, Used Right** · https://www.nngroup.com/articles/tabs-used-right/ — 기각 근거 ②(비교가 필요한 내용을 탭으로 가르면 one big page보다 사용성이 떨어진다).
- **IBM Carbon — Tabs usage** · https://carbondesignsystem.com/components/tabs/usage/ — "should never be nested within each other" → 기각 근거 ③.
- **AWS Cloudscape — Split view** · https://cloudscape.design/patterns/resource-management/view/split-view/ — 1,500행 보드를 우측 패널로 유지(기존 시안 A)하는 근거.

## 채택안 — 시안 C: 근거 리포트 행 (카드 4장 → 1장)

비교표에서 유일하게 P1–P6 전부 ●. 구조 = 헤드(판정 알약+CTA) ▸ 승인 조건 2행 ▸ 근거 2행(연결 테스트 결과 · 모니터링 결과, 기본 접힘·독립 펼침·세션 비저장). 기각: 시안 B(탭 안의 탭 — 위 3개 근거), 시안 D(좌측 세로 메뉴 — 화면 규모 대비 과함), 시안 E(2열 병렬 — 495px씩으로는 표가 좁음).

### 채택 후 오너 수정 3건 (2026-08-20)

1. **C-1 캡션 문장 교체** — 붙임표(—) 연결 금지, 강조는 굵기·색으로. 서비스 쪽 실제 버튼 이름을 조사해 반영: Step 5 카드의 CTA는 **완료 승인 요청** (`ConnectionTestCard.tsx`·`IdcStep5ConnectionTest.tsx`). 최종 문안: "연결 테스트가 성공해도 이 조건은 자동으로 충족되지 않습니다. 서비스 담당자가 **5단계 연결 테스트에서 완료 승인 요청**을 눌러야 합니다." (`latest 성공 && 미요청` 상태에서만.) 게이트 ①·헤드 필도 같은 어휘로 정렬(완료 확인 → 완료 승인).
2. **모니터링 표의 `연결 상태 (모니터링)`·`최근 7일 DAG` 열 병합** — 연결이 정상인 행에서 "성공" 알약은 DAG 분수가 이미 증명하는 사실의 사본. 비정상 값만 같은 칸 앞에 알약(`연결 실패` 등)으로 서고 raw 는 툴팁. **[08-21 대체]** 예외 표시 방식은 라이브 리뷰에서 기각 — 연결 성공 + 2/4 성공인 행이 아무 경고도 받지 못했다. 최종: 종합 상태 알약(`agentVerdict`)이 **모든 행에** 선다(연결 우선, 연결 정상이면 주간 관측으로 정상/이상 판정). raw 는 여전히 툴팁.
3. **C-2 검토 표는 Step 6·7 리소스 표 디자인** — `WaitingApprovalTable`(confirmed variant)의 스켈레톤을 admin 토큰으로 번역한 `ConfirmedInfoCard` 문법을 공용화(`confirmedTableBits`)해 사용. 개수 클릭은 읽기 전용 `LdbViewModal`(LdbManageModal의 검토 절반) — 쓰기(제외 정책·Credential·재실행)는 연결 테스트 탭 경계 유지.

### CSR/SSR 판단

승인 탭은 CSR 유지. 근거: ① 승인/반려 뮤테이션+즉시 리로드, ② TC 상태를 연결 테스트 탭과 한 번 받아 공유(페이지 소유 상태), ③ 탭 전환이 의도적으로 클라이언트(서버 왕복 없음 — R1 리디자인 #735의 결정), ④ 펼침·패널·모달의 지연 fetch. 서버로 옮길 수 있는 것은 첫 스냅샷뿐인데, 같은 사실의 소스가 둘로 갈라지는 비용이 내부 콘솔의 첫 페인트 이득보다 크다.
