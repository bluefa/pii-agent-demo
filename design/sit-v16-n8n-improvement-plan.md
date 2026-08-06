# SIT v16 — N8N 스타일 개선 계획 (Admin Pipeline Node Canvas)

> 대상 파일: `design/SIT Prototype Athena v16 (n8n).html` (단일 standalone HTML, 12,469줄)
> 범위: **Admin Pipeline 노드 플로우만** n8n 스타일 노드 캔버스로 재설계. 다른 화면/뷰는 절대 건드리지 않는다.
> 토큰: 신규 색상 발명 금지. 기존 CSS 변수 / hex만 재사용.

---

## 0. 현재 상태 (As-Is) — 코드 근거

| 요소 | 위치 | 현재 구현 |
|------|------|-----------|
| CSS `.adm-flow` / `.adm-node` / `.adm-link` / `@keyframes admNodePulse*` | 5089–5165 | 가로 flexbox 한 줄, 카드 178px, 연결선은 `.adm-link::before/::after` 의사요소(직선 + 삼각형 화살표) |
| `admTaskPanel(p, pi)` | 12319–12349 | 펼친 행 안에서 `.adm-flow` 한 줄 렌더. node + link 직렬 |
| `admMiniFlow(items)` | 12350–12362 | install 탭 미니 미리보기. 동일 `.adm-flow` 재사용 |
| Pipeline Board 뷰 컨테이너 | 7411–7430 | `data-aview-panel="pipeline"` → 카드 + 테이블. 행 클릭 시 `admTaskPanel` 펼침 |
| 데이터 모델 | 11483–11504, 12267–12289 | `tasks[]={name,kind,state,meta,poll,ttl,maxFail,fail}` · `kind: WAIT|EXEC` · `state: DONE/RUNNING/WAITING/QUEUED/FAILED/EXPIRED` |

**문제점 (As-Is 기준):**
1. 노드가 한 줄 가로 나열 — DAG가 아니라 단순 리스트처럼 보인다.
2. kind 배지가 stale: `EXECUTE` / `WAIT_EXTERNAL` (ADR-016에서 폐기됨).
3. state가 5종으로 뭉뚱그려짐 — ADR-016의 9종 모델을 표현 못 함.
4. 노드를 눌러도 인스펙터가 없다. 편집 모달(`admOpenTask`)만 존재.
5. 입출력 포트, 베지어 엣지, pan/zoom, 미니맵 등 "workflow canvas" 시각 언어가 전무.

---

## 1. 정보 구조 (Information Architecture)

3-레이어로 분리한다. 모두 Pipeline Board 뷰(7411–7430) 내부에 호스팅한다.

```
data-aview-panel="pipeline"
├─ adm-page-head           (그대로 유지)
├─ adm-cards #admPipeCards  (그대로 유지 — KPI 요약)
└─ card  (테이블)
   └─ 행 클릭 → admTaskPanel  ← 여기를 "row-expand 한 줄"에서 "노드 캔버스"로 교체
      └─ .n8n-stage          (호스트, position:relative, overflow:hidden, height 고정)
         ├─ .n8n-toolbar     (좌상단 floating — zoom/fit/방향)
         ├─ .n8n-viewport    (pan/zoom transform 적용 레이어)
         │  ├─ <svg class="n8n-edges">   (노드 뒤 z-index, 엣지 전부)
         │  └─ .n8n-node × N             (절대좌표 배치)
         ├─ .n8n-minimap     (우하단 floating)
         └─ .n8n-inspector   (우측 슬라이드인 패널 — 노드 클릭 시)
```

- **Board 헤더 확장(ADR-016):** `adm-page-head` 우측 또는 펼친 캔버스 헤더에 **slot 게이지(`slotsInUse/slotCap`)** 와 **next-check 카운트다운**을 둔다. (슬롯 대기 = `READY AND kind=TERRAFORM_JOB`)
- **Mini flow(install 탭)** 는 동일한 노드 anatomy를 쓰되 toolbar/minimap/inspector 없이 **읽기 전용 정적 캔버스**(pan/zoom off, 자동 fit)로 렌더한다 → `admMiniFlow`는 `admTaskPanel`과 노드 마크업 헬퍼를 공유.

