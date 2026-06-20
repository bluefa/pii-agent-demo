# IDC v15 — Design Verification (element-by-element vs `SIT Prototype Athena v15.html`)

> **상태: PRE-FIX 감사 스냅샷.** 이 문서는 수정 *이전* 상태를 기록한 감사 결과다. 이후 PR에서
> Bucket A(스텝 2~7 subtitle·상태 pill·배너·액션 버튼 복원, Step4 2-up)·Bucket B(배지/health/필드색/팝오버/
> 불러오기 토큰)·Bucket C(IDC-scoped: Modal `chrome="toss"`/`tone`, 52px footer, borderless input,
> 13/700 비대문자 테이블 헤더)를 모두 반영했고, codex 교차검증 3회로 후속 항목(불러오기 hook+스켈레톤,
> 실제 취소 플로우, Step4 installation-status 병합, swagger 정합, BAD_REQUEST→400 매핑)까지 정리했다.
> 즉 아래 "현재 결함"으로 적힌 항목 대부분은 **해결됨** — 본 문서는 무엇을 점검했는지의 기록으로 본다.

Audited the shipped IDC UI against the v15 HTML mockup, every element (layout, copy,
font-size, font-weight, color, padding/margin/gap, border-radius). Six read-only
agents covered: shared cells/tokens, Step 1 list, Step 1 modals, Steps 2/3, Step 4
+ firewall modal, Steps 5/6/7. Shared baseline components (`Modal`, `Button`,
`Badge`, inputs, `tableStyles`) were cross-checked against the cloud siblings
(`WaitingApprovalCard`, `ConnectionVerifiedStep`, …) and `ProcessStatusCard` to
separate IDC-specific defects from app-wide design-system gaps.

Findings split into three buckets:

| Bucket | What | Blast radius | In scope w/o asking? |
|---|---|---|---|
| **A. IDC content omissions** | Steps 2–7 drop per-step subtitle / status pill / banner / action buttons that the HTML **and** the cloud siblings render | IDC only | Yes — clear bugs |
| **B. IDC-unique token bugs** | IDC-only components use wrong hex/size (kind badge, health, field warn/err, add-IP, SID, popover, load icon, Step 4 grid) | IDC only | Yes — clear bugs |
| **C. App-wide chrome gap** | Shared `Modal`/`Button`/`Badge`/input/table use generic Tailwind tokens that differ from the prototype's Toss styling — for **all** providers | AWS/Azure/GCP/IDC | **No — needs a scope decision** |

---

## Bucket A — IDC content omissions (vs HTML + cloud siblings)

The IDC step components render only `ProjectPageMeta + ProcessStatusCard + GuideCard +
<Card title> + IdcResourceTable + RejectionAlert`. `ProcessStatusCard` renders only the
progress bar — so every per-step subtitle / pill / banner / action below is genuinely
absent (the cloud siblings render them).

### Step 2 — 연동 대상 승인 대기
- Missing card **subtitle** (요청일시 + 승인자 meta line).
- Missing **status pill** `승인 대기`.
- Missing **info banner** "관리자 승인을 기다리고 있어요. 평균 1영업일 내 검토되며…".
- Missing **`전체 요청 취소`** button (`action` is hardcoded to `DeleteInfrastructureButton`; cloud wires `WaitingApprovalCancelButton`).
- Column header `연동 대상 여부` vs HTML `연동 대상 / 제외 사유`.

### Step 3 — 연동 대상 반영중
- Missing **subtitle** (승인일시 + 승인자).
- Missing **status pill** `반영중`.
- Missing **success banner** "승인이 완료되어 시스템에 반영 중입니다. 평균 5분 내외…".

### Step 4 — 설치중
- Install pipeline uses shared `InstallTaskPipeline` → **3-column grid** (2 IDC tasks leave a blank 3rd column); HTML is `cols-2` (2-up).
- Install cards **centered**; HTML is left-aligned.
- Extra `설치 진행 상태` heading + `설치 상태 새로고침` button (not in HTML; acceptable live-polling affordance).
- Firewall modal + resource table columns: **faithful** (title/subtitle, all 5 fw columns incl. `→` fg-4 arrow, host-only endpoint, mono port, badge labels).

### Step 5 — 연결 테스트
- Missing **subtitle** "DB 접근 정보 사전 등록 및 보안 통신/방화벽 ACL, Agent 연결 여부를 점검합니다.".
- Missing footer helper "※ 모든 DB의 Connection Status가 Success여야 다음 단계로 진행할 수 있어요.".
- Missing **`완료 승인 요청`** button.
- Run-test simulation + `src conn` columns: faithful.

