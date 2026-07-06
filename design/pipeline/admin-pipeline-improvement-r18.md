# Admin Pipeline — R18 오너 피드백 개선 (2026-07-06)

> 오너 피드백 8건 + `ui-ux-pro-max` 스킬(origin/main `.claude/skills/ui-ux-pro-max`) 평가를
> 근거로 한 개선 스펙. **App 먼저 반영 → admin-pipeline.html 포팅** 순서(오너 지시).
> 크기·간격의 기존 권위는 [admin-pipeline-style-guide.md](admin-pipeline-style-guide.md) —
> 본 라운드에서 바뀌는 값은 §7에 명시하고 style-guide에도 반영한다.

## 0. ui-ux-pro-max 평가 — 현재 디자인의 위반/취약점

스킬의 스타일 제안(다크 OLED·Fira 폰트 등)은 **오너 승인 팔레트(--pl-*, Untitled 계열
라이트)와 충돌하므로 채택하지 않는다** — 스킬 자신의 `consistency`(같은 스타일 전면 유지)
규칙이 우선. 채택하는 것은 UX 규칙층이다. 현재 구현이 걸리는 항목:

| 스킬 규칙 | 현재 상태 | 판정 |
|---|---|---|
| `color-not-only` (색만으로 정보 전달 금지) | 유형(INSTALL/DELETE/CUSTOM)이 **plain text** — 색도 아이콘도 없음. 상태 pill 대비 유형은 식별 부하가 높다 | **위반은 아니나 피드백 #1의 근본 원인.** 아이콘+색+텍스트 3중 인코딩으로 해소 |
| `visual-hierarchy` (크기·간격·대비로 계층) | 상태바 한 줄에 pill·진행도·현재task·에러코드가 **동일 위계로 나열** (오너: "정보 계층이 flat") | **위반** — run 수준 / task 수준 2단 분리 |
| `whitespace-balance` (여백으로 그룹핑) | 상태 카드와 Task 흐름 카드가 분리된 두 표면 (오너: "따로 논다") | **위반** — 한 카드로 통합, 여백·헤어라인으로 내부 계층 |
| `primary-action` (화면당 primary CTA 1개, 명확히) | 취소 버튼이 상태바 우측에 sm 사이즈로 묻힘 | **취약** — 페이지 헤더로 승격, solid danger CTA "중단" |
| `destructive-emphasis` (파괴적 액션은 danger 색+분리) | danger 버튼이 흰 배경 outline — CTA감 없음 | **취약** — solid red 변형 신설 |
| filter `state-preservation`/가시성 (Komiser 레퍼런스) | 필터 상태가 **긴 산문 캡션**("최근 24시간 생성 6건 · 정렬: …")으로 표기 | **취약** — 활성 필터 칩(제거 ×) + 스코프 칩으로 구조화 |
| `heading-hierarchy` | 상세 h1이 "파이프라인 #124" — 식별자가 제목을 차지 | 오너 피드백과 일치 — h1은 "파이프라인 현황", id는 메타로 강등 |
| `touch-target-size` (≥44px는 앱 기준, 데스크톱 밀도형은 예외) | 칩 × 버튼 신설 시 히트 영역 주의 | 칩 높이 28 + × 히트 20×28 확보 |
| `content-jumping` (CLS) | 인라인 패널 신설 시 캔버스 리플로 | 패널은 고정폭 400, 캔버스는 min-w-0 스크롤 — transform/width 전이 200ms, reduced-motion 존중 |

## 1. 유형(INSTALL/DELETE/CUSTOM) 시각 구분 — `PipelineTypeTag`

**아이콘 + 색 + enum 원문** 3중 인코딩. 상태 pill(채운 라운드)과 문법이 겹치지 않도록
**배경 없는 인라인 태그**(아이콘만 유채색, 텍스트는 medium).

| 유형 | 아이콘 (24 viewBox stroke) | 색 토큰 | 값 |
|---|---|---|---|
| INSTALL | `install` — 트레이로 내려꽂는 화살표 | `--pl-type-install` | #2563EB (primary 계열 — 설치=주 작업) |
| DELETE | `trash` | `--pl-type-delete` | #B42318 (err-text — terraform destroy 관행) |
| CUSTOM | `sliders` — 조정 슬라이더 | `--pl-type-custom` | #6941C6 (Untitled purple-700 — 수동/커스텀) |

- 마크업: `inline-flex items-center gap-1` + `Icon size sm(14)` (color: 토큰) +
  텍스트 12/600 mono `text-medium`. 셀 높이(44) 안에 수납.