---

## 2. 노드 해부 (Node Anatomy)

`.n8n-node` (width 196px, 절대좌표). 위→아래 5영역:

```
┌─[in ●]──────────────────────[● out]─┐   ← 좌/우 핸들 포트 (.n8n-port.in / .out)
│  ⟨kind badge⟩            ⟨status dot⟩│   ← 1줄: kind 배지 + 상태 점
│  [ico]  operation name              │   ← 2줄: 아이콘 + 오퍼레이션 id (mono)
│  status label · 메트릭 라인          │   ← 3줄: 상태 한국어 라벨 + metric
│  fail 3/3 · check 12회 · TTL D-2     │   ← 4줄(조건부): 메트릭 칩들
└─────────────────────────────────────┘
```

### 2.1 Kind 배지 (ADR-016 — old EXECUTE/WAIT 교체)
| TaskKind | 배지 텍스트 | 색 토큰 |
|----------|------------|---------|
| `TERRAFORM_JOB` | `TERRAFORM` | primary 계열 `#0064FF` on `#E8F1FF` |
| `GENERAL_JOB` | `JOB` | medium-text `#4E5968` on `#F2F4F6` |
| `CONDITION_CHECK` | `CHECK` | warning 계열 `#B45309` on `#FFFBEB` |

> 데이터 마이그레이션: 기존 `kind:'WAIT'` → `CONDITION_CHECK`, `kind:'EXEC'` → TF 실행이면 `TERRAFORM_JOB`, 그 외 `GENERAL_JOB`. seed(11486–11502, 12268–12286)와 `admStartPipeline`의 `dag` 매핑을 함께 갱신.

### 2.2 Status 점 + 노드 테두리 (9-state → 시각)
ADR-016 9-state를 보드 그룹 라벨로 묶어 색을 정한다. **팔레트는 기존 그대로 재사용**.

| state | 그룹 라벨(한국어) | 노드 class | 테두리/점 |
|-------|------------------|-----------|-----------|
| `BLOCKED`, `READY` | 대기 | `.is-waiting-q` | dashed `--toss-divider`, 회색 점 |
| `DISPATCHING`, `RUNNING` | 실행 중 | `.is-running` | `#0064FF` + `admNodePulse` |
| `WAITING_EXTERNAL` | 외부 대기 | `.is-extwait` | `#FCD34D` + `admNodePulseAmber` |
| `DONE` | 완료 | `.is-done` | `#A7F3D0` / 점 `#059669` |
| `FAILED` | 실패 | `.is-failed` | `#FCA5A5` + glow `rgba(239,68,68,.10)` |
| `EXPIRED` | 타임아웃 | `.is-expired` | `#FCA5A5` dashed (failed와 구분 위해 점선) |
| `CANCELLED` | 중단 | `.is-cancelled` | `--toss-weak-text`, opacity .6 |

> `READY AND kind=TERRAFORM_JOB` 인 경우 메트릭 라인에 **"슬롯 대기"** 칩을 추가(WAITING_SLOT 제거 대응).

### 2.3 메트릭 라인 (4줄)
state별 조건부:
- 실행 중: `경과 3분` / `dispatch 시도 중`
- 외부 대기: `확인 12회 · 마지막 06-14 13:40 · D-2` (TTL 카운트다운)
- 실패: `fail 3/3 · CALL_TIMEOUT` (errorCode)
- 완료: `06-10 14:02 · 6분`

### 2.4 포트 (n8n 핸들)
- `.n8n-port` = 9px 원, 좌(in)·우(out) edge 중앙. `box-shadow:0 0 0 2px #fff`로 캔버스 위 가독성.
- 색: 평상시 `--toss-weak-text`, active 엣지에 연결된 포트는 `#0064FF`.
- 첫 노드는 in 포트 숨김, 마지막 노드는 out 포트 숨김.

---

## 3. SVG 엣지 전략

