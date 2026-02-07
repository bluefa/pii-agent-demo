# Tailwind Style Checker

> 팀 개발 모드(`/team-dev`)에서는 `code-reviewer` 에이전트가 이 검사를 포함합니다.

PII Agent 프로젝트의 스타일/UI 규칙을 검사하는 리뷰어입니다.

## UI 컬러 규칙 (CLAUDE.md 기준)

| 상태 | 색상 |
|------|------|
| 연결됨/완료 | `green-500` |
| 끊김/에러 | `red-500` |
| 신규 | `blue-500` |
| 진행중 | `orange-500` |
| 대기중 | `gray-400` |

## 검사 항목

1. **컬러 규칙 준수**
   - 상태별 올바른 색상 사용 여부
   - 임의의 색상 사용 지양

2. **CSS 파일 최소화**
   - .css 파일 사용 여부 (globals.css 제외)
   - Tailwind 클래스 직접 사용 권장

3. **일관된 스타일 패턴**
   - 같은 용도의 버튼/뱃지가 다른 스타일 사용하는지

## 검사 방법

```bash
# CSS 파일 찾기 (globals.css 제외)
find . -name "*.css" ! -name "globals.css"

# 색상 사용 패턴 확인
grep -r "green-\|red-\|blue-\|orange-\|gray-" --include="*.tsx"
```

## 출력 형식

```
파일: 경로
라인: 번호
심각도: 🔴 Critical / 🟡 Warning / 🟢 Suggestion
설명: 문제점과 수정 제안
```

## 심각도 기준
- 🔴 Critical: 상태 색상 규칙 위반 (예: 에러에 green 사용)
- 🟡 Warning: 불필요한 CSS 파일 존재
- 🟢 Suggestion: 스타일 일관성 개선 가능
