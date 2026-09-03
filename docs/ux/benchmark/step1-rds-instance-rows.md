# RDS 인스턴스 = 표의 행 — 디자인 벤치마크 결정 기록

- **일자**: 2026-09-03
- **대상**: `/pass/target-sources/{id}` Step 1 `CandidateResourceRow` + 같은 밴드를 쓰는 세 읽기 전용 화면 — Step 2·3 `WaitingApprovalTable`, Admin 요청 큐 `CloudResourceTable`, Admin 운영 상세 `RequestTab`
- **아티팩트**: https://claude.ai/code/artifact/4a2ec79c-0f9b-426e-a7c9-a294425db580
- **선행 기록**: `docs/ux/benchmark/step1-resource-table.md` (2026-08-12, 밴드를 만든 결정)

## 문제 — 실측

밴드는 `<tr><td colSpan>` 한 칸 안에서 **자기만의 3열 그리드**(`인스턴스 · 가용 영역 · 엔드포인트`)를 그렸다. 그 결과 오너가 확인한 결함 둘.

### P1. 선택이 두 번 말해진다

열린 클러스터 행의 3번째 줄 `↳ [Reader] demo-aurora-mysql-2` 와 밴드의 체크된 라디오가, **같은 `bgColors.panel` 면 위에서 75.1px 떨어져**, **같은 `RdsMemberChip`** 을 달고 같은 인스턴스를 가리켰다. 답은 하나인데 목소리가 둘이었다.

### P2. 열이 어긋난다 (실측, 2026-09-03)

| | x |
|---|---|
| 밴드의 3열 시작 | 450 / 831.8 / 1067.3 |
| 바깥 표의 6열 시작 | 396 / 674.9 / 954.2 / 1096.2 / 1252.2 / 1364.2 |

**밴드 열이 바깥 열 경계에 하나도 걸리지 않는다.** 최악의 경우: 인스턴스의 AZ `ap-northeast-2b` 가 x=827.5(=**Resource ID** 열 안)에 그려지는데, 한 행 위 Athena 자식 행은 `ap-northeast-2` 를 x=1096.2(=**Region** 열 안)에 그렸다. **같은 종류의 값이 268.7px 떨어진 두 축에** 앉아 있었다.

덧붙여: 밴드의 오른쪽 끝이 표의 오른쪽 끝보다 18px 짧았고(밴드 컨테이너의 `pr-[18px]`), 밴드 줄에는 다른 모든 셀이 갖는 세로 이음매 그라디언트가 `none` 이었다.

## 실제 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 |
|---|---|---|
| TanStack Table — Expanding | https://tanstack.com/table/v8/docs/guide/expanding | "Expanded rows are essentially child rows that inherit the same column structure as their parent rows" — 펼친 자식은 **부모의 열 구조를 물려받는다**. 이번 채택안의 핵심 문장 |
| AG Grid — Tree Data | https://www.ag-grid.com/react-data-grid/tree-data/ | 계층은 **행의 성질**이지 별도 표면이 아니다. 자식은 그리드의 열 원장 위에 그대로 선다 |
| Cloudscape — Table with expandable rows | https://cloudscape.design/patterns/resource-management/view/table-with-expandable-rows/ | "A child row is indented." — 계층 표시는 **들여쓰기**이고, 열은 건드리지 않는다 |
| Cloudscape — Split view | https://cloudscape.design/patterns/resource-management/view/split-view/ | "Don't repeat the action buttons from the table/cards header in the split panel." — 부모 표면과 자식 표면이 **같은 것을 두 번 말하지 않는다**. P1 의 판정 근거 |
| MUI X — Master detail | https://mui.com/x/react-data-grid/master-detail/ | "By default, the detail panel's width is equal to the sum of the widths of all columns." — 디테일 패널조차 폭을 **열 합계에서 가져온다**. 자체 그리드를 새로 짜는 쪽이 예외다 |

## 채택안 — 시안 D + 시안 B

### 시안 D — 인스턴스가 호스트 표의 행이 된다

`RdsInstancePanel` 이 colspan 한 칸 대신 **인스턴스마다 `<tr>` 하나**를 낸다. 정렬은 호스트 표의 `table-fixed` 원장이 하고, 이 컴포넌트는 아무것도 다시 계산하지 않는다.