**선택: 직교(orthogonal/elbow) 베지어 하이브리드 — "S-curve elbow".** 근거: 노드를 **수평 레인(좌→우 진행)** 으로 배치하므로 out(우) → in(좌) 수평 흐름엔 **수평 cubic 베지어**가 가장 깔끔하다. DAG 분기(한 노드 → 2개 자식)가 생기면 세로 간격을 elbow로 흡수.

- 각 엣지 = `<path>`, `<svg class="n8n-edges">` 안에 그린다. SVG는 viewport와 **같은 transform**을 받는 레이어(노드와 좌표계 공유).
- 수평 베지어 control point: `M x1 y1 C x1+Δ y1, x2-Δ y2, x2 y2` (Δ = (x2-x1)*0.5, 최소 40).
- 화살표: `<marker id="n8nArrow">` 1개 정의, `marker-end`로 재사용. 색은 엣지 상태색.
- 엣지 상태색(기존 `.adm-link` 규칙 이식):
  - done→done: `#34D399`
  - active(done→다음 실행/대기): `#0064FF` + **animated dash flow** (`stroke-dasharray` + `@keyframes n8nFlowDash`로 `stroke-dashoffset` 이동)
  - →failed/expired: `#EF4444`
  - 그 외(미진행): `#CBD5E1`
- 활성 엣지 1개만 dash 애니메이션(현재 진행 경로). 나머지는 정적.

> 구현 메모: 노드는 `position:absolute; left/top`로 좌표를 갖고, JS가 각 노드의 (right-center)·(left-center)를 계산해 path `d`를 생성. 레이아웃 자동계산은 §4.

---

## 4. 자동 레이아웃 (좌표 계산)

선형 DAG가 대부분이므로 **단순 layered left-to-right**:
- `x = colIndex * (NODE_W + GAP_X)`, `GAP_X=72`.
- 분기 없으면 `y` 고정(1레인). 분기/병합이 생기면 BFS depth로 column, 같은 column 내 형제는 `y += (NODE_H+GAP_Y)`.
- `dependsOn`(ADR-016 필드)을 column 산정의 근거로 사용: `col(node)=max(col(dep))+1`.
- 계산 후 전체 bounding box를 구해 **fit view**(§5) 초기 적용.

---

## 5. Pan / Zoom 모델

CSS transform 단일 상태 객체로 관리. **노드 캔버스마다 1개 viewport**.

```js
const view = { x:0, y:0, k:1 };   // translate + scale
function applyView(){ viewport.style.transform = `translate(${view.x}px,${view.y}px) scale(${view.k})`; }
```
- **Pan:** 빈 캔버스 영역 `mousedown` → drag로 `view.x/y` 갱신. 노드/포트 위 mousedown은 pan 시작 안 함(`e.target.closest('.n8n-node')` 가드).
- **Zoom(wheel):** 커서 기준 줌. `k' = clamp(k * (1 - deltaY*0.001), 0.4, 2.0)`, 커서 좌표 고정 보정으로 `x,y` 재계산.
- **버튼 줌:** toolbar `+ / −` → 중앙 기준 `k *= 1.2 / 0.8`.
- **Fit view:** bounding box를 stage 크기에 맞춰 `k`·`x`·`y` 산출(패딩 40). 펼칠 때 자동 호출.
- dot-grid 배경: stage(`.n8n-stage`)에 고정(transform 미적용) → 배경은 안 움직이고 노드만 이동(n8n 동작과 동일하게 하려면 background-position을 view에 연동해도 됨; 1차는 고정).

---

## 6. 사이드 인스펙터 (노드 클릭 → 우측 슬라이드인)

`GET /admin/pipelines/{id}/tasks/{taskId}` 응답 필드에 1:1 매핑. 노드 클릭 시 `.n8n-inspector.open`, 해당 노드에 `.is-selected`(2px `#0064FF` ring) 부여.

