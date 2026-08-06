# API Call Map (Cloud × Step)

각 Cloud Provider(AWS / Azure / GCP / IDC)별로, **Step(ProcessStatus 1–7)** 단위로 발생하는
모든 API 호출을 **트리거 종류**로 분류해 정리한 문서다.

| 트리거 | 의미 |
|---|---|
| `화면진입` | 스텝 화면/컴포넌트 mount·useEffect·SSR 페이지 로드·polling 시작 시 발생 |
| `버튼클릭` | 스텝 화면의 버튼/컨트롤 클릭으로 발생 |
| `모달진입` | 모달이 열릴 때(mount·`isOpen` useEffect) 발생 |
| `모달버튼` | 모달 내부 버튼 클릭으로 발생 |

## 호출 경로 (wiring)

```
page.tsx (Server Component)
  └─ bff.targetSources.get(id)         ── SSR: 상위 BFF 직접 호출
ProjectDetail → {Aws|Azure|Gcp|Idc}ProjectPage
  └─ processStatus 분기 → Step 컴포넌트
       └─ handler / hook → app/lib/api/* client fn
            └─ fetchInfra(path)        ── CSR: Next.js 프록시 경유
```

- **SSR 직접 호출**: 서버 컴포넌트(`page.tsx`)에서 `bff.targetSources.get()` 이 `lib/bff/http.ts` →
  `fetch(BFF_URL + toUpstreamInfraApiPath(path))` 로 **상위 BFF 를 직접** 호출한다. 경로 prefix 는
  `/install/v1` (`lib/infra-api.ts` `UPSTREAM_INFRA_API_PREFIX`). 모든 스텝의 화면 진입마다 1회 발생.
- **CSR 프록시 호출**: 브라우저의 client fn(`app/lib/api/*`)은 `fetchInfra(path)` 로 Next.js 라우트
  `/integration/api/v1` (`INTERNAL_INFRA_API_PREFIX`) 을 호출하고, 그 라우트가 다시 상위 BFF
  `/install/v1` 로 포워딩한다(2-hop). 본 문서의 endpoint 컬럼은 **CSR 가 직접 때리는 내부 경로**
  (`/integration/api/v1/...`)를 기준으로 표기한다.
- `{id}` = `targetSourceId`, `{resourceId}` = 리소스 식별자 placeholder.

## Polling

| hook | 대상 | interval | 지속 조건 |
|---|---|---|---|
| `useScanPolling` | `scanJob/latest` | 2s | 스캔 SCANNING 동안 |
| `ProcessStatusCard` 내부 polling | `process-status` | 10s | WAITING_APPROVAL / APPLYING_APPROVED 동안 |
| `useTestConnectionPolling` | `test-connection/latest_version` | 4s | 테스트 PENDING/RUNNING 동안 |
| `useInstallationStatus` | `{cloud}/.../installation-status` | 1회 fetch (완료 시 `onComplete`) |

## 검증 방식

각 Cloud·Step 표는 **Sonnet 서브에이전트 2개 + Codex 서브에이전트 1개**가 독립적으로 코드를 추적해
열거한 뒤, 불일치 항목을 실제 소스(권위)로 대조·확정한 결과다.

- AWS / Azure / GCP: 공유 레이아웃(`_components/layout/*Step.tsx`)을 쓰므로 스텝 골격은 동일하고,
  설치(installation-status·terraform-script)·모달 등 Cloud 고유 호출만 다르다.
- IDC: 독자 레이아웃(`IdcTargetSourceLayout` → `idc/steps/IdcStep1..7`)을 쓴다.

### 교차 검증에서 해소한 불일치 (3-way 대조 결과)

세 에이전트가 갈린 지점은 모두 실제 코드로 확정했다.

1. **SSR 진입 호출의 base** — Codex 는 `/integration/api/v1/...`(CSR 프록시)로 적었으나, 실제
   `page.tsx` 의 `bff.targetSources.get` 은 `lib/bff/http.ts` 에서 상위 BFF 를 직접 호출하므로
   `/install/v1/target-sources/{id}` 가 맞다(`lib/infra-api.ts` `UPSTREAM_INFRA_API_PREFIX`).
   → 전 스텝 `화면진입` SSR 행을 `/install/v1` 로 확정.
2. **GCP Step 7 의 `latest-results` 호출** — GCP Sonnet 2개가 누락했으나, 완료 스텝의 공유 컴포넌트
   `InstallationCompleteStep` → `ConfirmedResourcesSlot variant="complete"` →
   `ConfirmedIntegrationTable`(`:56-58`)이 `variant==='complete'` 일 때 `getLatestTestConnectionResultSummaries`
   를 호출한다. AWS/Azure 와 동일. → GCP Step 7 에 추가.

그 외 follow-on `refreshProject` GET, 오류 `다시 시도` 버튼 호출 등은 세 결과의 합집합으로 보강했다.

### 2차 per-(Cloud,Step) 검증 라운드

완성된 문서를 다시 Cloud마다 Sonnet 2 + Codex 1로 **Step(셀) 단위 재검증**(총 8+4)했다. 엔드포인트·
Method·트리거 분류는 4 Cloud × 7 Step 전부 정확했고, 유일한 내용 누락은 **Step 5 confirmed-integration
로드 오류 시 `다시 시도` 버튼**(`WaitingConnectionTestStep.tsx:39` `ErrorRow onRetry` → `getConfirmedIntegration`,
AWS/Azure/GCP 공유)으로, 세 문서 Step 5에 추가했다. 나머지 지적은 모두 ±1~4줄 인용 오차(내용 무관)였다.
