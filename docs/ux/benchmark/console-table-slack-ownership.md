# 콘솔 표 — 슬랙은 누가 먹나

- **날짜** 2026-08-22
- **대상** `ConsoleTable` (연동 완료 리소스 표, `/pass/target-sources/{id}`)
- **PR** #754 (3번째 커밋)
- **선행** `target-source-resource-table-console.md` 라운드 19

## 1. 문제

오너 보고 두 건. 같은 원인의 앞뒤다.

| # | 증상 | 등급 |
|---|------|------|
| D1 | 열 하나를 드래그하면 표가 반응형을 잃고 고정 폭이 된다 | 수치 위반 |
| D2 | 드래그 전에는 Resource ID **혼자** 화면을 다 먹는다 (2400px 판에서 1598px = 67%) | 수치 위반 |
| D3 | 드래그 후 표가 1183px에서 끝나고 1217px가 페이지 배경 — 콘솔 표면이 판에서 끊긴다 | UX 원칙 |
| D4 | 되돌릴 방법이 없다 (R14에서 「열 너비 초기화」 제거) | 제안 |

원인: 슬랙을 먹는 역할을 **`id` 열이라는 정체성**에 묶었다.

```ts
const isFlexing = (column, resize) => !!column.flex && !resize?.widthOf(column.key);
```

그 열을 드래그하면 술어가 깨지고 **흡수하는 열이 0개**가 된다. 아무도 역할을 물려받지 않는다.

## 2. CSS 실측 — `table-layout: fixed` 가 받는 것

판 1400px, Chrome에서 직접 측정.

| 선언 | 실측 | 판정 |
|------|------|------|
| `200px` (형제에 `auto` 있음) | 200 | ✅ 정확 |
| `30%` | 420 = 1400×0.30 | ✅ 정확 |
| `auto` | 나머지 전부 | ✅ 싱크 |
| `calc(100px + 50px)` | **323** (≠150) | ❌ 전 열 비례 재분배 — R4가 잡은 그 문제 |
| `calc(50% - 20px)` | 900 = `auto`와 동일 | ❌ %가 섞인 calc은 통째로 `auto`로 강등 |
| `max(162px, 16.4%)` | 900 = `auto`와 동일 | ❌ `min()`/`max()`/`clamp()` 전부 같음 |

**어휘는 맨 px · 맨 % · `auto` 셋뿐.** 「하한 + 지분」을 한 선언으로 쓸 수 없다.
그래서 조사한 12종 중 **순수 CSS로 푸는 곳이 하나도 없다** — 전부 컨테이너를 재서 px를 쓴다.
우리가 CSS로 갈 수 있는 최대치는 **지분(%) 여러 개 + 싱크(`auto`) 하나**.

## 3. 레퍼런스 12종

관련도 순. 전부 이번 세션에 문서/소스 직접 확인.

1. **AWS Cloudscape Table** — 우리 시안 F의 원산지. 자체 소스 인용:
   ```js
   // src/table/use-column-widths.tsx
   const isLastColumn = column.id === visibleColumns[visibleColumns.length - 1]?.id;
   if (isLastColumn && containerWidthRef.current > totalWidth) {
     return { width: 'auto', minWidth: column.minWidth };
   }
   ```
   > `skip reading for the last column, because it expands to fully fit the container`

   **차용: 싱크는 「마지막」이라는 자리다. 특정 열이 아니라서 어떤 열을 드래그해도 사라지지 않는다.**
   <https://github.com/cloudscape-design/components/blob/main/src/table/use-column-widths.tsx>

2. **WinForms DataGridView — Fill mode / FillWeight** — 같은 문제의 가장 완전한 명세(2005).
   > any columns with a size mode of **Fill** will share the display-area width that is not used by
   > the other columns … divided among the fill-mode columns **in proportions relative to their FillWeight**
   >
   > When a user resizes a fill-mode column, any fill-mode columns **after** the resized column are also
   > resized to compensate … **If there are no other fill-mode columns in the control, the resize is ignored.**
   >
   > does not display the horizontal scroll bar except when it is necessary to keep the width of every
   > column equal to or greater than its **MinimumWidth**

   차용: 흡수 열이 **여럿**이고 가중치를 가진다 · 하나뿐이면 드래그를 **무시**한다(채움을 깨느니 제스처를 버림) ·
   하한이 안 맞을 때만 가로 스크롤 = 오너가 요청한 동작.
   <https://learn.microsoft.com/en-us/dotnet/desktop/winforms/controls/column-fill-mode-in-the-windows-forms-datagridview-control>