| 열 | 인스턴스 행이 담는 것 |
|---|---|
| 선행 체크박스 칸 (있는 표에서만) | 빈 `<td>`. 체크박스는 **클러스터의 판정**이지 멤버의 것이 아니다. `data-static-col` 이라 이음매도 레일도 없다 |
| Resource Name | 2줄 스택. 1줄: 라디오(1단계·편집 가능일 때만, 계층 틈에 걸림) · 인스턴스 이름(mono 14px, **잘리면 툴팁이 전문**) · `RdsMemberChip` · 읽기 전용이면 `RdsSelectionChip`. 2줄: 엔드포인트 `host:port`(mono 12px, 잘리면 툴팁이 전문). 스택 문법은 수동 추가 EC2 행이 이미 쓰는 `ec2Styles.rowStack` 재사용 |
| Resource ID | 빈다. Athena 자식과 같은 규칙 — 인스턴스 id 는 부모 경로 + 자식 이름이라 **한 칸에서 부모 정체성을 두 번** 말한다 |
| Database Type | 빈다. 모든 멤버가 클러스터의 엔진을 쓰고, 클러스터 행의 그 칸이 한 번 말한다 (오너, 2026-08-12) |
| Region | **AZ** (`instance.availability_zone ?? '—'`). P2 가 옮기려던 값이 여기 앉는다. 호스트의 Region 셀과 같은 옷(mono 14px `secondary`) — 이 열을 세로로 읽으니 위의 리전들과 같은 활자여야 한다. `tableRowLift.cellText` 는 안 붙인다: `group-hover:` 규칙인데 인스턴스 행에는 답할 `tableRowLift.base` 그룹이 없고, 옛 밴드 줄에도 hover 상태는 없었다 |
| 나머지 전부 | 빈다 |

표가 대신하게 되어 **삭제한 것**: `LINE_GRID` · `INDENT_WITH_CHECKBOX` · `INDENT_WITHOUT_CHECKBOX` · 밴드 헤더 스트립 · `role="table"/"row"/"columnheader"/"cell"/"rowgroup"` · `rdsInstanceBandLabel` · 그리고 그것들이 쓰던 카피 세 개(`instanceBand` · `instance` · `availabilityZone`). 헤더는 표의 `<thead>` 가 되고, 표 의미론은 진짜 `<table>` 이 준다.

`colSpan` 도 사라졌다. 대신 **호스트의 열 배치를 명시적으로 받는다** — `columns: readonly RdsInstanceHostColumn[]`(`'select' | 'name' | 'availabilityZone' | 'blank'`). 추론이 아니라 선언이다: 어느 열이 Region 인지 아는 것은 호스트뿐이고, 네 호출처는 7 / 5 / 6 / 6 열이다.

**그대로 둔 것**: `sortRdsInstances` 의 Reader 우선 순서, 열린 클러스터 행과 인스턴스 행이 **함께 입는 `bgColors.panel`**(여백·라운드·그림자·틈 없음 — 이 모양은 「떠 있는 카드」로 3번 기각됐다), 그리고 **선택된 행에 배경 칠 없음**(오너: 라디오 또는 `선택됨` 칩이 유일한 표식).

**트리 레일 — 어휘는 하나다.** 밴드였을 때는 colspan 셀이 표의 왼쪽 끝에서 시작해서 `idcStyles.table.instanceBand` 가 레일을 `-38px` 로 **다시 앵커**했고, 두 토큰의 숫자가 어긋나지 않도록 `design-guard.test.ts` 가 두 축을 대조했다. 행이 된 지금 인스턴스 이름 셀은 Athena 자식과 **같은 셀·같은 열**이므로 `group.childCell` / `childCellLast` 를 그대로 쓴다. `instanceBand` 에 남은 것은 라디오가 들어갈 자리를 만드는 팔꿈치 하나뿐(22px → 8px)이고, 가드는 **단일 축**을 지킨다: 트렁크 x · 팔꿈치 x · 이름 단(54px)이 `group.childCell` 과 값이 같아야 하고, 라디오는 팔꿈치 끝과 이름 사이에 양쪽 다 안 닿고 앉아야 한다.

### 시안 B — 열린 클러스터 행이 요약 줄을 뗀다

`CandidateResourceRow` 에서만: **밴드가 열려 있고 그 밴드가 라디오를 그릴 때** `RdsChosenInstanceLine` 을 그리지 않는다. 체크된 라디오가 답이고, 부모 줄이 그 답을 두 번째 목소리로 만든다.

- **접었을 때는 그대로** — 접힌 부모가 답을 들고 있어야 한다는 판례(오너, 2026-08-11)는 손대지 않았다.
- **읽기 전용 세 화면에는 적용 안 함** — 라디오가 없으므로 거기서는 부모 줄이 선택을 말하는 **유일한** 것이다.

## 실측 — 전 / 후 (1920px 뷰포트, `/pass/target-sources/1006`)