### Step 6 — 완료 여부 관리자 승인 대기
- Missing **subtitle** "PII Agent 운영팀의 최종 승인이 완료되면 모니터링이 시작됩니다.".
- Missing **status pill** `승인 대기`.
- Missing **waiting banner** "최종 관리자 승인을 기다리고 있어요. 승인이 완료되면 모니터링이 즉시 시작됩니다.".
- Missing **`연결 테스트 재실행`** button.

### Step 7 — PII 모니터링 모듈 연동 완료
- Missing **subtitle** "PII가 사용되어 있을 가능성이 있어요. 변경·추가 시 프로세스를 재수행하여 Agent 설치까지 진행됩니다.".
- Missing **status pill** `Healthy`.
- Missing **`인프라 변경`** + **`연결 테스트 재실행`** buttons.

> Column sets per step are all correct: S2/S3 `src excl`, S4 `src fw`, S5/S6 `src conn`, S7 `src health`.

---

## Bucket B — IDC-unique token / style bugs (IDC-only components)

| # | Element | HTML spec | Impl now | Sev |
|---|---|---|---|---|
| B1 | Kind badge — single | bg `#E8F1FF` / text `#1747B5` | `tagStyles.blue` = `#DBEAFE`/`#1E40AF` | MAJOR |
| B2 | Kind badge — multi | bg `#FEF0E1` / text `#7A3F0E` | `tagStyles.orange` = `#FFEDD5`/`#9A3412` | MAJOR |
| B3 | Kind badge — domain | bg `#EEF2FF` / text `#4338CA` | `tagStyles.indigo` = `#E0E7FF`/`#3730A3` | MAJOR |
| B4 | Kind badge padding | `3px 8px` | `py-0.5` = 2px vertical | MINOR |
| B5 | **Health cell** | `.status`: bare text+dot, 12.5px/500, dot **8px**, no bg/pad/radius | filled `Badge` pill, dot 6px | BLOCKER |
| B6 | Health unhealthy dot | `#991B1B` (error-dark) | `#EF4444` (red-500) | MAJOR |
| B7 | Endpoint toggle | 11.5px / **600** / **primary** | 11.5px / 500 / gray-500 | MAJOR |
| B8 | SID key (`idc-sid-k`) | fg-4, **bare** (no bg/pad/radius), 10px, ls .02em | gray-700, `bg-gray-100 rounded px-1`, 10.5px | MAJOR |
| B9 | `+ IP 추가` (`idc-add-ip`) | **primary** text, **no border**, 600, radius 6, hover primary-light | dashed gray border, gray text, 500 | MAJOR |
| B10 | Remove-IP (`rm-ip`) | **30×30**, no border, hover `#FEECEC`/`#B42318` | 36×36, border, gray hover | MAJOR |
| B11 | Row actions (edit/del) | **26×26**, no border, del:hover `#FEECEC`/`#B42318` | 28×28, border, no del variant | MAJOR |
| B12 | Field warning | `#B45309`, 11.5px, leading `⚠` | `#9A3412` (orange-800), 12px, no glyph | MAJOR |
| B13 | Field error | `#DC2626`, 11.5px | `#EF4444` (red-500), 12px | MAJOR |
| B14 | Exclusion popover — selected | weight **700** | weight 500 | MAJOR |
| B15 | Exclusion popover — custom row | always primary/600 + top divider | gray until active, no divider | MAJOR |
| B16 | Load modal — header icon | **amber** circle `#FEF3C7`/`#B45309` (warn/overwrite) | blue square (Modal hardcodes `statusColors.info.bg`) | MAJOR |
| B17 | Host text color | fg-1 | gray-700 (secondary) | MINOR |

---

## Bucket C — App-wide design-system chrome (shared components; affects all providers)

These are **not** IDC-specific: `Modal`/`Button`/`Badge`/input/`tableStyles` use generic
Tailwind tokens that differ from the prototype's Toss values, identically for AWS/Azure/GCP/IDC.

### Modal footer buttons — exact measurements (explicit request)

