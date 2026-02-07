# Parallel Code Review

> **팀 개발 모드**를 사용 중이라면 `/team-dev`의 code-reviewer 에이전트가 아래 4개 검사를 통합하여 더 깊은 리뷰를 수행합니다.

$ARGUMENTS 경로에 대해 4개의 전문 리뷰어를 **병렬로** 실행합니다.

## 실행 방법

다음 4개의 리뷰 작업을 **동시에 병렬로** Task tool을 사용하여 실행하세요:

### 1. TypeScript Checker
- **subagent_type**: `Explore`
- **prompt**: `typescript-checker 에이전트 역할로 $ARGUMENTS 경로의 파일들을 검사하세요. any 타입 사용, Props interface 정의, arrow function 사용 여부를 확인하고 이슈를 보고하세요.`

### 2. React Pattern Checker
- **subagent_type**: `Explore`
- **prompt**: `react-pattern 에이전트 역할로 $ARGUMENTS 경로의 파일들을 검사하세요. 외부 상태 라이브러리 사용 여부, 컴포넌트 크기(150줄), hooks 규칙 준수를 확인하고 이슈를 보고하세요.`

### 3. Tailwind Style Checker
- **subagent_type**: `Explore`
- **prompt**: `tailwind-style 에이전트 역할로 $ARGUMENTS 경로의 파일들을 검사하세요. UI 컬러 규칙(green-500=완료, red-500=에러, blue-500=신규, orange-500=진행중, gray-400=대기), CSS 파일 최소화를 확인하고 이슈를 보고하세요.`

### 4. Project Structure Checker
- **subagent_type**: `Explore`
- **prompt**: `project-structure 에이전트 역할로 프로젝트 폴더 구조를 검사하세요. 파일이 올바른 위치(ui/, features/, types/, lib/)에 있는지, PascalCase 네이밍을 사용하는지 확인하고 이슈를 보고하세요.`

## 중요 사항

- **반드시 4개 Task를 한 번의 응답에서 동시에 호출**하세요
- 각 Task는 독립적인 컨텍스트에서 실행됩니다
- 모든 Task 완료 후 결과를 수집하세요

## 최종 출력 형식

모든 리뷰어의 결과를 수집한 후, 다음 형식으로 **통합 리포트**를 생성하세요:

```
## 코드 리뷰 결과

### 🔴 Critical 이슈
- [파일:라인] 설명 (검사자: typescript/react/tailwind/structure)

### 🟡 Warning 이슈
- [파일:라인] 설명 (검사자: typescript/react/tailwind/structure)

### 🟢 Suggestions
- [파일] 설명 (검사자: typescript/react/tailwind/structure)

### 요약
- 총 이슈: N개 (Critical: X, Warning: Y, Suggestion: Z)
- 우선 수정 필요: Top 3 이슈 나열
```