| 확인 항목 | 전 | 후 |
|---|---|---|
| 인스턴스 이름 x == Athena 자식(`test_raw`) 이름 x | 450 == 450 (유일하게 이미 맞던 것) | **450 == 450** |
| 인스턴스 AZ 셀 x vs Region 열 x | 827.5 vs 1096.2 (**어긋남**) | **1134 == 1134** (Athena 자식의 Region 값과 같은 x) |
| `table [role="table"]` 개수 | 1 | **0** (문서 전체 `<table>` 1개) |
| 인스턴스 행 오른쪽 끝 vs 표 오른쪽 끝 | 18px 짧음 | **1544 == 1544** |
| 인스턴스 행의 셀 경계 vs `thead th` 경계 | 해당 없음 (셀 1개) | **[344, 396, 679.5, 974, 1116, 1272, 1384] — 7칸 전부 일치**, 세 행 모두 |
| 열린 클러스터 행 높이 | 109.5px | **86px** (3번째 줄이 빠짐) |
| 접힌 클러스터 행 | `↳ [Reader] demo-aurora-mysql-2` | **그대로** (109.5px, 문구 유지) |
| 세로 이음매 그라디언트 | 밴드 줄에 `none` | **`linear-gradient(to left, rgba(15,23,42,0.03), rgba(0,0,0,0))`** — 이름·Region 셀 모두 |
| 열린 클러스터 행 / 인스턴스 행 면 | — | **동일** (`lab(96.1596 -0.0823438 -1.13575)`) |
| 레일 | 밴드 트렁크 `-38px` (자체 축) | 인스턴스 셀 트렁크 16px · 팔꿈치 16px/8px, Athena 자식 트렁크 16px · 팔꿈치 16px/22px — **같은 축**. 라디오 x=426(=396+30), 팔꿈치 끝 420, 이름 450 |
| 마지막 인스턴스 행 | — | 트렁크가 자기 팔꿈치에서 끊긴다(`childCellLast`, bottom 41.5 = 행 높이의 절반) |

### 자체 리뷰에서 고친 것 (2026-09-03)

**이름이 툴팁 없이 잘렸다 (실결함).** 1512px 에서 Name 열은 250px 이고, 정체성 줄은 54px 단 + 이름 + 역할 칩이다. 실측: 이름 span `clientWidth 117` vs `scrollWidth 133` — 세 행 모두 `demo-aurora-my…` 로 잘려, **라디오가 고르는 바로 그 값으로 세 인스턴스를 구별할 수 없었다**. 엔드포인트 줄에는 잘린 값 툴팁이 있었고 이름에는 없었다. 이름에 같은 레시피를 얹었다 — `Tooltip variant="value" size="md" truncatedOnly` + `IdentifierTip label={t.instance}`. 이 표들의 다른 정체성 셀이 전부 따르는 레시피라 새로 만든 것이 아니다. `triggerClassName` 은 `min-w-0` 하나뿐이다 — Tooltip 래퍼가 이미 `relative inline-flex` 이고 `cn` 은 단순 join 이라, display 클래스를 하나 더 얹으면 승자가 스타일시트 순서로 정해진다(`NAME_TRIGGER` 가 display 를 안 쓰는 것과 같은 이유). 확인: 툴팁이 뜨고 `인스턴스 / demo-aurora-mysql-2` 를 싣는다. 열 폭·잘림 위치는 그대로.

> ⚠️ **레이아웃 재배분은 오너 결정**이라 하지 않았다 — 역할 칩을 엔드포인트 줄로 내려 이름에 폭을 돌려줄지는 별건이다. 여기서 한 것은 **잘린 값에 닿을 길을 만든 것**뿐이다.

**행 전체 클릭이 사라졌었다 (좁아짐).** 옛 밴드의 줄은 `<label>` 하나여서 AZ 든 엔드포인트든 누르면 그 인스턴스가 골라졌다. 행이 된 뒤 첫 구현은 Resource Name 셀만 `<label>` 로 감쌌는데, 그 셀은 ~1040px 행의 250px 이고 행 높이는 84px 다 — 대부분이 죽은 면적이었다. `<tr>` 은 label 이 될 수 없으므로 `<tr onClick>` 으로 되돌렸다. 라디오를 직접 누르면 `onChange` 와 함께 두 번 불리지만 `onSelect` 는 같은 id 로 선택을 세우는 setter 라 멱등이다 — `stopPropagation` 은 쓰지 않는다. 드래그로 텍스트를 긁은 경우만 `window.getSelection()?.isCollapsed === false` 로 걸러낸다. `<label>` 은 이름 셀에 남아 포인터 어포던스를, 라디오는 키보드 진입점을 계속 맡는다. 읽기 전용 표면에는 핸들러 자체가 안 달린다.

