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
- `install-v1-client.yaml`

## 반영 원칙

- 이 디렉터리의 YAML은 이슈 본문 내용을 기준으로 1차 분리 반영했습니다.
- 최종 API Contract 확정은 `MIGRATION_PLAN.md`에 정의한 합의/검토 항목을 반영한 뒤 진행합니다.
- 현재 세션 결정사항(용어/버전/식별자)은 migration 계획 문서에 별도로 기록했습니다.

## 로컬 미리보기

`npm run dev` 실행 후 아래 경로에서 확인할 수 있습니다.

- 통합 문서 허브(Swagger UI, one-page): `/integration/api-docs`  
  예: `http://localhost:3001/integration/api-docs`
- 개별 문서(Swagger UI): `/integration/swagger/{spec}`  
  예: `http://localhost:3001/integration/swagger/aws`
- 기존 Swagger UI(개별): `/{spec}`  
  예: `http://localhost:3001/aws`
- Issue #222 실행형 미러: `/integration/api-docs?spec=install-v1-client`  
  예: `http://localhost:3001/integration/api-docs?spec=install-v1-client`

## 실제 BFF 연동

`/integration/api-docs?spec=install-v1-client` 의 `Try it out`은 브라우저가 BFF를 직접 호출하지 않습니다.

호출 경로는 아래와 같습니다.

`Swagger UI` → `Next.js /integration/api/v1/**` → `BFF_API_URL + /install/v1/**`

즉, 실행형 Swagger에서 실제 BFF를 확인하려면 Next.js 서버에 아래 설정이 필요합니다.

```bash
USE_MOCK_DATA=false
BFF_API_URL=http://your-bff-host:port
```

확인 체크리스트:

- Next.js 서버 프로세스가 `BFF_API_URL`에 네트워크로 접근 가능해야 합니다.
- upstream BFF는 `Issue #222` 기준 `/install/v1/**` 경로를 지원해야 합니다.
- Swagger는 Next.js same-origin API를 호출하므로, 브라우저에서 BFF CORS를 직접 열 필요는 없습니다.
- 현재 구현은 외부 BFF로 인증 헤더/쿠키를 자동 전달하지 않습니다. BFF가 별도 인증 없이 접근 가능하거나, 같은 내부망/VPN에서 허용되어야 합니다.
