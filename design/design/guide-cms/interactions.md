# Guide CMS — 상호작용 메모

키보드 네비게이션 · 포커스 · 트랜지션 · 접근성 가드레일.

---

## 1. 키보드 네비게이션

### 전체 Tab 순서 (1440px 기준)
```
1. Provider tabs (tablist — Tab 한 번으로 진입, 좌우로 탭 간 이동)
2. Step 목록 (list — Tab 으로 진입, ↑↓ 로 행 이동)
3. 편집 패널
   3-1. Language tabs (Tab 한 번으로 진입, 좌우로 언어 이동)
   3-2. Tiptap 툴바 (roving tabindex — Tab 한 번만 들어감)
   3-3. 에디터 영역 (contenteditable)
   3-4. 저장 버튼
4. 미리보기 패널
   4-1. 언어 토글 (ko/en)
```

### Provider tabs (`role="tablist"`)
- `←` / `→` — 활성 가능한 탭 사이만 순환 (IDC/SDU 는 스킵).
- `Home` — 첫 활성 탭(`AWS`).
- `End` — 마지막 활성 탭(`GCP`).
- `Enter` / `Space` — 선택 확정 (기본 자동 activation 이므로 생략 가능).
- IDC/SDU 탭은 `Tab` 으로 포커스는 받지만 `aria-disabled="true"`. Enter/Space 시 toast.

### Step 목록 (`role="list"` + 각 행 `role="button"`)
- `↑` / `↓` — 이전/다음 행 (포커스 이동 only).
- `Enter` / `Space` — 선택.
  - `dirty === true` 면 즉시 `UnsavedChangesModal` 을 띄우고 Enter 키 처리 중단.
- `PageUp` / `PageDown` — 4행 단위 이동 (선택적).
- `Home` / `End` — 첫 / 마지막 행.

### 언어 탭 (편집 패널 & 미리보기 패널)
- `←` / `→` — ko ↔ en 전환.
- 두 탭 **독립**. 미리보기에서 en 토글 → 편집 에디터의 ko 탭은 건드리지 않음.

### Tiptap 툴바 (`role="toolbar"`, roving tabindex)
- `Tab` 은 한 번만 툴바 내부로 진입, 다음 `Tab` 은 에디터로.
- 툴바 내부 `←` / `→` 로 버튼 이동.
- `Enter` / `Space` — 현재 버튼 실행.
- 에디터 포커스 상태에서의 단축키는 § 4.3 참고.

### 에디터 영역
- `⌘B / ⌘I / ⌘E / ⌘K / ⌘⇧4 / ⌘⇧7 / ⌘⇧8` — 해당 마크 토글.
- `⌘S` — 저장 (enabled 시에만).
- `Escape` — 링크 prompt 모달 닫기 (취소).
- `Tab` — 에디터를 나가 다음 포커스 가능한 요소로 (에디터 내부에서 탭 문자 삽입하지 않음).

### Confirm Modal (`UnsavedChangesModal`)
- 열림과 동시에 `취소` 버튼 `autoFocus` (기본 = 안전 방향).
- `Tab` / `Shift+Tab` — 모달 내부에서 포커스 트랩.
- `Escape` — 취소와 동일 (닫기 + 편집 상태 유지).
- `Enter` — 현재 포커스된 버튼 실행 (= 취소).

### 저장 버튼
- `disabled` 상태에서도 포커스는 받음(`aria-disabled="true"`). 포커스 시 tooltip 즉시 표시.

---

## 2. 호버 / 포커스 상태

| 요소 | 기본 | Hover | Focus (visible) | Active / Selected |
|---|---|---|---|---|
| Provider tab | `fg-3`, 투명 border | `fg-1` | 2px `primary` ring, 2px offset | `primary` text + 2px bottom border `primary` |
| Provider tab (disabled) | `fg-4`, 35% dot | 동일 (커서 `not-allowed`) | 동일 ring | — |
| Step row | 흰 배경 | `bg-muted` 배경 | 2px `primary` ring | `primary-50` 배경 + 3px 좌측 `primary` 엣지 + circle fill |
| Toolbar button | `fg-2` | 흰 배경 + `fg-1` | 2px `primary` ring | 흰 배경 + `primary` text + soft shadow |
| Save (enabled) | `primary` | `primary-hover` | 3px rgba(0,100,255,0.2) ring | — |
| Save (disabled) | `gray-200` / `fg-4` | 동일 | `primary` ring (접근 가능) | — |
| 언어 탭 pill | `fg-3` | `fg-1` | 2px `primary` ring | 흰 배경 + `fg-1` + soft shadow + `● filled/empty` dot |

- 전역 focus visible: `outline: 2px solid var(--color-primary); outline-offset: 2px;`
- 모든 interactive 요소는 키보드로만 포커스 가능할 때 ring 노출 (`:focus-visible`).

---

## 3. 트랜지션