| 섹션 | ADR-016 필드 | 표시 |
|------|-------------|------|
| 헤더 | `name`, `kind`, `status` | 오퍼레이션 id(`im.terraformApply`/`im.jobStatus`) + kind 배지 + 상태 칩 |
| 의존성 | `dependsOn` | 선행 task 칩 목록 |
| 실패 | `failCount` / `maxFailCount` | `3 / 3` 게이지 |
| 최근 체크 | `latestCheck{checkedAt, observed, apiResult}` | 1행 요약 |
| 시도 이력 | `attempts[]{response, errorCode, outcome}` | outcome=`SUCCEEDED/FAILED/EXECUTION_TIMEOUT` 칩, errorCode 표시 |
| 체크 요약 | `checks` | **집계 기본**: `count + last checkedAt + last observed`. 개별 폴은 접힘(notable=ERROR/PENDING/transition만 펼침) |
| postCheck | `postCheck` | `TERRAFORM_JOB` → `{type:TERRAFORM_LOG, logPointer, excerpt}` 로그 발췌 박스(mono) |
| 컨트롤 | — | **Cancel + Retry(=new run) 두 개만.** pause/resume/force-check 없음 |

- `errorCode` enum 표시: `CALL_TIMEOUT · EXECUTION_TIMEOUT · TTL_EXPIRED · IM_REJECTED · CHECK_ERROR · DISPATCH_NO_RESPONSE` → red 배지.
- 기존 편집 모달(`admOpenTask`/`admSaveTask`, poll/ttl/maxFail)은 **인스펙터의 "설정" 접이식 섹션**으로 이동하거나, 인스펙터 하단 "Task 설정" 버튼이 기존 모달을 그대로 연다(모달 로직 재사용, 최소 변경).

---

## 7. 툴바 · 미니맵 · 모션

### 7.1 Toolbar (`.n8n-toolbar`, 좌상단 floating)
- `[−] 120% [+]` 줌 / `⤢ fit` / `↔ 방향`(가로↔세로 레이아웃 토글, 선택).
- 스타일: 흰 배경, `border:1px var(--toss-divider)`, `border-radius:10px`, `box-shadow:0 1px 3px rgba(15,23,42,.08)`. 버튼은 기존 `.btn.ghost` 톤.

### 7.2 Minimap (`.n8n-minimap`, 우하단)
- 144×96 축소 캔버스. 노드를 작은 사각형(상태색)으로, 현재 viewport를 사각 프레임으로. 클릭 시 해당 위치로 pan(2차 우선순위 — 없어도 무방하나 마크업은 둔다).

### 7.3 모션 (restrained)
- 실행 중 노드: `admNodePulse`(1.8s) 재사용.
- 외부 대기: `admNodePulseAmber`(2.2s) 재사용.
- 활성 엣지: `n8nFlowDash`(stroke-dashoffset, 0.6s linear infinite).
- 인스펙터: `transform: translateX(100%)→0`, `0.22s cubic-bezier(.2,.8,.2,1)`.
- pan/zoom: transform 직접(transition 없음, 60fps 드래그). fit/버튼 줌만 `transition:transform .2s`.
- 신규 keyframe은 `n8nFlowDash` 1개만 추가. `admSpin`은 실행 노드 아이콘에 재사용.

---

## 8. 정확히 바꿀 CSS / JS (Change List)

### CSS (5089–5165 블록 내부에서)
1. **유지·재사용:** `@keyframes admNodePulse`, `admNodePulseAmber`, `admSpin`, `admFlowDash`(엣지 dash로 전용).
2. **추가(같은 블록 끝, 5165 직전):**
   - `.n8n-stage` (relative, overflow hidden, height:440px, dot-grid 배경 — 기존 radial-gradient 16px 이식)
   - `.n8n-viewport` (absolute, transform-origin 0 0, will-change:transform)
   - `.n8n-edges` (absolute, overflow visible, pointer-events:none)
   - `.n8n-node` (absolute, width 196px — `.adm-node` 시각 토큰 상속) + `.is-done/.is-running/.is-extwait/.is-failed/.is-expired/.is-cancelled/.is-waiting-q/.is-selected`
   - `.n8n-port`(.in/.out), `.n8n-kind`(3종 변형), `.n8n-status-dot`, `.n8n-metric`
   - `.n8n-toolbar`, `.n8n-minimap`, `.n8n-inspector`(+ `.open`), `.n8n-insp-*` 내부 요소
   - `@keyframes n8nFlowDash { to { stroke-dashoffset:-12; } }`
