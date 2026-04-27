# Guide CMS 링크 입력 UX 개편 — 모달 → BubbleMenu

> 작성일: 2026-04-27
> 기준 브랜치: `origin/main` @ `beff178` (PR #414 반영)
> 검증: Codex CLI cross-review (gpt-5.5, xhigh) — Needs revision 피드백 반영본
> 원칙: **링크 입력 UX만 변경한다. ko/en 본문 게이트(#414), 저장 메시지, 다른 툴바 버튼 동작은 유지.**

---

## 1. 배경

현재 가이드 수정 탭에서 링크를 넣으려면:

1. 툴바의 🔗 LINK 버튼 클릭
2. 화면 중앙에 모달이 떠오름
3. URL 입력란에 `https://...` 타이핑
4. "확인" 버튼 클릭 → 모달 닫힘

**사용자 불만**: 모달이 본문 위를 가려서 작성 흐름이 끊기고, "버튼 → 모달 → 타이핑 → 확인"의 4단계 컨텍스트 스위칭이 헷갈린다.

**현재 구현**:
- `app/integration/admin/guides/components/EditorToolbar.tsx:104-111` — 🔗 버튼은 `apply` 없이 `onOpenLink()` 호출
- `app/integration/admin/guides/components/LinkPromptModal.tsx` (105 lines) — 모달 본체
- `app/integration/admin/guides/components/GuideEditorPanel.tsx:561,598-605` — 모달 마운트
- `app/integration/admin/guides/components/GuideEditorPanel.tsx:378-421` — 본문 `<a>` 클릭을 가로채 모달 다시 띄움 (capture phase, target=_blank 차단)
- `app/integration/admin/guides/components/GuideEditorPanel.tsx:361-376` — ⌘K 단축키 → 모달 열기
- `app/integration/admin/guides/components/editor-link.ts` — `isAllowedLinkHref` 스킴 검증 (`https://`, `mailto:`, `/`)

---

## 2. 목표

본문 위에 떠오르는 인라인 입력 바(BubbleMenu)로 교체해 모달을 제거한다. 다음 요건을 모두 만족한다.

1. **신규 링크 추가**: 텍스트 선택만으로 BubbleMenu 자동 표시 → URL 입력 → Enter
2. **기존 링크 편집**: 링크 위를 클릭하면 BubbleMenu가 자동으로 떠오르고 URL이 미리 채워짐
3. **빈 캐럿에서도 가능**: 툴바 🔗 버튼 클릭 또는 ⌘K → BubbleMenu 강제 표시
4. **접근성**: Esc로 닫기 + editor 포커스 복귀, IME 조합 중 Enter 무시, error는 `aria-live`
5. **검증 정책 유지**: `https://`, `mailto:`, `/`만 허용 (기존 `isAllowedLinkHref` 재사용)

---

## 3. 새 UX — 시각 자료

### 3.1. 진입 직후 — 변화 없음

```
┌─ Guide CMS · Provider · AUTO · Step 3 ─────── [guideName] ─┐
│ [한국어 ●] [English ○]                                      │
├──────────────────────────────────────────────────────────────┤
│ [H4] | [B][I][</>] | [•][1.] | [🔗]                          │  ← Toolbar (그대로 유지)
├──────────────────────────────────────────────────────────────┤
│ |                                                            │
│ 본문에 caret이 깜빡임. BubbleMenu는 표시되지 않음.           │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### 3.2. 시나리오 A — 텍스트 선택 후 자동 표시

```
        ┌─────────────────────────────────────────┐
        │ 🔗  https://_____________   [적용]      │  ← BubbleMenu (선택 영역 바로 위)
        └─────────────────────────────────────────┘
            ▼
   ───────[ 선택된 텍스트 ]───────
   본문 위에 링크를 걸 텍스트가 드래그로 선택됨.
```

**동작**: 사용자가 본문에서 텍스트를 드래그하면 Tiptap selection이 비어있지 않게 되고(`!selection.empty`), BubbleMenu의 기본 `shouldShow`가 true가 되어 자동으로 떠오른다.

### 3.3. 시나리오 B — 🔗 LINK 버튼 클릭 (사용자가 명시적으로 강조 요청한 경로)

#### B-1. 텍스트가 선택된 상태에서 🔗 클릭

선택 영역이 이미 있으므로 BubbleMenu는 이미 떠 있음 → 🔗 클릭은 **input에 포커스를 줄 뿐**(no-op에 가까움). 직관적으로 동일한 결과.

#### B-2. 빈 캐럿(선택 없음)에서 🔗 클릭 ★

```
[H4] | [B][I][</>] | [•][1.] | [🔗] ← 사용자가 클릭
                                  │
                                  ▼ (강제 표시)
        ┌─────────────────────────────────────────┐
        │ 🔗  https://_____________   [적용]      │  ← caret 위치 위에 떠오름
        └─────────────────────────────────────────┘
            ▼
   본문...텍스트 caret| 텍스트...
```

**동작 시퀀스** (코드로 보장해야 할 핵심):

1. 🔗 버튼이 `onTriggerLink()` 호출 (이름 변경: `onOpenLink` → `onTriggerLink`)
2. 부모는 `editor.view.dispatch(state.tr.setMeta(linkBubblePluginKey, 'show'))` 발행
3. BubbleMenu가 `pluginKey` 기반으로 강제 `show()` 실행 → caret 위치를 virtualElement로 사용
4. 다음 frame(`requestAnimationFrame`)에 input에 포커스 + `setMeta(key, 'updatePosition')`
5. 사용자가 URL 타이핑 후 Enter → caret 위치에 링크 텍스트 + mark 삽입 (URL이 표시 텍스트로도 들어감)

#### B-3. 이미 링크 mark 위에 caret이 있는 상태에서 🔗 클릭

기존 URL이 input에 미리 채워지고, `[수정] [제거]` 버튼이 함께 노출.

```
        ┌────────────────────────────────────────────────────┐
        │ 🔗  https://example.com         [수정]  [제거]     │
        └────────────────────────────────────────────────────┘
            ▼
   본문...[기존 링크 텍스트]|...
```

### 3.4. 시나리오 C — 링크 위 클릭

링크 텍스트 아무 곳이나 클릭 → Tiptap `Link.configure({ enableClickSelection: true })`가 link mark 전체 range를 selection으로 설정 → `!selection.empty` 충족 → BubbleMenu 자동 표시 (URL 미리 채워짐, B-3과 동일한 모양).

### 3.5. 시나리오 D — ⌘K 단축키

본문에 포커스가 있을 때 ⌘K → B-2 또는 B-3 시나리오와 동일한 강제 표시 흐름.

### 3.6. 닫힘

- **Esc** → BubbleMenu hide + editor에 포커스 복귀
- **외부 클릭** → 동일
- **input blur**로 다른 곳으로 이동 → BubbleMenu hide
- **Enter (적용 후)** → setLink 적용 → hide → editor 포커스 복귀

---

## 4. 기술 설계

### 4.1. Tiptap 옵션 변경 (origin/main `GuideEditorPanel.tsx:66-79`)

```ts
// before
Link.configure({
  openOnClick: false,
  HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
  validate: isAllowedLinkHref,           // ← Tiptap v3에서 deprecated
}),

// after
Link.configure({
  openOnClick: false,
  enableClickSelection: true,            // ← 링크 클릭 시 mark range를 selection으로 — BubbleMenu 자동 표시 조건 충족
  autolink: false,                       // ← B 방식(붙여넣기 자동 변환)은 본 PR 범위 밖. 명시적으로 false
  linkOnPaste: false,                    // ← 동일 이유로 false (default true이므로 명시 필수)
  HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
  isAllowedUri: (url) => isAllowedLinkHref(url),  // ← v3 권장 옵션
}),
```

> Codex 검증: `autolink`/`linkOnPaste`는 Tiptap v3 Link의 기본값이 `true`. 정책상 우리는 명시 검증을 거치는 입력만 받으므로 둘 다 `false`로 명시. B 방식 도입은 별도 PR로 분리한다.

### 4.2. BubbleMenu — pluginKey 기반 외부 제어

`@tiptap/react`는 React의 `BubbleMenu`를 `@tiptap/react/menus`에서 export. `@tiptap/extension-bubble-menu`를 직접 import하지 않는다(`package.json`에 직접 dependency 없음).

```ts
// app/integration/admin/guides/components/LinkBubbleMenu.tsx (신규)
import { BubbleMenu } from '@tiptap/react/menus';
import { PluginKey } from '@tiptap/pm/state';

const linkBubblePluginKey = new PluginKey('linkBubble');

<BubbleMenu
  editor={editor}
  pluginKey={linkBubblePluginKey}        // ← 외부 show/hide meta 발행에 필수
  shouldShow={({ editor, state }) => {
    if (!editor.isEditable) return false;
    const { selection } = state;
    // 기본 "selection 비어있지 않음" 조건
    if (!selection.empty) return true;
    // 빈 selection이라도 링크 위 caret이면 표시 (편집 시나리오)
    if (editor.isActive('link')) return true;
    return false;
  }}
  options={{ placement: 'top' }}
>
  <LinkBubbleForm ... />
</BubbleMenu>
```

> Codex 검증: BubbleMenu 기본 `shouldShow`는 `selection.empty`이면 false. 따라서 (a) `enableClickSelection: true`로 링크 클릭 시 selection을 만들어 주거나, (b) `shouldShow`에서 `editor.isActive('link')` 빈 selection을 명시적으로 허용해야 한다. 본 계획은 두 보강을 모두 적용한다.

### 4.3. ⌘K · 🔗 버튼의 강제 표시

```ts
// 트리거 (parent에서 toolbar/⌘K 핸들러가 호출)
const triggerLinkBubble = useCallback(() => {
  if (!editor) return;
  // 빈 selection + 링크 위가 아닌 경우에도 강제로 띄우기 위해 meta 발행
  editor.view.dispatch(
    editor.state.tr.setMeta(linkBubblePluginKey, 'show'),
  );
  // 위치 갱신 + input focus는 다음 frame
  requestAnimationFrame(() => {
    editor.view.dispatch(
      editor.state.tr.setMeta(linkBubblePluginKey, 'updatePosition'),
    );
    linkBubbleFormRef.current?.focusInput();
  });
}, [editor]);
```

> Codex 검증: 로컬 `node_modules/@tiptap/extension-bubble-menu/src/bubble-menu-plugin.ts:587`에서 `'show'`/`'hide'`/`'updatePosition'` meta가 처리됨을 확인. React 컴포넌트는 자동 pluginKey를 만드므로 외부 제어는 명시적 `pluginKey` 전달이 필수.

### 4.4. 링크 클릭 인터셉트 단순화

origin/main의 `GuideEditorPanel.tsx:378-421`에서 capture phase로 가로채는 47줄의 로직 중:
- **유지**: `target="_blank"` 자동 새 탭 이동 차단 (browser default 막기) — `mousedown` / `auxclick` capture
- **단순화**: `clickHandler`의 "selection을 anchor로 이동 + linkModal.open()" 2-step → `enableClickSelection: true`가 selection 처리를 대신하므로 `preventDefault + stopPropagation`만 남김. BubbleMenu는 자동 표시.

순감소 약 15줄.

### 4.5. LinkBubbleMenu 컴포넌트 구조 (신규)

```
LinkBubbleMenu.tsx (~120 lines 예상)
├── BubbleMenu wrapper (pluginKey, shouldShow, editor)
└── LinkBubbleForm (ref-forwardable, 내부 state 캡슐화)
    ├── value (URL 입력값) ─ useState
    ├── error (검증 에러)  ─ useState
    ├── isComposing       ─ ref (IME guard)
    ├── label "URL"        ─ <label>
    ├── <input>            ─ ref-attached, focusInput() 노출
    │   └── onKeyDown: Enter/Escape 처리 (composing 중이면 무시)
    ├── [적용] 버튼
    └── [제거] 버튼 (editor.isActive('link') 일 때만)
```

**상태 캡슐화 원칙**: parent(`GuideEditorPanel`)는 `editor`와 `disabled`만 넘긴다. URL value/error/IME 상태는 모두 `LinkBubbleMenu` 내부. (origin/main 기준 `GuideEditorPanel.tsx`는 이미 608 LOC. 더 이상 키우지 않는다.)

### 4.6. 적용·제거 로직 (기존 재사용)

```ts
// 적용
editor.chain().focus().extendMarkRange('link').setLink({ href }).run();

// 제거
editor.chain().focus().extendMarkRange('link').unsetLink().run();
```

origin/main의 `submitLink` / `unsetLink` (line 423-434)와 동일. parent에서 callback으로 노출하거나, BubbleMenu 내부에서 직접 호출 가능. **본 계획은 LinkBubbleMenu 내부 직접 호출**(상태 lifting 회피).

### 4.7. 빈 caret에서 🔗 클릭한 경우의 텍스트 처리

빈 selection 상태에서 `setLink({ href })`만 부르면 mark만 켜지고 보이는 문자가 없다. 이 경우의 동작:

- **옵션 1 (채택)**: URL 자체를 표시 텍스트로 삽입.
  ```ts
  editor.chain().focus().insertContent({
    type: 'text',
    text: href,
    marks: [{ type: 'link', attrs: { href } }],
  }).run();
  ```
- 옵션 2: 표시 텍스트 별도 input. 인터랙션 복잡 → 보류.

옵션 1이 직관적이고 Notion·Linear 동작과도 일치.

---

## 5. 변경 파일 (origin/main 기준)

| 파일 | 변경 |
|------|------|
| `app/integration/admin/guides/components/LinkBubbleMenu.tsx` | **신규** (약 120줄) |
| `app/integration/admin/guides/components/LinkPromptModal.tsx` | **삭제** (-105줄) |
| `app/integration/admin/guides/components/GuideEditorPanel.tsx` | 수정 (아래 상세) |
| `app/integration/admin/guides/components/EditorToolbar.tsx` | 수정 (아래 상세) |
| `app/integration/admin/guides/components/editor-link.ts` | 변경 없음 |
| `lib/utils/__tests__/link-bubble-menu.test.tsx` | **신규** 테스트 |

### 5.1. `GuideEditorPanel.tsx` 수정 사항

| origin/main line | 변경 |
|---|---|
| 35 | `useModal` import 제거 (다른 사용처 없으면) |
| 53 | `LinkPromptModal` import → `LinkBubbleMenu` import (`@/app/integration/admin/guides/components/LinkBubbleMenu`) |
| 54-57 | `getSelectedLinkHref` import 제거 (LinkBubbleMenu 내부로 이동) — `isAllowedLinkHref`는 LinkBubbleMenu에서 import |
| 66-79 | Tiptap extension config 수정 (§4.1 참조) |
| 231 | `const linkModal = useModal()` 제거 |
| 361-376 | ⌘K handler: `linkModal.open()` → `triggerLinkBubble()` |
| 378-421 | 링크 클릭 인터셉트 단순화 (§4.4) — clickHandler가 `linkModal.open()`을 호출하지 않음 |
| 423-434 | `submitLink` / `unsetLink` 제거 (LinkBubbleMenu 내부로 이동) |
| 561 | `<EditorToolbar onOpenLink={linkModal.open} />` → `onTriggerLink={triggerLinkBubble}` |
| 598-605 | `<LinkPromptModal>` 마운트 제거 → `<LinkBubbleMenu editor={editor} disabled={loading || saving} pluginKey={linkBubblePluginKey} />`로 교체 |

### 5.2. `EditorToolbar.tsx` 수정 사항 (LINK 버튼 **유지**, 동작만 교체)

| origin/main line | 변경 |
|---|---|
| 28 | `onOpenLink` prop 이름 → `onTriggerLink` (의미 명확화) |
| 38 | 주석 변경: "Returned undefined for `link` — opens BubbleMenu instead." |
| 103-111 | link 버튼 spec은 그대로. id, label `'링크'`, shortcut `'⌘K'`, glyph `🔗` 유지 |
| 117 | `DIVIDER_BEFORE` 그대로 (버튼 7개 유지) |
| 160-162 | `if (spec.id === 'link') { onTriggerLink(); return; }` — 함수 이름만 교체 |

→ Codex 권고대로 LINK affordance를 toolbar에 유지. 발견성 회귀 없음.

---

## 6. 접근성 (a11y)

| 요소 | 처리 |
|------|------|
| input label | `<label>URL <input ... /></label>` (가시 라벨, sr-only 아님) |
| BubbleMenu container | `role="group"` + `aria-label="링크 편집"` (modal이 아니므로 `role="dialog"` 미사용) |
| error 메시지 | `<p role="alert" aria-live="polite">https://, mailto:, 또는 /로 시작해야 합니다.</p> ` |
| Esc | input의 `onKeyDown`에서 `setMeta(linkBubblePluginKey, 'hide')` + `editor.commands.focus()` |
| Enter | composing 중(`event.isComposing` or 내부 ref) 무시. 빈 값이면 `unsetLink` 호출 후 hide |
| focus return | 적용/취소/제거 후 항상 `editor.commands.focus()` |
| 외부 클릭 | BubbleMenu 기본 동작(blur on outside click)에 위임. `relatedTarget`이 BubbleMenu 내부면 유지 |
| 키보드 전용 | 🔗 버튼이 toolbar에 있으므로 Tab만으로 도달 가능. ⌘K도 사용 가능 |

> Codex 지적: LinkPromptModal은 `Modal`에 focus trap을 위임했지만 BubbleMenu는 단순 floating UI라 명시적 처리가 필요.

---

## 7. 테스트 계획

### 7.1. 신규 테스트 (`LinkBubbleMenu.test.tsx`)

| 케이스 | 기대 |
|---|---|
| 텍스트 선택 시 BubbleMenu 자동 표시 | DOM에 form 노출 |
| 빈 caret + ⌘K → 강제 표시 + input 포커스 | 활성 element가 input |
| `https://example.com` 입력 + Enter → setLink 호출 | mark 적용, BubbleMenu hide |
| `javascript:alert(1)` 입력 + Enter → 검증 에러, hide 안 됨 | error role=alert 노출 |
| 링크 위 클릭 → BubbleMenu 표시 + URL 미리 채움 | input value === 기존 href |
| 링크 위 + [제거] 클릭 → unsetLink + hide | mark 제거 |
| Esc → hide + editor focus 복귀 | document.activeElement === editor.view.dom |
| IME composing 중 Enter → submit 차단 | onSubmit 호출 안 됨 |
| 빈 caret + 🔗 클릭 → 동일하게 강제 표시 | 동작 동일 |

### 7.2. 회귀 검증

- `lib/utils/__tests__/validate-guide-html.test.ts` 49케이스 → 그대로 통과 (스킴 정책 동일)
- `lib/utils/__tests__/has-guide-content.test.ts` 9케이스 → 무관, 통과
- AGENTS 요구사항: `npm run test:run`, `npm run lint`, `npm run build` (build 영향 있으니 필수)

---

## 8. 진행 절차

### 8.1. Worktree-First (CLAUDE.md ⛔ 규칙)

```bash
# canonical repo path에서 실행 금지 — worktree로 분리
git fetch origin main
bash scripts/create-worktree.sh --topic guide-link-bubble-menu --prefix feat
# 생성된 worktree에서 이후 작업
bash scripts/guard-worktree.sh
```

### 8.2. 구현 순서 (vertical slice)

1. **Slice 1**: LinkBubbleMenu 컴포넌트 + pluginKey + 기본 텍스트 선택 시나리오만 → 컴파일 + 동작 확인
2. **Slice 2**: ⌘K · 🔗 버튼 강제 표시 (`setMeta('show')` + rAF + focus)
3. **Slice 3**: 링크 클릭(B-3, C 시나리오) — `enableClickSelection: true`, 기존 인터셉트 단순화
4. **Slice 4**: a11y (Esc, IME guard, error aria-live) + 검증 (`isAllowedUri` 적용)
5. **Slice 5**: LinkPromptModal 삭제 + import 정리 + dead code 제거
6. **Slice 6**: 테스트 작성 + 회귀 검증

각 slice 끝마다 `npm run lint && npx tsc --noEmit && npm run test:run` 통과 확인.

### 8.3. PR 시 보고 항목

- 수정탭 4개 시나리오(§3.2 ~ §3.5) 스크린샷 또는 GIF
- 신규 테스트 결과
- `validate-guide-html` 49케이스 + `has-guide-content` 9케이스 회귀 통과 확인
- build 결과

---

## 9. 위험과 미해결

| 항목 | 영향 | 대응 |
|------|------|------|
| `enableClickSelection` 변경이 다른 mark(예: bold, italic) 클릭 동작에도 영향 줄 수 있음 | 중 | 테스트로 확인. Tiptap source상 link mark에 한정된 옵션이지만 cross-mark 시 동작 검증 필요 |
| Tiptap v3.22.4의 `BubbleMenu` import 경로 (`@tiptap/react/menus`) 안정성 | 저 | 로컬 `node_modules/@tiptap/react/src/menus/BubbleMenu.tsx`에서 export 확인됨. 직접 dependency 없는 상태이므로 향후 react 패키지 업그레이드 시 모니터링 |
| 빈 caret에서 🔗 클릭 후 표시되는 BubbleMenu의 위치 — caret이 빈 줄이면 anchor가 없어 좌표가 부정확할 수 있음 | 중 | `getReferencedVirtualElement`로 caret rect를 명시. 안 되면 toolbar 버튼 좌표 fallback |
| autolink 미도입으로 사용자가 URL을 그냥 타이핑/붙여넣어도 자동 링크가 되지 않음 (B 방식 부재) | 저 | 본 PR 범위 밖. 후속 PR로 검토 (정책: `shouldAutoLink`로 스킴 통과 시에만 적용) |
| 모바일 미고려 | 없음 | 프로젝트가 desktop only라 무관 |

---

## 10. 결정 요약

- **LINK 버튼**: 유지 (Codex 권고). 동작만 모달 → BubbleMenu 강제 표시로 교체
- **autolink/linkOnPaste**: 명시적 `false` (정책 일관성). B 방식은 별도 PR
- **link click 동작**: `enableClickSelection: true`로 mark range를 selection으로 만들어 BubbleMenu 자동 표시 조건 충족
- **상태 위치**: URL value/error/IME 모두 `LinkBubbleMenu` 내부에 캡슐화. parent는 editor와 trigger만 보유
- **검증 정책**: `isAllowedUri`(v3 권장)로 전환, 기존 `isAllowedLinkHref` 함수 본문은 그대로 재사용