- 적용 위치: ① 대시보드 목록 `파이프라인 유형` 열 ② 타겟 상세 이력 테이블 유형 열
  ③ 타겟 상세 상태바 meta의 `INSTALL #128` ④ 파이프라인 상세 idbar `유형` 필드
  ⑤ 서비스 검색 LatestCell(유형 노출 시).
- DELETE 태그의 red는 상태 FAILED red와 같은 계열이나, **모양(아이콘 태그 vs 채운
  pill)과 열 위치**로 구분된다 — `color-not-only` 충족.

## 2. 타겟 상세 — 설치/삭제 버튼 게이팅 제거 (오너 확정: "활성화 게이팅만 제거")

- `targetButtons.ts`(+테스트) 삭제. [설치 시작] [삭제 시작] **상시 활성**.
- 잠금 캡션("진행·대기 중 파이프라인이 있어 설치·삭제는 잠깁니다") 제거.
- 충돌은 서버 계약이 처리: 생성 409 `ALREADY_ACTIVE` → latest 재조회 후 활성 run으로
  이동(기존 PreviewModal 플로우 그대로).
- 활성 run 존재 시 상태바의 [취소]는 유지(게이팅과 무관).

## 3. 섹션 제목↔캡션 간격 완화

실측상 앱=프로토타입(4px/12px)이었으나 오너가 답답하다고 판단 → **스펙 자체 변경**:

- 제목↔캡션 **4 → 8**, 캡션↔내용 **12 → 16** (간격 세트 {4,8,12,16,24,64} 내).
- app: `pipelineStyles.section.desc` = `-mt-1 mb-4`. HTML: `.section-desc{margin:-4px 0 16px}`.

## 4. 대시보드 — 필터 정보 칩 구조화 (Komiser 레퍼런스)

오너 제공 레퍼런스(Komiser 인벤토리)의 필터 칩 패턴 채택:

- **현황 섹션**: 산문 캡션 제거(정보는 stat 라벨 2단이 흡수 — §5).
- **목록 섹션**: 산문 캡션 제거. FilterBar(검색·상태·CSP select 유지) 아래 **칩 행**:
  - 스코프 칩(항상, × 없음): `기간 · 최근 24시간` `정렬 · 실패 우선`(title에 전체 정렬 규칙)
  - 활성 필터 칩(조건부, × 제거 버튼): `상태 · FAILED ×` `CSP · AWS ×` `검색 · "10" ×`
  - 활성 칩이 있으면 [필터 초기화] ghost 텍스트 버튼
  - 우측 정렬: `N건` (12 weak tabular; 200건 창 초과 시 "최신 200건 기준" title)
- 칩: h-7(28) rounded-full, bg-card + border(--pl-border-strong), 12px;
  키 weak·값 strong/600, × 는 ghost 아이콘 버튼(hit ≥20×28).

## 5. stat 라벨 2단 계층

"실패 · 최근 24시간" 단일 12px 행 → **주 라벨과 기간을 크기·색으로 분리**(오너 지시):

- 주 라벨: **14/600 medium** — "실패", "성공", "동작 중 파이프라인"
- 기간 부가: **12/400 faint** — "최근 24시간"(기간 seg 연동), 동작 중은 "현재"
- 마크업: 라벨 행 `flex items-baseline gap-1.5`, 값(32)은 기존 mt-3 유지.
- 크기 차이는 표준 세트 {12,14} 안에서만 (12 미만 금지 규칙 준수).

## 6. 파이프라인 상세 — 헤더·아이덴티티 재구성

- **h1: "파이프라인 현황"** (id 강조 제거). h1 우측 액션: **[중단] CTA**(§7).
- 브레드크럼의 말단은 `#124` 유지(위치 표시용 — 강조 아님).
- **IdentityBar 재배열 — Target Source 우선**(오너: "어떤 Target Source인지가 더 중요"):
  - pname(16/700): `{targetSourceId} · {providerLabel}` (예: `1006 · AWS`)
  - psub: 레시피 표시명 (예: `AWS 인프라 설치`)
  - fields: `유형`(TypeTag) · `생성` · `마지막 활동`
  - trailing: `실행 ID` 필드(값 `#124`, **12 mono faint** — 강등) + 대상 상세 ↗
  - meta note: Pipeline 설명(레시피 desc + 원문 코드 mono)
  - 순서 근거: 오너 나열(CSP, TargetSourceId, 생성시간, 유형, 설명) 그대로.

## 7. Task 흐름 — 상태 통합 단일 카드 + 인라인 상세 패널 + 중단 CTA

