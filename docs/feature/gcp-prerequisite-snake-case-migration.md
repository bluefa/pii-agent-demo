# GCP 사전조치 API — snake_case 응답 전환 가이드

> **관련 PR:** #264 (feat: GCP 사전조치 조회)
> **대상 API:**
> - `GET /install/v1/target-sources/{id}/gcp/scan-service-account`
> - `GET /install/v1/target-sources/{id}/gcp/terraform-service-account`

## 현재 상태

현재 BFF mock 라우트는 **camelCase**로 응답합니다:

```json
{
  "gcpProjectId": "pii-agent-prod-12345",
  "status": "VALID",
  "lastVerifiedAt": "2026-04-13T13:11:12.945Z"
}
```

프론트엔드 API 클라이언트(`app/lib/api/gcp.ts`)는 `fetchInfraCamelJson`을 사용하며,
이 함수는 내부적으로 `camelCaseKeys` (`lib/object-case.ts`)를 적용합니다.

따라서 **BFF가 snake_case로 응답해도 프론트엔드는 변경 없이 동작합니다.**

## snake_case 전환 시 변경 사항

### 변경 필요 없는 파일 (프론트엔드)

| 파일 | 이유 |
|------|------|
| `app/lib/api/gcp.ts` | `fetchInfraCamelJson`이 자동 변환 |
| `app/components/features/GcpInfoCard.tsx` | camelCase 타입 그대로 사용 |
| `app/projects/[projectId]/gcp/GcpProjectPage.tsx` | camelCase 타입 그대로 사용 |
| `app/api/_lib/v1-types.ts` | FE 타입은 camelCase 유지 |

### 변경이 필요한 파일 (BFF 라우트)

실제 BFF 서버 연동 시, mock 라우트를 실제 upstream 프록시로 교체합니다.

#### 1. BFF 라우트 — upstream 프록시로 전환

**파일 2개:**
- `app/integration/api/v1/gcp/target-sources/[targetSourceId]/scan-service-account/route.ts`
- `app/integration/api/v1/gcp/target-sources/[targetSourceId]/terraform-service-account/route.ts`

**현재 (mock):**
```ts
// Mock 데이터를 직접 반환
const response: GcpServiceAccountInfo = {
  gcpProjectId,
  status: 'VALID',
  lastVerifiedAt: new Date().toISOString(),
};
return NextResponse.json(response);
```

**전환 후 (upstream 프록시):**
```ts
import { toUpstreamInfraApiPath } from '@/lib/infra-api';

// upstream BFF로 프록시
const upstreamPath = toUpstreamInfraApiPath(
  `/target-sources/${parsed.value}/gcp/scan-service-account`
);
const upstream = await fetch(`${BFF_BASE_URL}${upstreamPath}`, {
  headers: { /* 인증 헤더 전달 */ },
});
const body = await upstream.json();
return NextResponse.json(body, { status: upstream.status });
```

> upstream 응답이 snake_case(`gcp_project_id`, `last_verified_at`)이면
> 프론트엔드의 `fetchInfraCamelJson` → `camelCaseKeys`가 자동으로
> camelCase(`gcpProjectId`, `lastVerifiedAt`)로 변환합니다.

#### 2. (선택) BFF 라우트 내부에서 변환하는 패턴

프로젝트 내 다른 BFF 라우트가 **라우트 내부에서 snake → camel 변환 후 응답**하는 패턴을 따른다면:

```ts
import { camelCaseKeys } from '@/lib/object-case';

const upstream = await fetch(upstreamUrl);
const raw = await upstream.json();
// BFF에서 camelCase로 변환 후 응답
return NextResponse.json(camelCaseKeys(raw));
```

이 경우 프론트엔드의 `fetchInfraCamelJson`이 이중 변환하지만,
이미 camelCase인 키에 `camelCaseKeys`를 적용해도 **멱등(idempotent)**이므로 문제없습니다.

## snake_case 응답 예시와 변환 결과

**BFF 실제 응답 (snake_case):**
```json
{
  "gcp_project_id": "pii-agent-prod-12345",
  "status": "INVALID",
  "fail_reason": "SA_INSUFFICIENT_PERMISSIONS",
  "fail_message": "Scan SA에 필요한 IAM 역할이 부족합니다.",
  "last_verified_at": "2026-02-15T10:30:00Z"
}
```

**`camelCaseKeys` 변환 후 (프론트엔드가 받는 값):**
```json
{
  "gcpProjectId": "pii-agent-prod-12345",
  "status": "INVALID",
  "failReason": "SA_INSUFFICIENT_PERMISSIONS",
  "failMessage": "Scan SA에 필요한 IAM 역할이 부족합니다.",
  "lastVerifiedAt": "2026-02-15T10:30:00Z"
}
```

> `status`, `VALID`, `INVALID` 등 **값(value)**은 변환되지 않습니다.
> 키(key)만 snake_case → camelCase로 변환됩니다.

## 전환 체크리스트

- [ ] BFF 라우트 2개를 upstream 프록시로 교체
- [ ] upstream 응답 스키마가 Swagger 명세(`#259`)와 일치하는지 확인
- [ ] `curl`로 BFF 엔드포인트 호출 → 응답 필드명 확인
- [ ] dev 서버에서 GCP 상세 페이지 → 사전 조치 현황 정상 표시 확인
- [ ] 에러 케이스 (403, 404) 응답 형식 확인

## 데이터 흐름 요약

```
실제 BFF 서버                    Next.js BFF Route              프론트엔드
(snake_case)                    (프록시)                       (camelCase)

{                               NextResponse.json(body)        fetchInfraCamelJson()
  "gcp_project_id": "...",  →   (snake_case 그대로 전달)    →   camelCaseKeys() 적용
  "fail_reason": "...",                                        → { gcpProjectId, failReason, ... }
  "last_verified_at": "..."                                      → GcpServiceAccountInfo 타입 매칭
}
```
