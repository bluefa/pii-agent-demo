# Guide CMS — 저장 버튼 한/영 필수 입력 강제 (계획 v2)

> v2 변경: Codex cross-review 피드백 반영. v1의 `trim().length` 검사가 Tiptap의 빈 에디터(`<p></p>`)를 잡지 못하는 결함을 발견 → `validateGuideHtml` 기반 visible-text 검사로 교체. handleSave/canSave 일관화, seeded 가드 추가, 언어별 메시지로 세분화.

## Context

Guide CMS 편집 페이지에서 한국어·영어 본문 중 한쪽이 비어있는 상태로 저장을 시도하면, BFF의 `validateGuideHtml`이 빈 콘텐츠를 거부하여 `GUIDE_CONTENT_INVALID` 예외가 발생한다. "비어있다"의 정의가 단순 빈 문자열이 아니라 **visible text 부재** — Tiptap이 빈 에디터를 `<p></p>`로 시리얼라이즈하므로 trim 검사로는 부족하다 (`'<p></p>'.trim().length > 0` → true).

페이지 부제목(`app/integration/admin/guides/page.tsx:113`)은 이미 **"저장 시 한국어·영어 둘 다 필수입니다"** 라고 안내하고 있지만, 실제 저장 버튼 활성 로직(`canSave`)은 이 규칙을 검사하지 않는다. UI에서 BFF와 동일한 visible-text 의미로 enforce 하는 게 이번 작업의 전부.

## 결론 (앞서 보기)

**수정 파일 1개** — `app/integration/admin/guides/components/GuideEditorPanel.tsx`

1. 모듈 스코프 헬퍼 `hasGuideContent(html)` 추가 → `validateGuideHtml` 결과 중 `EMPTY_CONTENT` 만 보고 visible text 유무를 판정. (BFF와 의미 일치)
2. 기존 `koFilled`/`enFilled` (trim 기반)는 그대로 두고 — 언어 탭 점 인디케이터용으로만 계속 쓰임 — 별도로 `koHasContent`/`enHasContent` 메모를 추가.
3. `canSave`에 `koHasContent && enHasContent` 추가 → 단일 술어로 통일.
4. `handleSave`도 동일 `canSave`만 검사 → ⌘S 단축키 일관성 유지.
5. `seeded` 상태 추가 → 첫 GET 응답이 부모로 reseed될 때까지 빈 메시지 노출 방지 (Codex가 지적한 false-flash 갭 차단).
6. `saveStateMessage`에 `'error'` kind 추가, **언어별 문구**로 세분화.
7. 푸터 텍스트 컬러 분기에 `'error'` 케이스 추가 → 기존 토큰 `statusColors.error.text` 재사용.

빈 상태 메시지 (가장 구체적인 것 우선):
- 한·영 모두 비어있음 → **"한국어 / 영어 본문이 필요합니다"**
- 한국어만 비어있음 → **"한국어 본문이 필요합니다"**
- 영어만 비어있음 → **"영어 본문이 필요합니다"**

## Codex review 핵심 결함 → 대응 매핑

| Codex 지적 | v1 plan | v2 대응 |
|---|---|---|
| **Critical**: `trim().length` 가 Tiptap `<p></p>` 못 잡음 | `koFilled`/`enFilled` 재사용 | `validateGuideHtml` 기반 `hasGuideContent` 신규 헬퍼 사용 |
| **Major**: handleSave / canSave 술어 불일치 | `if (!dirty \|\| !koFilled \|\| !enFilled)` 별도 검사 | `if (!canSave) return` 하나로 통일 |
| **Major**: `loading`만으로 false-flash 못 막음 | `loading ? null : ...` | `seeded` state 추가 (onLoad 첫 호출에서 true) |
| **Minor**: 메시지가 어느 언어인지 안 알려줌 | 단일 문구 | 한/영 분리 + 양쪽 케이스 |
| **Minor**: 검증 plan 너무 가벼움 | 수동 시나리오만 | `hasGuideContent` 단위 테스트 + ⌘S 브라우저 검증 추가 |

