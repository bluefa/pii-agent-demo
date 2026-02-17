# Swagger Sources (Issue #122)

이 디렉터리는 GitHub Issue #122에 등록된 Swagger 초안을 섹션별로 분리해 반영한 결과입니다.

원본 이슈: https://github.com/bluefa/pii-agent-demo/issues/122

## 파일 목록

- `scan.yaml`
- `user.yaml`
- `confirm.yaml`
- `credential.yaml`
- `aws.yaml`
- `azure.yaml`
- `gcp.yaml`
- `idc.yaml`
- `sdu.yaml`
- `logical-db-status.yaml`

## 반영 원칙

- 이 디렉터리의 YAML은 이슈 본문 내용을 기준으로 1차 분리 반영했습니다.
- 최종 API Contract 확정은 `MIGRATION_PLAN.md`에 정의한 합의/검토 항목을 반영한 뒤 진행합니다.
- 현재 세션 결정사항(용어/버전/식별자)은 migration 계획 문서에 별도로 기록했습니다.

## 로컬 미리보기

`npm run dev` 실행 후 아래 경로에서 확인할 수 있습니다.

- 통합 문서 허브(Swagger UI, one-page): `/api-docs`  
  예: `http://localhost:3001/api-docs`
- 개별 문서(Swagger UI): `/api-docs/{spec}`  
  예: `http://localhost:3001/api-docs/aws`
- 기존 Swagger UI(개별): `/{spec}`  
  예: `http://localhost:3001/aws`