3. **Azure Monitor workbook grid** — 오너가 지목한 Azure. 열 너비 단위 체계.
   > units … **ch** (default) · **px** · **fr** (fractional units) · **%**
   > static units (ch and px) are **hard constants** … columns set with **fr split up the remaining grid space**
   > based on the number of fractional units they're allotted … dynamic columns have a **minimum width based on their contents**

   차용: **한 표 안에서 단위를 섞는다.** 짧은 열은 px, 길이가 변하는 열만 자란다.
   <https://learn.microsoft.com/en-us/azure/azure-monitor/visualize/workbooks-grid-visualizations>

4. **ag-Grid Column Sizing** — flex 모델.
   > dividing the remaining space … in proportion to their flex value … will also take **maxWidth** into account
   > If you manually resize a column with flex … **flex will automatically be disabled for that column**
   > [Shift] the column will take space away from the column adjacent to it … **the total width for all columns will be constant**

   "드래그하면 flex 해제"는 우리와 **동일**. 차이는 flex 열이 여러 개라는 것 하나.
   <https://www.ag-grid.com/javascript-data-grid/column-sizing/>

5. **MUI X DataGrid** — 실패 모드를 명시.
   > `flex` doesn't work if the combined width of the columns that have `width` is more than the width of the
   > data grid itself … a scroll bar will be visible, and the columns that have flex will **default back to 100px**

   차용: 하한을 못 맞추는 상태의 폴백을 정해 둬야 한다(답: 자기 하한).
   <https://mui.com/x/react-data-grid/column-dimensions/>

6. **Fluent UI DetailsList (justified)** — ⚠️ **반증**. Azure 이전 세대 그리드가 우리와 **완전히 같은 버그**.
   > DetailsList **switches to fixedColumns layout when any column is resized**, regardless of the layoutMode prop
   > Users would expect … **the rest of columns to adapt themselves** to keep the justified original intention

   2017년 이슬로 9년째 미해결 → **사후 패치가 아니라 모델을 바꿔야 한다**는 근거.
   <https://github.com/microsoft/fluentui/issues/517> · <https://github.com/microsoft/fluentui/issues/16332>

7. **Fluent `flexGrow` 우회** — justified를 포기하고 전 열에 지분을 준다. 시안 D의 논거.
   <https://github.com/microsoft/fluentui/discussions/23280>

8. **Syncfusion Grid resize mode** — 우리가 오간 두 상태에 이름을 붙인 유일한 곳.
   > **Normal** — total < grid width: **Empty space appears to the right** / total > grid: scrollbar
   > **Auto** — total < grid width: **Columns expand proportionally to fill space**

   우리의 "드래그 후" = Normal, 오너가 원하는 것 = Auto. 다만 Syncfusion의 Auto는 숫자 열까지 늘리는 전면 비례라 과함.
   <https://ej2.syncfusion.com/angular/documentation/grid/columns/column-resizing>

9. **Oracle APEX — Stretch Column Widths** — 이 결정을 사용자에게 넘긴 유일한 사례.
   > the interactive grid automatically takes up the width of your screen, **even if you resize some of the columns to be smaller**

   시안 E의 근거. R14 판례와 충돌.
   <https://docs.oracle.com/en/database/oracle/apex/22.2/aeeug/toggling-stretch-column-widths.html>

10. **Telerik Blazor Grid** — ⚠️ **반증**. 「이웃에서 뺏어 온다」를 사용자가 버그로 접수.
    > resizing a single column … **every column between the original location … and its new location are resized**
    > the problem manifests itself only if the **'width' is not set on the `<table>` element**

    시안 A 기각의 직접 근거.
    <https://www.telerik.com/forums/resizing-a-column-in-the-grid-causes-other-columns-to-resize>

11. **Retool** — ⚠️ **반증**. 오너가 본 증상과 같은 제목의 스레드, 벤더가 버그로 인정.
    > a white space at the right of the last column … **a Retool bug** [workaround: 폭 초기화 후 새로고침]

    이 상태는 취향이 아니라 업계가 결함으로 취급. 그리고 유일한 우회가 우리가 R14에서 없앤 버튼.
    <https://community.retool.com/t/columns-do-not-fill-up-table-awkward-empty-space-on-right-hand-side/20439>