## 현재 코드 트레이스 (확정 사실)

### `app/integration/admin/guides/components/GuideEditorPanel.tsx`

- **L186-187**: `koFilled = draftKo.trim().length > 0` — 언어 탭 점 인디케이터(L468 `EditLanguageTabs`)로만 쓰이며 빈 `<p></p>`를 못 잡음. **유지** (탭 인디케이터에는 충분; 우리는 별도 strict 검사를 추가).
- **L218-228 `handleSave`**: `if (!dirty) return`만 있음. ⌘S/Ctrl+S(L263-272)도 같은 핸들러를 호출하므로 여기서 가드해야 우회 불가.
- **L230 `canSave = dirty && !saving && !loading`** — 빈 검사 없음.
- **L180-184**: `useEffect(() => if (data) onLoad(data.contents))` — `data` 도착 후 부모로 reseed. 부모(`page.tsx:93-96`)는 `setDraftKo/setDraftEn`로 상태 업데이트. **즉, `loading=false` 와 `draftKo=loaded value` 사이에 한 렌더의 갭이 존재** — 그동안 draft는 부모 초기값 `''`. v1 plan의 `loading` 가드는 이 갭을 못 막음.
- **L357-363 `saveStateMessage`**: `'disabled' | 'warning'` 두 종류만. 빈 케이스 미커버.
- **L498-518 footer JSX**: `saveStateMessage?.kind === 'warning'` 인지에 따라 `statusColors.warning.textDark` vs `textColors.tertiary` 만 분기.

### `lib/utils/validate-guide-html.ts`

- **L147-179 `validateGuideHtml`**: 빈 문자열 → 즉시 `EMPTY_CONTENT`; 그 외에는 파싱 후 `!hasVisibleText(ast)` 일 때 `EMPTY_CONTENT` 추가.
- **L356-366 `hasVisibleText`** (내부 함수, 미export): visible text 존재 여부 검사.
- **테스트** `lib/utils/__tests__/validate-guide-html.test.ts:245-257`: `<p></p>`, `<p>   </p>`, `<ul><li></li></ul>` 모두 EMPTY_CONTENT로 거부됨. **빈 케이스 검증은 이미 server-side 단위 테스트로 보장**.

### `app/integration/admin/guides/components/GuidePreviewPanel.tsx:86-87`

```tsx
const isEmpty = previewHtml.trim() === '';
const validation = isEmpty ? null : validateGuideHtml(previewHtml);
```

→ 미리보기는 이미 `validateGuideHtml`을 client-side에서 사용 중. **같은 패턴을 editor panel에서도 사용** (Tiptap → linkedom 미포함, browser DOMParser 경로).

### `app/hooks/useApiMutation.ts:69-92`

`mutate` 내부에 in-flight gate 없음 (`setLoading(true)` 이후 동시 호출 방지 안 함). `canSave`가 `!loading`을 포함하므로 button 클릭은 재방어되지만, ⌘S spam의 closure-capture 경합은 별개 이슈 → 이번 scope 밖.

### `lib/theme.ts:52-58`

`statusColors.error.text = 'text-red-500'` — 기존 토큰. 새 토큰 추가 불필요.

## 변경 사양

### 1. 모듈 스코프 헬퍼 추가 (top-of-file, import 영역 뒤)

```tsx
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

/**
 * Server-side와 동일한 visible-text 의미로 본문 유무를 판정한다.
 * `'<p></p>'` 같은 Tiptap 빈 출력도 false 로 잡아내야 BFF의
 * GUIDE_CONTENT_INVALID 예외를 UI에서 미연에 차단할 수 있음.
 */
const hasGuideContent = (html: string): boolean => {
  const result = validateGuideHtml(html);
  if (result.valid) return true;
  // valid=false 라도 EMPTY_CONTENT 가 없는 케이스(예: 허용되지 않은 태그
  // 만 있고 visible text는 존재)는 본문은 있는 셈이므로 BFF에 맡긴다.
  return !result.errors.some((e) => e.code === 'EMPTY_CONTENT');
};
```

