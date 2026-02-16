# Contract Validation Playbook

API 작업에서 계약 정합성을 확인할 때 공통으로 사용하는 규칙입니다.

## 목적

- Swagger 계약 우선 원칙 강제
- 런타임 코드 변경과 계약 문서 변경의 괴리 탐지
- 도메인별 legacy 필드/플래그 사용 금지 규칙을 재사용 가능하게 중앙 관리

## 공통 명령

### 개발 중(스테이징 기준)

```bash
bash scripts/contract-check.sh --mode staged
```

### PR 준비(브랜치 diff 기준)

```bash
bash scripts/contract-check.sh --mode diff --base origin/main --head HEAD
```

## Rule 파일

- 기본 파일: `.claude/skills/shared/contract-check.rules`
- 형식: `<regex>|<message>`
- 주석: `#`

예시:

```text
# \blegacyFlag\b|Legacy flag is deprecated. Use canonical source field instead.
# \bdeprecated_field\b|Deprecated payload field must not be used.
```

## 실패 처리 원칙

- Contract check 실패 시 lint/test/build 성공 여부와 무관하게 실패로 처리
- 불가피한 legacy 유지가 필요하면 코드에 TODO를 남기고 제거 계획을 PR 본문에 기록
