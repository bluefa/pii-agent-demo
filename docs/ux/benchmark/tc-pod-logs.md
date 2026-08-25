# Admin TC 탭 — fail_reason·Pod 로그 (ResourceTable 구조 전환)

- 날짜: 2026-08-19
- 대상 화면: Admin · Target Source 운영 · Test Connection 탭
- 구현 PR: #729 (feat/tc-latest-pod)
- 디자인 아티팩트:
  - 최신 TC 결과 설계 (밴드 + ResourceTable + 로그 뷰어): https://claude.ai/code/artifact/8eb466c0-ba9b-4722-8381-ce14c5590735
  - TC 실패 사유 카탈로그 (12종 + fallback): https://claude.ai/code/artifact/181e31eb-28bf-476b-8c08-447b1a80f84e

## 문제 진단

1. **같은 리소스 명단이 화면에 두 번** (`UX 원칙` — 중복 표면): 최근 연결 테스트 카드의
   Agent별 결과 목록과 확정 정보 표가 같은 명단을 각자 그리고, 필터·페이저도 두 벌.
2. **내부 식별자 노출** (`제안` → 오너 확정): agent_id 열은 운영자의 질문("어느 리소스가
   왜 안 붙고 로그는 어디서 보나")에 등장하지 않는다.
3. **실패의 원인이 지면에 없다** (`UX 원칙` — 실패는 빈 결과가 아니다): 계약 예고 필드
   fail_reason(리소스·TargetSource 2단위)과 pod_id 를 실을 자리가 없었다.

## 채택안 — "집계는 밴드로, 사실은 표로"

- 최근 연결 테스트 카드 → **종합 상태 밴드**: 제목행(#N + pill) · 요약 한 줄
  (n건 성공·m건 실패 / 진행 n/m + PipelineProgressBar / "리소스별 결과 없음") ·
  **TargetSource 사유 줄**("사유 · 라벨 · 원문 enum", FAIL+값 있을 때만).
- Agent별 결과 목록 **제거**. 리소스별 사실은 전부 확정 정보 표의 열로:
  연결 상태(기존 ConnCell) 옆에 **실패 사유**(라벨+원문 2단) · **Pod 로그**(로그 조회
  countLink — pod_id 는 열이 아니라 이 액션의 열쇠, hover title 과 뷰어 헤더가 짊어진다).
- **로그 뷰어**: JobViewer 셸 재사용(ModalShell 720×572 · 드래그 그립 · 어두운 패널),
  본문은 severity+content 리스트, severity 필터는 클라이언트 칩(0건 숨김), 헤더에
  캡처 도장 — 새로고침 없음(완료 시점 캡처, StackDriver 쿼터 60/min 근거).
- **fail_reason 12종 허용목록 접기 맵** 한 벌을 두 단위가 공유. 밖의 값은 원문+중립.
  SECRET_NOT_FOUND 라벨 "Credential(Secret) 없음" / 설명 "Credential 설정 안 된 리소스
  존재"는 오너 지정 문안(2026-08-19).
- 오너 결정: 상태 태그는 **flat tag(점 없음)** — TcPill 의 6px 점 제거, 판정 라벨
  '미확인'으로 3곳 통일. 리소스 접기는 Step 5 와 같은 foldAgentStatuses
  (FAIL → UNKNOWN → RUNNING → PENDING → SUCCESS) 한 벌.
- 전면 실패(TERRAFORM_NOT_APPLIED 등): 표는 전행 무보고(—), 밴드 사유 줄이 유일한
  설명 — 요약문은 "리소스별 결과 없음"(0건 성공으로 세지 않는다).

## 레퍼런스 (아티팩트 §벤치마크 참조)

수치는 전부 기존 화면에서 재사용: 표 프레임 = 확정 정보 표 HEAD_CELL/CELL(12px/500 ·
18/16 · hairline), 로그 조회 = opsStyles.countLink, 진행 바 = PipelineProgressBar,
뷰어 = detailJobStyles(jobStyles), IDC 식별 = IdcEndpointCell(PR #724 규칙).

## 계약 상태 (DRAFT)

swagger 미랜딩 — 목(mock-test-connection.ts)이 DRAFT CONTRACT 로 시딩하고 읽기는
passthrough. 열린 결정: 부분 실패에서 run fail_reason 의 의미(값이 없으면 UI 는 줄
자체를 그리지 않으므로 어느 쪽으로 랜딩해도 안전), pod-logs 엔드포인트 경로 확정.

## 2026-08-20 — 행 단위 두 건 (오너 지시)

**표: 한 행 = 결과가 보고되는 단위.** Athena 는 Step 4 부터 리전이 곧 리소스라
판정·pod·논리 DB 가 `athena_region_resource_id` 로만 온다. 확정 스냅샷은 DB 단위라
DB 의 자기 id 로 조회하던 이 표는 Athena 행 전부가 무보고(—)였고, 같은 리전이 4행을
차지해 "테스트가 4번 돌았다"로 읽혔다. `toConfirmedUnits`(= `resultUnitId`)로 접는다 —
사용자 화면 Step 5(ConnectionTestCard)·Step 6·7(ConfirmedIntegrationTable)이 이미 쓰는
같은 키다. 접힌 행: Resource Name 칸이 손잡이+엔진 이름, Resource ID 칸은 **결과가 키로
쓰는 리전 id**, Credential 은 '불필요'(배정할 리소스가 하나로 정해지지 않고 Athena 는
IAM 이다). 자식 = 데이터베이스(Database Type 열이 `Database`), 나머지 칸은 비운다.
페이지도 단위로 센다(리전이 페이지 경계에서 갈리지 않게).
⚠️ 운영 콘솔 **연동 확정 탭은 접지 않는다** — 그 표는 확정 응답 그 자체를 보여 준다
(ConfirmedResourceTable 주석). 접는 것은 step 4+ 결과를 조인하는 표뿐이다.

**로그 뷰어: StackDriver 행 문법.** 바닥(어두운 패널)과 줄 전체 severity 색은 그대로 두고
앞의 두 칸만 가져왔다 — **글리프 · 시각 · 본문**. 글리프는 4색 접기와 같은 갈래
(적색 `x-circle` / 호박 `warn-tri` / 중립 `info` / DEBUG·DEFAULT·미지 = 점), 색은 줄에서
물려받는다. 시각은 `fmtTimeMs` — Asia/Seoul 고정, `HH:mm:ss.SSS`(같은 초에 여러 줄이
찍힌다), 날짜는 헤더 캡처 도장이 이미 말하므로 뺀다. 캡처본이 시각을 하나도 안 주면
칸 자체가 빠진다(자리만 잡고 '-' 를 세우지 않는다). 복사 텍스트는 시각·severity·본문.
DRAFT 계약에 `entries[].timestamp` 추가 — Cloud Logging `LogEntry.timestamp` 그대로,
목은 캡처 시각에서 800ms 간격으로 거슬러 결정적으로 찍는다.

**같은 날 이어서 — 탭 배치를 Step 5 문법으로.** 제목의 회차 번호(#N) 제거: 제목이 답할
질문은 "지금 붙는가"이고, 회차는 그것을 세는 표에서 읽는다. 지면 맨 아래 있던 **실행 기록
카드를 모달로** 내렸다(TcRunHistoryModal, ModalShell task + appTable + PlPagination 5행 —
형제 TcHistoryModal 문법). 입구는 밴드 우측 시각 아래 링크 두 개(실행 기록 · 승인·반려 이력),
사용자 화면 Step 5 의 `historyAction` 자리와 같다. 이유: 카드로 두면 탭의 마지막 절이
"과거"가 되어, 이 탭에 온 이유(지금 무엇이 실패했나)가 지면에서 가장 멀어진다. 실행이
한 번도 없으면 링크 자체가 없다(빈 모달로 가는 입구를 세우지 않는다). 회차 목록 폴링도
같이 사라졌다 — 모달이 열릴 때 스스로 조회한다.

## 2026-08-25 — 한 줄은 한 행 (오너 지시)

**문제.** 뷰어 본문이 `whitespace-pre-wrap break-all` 한 벌이라 entry 하나가 그대로
감겼다. StackDriver 캡처본의 ERROR 줄은 스택 트레이스 전문인 경우가 흔하고, 그런 줄
하나가 720×572 패널을 통째로 먹으면서 그 앞뒤 줄이 지면 밖으로 밀렸다 — 로그를 여는
사람이 맨 처음 하는 일("몇 건이 어떤 순서로 찍혔나")이 불가능했다.

**채택.** StackDriver 가 행 앞 화살표로 상세를 여는 그 문법을 그대로 — 행 문법
(글리프·시각·본문)은 2026-08-20 것을 유지하고 앞에 화살표 한 칸만 더 붙였다.

- **접힘이 기본**: 접힌 행은 무슨 일이 있어도 정확히 한 줄(`truncate`). `nowrap` 이
  줄바꿈을 공백으로 접으므로 여러 줄짜리 트레이스도 행 높이를 늘리지 않는다.
- **행 전체가 디스클로저 머리**: hover 면 행이 밝아지고(기존 `--pl-gray-700`) 화살표가
  선명해진다, 누르면 펴진다. 키보드도 같은 자리 — `role="button"`·`aria-expanded`·
  Enter/Space(누르고 있는 Space 의 auto-repeat 는 한 번만 센다). 본문을 긁는 중이면
  토글하지 않는다 — 단 이 문은 **클릭에만** 선다. 키보드 활성화까지 막으면, 긁어 둔
  선택이 살아 있다는 이유로 Enter 가 아무 말 없이 안 먹는다.
- **Tab 은 목록에서 한 번만 멈춘다**(roving tabindex, 위아래는 방향키). 행마다
  `tabIndex={0}` 을 주면 300줄 캡처본이 `ModalShell` 의 포커스 트랩 안에 300개의
  정거장을 만들고, 트랩은 Tab 마다 후보를 다시 훑으므로 그 비용이 O(N) 으로 붙는다.
  종전에는 로그 본문이 정거장 하나였다 — 접기를 얻으면서 그걸 잃을 이유가 없다.
  필터가 그 행을 걷어내면 보이는 첫 행이 대신 선다(정거장 0개 = 로그가 키보드에서 실종).
- **포커스 표식은 행이 따로 그리지 않는다.** 전역 `*:focus-visible` 아웃라인
  (globals.css §Focus Ring)이 이미 모든 초점 대상에 같은 표식을 세운다. 그 규칙은
  cascade layer 밖이라 Tailwind 의 `outline-none` 으로 끄지 못하므로, 행에 링을 하나 더
  얹으면 굵기가 다른 고리 두 개가 겹친다(실측으로 확인).
  아웃라인은 `outline-offset: 2px` 으로 행 박스 **바깥**에 그려지므로, 첫 행이 스크롤
  경계에 붙으면 그 4px(offset 2 + 두께 2)이 잘린다 — 행 목록 컨테이너에만 위 여백을 준다
  (`j.logBody` 는 공유 셸이라 건드리지 않는다).
  ⚠️ 남는 사실 하나: 전역 아웃라인 #0064FF 는 이 어두운 패널(#1D2939) 위에서 2.99:1(브라우저
  실측) 로 비텍스트 3:1 에 0.01 모자란다. 바깥에 그려지는 덕에 기준 바닥은 **언제나 패널**
  이고 hover 칠(#344054, 2.13:1)이 아니다 — 즉 2.99 는 모든 상태에서 같은 값이다. 앱 전역
  토큰 문제라 이 화면에서 갈라 놓지 않는다 — 같은 파랑이 흰 바닥에서는 4.92:1 이다.
- **펴기는 언제나 픽셀을 바꾼다**: 펴진 행은 본문 전문(감김)에 더해, 접힌 줄이 못 싣는
  두 사실을 덧붙인다 — severity 원문 낱말(같은 색을 나눠 쓰는 ERROR/CRITICAL 을 가른다.
  hover title 의 상시 판)과 날짜까지 붙은 시각(`fmtDate` + `fmtTimeMs`). 그래서 짧은
  줄에서도 죽은 토글이 되지 않는다.
- **편 상태는 필터 전 원본 인덱스에 매인다** — severity 칩을 눌러도 같은 줄이 같은
  상태로 남는다. 필터된 배열의 위치로 키잉하면 칩 한 번에 다른 줄이 펴진다.

기각: 전역 "모두 펼치기/접기" — 접힘이 기본이고 편 줄은 한 번에 몇 개뿐이라, 지면 위에
상시 컨트롤을 세울 만큼의 일이 없다. 가상 스크롤 — **접힌** 행이 한 줄로 고정되면서
높이가 예측 가능해졌다(편 행은 여전히 가변이지만, 한 번에 몇 개뿐이다). 둘 다 실측이
요구하면 그때.

목: `CLUSTER_TEST_FAILED` 갈래에 스택 트레이스 전문 entry 한 건을 심었다 — 목이 최악
케이스를 만들 수 있어야 뷰어가 그걸 접는지 볼 수 있다.