> `hasGuideContent`는 사이드이펙트 없는 순수 함수 → `useMemo`의 `[draftKo]` deps와 함께 사용하면 키스트로크마다 재실행되지만 단일 paragraph parse는 가벼움.

### 2. 컴포넌트 내부 derive (L186-187 영역 근처)

`koFilled`/`enFilled`는 그대로 둠 (탭 점 인디케이터). 추가:

```tsx
const koHasContent = useMemo(() => hasGuideContent(draftKo), [draftKo]);
const enHasContent = useMemo(() => hasGuideContent(draftEn), [draftEn]);
```

### 3. `seeded` state 추가 (L172-173 근처)

```tsx
const [seeded, setSeeded] = useState(false);
```

L180-184 effect 갱신:

```tsx
useEffect(() => {
  if (data) {
    onLoad(data.contents);
    setSeeded(true);
  }
}, [data, onLoad]);
```

> `key={selected}` (page.tsx:127) 가 step 전환 시 panel을 remount → `seeded`도 자연스레 false에서 시작. 별도 reset 불필요.

### 4. `canSave` 단일화 (L230)

```tsx
const canSave =
  dirty && !saving && !loading && koHasContent && enHasContent;
```

### 5. `handleSave` 일관화 (L218-228)

```tsx
const handleSave = useCallback(async (): Promise<void> => {
  if (!canSave) return;
  const result = await save({ contents: { ko: draftKo, en: draftEn } });
  if (result) {
    toast.success('저장되었습니다');
    setTouchedKo(false);
    setTouchedEn(false);
  }
}, [canSave, save, draftKo, draftEn, toast]);
```

> `canSave`가 deps에 들어가므로 매 변경마다 `handleSave` identity가 바뀜 → ⌘S 단축키 effect(L263-272)도 자동 재바인딩. 키 입력당 한 번 reset되는 정도라 비용 무시 가능.

### 6. `saveStateMessage` 확장 + 언어별 분기 (L357-363)

```tsx
const emptyMessage =
  !koHasContent && !enHasContent
    ? '한국어 / 영어 본문이 필요합니다'
    : !koHasContent
      ? '한국어 본문이 필요합니다'
      : !enHasContent
        ? '영어 본문이 필요합니다'
        : null;

const saveStateMessage: { kind: 'disabled' | 'warning' | 'error'; text: string } | null = !seeded
  ? null
  : emptyMessage
    ? { kind: 'error', text: emptyMessage }
    : !dirty
      ? { kind: 'disabled', text: '한국어 / 영어 수정이 발생하지 않았습니다' }
      : editedKo && !editedEn
        ? { kind: 'warning', text: '영어는 수정되지 않았습니다 — 기존 내용이 그대로 저장됩니다' }
        : !editedKo && editedEn
          ? { kind: 'warning', text: '한국어는 수정되지 않았습니다 — 기존 내용이 그대로 저장됩니다' }
          : null;
```

### 7. 푸터 텍스트 컬러 분기 (L505-514)

```tsx
<span
  className={cn(
    'text-[11.5px] leading-snug',
    saveStateMessage?.kind === 'error'
      ? statusColors.error.text
      : saveStateMessage?.kind === 'warning'
        ? statusColors.warning.textDark
        : textColors.tertiary,
  )}
  aria-live="polite"
>
  {saveStateMessage?.text ?? ''}
</span>
```

> `aria-live="polite"`는 그대로. 메시지 kind이 disabled→error 로 바뀌어도 텍스트 변경이라 polite 충분 (스크린리더가 사용자 입력을 인터럽트하지 않음).

## 의도적으로 하지 않는 것

