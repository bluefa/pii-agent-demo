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

**남는 것은 D2(ID 1366px) 하나.** 보존 법칙이라 공짜 해법이 없다 — 2400px 판에 1400px 여유가 있고
쓸 수 있는 열이 둘뿐이니 **누군가는 부풀거나 어딘가는 빈다**. 지난 턴 오너 결정("상한 없음")을 따라 C.
과하다고 판단되면 **시안 D로 한 줄 전환**이고 그때 ID는 452px에서 멈춘다.

## 7. 기각

- **A 이웃에서 뺏기** — 손대지 않은 열이 움직이는 건 사용자에게 버그로 읽힌다 (ref 10)
- **E 사용자 토글** — C가 기본값을 옳게 만들면 불필요. R14의 「열 너비 초기화」 제거 판례와 충돌
- **JS 측정(ResizeObserver + `<col>` 명령형 쓰기)** — 나머지 11종이 다 하는 방식이지만,
  §2 실측상 CSS로 D1·D3가 풀리므로 아직 값을 못 한다. ID 절대 상한이 필요해지면 그때.

## 8. 이 문서가 다루지 않는 것

- 나머지 12개 표로의 확산. 이 PR은 공용 셸만 고친다. 다만 각 표에서 오늘 폭 선언이 없는 열
  (`제외 사유`·`접근 허용 상태`·`Status`)이 그 표의 싱크 후보라 확산 비용은 오히려 내려간다.
- ID 열의 절대 `maxWidth` — CSS만으로는 시안 D 형태로만 가능.

---

측정 환경: Chrome, 창 1710×, dPR 2, dev 서버 `/pass/target-sources/1012`,
판 폭 990px (브라우저 1710 − 좌우 레일 720).