### 7-1. 중단 CTA (페이지 헤더)

- 이름 **"중단"**, 아이콘 `stop`(정지 사각), **solid danger** 변형 신설:
  `--pl-err-solid: #D92D20`, hover `#B42318`, 텍스트 white. h-8 md.
- 취소 불가 상태: disabled + title("진행·대기 중만 취소 가능" / "취소 처리 대기 중").
- 확인 모달(CancelModal)·토스트 분기(취소됨/취소 요청됨)는 기존 유지.

### 7-2. 통합 카드 (기존: 상태바 카드 + 흐름 카드 2개 → 1개)

카드 내부 3존 헤더 + 캔버스. **run 수준과 task 수준을 계층으로 분리**(오너: "정보 계층"):

```
┌─ Card ────────────────────────────────────────────────────────┐
│ [FAILED pill·lg] [취소 요청됨] ▮▮▮▯▯ 1/2        다음 실행 meta │  ← zone1: run 수준
│ 실패 태스크  Azure BDC 테라폼 Apply  재시도 1/1  [JOB_FAILED]   │  ← zone2: task 수준 (kv 문법)
│ leased 예 — 워커 실행 중 · 스케줄 지연 0 ms                    │  ← zone3: 12 faint meta
│ ──────────────────────────────────────────────────────────────│  ← 헤어라인
│ ┌ 점무늬 캔버스 ──────────────────┐┌ Task 상세 패널(선택 시) ┐ │
│ │ [tnode]→[tnode]→[tnode]→ …     ││ 이름 + pill        [×]  │ │
│ │  (가로 스크롤)                  ││ kv · attempts 테이블    │ │
│ └────────────────────────────────┘└────────────────────────┘ │
└───────────────────────────────────────────────────────────────┘
```

- zone2 문법: 라벨(12/600 faint: `현재 태스크`/`실패 태스크`/`시작 대기`) + 이름
  **14/600 strong** + 재시도 12 weak + 에러코드 mono chip(err). `statusModel`이
  flat 문자열 대신 구조체(`{label, name, retry}`)를 반환하도록 변경.
- zone 간 8px, 헤더↔캔버스 16px + 헤어라인. FAILED 시 카드 배경 그라디언트 틴트는
  **헤더 존에만**(기존 statusbar.failed 문법 이식).
- 타겟 상세의 statusbar(variant='target')는 기존 형태 유지(이 라운드 범위 밖).

### 7-3. 인라인 Task 상세 패널 (모달 대체)

- 노드 클릭 → **카드 내부 우측에서 펼쳐지는 400px 고정폭 패널**
  (`flex: 캔버스 min-w-0 flex-1 | 패널 w-[400px] border-l`).
- 내용은 기존 TaskDetailModal 본문 재사용(kv 170 → **stacked/150** 폭 조정,
  attempts 테이블은 `overflow-x-auto`), 헤더: 표시명 + pill + [×].
- 열림 전이: opacity+translateX 200ms ease-out, `motion-reduce:transition-none`.
- 선택 노드 하이라이트: `outline 2px primary` ring. 같은 노드 재클릭/× → 닫힘.
- Esc로 닫기, 패널 `role="complementary"` aria-label "Task 상세".
- 파일: TaskDetailModal.tsx → **TaskDetailPanel.tsx**로 전환(ModalShell 탈피).
  선택 상태는 useState (모달이 아니므로 useModal 규칙 비적용).

### 7-4. 콘텐츠 폭

- 오너: "margin이 오른쪽으로 너무 크게" → `layout.content` max-width **1280 → 1440**
  (app + HTML `.content` 동일). 흐름 카드는 콘텐츠 폭을 가득 채움.

## 8. HTML 포팅 (app 반영 후)

admin-pipeline.html에 §1~§7 전부 반영: `.section-desc` 마진, stat 라벨 2단, 필터 칩
행, TypeTag(아이콘 3종 defs 추가), 게이팅 제거(targetButtons), 상세 h1·idbar 재배열,
statusbar+flow 통합 카드 + 인라인 패널, `.content` 1440, 중단 CTA(solid danger).

## 9. 문서 동기화

- style-guide: §1 stat 라벨 2단 추가, §2 캡션 8/16, §3 content 1440 — 본 라운드 근거 링크.
- changelog: r18 항목. usecases S2: 게이팅 서술 → "상시 활성 + 서버 409 처리"로 수정.
- docs/api/pipeline-orchestrator-frontend-flows.md: 게이팅 문장 제거.