- **백엔드 메시지 개선**: BFF는 이미 `GUIDE_CONTENT_INVALID`를 반환하고 있고, 프런트가 잘못된 요청을 보내지 않게 막는 게 이번 task. 백엔드 메시지 개선은 별개 작업.
- **타입 변경 (`ko: string | null`)**: 현재 타입 `ko: string`을 유지. `hasGuideContent`는 빈 문자열도 자연스럽게 false로 처리. 타입을 nullable로 바꾸면 다른 곳까지 파급되므로 scope 초과.
- **⌘S spam 동시성 가드 (in-flight ref)**: `useApiMutation`의 closure-capture 경합은 별개 이슈. `canSave`에 `!loading`이 포함되어 있어 정상 흐름에선 두 번째 호출이 차단되지만, 키 폭주 케이스의 race는 남음 → 이번 PR scope 밖.
- **`hasVisibleText` export**: validate-guide-html.ts를 안 건드림. `validateGuideHtml`의 결과를 통해 의미를 추출 (모듈 경계 변경 없음).
- **`koFilled`/`enFilled` 제거**: 언어 탭 점 인디케이터용으로 계속 쓰임 — strict 검사가 필요한 곳은 `koHasContent` 별도 사용.

## 검증

### 자동화 (단위 테스트)

신규 파일: `app/integration/admin/guides/components/__tests__/has-guide-content.test.ts` (또는 `GuideEditorPanel.test.ts`로 통합 가능)

`hasGuideContent` 케이스:
- `''` → false
- `'   '` (공백만) → false
- `'<p></p>'` → false (Tiptap 빈 에디터 케이스 — Codex Critical)
- `'<p>   </p>'` → false
- `'<ul><li></li></ul>'` → false
- `'<p>hello</p>'` → true
- `'<p><strong>x</strong></p>'` → true

> 본 헬퍼가 `validateGuideHtml`의 wrapper이므로 server-side 테스트(`lib/utils/__tests__/validate-guide-html.test.ts`)와 동일한 케이스로 mirror 검증.

### 수동 (mock 모드 dev 서버)

1. `/integration/admin/guides` 진입 → AWS 탭 선택 → step 하나 클릭.
2. **Codex Critical 재현 확인**: 에디터에서 한국어 본문 모두 지움 (Tiptap이 `<p></p>`로 직렬화 — DevTools에서 onUpdate emit 값 확인). 영어는 그대로.
   - **기대**: 푸터에 빨간 글씨 "한국어 본문이 필요합니다", 저장 버튼 disabled, ⌘S 무반응 (이전 plan에서 회귀했을 케이스).
3. 한국어를 다시 입력 → 빨간 메시지 사라짐, 저장 활성.
4. 한·영 모두 비움 → "한국어 / 영어 본문이 필요합니다" 노출.
5. step 전환 직후 GET 진행 중 → 빨간 메시지 깜빡이지 않음 (`seeded` 가드 — Codex Major 검증).
6. mock 데이터에서 임의 가이드의 `en`을 `''`로 미리 만들어두고 페이지 진입 → 즉시 "영어 본문이 필요합니다" 노출.
7. 키보드 ⌘S 시도 → 빈 케이스에서 무반응. 양쪽 채운 상태에서 ⌘S → 정상 저장.
8. **a11y**: `aria-live="polite"` 영역이 비기→error→warning→none 으로 변할 때 스크린리더 음성 안내가 자연스러운지 VoiceOver로 1회 확인.

### 회귀 검사

- 양쪽 모두 채운 일반 케이스 → 기존 disabled/warning 메시지 그대로.
- 한 쪽만 편집한 케이스 → amber warning 그대로 (양쪽 모두 visible content 있음).

## 영향 파일

- `app/integration/admin/guides/components/GuideEditorPanel.tsx` — **유일한 수정 대상**
- `app/integration/admin/guides/components/__tests__/has-guide-content.test.ts` — **신규 (단위 테스트)**

## 변경 통계 (예상)

- GuideEditorPanel.tsx: +25 lines, -8 lines (헬퍼 import + memo + state + 메시지 분기 + 색상 분기)
- 신규 테스트: +30 lines (단순 케이스 7개)