12. **TanStack Table** — headless. `size`/`minSize`/`maxSize` 상태만 주고 레이아웃은 호출자 몫.
    > table logic for column sizing is really only a collection of states that you can apply to **your own layouts**

    12종 중 CSS에 위임하는 곳이 없다는 증거.
    <https://tanstack.com/table/v8/docs/guide/column-sizing>

## 4. 시안 5 (판 2400px 실측)

| 시안 | Name | Resource ID | 나머지 5열 | 빈 공간 |
|------|------|-------------|-----------|---------|
| 현재 드래그 전 | 162 | **1598** | 불변 | 0 |
| 현재 드래그 후 | 162 | 381(고정) | 불변 | **1217 (페이지 배경)** |
| **A** 이웃에서 뺏기 | 162 | 1598 | **움직임** | 0 |
| **B** 지분만 | 394 | 1366 | 불변 | 0 (드래그 전에만) |
| **C** 싱크는 자리 ★ | 394 → **1379**(인계 시) | 1366 → 381 | 불변 | **0 (항상)** |
| **D** 지분+스페이서 | 394 | **452** | 불변 | 915 (표 안) |
| **E** 사용자 토글 | — | — | — | 0 |

## 5. 비교표

| 시안 | D1 채움 유지 | D2 한 열 비대 | D3 빈 공간 | 구현 | 기존 화면 일관성 |
|------|-------------|--------------|-----------|------|----------------|
| 현재 #754 | ✗ 고정 전환 | ✗ 1598 | ✗ 1217 | — | — |
| A 이웃 | ✓ | ✗ 1598 | ✓ | 중 | ✗ 안 만진 열이 움직임 (ref 10) |
| B 지분만 | ✗ | △ 1366 | ✗ | 저 | ✓ |
| **C 싱크는 자리** | **✓ 인계** | △ 1366 | **✓ 0** | **저 ~15줄** | **✓ Cloudscape 원본 규칙** |
| D 스페이서 | ✓ | ✓ 452 | △ 표 안 915 | 저 | △ 무명 헤더 셀 |
| E 토글 | ✓ | ✗ | ✓ | 중 | ✗ R14 판례 충돌 |

## 6. 채택 — 시안 C

**싱크를 정체성이 아니라 자리로 정의한다: 「고정되지 않은 마지막 flex 열」.**
사용자가 그 열을 고정하면 역할이 앞 열로 인계된다. 채움을 잃으려면 flex 열을 **전부** 고정해야 한다.
싱크가 아닌 flex 열은 **자기 하한의 지분(%)** 으로 자란다.

```ts
const flexing = columns.filter((c) => c.flex && !resize?.widthOf(c.key));
const sink = flexing.at(-1) ?? null;

// th width
key === sink   ? 'auto'
: isFlexing    ? `${(col.width / columnSum) * 100}%`   // 하한 비율 = 지분
               : col.width;                            // px, 정확
```

C만이 D1·D3를 동시에 풀면서 구현 비용이 최저이고, JS 측정이 필요 없다(§2 실측 덕분).

### 6.1 정정 — 「고정되지 않은」은 여전히 역할을 비운다 (오너 재보고)

위 술어는 **flex 열을 전부 고정하면 `sink === null`** 이 된다. 그런데 이 표에서 flex 열은
Resource Name·Resource ID 둘이고, **그 둘이 정확히 사용자가 끄는 두 열**이다. 실측:

| 제스처 | 표 | 결과 |
|---|---|---|
| ID +40 | `w-full` minW 1027 | name `auto`, id 239px |
| Name +25 | **`width: 1052px`** | **채움 상실** — 판 2700에서 1648px 공백 |

Round 19가 정체성으로 비웠다면 Round 20은 **「미고정」이라는 조건으로** 비웠다. 같은 결함의 두 번째 판.

**확정 규칙: 싱크는 「마지막 flex 열 중, 마지막으로 조정한 열을 뺀 것」.** flex 열이 하나라도
선언돼 있으면 절대 null 이 아니다.

```ts
const flex = columns.filter((c) => c.flex);
const free = flex.filter((c) => c.key !== resize?.lastResizedKey);
const sink = flex.length === 0 ? null : (free.at(-1) ?? flex.at(-1)).key;
```