| Element | HTML (v15) | Impl | Match |
|---|---|---|---|
| Footer alignment | `flex; justify-content: flex-end` (right) | `flex justify-end` (right) | ✅ position |
| Footer gap | 10px | 12px (`gap-3`) | ✗ |
| Footer background | `#fff` (white) | `bg-gray-50` `#F9FAFB` | ✗ |
| Footer border-top | `#EBEEF2` | `#F3F4F6` (gray-100) | ✗ |
| Footer padding | `20px 40px 24px` | `16px 24px` (`px-6 py-4`) | ✗ |
| **Right btn height** (확인/불러오기/제출) | **52px** | ~36px (`py-2`) | ✗ |
| Right btn radius | 14px | 8px (`rounded-lg`) | ✗ |
| Right btn font | 15px / **700** | 14px / 500 (`font-medium`) | ✗ |
| Right btn color | `#0064FF` / `#fff` | `#0064FF` / `#fff` | ✅ color |
| **Left btn height** (취소/머무르기) | **52px** | ~36px | ✗ |
| Left btn style | transparent + `#4E5968` text (outline) | `bg-gray-100` `#F3F4F6` fill + gray-700 (secondary) | ✗ |
| Left btn radius / font | 14px / 15px / 600 | 8px / 14px / 500 | ✗ |
| Disabled right btn | solid `#EBEEF2` fill + `#8B95A1` text | `opacity-50` (translucent blue) | ✗ |

> Net: button **position** (left cancel / right confirm, right-aligned) and the primary
> button **color** match; **height (52→36), radius, font weight, left-button fill, footer
> background, disabled style** all differ — every one inherited from the shared
> `Modal`/`Button`.

### Other shared chrome
- **Modal shell**: radius 12 vs 24; title 18px/700 vs 26px/800 (or 20px); subtitle gray-500 vs `#8B95A1`/500; body `p-6` vs `28px 40px`.
- **Badge** (firewall / conn / DB-type): `rounded-full` pill + `statusColors` hexes vs `.tag` radius-8 + exact hexes (green `#E5F8EE`/`#197A3F`, red `#FEECEC`/`#B42318`, orange `#FEF0E1`/`#7A3F0E`, blue `#E8F1FF`/`#1747B5`).
- **`soft` / `warnOutline` button tokens**: `soft` = `bg-blue-50` `#EFF6FF` vs `#E8F1FF`; `warnOutline` = `amber-50/amber-700/border` vs `#FEF3C7`/`#92400E`/no-border.
- **Inputs**: white-bordered `rounded-lg px-4 py-3` vs borderless `#F7F8FA` fill, radius 12, height 52.
- **Table header**: `uppercase text-xs text-gray-500` vs 13px/700 `#4E5968` non-uppercase; cell `px-6 py-4` vs `14px 16px`.
- **Read-only step tables**: no pagination row (HTML shows one).

---

## "기존 연동 요청 정보 불러오기" — functional verification

**Functionally correct and matches the HTML behavior.**

| Aspect | HTML `confirmIdcLoad()` | Impl | Match |
|---|---|---|---|
| Data source | global `IDC_PREV_REQUEST` (7 rows) | `getIdcPreviousRequest()` → mock `IDC_PREV_REQUEST_SEED` (7 rows) | ✅ |
| Preview pagination | 5 / page (`IDC_LOAD_PER`) | 5 / page (`IDC_LOAD_PER`) | ✅ |
| Meta line | 불러올 N건 · 연동 N건 · 제외 N건 | same | ✅ |
| Confirm action | **replace** working list w/ deep clone, re-render, close | `setRows(resources.map(toRow))` + `setPage(0)` + close (full replace) | ✅ |
| Empty state | "불러올 기존 연동 정보가 없어요" | same copy | ✅ |
| Trigger / confirm labels | `기존 연동 요청 정보 불러오기` / `불러오기` | same | ✅ |

Only **visual** gaps remain (Bucket B16 amber header icon; Bucket C modal chrome;
empty-state styling, meta `strong` color). The feature itself works.

---

## Recommendation

- **Bucket A + B** are unambiguous IDC defects → fix to match the HTML exactly.
- **Bucket C** is the design-system fork (touches all providers) → needs a decision:
  1. **IDC-scoped exact match** — apply prototype values via IDC-only styling/tokens; siblings untouched (IDC looks more refined than AWS/Azure/GCP). Surgical, no regression risk.
  2. **App-wide migration** — change shared `Modal`/`Button`/`Badge`/input/table to prototype values; all providers match; larger blast radius + regression risk.
  3. **Leave shared chrome** — fix only A + B; modal button height (52 vs 36) etc. stay consistent with siblings.