**술어 하나가 두 벌이었다.** `CandidateResourceRow` 가 `instancesAnswerable = isSelected && !readonly` 를 계산해 놓고 패널에는 `selectable={isSelected && !readonly}` 를 따로 넘기고 있었다. 둘이 갈리면 — 줄 숨김 술어는 참인데 `selectable` 이 거짓이면 — 열린 클러스터 행이 ↳ 줄을 떼고 라디오도 안 뜨므로 **화면 어디에도 선택을 말하는 것이 없어진다**. `selectable={instancesAnswerable}` 로 출처를 하나로 묶었다.

## 읽기 전용 세 화면 실측 (1512px)

| 화면 | 컴포넌트 | 결과 |
|---|---|---|
| Step 3 `/pass/target-sources/2001` | `WaitingApprovalTable` | 6열(name 344 · id 594 · dbType 780 · region 922 · target 1078 · reason 1194), 인스턴스 행 3개 · 셀 6/6 · **경계 전부 `thead th` 와 일치** · 행 우측 1336 == 표 우측 · 이름 x 398 · **AZ x 940 == 클러스터 행 Region 값의 x 940** · 라디오 0 · `선택됨` 1 · 중첩 `role="table"` 0 · 이음매 그라디언트 있음 · 클러스터 행과 같은 면 · 레일 트렁크 16px 팔꿈치 16px/22px(= `group.childCell` 그대로) · **↳ 줄 유지**(시안 B 미적용 확인) |
| Admin 큐 `/pass/admin/pipelines/queue/requests/2113` | `CloudResourceTable` | 6열(name 249 · id 557 · dbType 915 · region 1057 · target 1213 · reason 1329), 위와 같은 항목 전부 통과. 행 우측 1471 == 표 우측 · 이름 x 303 · **AZ x 1075 == 클러스터 Region x 1075** |
| Admin 운영 `/pass/admin/pipelines/ops/target-sources/2113` 「연동 요청 정보」 탭 | `CloudResourceTable` (`ResourceSection` 경유 — `WaitingApprovalTable` 이 **아니다**) | 6열(name 274 · id 569.4 · dbType 890 · region 1032 · target 1188 · reason 1304), 전부 통과. 행 우측 1446 == 표 우측 · 이름 x 328 · **AZ x 1050 == 클러스터 Region x 1050** |

> ⚠️ **목 드리프트 — 이 변경과 무관.** 큐/운영 두 화면의 유일한 클러스터 픽스처(`SEED_APPROVAL_DEMO` 의 요청 2113)는 지금 화면에 닿지 않는다. 2026-09-02 의 `f3b23708`(PR #859)이 `mock-data.ts` 에서 `APPROVAL_QUEUE_TARGETS` 의 모든 ts 에 대해 **리소스 없는 store project 를 합성**하기 시작했고, 그래서 `getProjectByTargetSourceId(2113)` 가 이제 적중해 `confirm.ts:1301` 의 데모 폴백이 죽었다. 같은 파일의 주석 "Admin Task Queue demo targets (1031/2113) live outside the store" 도 함께 낡았다. 두 화면 모두 「요청 리소스가 없습니다」를 그린다. 위 두 줄은 그 응답을 브라우저(CDP `Fetch.fulfillRequest`)에서 시드 페이로드로 갈아끼워 실제 `CloudResourceTable` 을 렌더시켜 잰 값이다 — 저장소는 건드리지 않았다. **목 복구는 이 PR 범위 밖**이다.

## 후속 / 스코프 밖

- **판정 레일(`verdictRail`)은 예전에도 없었다.** 인스턴스 행의 선행 칸은 비어 있고, 제외/설치 불가 클러스터의 4px 레일은 클러스터 행에서 끊긴다. **2026-09-03 이 만든 구멍이 아니다** — 옛 밴드의 colspan `<td>` 도 `verdictRailClass` 를 달지 않았으므로, 이 화면은 처음부터 이랬다. 멤버 행이 클러스터의 판정을 입을지는 디자인 결정이고 오너에게 물은 적이 없어, 이번에 임의로 더하지 않았다.
- **이름 열의 폭 배분** — 위 리뷰 항목의 ⚠️. 250px 열에서 54px 단 + 이름 + 역할 칩이면 이름은 구조적으로 잘린다. 역할 칩을 엔드포인트 줄로 내리는 안이 있지만, 「Reader/Writer 가 인스턴스와 최대한 가까이」는 오너 지시(2026-08-12)라 임의로 못 옮긴다.