조정 중인 열을 빼는 이유는 따로 있다: **싱크는 채워지는 열이지 크기를 정하는 열이 아니다.**
싱크를 끌면 표의 하한이 판을 넘어설 때까지 폭이 1px도 안 움직인다(판 1600·하한 988이면 612px
데드존). 역할을 상대에게 넘기면 두 열이 **split pane** 처럼 움직인다 — 끄는 열은 포인터를
정확히 따라오고, 다른 열이 나머지를 먹는다. 고정 px 열 다섯은 어느 경우에도 안 움직인다.

`useColumnResize` 가 `lastResizedKey` 를 내놓는다. 스토리지 복원은 여기 해당하지 않는다 —
아무도 열을 겨냥하지 않았다.

실측(판 990 → zoom 0.5 로 판 2700, **두 flex 열 모두 고정된 상태**):

| 판 | 표 폭 | 공백 | Name | ID |
|---|---|---|---|---|
| 990 | 1032 (스크롤) | 0 | 227 고정 | 179 |
| 1418 | 1418 | **0** | 227 고정 | 565 |
| 2131 | 2131 | **0** | 227 고정 | 1278 |
| 2700 | 2700 | **0** | 227 고정 | 1847 |

flex 열이 **하나뿐인** 표는 예외로 자기가 계속 싱크다(폴백). 그 열의 드래그는 채움 폭에서
소프트 플로어에 걸린다 — Cloudscape 와 같은 거동이고, 채움을 잃는 것보다 낫다.
**가능하면 flex 를 둘 선언하라.**

**남는 것은 D2(ID 1366px) 하나.** 보존 법칙이라 공짜 해법이 없다 — 2400px 판에 1400px 여유가 있고
쓸 수 있는 열이 둘뿐이니 **누군가는 부풀거나 어딘가는 빈다**. 지난 턴 오너 결정("상한 없음")을 따라 C.
과하다고 판단되면 **시안 D로 한 줄 전환**이고 그때 ID는 452px에서 멈춘다.

§6.1 이후 이 수치는 더 커진다: 상대 flex 열이 **고정돼 있으면 지분을 못 받으므로** 새 여유가
전부 싱크로 간다(판 2700에서 ID 1847px). 상한이 필요하다는 판단이 서면 그때가 시안 D다.

## 7. 기각

- **A 이웃에서 뺏기** — 손대지 않은 열이 움직이는 건 사용자에게 버그로 읽힌다 (ref 10)
- **E 사용자 토글** — C가 기본값을 옳게 만들면 불필요. R14의 「열 너비 초기화」 제거 판례와 충돌
- **JS 측정(ResizeObserver + `<col>` 명령형 쓰기)** — 나머지 11종이 다 하는 방식이지만,
  §2 실측상 CSS로 D1·D3가 풀리므로 아직 값을 못 한다. ID 절대 상한이 필요해지면 그때.

## 8. 이 문서가 다루지 않는 것

- ID 열의 절대 `maxWidth` — CSS만으로는 시안 D 형태로만 가능.

## 9. 확산 — Step 2·3 (후속 PR)

원래 §8은 "각 표에서 오늘 폭 선언이 없는 열(`제외 사유`·`접근 허용 상태`·`Status`)이 그 표의
싱크 후보라 확산 비용은 오히려 내려간다"고 적었다. **세 군데가 틀렸다.**

**(a) 다른 Step 표에는 애초에 이 병이 없었다.** 전부 `w-full` **auto** 레이아웃이라
(`table-fixed` 아님) 정의상 판을 채우고, 드래그가 없으니 굳을 경로도 없다. 확산의 명분은
"빈 공간"이 아니라 **열 폭이 내용에 끌려다니는 것**이다.

**(b) 싱크 후보를 잘못 짚었다.** 폭 선언이 없다는 건 "지금 auto"라는 뜻이지 "값이 길다"는 뜻이
아니다. 싱크는 여유의 ~80%를 가져가므로 **픽셀이 값을 하는 열**이어야 한다. 실측: `제외 사유`를
싱크로 두면 판 2700에서 **1620px(표의 60%)** 를 먹는데, 그 열은 `ReasonCell` 이 대상 행에서
`null` 을 반환하고 제외 행에서도 `clampReason(...)` 요약 칩만 그린다 — **넓혀도 더 보여줄 게 없다.**
→ Step 2·3 의 flex 는 confirmed 와 같은 **Resource Name · Resource ID**, `제외 사유` 는 230px 고정.