| 전환 | Duration | Easing | 비고 |
|---|---|---|---|
| Tab hover 배경·색 | 120ms | `cubic-bezier(0.2, 0, 0, 1)` | Provider / Language / Toolbar 공통 |
| 탭 underline slide | 180ms | `ease-out` | 가능하면 framer-motion `layoutId`, 아니면 opacity fade 로 대체 |
| Step row `background` | 100ms | `ease-out` | 클릭 응답 빠르게 |
| 편집 패널 교체 (empty ↔ editor) | 160ms | `ease-out` | fade + 4px translateY. 레이아웃은 고정, 내용만 스왑 |
| Tiptap 툴바 active 상태 | 0ms | — | 즉시 반영 (눈에 띄는 트랜지션 금지) |
| Save 버튼 loading 진입 | 120ms | `ease-out` | 스피너 fade-in, 라벨은 크로스페이드 |
| Toast 진입 / 퇴장 | 180ms / 140ms | `ease-out` / `ease-in` | `translateY(-6px)` + opacity |
| Modal backdrop fade | 180ms | `ease-out` | 모달 본체 `translateY(8px) → 0` |
| 미리보기 업데이트 | debounce **250ms** | — | 편집 → 미리보기 동기화. 타이핑 burst 동안 과잉 렌더 방지 |

- 접근성: `@media (prefers-reduced-motion: reduce)` 시 모든 transition `duration: 0.01ms`, transform 제거.

---

## 4. 특수 상호작용 플로우

### 4.1 탭/행 이동 시 dirty guard
1. 사용자가 dirty 상태에서 다른 step 클릭.
2. 클릭 이벤트를 선점 → `event.preventDefault()` 대신, `setSelected` 호출 전 `useModal` open.
3. 모달 `취소` → state 유지, 포커스 방금 클릭한 행으로 복귀.
4. 모달 `변경 폐기 후 이동` → `setSelected(newKey)` + `onDiscard` 호출 (`ko/en/dirty` 리셋).

### 4.2 Provider 전환 시
- dirty guard 동일 적용.
- 전환 성공 시 `selected = null` 로 초기화 → 편집/미리보기는 empty state.

### 4.3 편집 도중 ⌘S
- 에디터 focus + `⌘S` → 저장 버튼이 `enabled` 이면 클릭과 동일 동작. `disabled` 면 tooltip 을 1.8s 깜빡이며 표시.

### 4.4 링크 삽입
1. 툴바 링크 버튼 클릭 / `⌘K`.
2. `<LinkPromptModal>` 오픈, URL input autoFocus.
3. Enter 로 확정, Escape 로 취소.
4. 확정 시 `editor.chain().focus().setLink({ href }).run()`. 빈 문자열이면 `unsetLink`.

### 4.5 저장 에러 복구
- PUT 실패 → `<Toast variant="error">` 노출 (5s) + 저장 버튼 즉시 `enabled` 로 복귀.
- 입력값 **유지** — `ko/en` state 그대로.
- toast 안에는 "다시 시도" action 없음 (저장 버튼이 retry 지점).

### 4.6 비활성 provider 탭
- 클릭 / Enter / Space → toast (info):  
  **"{IDC|SDU} 가이드는 Step 구조 확정 후 별도 wave 에서 지원됩니다."**
- toast 는 top-right, auto-dismiss 4.2s.
- 동일 탭 연속 클릭 시 toast 중복 방지 (최근 toast id 동일하면 skip).

### 4.7 미리보기 언어 전환
- 편집 언어 탭과 **독립**. 상태는 로컬.
- ko 가 empty 일 때 미리보기 `ko` 탭: `<preview-empty-lang>` — "한국어 본문이 아직 작성되지 않았습니다".

---

## 5. 접근성 체크리스트 (WCAG 2.1 AA)

- [x] 모든 interactive element 에 visible focus (outline 2px / primary).
- [x] Provider tabs / Language tabs — `role="tablist"`, 각 탭 `role="tab"`, panel 과 `aria-controls` 연결.
- [x] Step 목록 — `role="list"`, 각 행 `role="button"` + `tabindex="0"`.
- [x] 저장 버튼 disabled — `aria-disabled="true"` + tooltip. HTML `disabled` 속성으로는 포커스 불가하므로 `aria-disabled` 사용.
- [x] 미리보기 panel root — `aria-live="polite"` (편집 중 미리보기가 갱신됨을 스크린리더에 알림).
- [x] 색상 대비
  - `primary` #0064FF on white → 4.94:1 (AA ✓)
  - `fg-3` #6B7280 on white → 4.68:1 (AA ✓)
  - Save disabled: `fg-4` #9CA3AF on `gray-200` → 2.28:1 → 실제 텍스트 대비는 **의도된 비활성 표시**, 하지만 tooltip 으로 정보 보조 (`aria-describedby`).
- [x] 모달 — focus trap + Esc 취소. 취소 버튼 autoFocus (안전 기본값).
- [x] 키보드 단축키 — 에디터 focus 안일 때만 동작 (전역 충돌 방지).
- [x] 모든 아이콘 버튼 — `aria-label` 필수 (툴바 7개, 언어 탭 dot, provider tab dot 포함).
- [x] 스크린리더용 step label — `aria-label="AWS 4단계 설치 진행 (자동)"` 처럼 provider + no + label + variant 까지 병합.

---

## 6. 데스크탑 전용

- min-width: **1280px** (1440 기준이지만 15% 여유).
- 미만은 별도 시안 없이 fallback `<UnsupportedViewport>` 로 안내 (이번 scope 외).