3. **수정:** `.adm-flow`는 `admMiniFlow`가 계속 쓰면 유지. 단 mini도 캔버스로 가면 `.adm-flow`를 `.n8n-stage.is-mini`로 대체. **`.adm-link` 의사요소 연결선 규칙(5147–5165)은 SVG 엣지로 대체되므로 제거 또는 mini 전용으로 축소.**

### JS
1. **`admTaskPanel(p, pi)` (12319–12349) — 전면 재작성:**
   - state→class 매핑을 9-state 표(§2.2)로 교체.
   - kind 배지 라인 `t.kind === 'WAIT' ? 'WAIT_EXTERNAL' : 'EXECUTE'` (12336) → `TERRAFORM/JOB/CHECK` 3종(§2.1)으로 교체.
   - `.adm-flow` 직렬 출력 → `.n8n-stage > .n8n-viewport > (svg edges + 절대좌표 노드)` 마크업 생성.
   - 노드에 `data-pi/data-ti`, `onclick="admOpenInspector(pi,ti)"` 부여.
2. **신규 JS 헬퍼(파일 끝 admMiniFlow 인접에 추가):**
   - `n8nLayout(tasks)` → 좌표/엣지 배열 (§4)
   - `n8nEdgePath(a,b)` → cubic 베지어 d 문자열 (§3)
   - `n8nInitView(stageEl)` → pan/zoom 바인딩 + `applyView/fitView` (§5)
   - `admOpenInspector(pi,ti)` / `admCloseInspector()` → §6 패널 렌더(ADR 필드 매핑)
3. **`admMiniFlow(items)` (12350–12362):** 동일 노드 마크업 헬퍼 공유, `.n8n-stage.is-mini`(정적, fit만) 사용. kind 라벨 동일 규칙.
4. **데이터/매핑 동기화:** seed(11486–11502), `ADM_DAGS`(12268–12275), `admStartPipeline`(12284–12286) → 신규 kind enum + (선택) `dependsOn`/`failCount/maxFailCount`/`latestCheck`/`attempts`/`postCheck` 필드 추가. 인스펙터가 읽을 최소 demo 필드를 seed에 보강.
5. **`admRetryPipe`/`admCancelPipe`(12363–12372):** 컨트롤이 Cancel+Retry만이라는 ADR-016 규칙과 이미 일치 — **변경 없음**(인스펙터 버튼이 이 함수 재사용).
6. **Pipeline 뷰 컨테이너(7411–7430):** 테이블 행 펼침 셀(`<td colspan=7>`) 높이만 캔버스(440px) 수용하도록 확인. 카드/페이지헤드에 slot 게이지 + next-check 카운트다운 1줄 추가(§1).

### 절대 건드리지 않을 것
- 다른 모든 `data-aview-panel`(queue/service/api/guide) 뷰, 다른 스크린, 다른 CSS 블록.
- 토큰 외 신규 색상.

---

## 9. 토큰 일관성 체크리스트
- 색: `--color-primary #0064FF` · `--color-success #45CB85`(노드 done은 기존 `#059669/#A7F3D0` 유지) · `--color-error #EF4444` · `--color-warning #F97316`(amber 계열 `#FCD34D/#B45309` 유지) · 구분선 `--toss-divider #EBEEF2` · 텍스트 `--toss-strong/medium/weak-text` · 내부 배경 `--toss-inner-bg #F7F8FA`.
- 폰트: `'Geist'`. 오퍼레이션 id·로그 발췌만 mono.
- dot-grid: `radial-gradient(circle,#DCE2EC 1px,transparent 1px) 16px` 그대로.
- 신규 hex 추가 금지. 모든 상태색은 기존 노드 상태 팔레트에서 차용.