**(c) flex 하나로는 부족하다**(§6.1). 표마다 긴 값 열 **둘**이 필요하다.

비용은 반대로 §8 추정보다 **낮았다**. 행 렌더러가 이미 variant 공용이고 셀 문법이 불리언
하나(`coveredCell`)에 걸려 있어, 실제 작업은 열 스펙 + 셸 분기 + 그 불리언의 확장이었다.

### Step 2·3 스펙 (구현됨)

| 열 | 하한 | 출처 | flex |
|---|---|---|---|
| Resource Name | **250** | 오너 지시 + 행별 실측 | ● |
| Resource ID | 186 | confirmed 와 동일 | ● 싱크 |
| Database Type | 142 | confirmed 와 동일 | |
| Region | 156 | confirmed 와 동일 | |
| 요청 대상 여부 | 112 | `IdcResourceTable` | |
| 제외 사유 | **142** | 남은 예산 | |

합계 988 = confirmed 의 하한이라 같은 판에서 둘 다 스크롤하지 않는다.

**Name·제외 사유 배분은 오너 지시**(2026-08-23: "제외사유에 너무 많은 width를 할당한듯. resource
name, resource id가 더 중요해" / "resource name은 축약어로 보여지는 현상"). 실측 근거:

- `제외 사유` 는 1007 의 **9행 전부 비어 있었다.** 최대치도 `clampReason` 의 15자 + 확장 칩이다.
  230 은 그 최악값에 맞춘 폭이고, 142 는 평상값에 맞춘 폭이다. **여유는 전부 여기서 나왔다.**
- `Resource Name` 은 303 이 필요한데 162 였다 — 그 차이가 오너가 본 축약이다. 250 에서 **9행 중
  6행이 잘리지 않는다.** 남은 셋은 264 짜리 이름 하나(13px 부족)와 `dynamodb:<acct>:<region>`
  두 건 — 이름 열을 입은 식별자다.
- `Resource ID` 는 186 유지. ARN 은 645 가 필요해 어떤 하한으로도 못 채우고, 싱크라 하한 위로는
  전부 가져간다.

⛔ 셋이 동시에 커질 수는 없다. 콘텐츠 합이 ~1500 인데 판은 990 이라, Name 의 지분을 키우면 넓은
화면에서 ARN 의 몫이 줄어든다. 그게 위 순위가 사는 거래이고, 드래그가 한 세션 동안 그걸 되돌린다.

실측(`/pass/target-sources/1007`, 판 990):

| | 판 | 표 폭 | Name | ID | 나머지 4열 |
|---|---|---|---|---|---|
| 기본 | 990 | 990 | 251 | 188 | 불변 |
| zoom 0.7 | 1723 | 1723 | 436 | 735 | 불변 |
| zoom 0.5 | 2700 | 2700 | 683 | 1465 | 불변 |
| ID·Name 둘 다 고정 + zoom 0.5 | 2700 | **2700** | 고정값 유지 | 나머지 전부 | 불변 |

### 그룹 행의 셋째 줄 제거

오너 지시(2026-08-23): Athena 그룹 부모 행의 `데이터베이스 · 대상 N · 제외 N` 삭제. 그룹을 펼치면
행들이 같은 말을 하고, `요청 대상 여부` 열이 행마다 판정을 이미 들고 있다. Step 1 의 후보 표는
그대로 둔다 — 거기는 그룹을 **고르는** 화면이지 **검토하는** 화면이 아니다.

### 남은 Step

`install`(Step 4)은 `identityColumns` 를 호출자가 주입하고 그 폭이 Tailwind 클래스라
(`table-fixed` 가 못 읽는다) 아직 레거시 셸이다 — 그 필드에 숫자 폭을 주는 것이 Step 4 작업의
시작점이다. Step 1(`CandidateResourceTable`)·Step 5(`ConnectionTestCard`)는 별도 컴포넌트라
각자 스펙이 필요하다.

---

측정 환경: Chrome, 창 1710×, dPR 2, dev 서버 `/pass/target-sources/1012`,
판 폭 990px (브라우저 1710 − 좌우 레일 720).
