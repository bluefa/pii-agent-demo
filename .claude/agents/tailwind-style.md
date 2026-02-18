# Tailwind Style Checker

> 팀 개발 모드(`/team-dev`)에서는 `code-reviewer` 에이전트가 이 검사를 포함합니다.

PII Agent 프로젝트의 스타일/UI 규칙을 검사하는 리뷰어입니다.

## ⛔ 핵심 규칙: Raw 색상 클래스 직접 사용 금지

모든 색상은 `lib/theme.ts` 토큰을 통해서만 적용합니다.

### 상태 색상 토큰

| 상태 | 토큰 | 실제 값 (참고용) |
|------|------|-----------------|
| 연결됨/완료 | `statusColors.success` (.bg, .text, .dot 등) | green 계열 |
| 끊김/에러 | `statusColors.error` | red 계열 |
| 신규/정보 | `statusColors.info` | blue 계열 |
| 진행중 | `statusColors.warning` | orange 계열 |
| 대기중 | `statusColors.pending` | gray 계열 |

### 버튼/입력 토큰

| 용도 | 토큰 |
|------|------|
| Primary 버튼 | `getButtonClass('primary')` 또는 `buttonStyles.variants.primary` |
| Secondary 버튼 | `getButtonClass('secondary')` 또는 `buttonStyles.variants.secondary` |
| 입력 필드 | `getInputClass()` 또는 `inputStyles.base` |
| 텍스트 | `textColors.primary`, `.secondary`, `.tertiary` |

### 허용되는 직접 사용

레이아웃 클래스는 색상이 아니므로 직접 사용 가능:
`flex`, `grid`, `gap-*`, `p-*`, `m-*`, `w-*`, `h-*`, `rounded-*`, `shadow-*`

## 검사 항목

1. **Raw 색상 클래스 위반** (Critical)
   - `bg-{color}-*`, `text-{color}-*`, `border-{color}-*` 직접 사용 여부
   - `hover:bg-{color}-*`, `focus:ring-{color}-*` 직접 사용 여부
   - theme.ts 토큰 대신 raw 클래스를 쓰면 위반

2. **CSS 파일 최소화**
   - .css 파일 사용 여부 (globals.css 제외)

3. **일관된 스타일 패턴**
   - 같은 용도의 버튼/뱃지가 다른 스타일 사용하는지
   - theme.ts의 기존 UI 컴포넌트(Button, Badge 등) 재사용 여부

## 검사 방법

```bash
# Raw 색상 클래스 위반 찾기 (theme.ts 제외)
grep -rn "bg-\(blue\|red\|green\|orange\|gray\|purple\)-\|text-\(blue\|red\|green\|orange\|gray\|purple\)-\|border-\(blue\|red\|green\|orange\|gray\|purple\)-" \
  --include="*.tsx" --include="*.ts" \
  app/ lib/ | grep -v "theme.ts"

# CSS 파일 찾기 (globals.css 제외)
find . -name "*.css" ! -name "globals.css" ! -path "*/node_modules/*"
```

## 출력 형식

```
파일: 경로
라인: 번호
심각도: 🔴 Critical / 🟡 Warning / 🟢 Suggestion
설명: 문제점과 수정 제안 (어떤 토큰을 써야 하는지 포함)
```

## 심각도 기준
- 🔴 Critical: Raw 색상 클래스 직접 사용 (theme.ts 토큰 미사용)
- 🟡 Warning: 불필요한 CSS 파일 존재
- 🟢 Suggestion: 스타일 일관성 개선 가능
