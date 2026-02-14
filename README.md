# PII Agent Demo

## 1. Dev 서버 실행 방법

권장 실행 방법은 아래 스크립트입니다.

```bash
bash scripts/dev.sh "$(pwd)"
```

동작:

1. `scripts/bootstrap-worktree.sh`로 의존성(`node_modules`) 자동 준비
2. `.next/dev/lock` 정리
3. 3000~3100 사이 빈 포트 탐색 후 `next dev` 실행

실행 후 콘솔에 출력되는 URL로 접속합니다.
예: `http://localhost:3001`

## 2. Swagger 확인 페이지

Swagger 문서는 아래 경로에서 확인할 수 있습니다.

- 통합 문서 페이지(권장): `/api-docs`
- 개별 문서 직접 페이지: `/{spec}`
  - 예: `/aws`, `/azure`, `/gcp`, `/scan`, `/user`, `/credential`, `/confirm`
- `api-docs`에서 개별 스펙 선택도 가능: `/api-docs?spec=aws`

## 3. 첫 진입 가이드

프로젝트 실행 후 최초 진입은 아래 경로를 사용합니다.

- `/admin`

예:

- `http://localhost:3001/admin`
