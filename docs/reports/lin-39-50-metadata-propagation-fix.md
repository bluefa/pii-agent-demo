# D1 Follow-up (LIN-39 ~ LIN-50) — 승인 파이프라인 metadata 유실 분석 및 수정 계획

> 작성일: 2026-07-04 · 브랜치: `fix/d1-metadata-propagation`
> 대상: Admin Pipeline / 연동 대상 승인 흐름 (Step1 후보 조회 → Step2 승인 대기 → Step3 반영중)

## 1. 한 줄 요약

12개 이슈 중 **11개는 하나의 근본 원인**을 공유한다: 계약(`docs/swagger/install-v1.yaml`)에서
`database_type`·`region`·`provider` 는 리소스 항목의 **`metadata` 객체 안**에 있고 `resource_name` 은
**최상위 필드**인데, 코드가 이 값들을 최상위로 잘못 읽거나(→ 항상 빈 값), 승인 요청 payload를 만들 때
**아예 빠뜨려서** Step1→Step2→Step3 로 흐르며 유실된다. 나머지 1개(LIN-39)는 스캔 폴링 첫 요청이
실패하면 `loading` 상태가 영구히 `true` 로 굳어 "Run Infra Scan" 버튼이 비활성화로 잠기는 별개 버그다.

## 2. 계약이 말하는 실제 shape (근거)

`lib/generated/install-v1.ts` — 승인 요청/응답·리소스 조회가 모두 쓰는 `TargetSourceResourceItemDto`:

```
TargetSourceResourceItemDto {
  selected?, resource_id?, resource_name?,      // ← resource_name 은 최상위
  resource_type?, integration_category?, exclusion_reason?,
  metadata: TargetSourceResourceMetadataDto {   // ← 나머지는 전부 여기 안
    provider, region, database_type, host, port,
    resource_type, oracle_service_id, network_interface_id,
    project_id, subscription_id, resource_group, server_name,
    instance_name, cloud_sql_type, idc_host_format, idc_ips, idc_host, ...
  }
}
```

- 이 DTO에는 **최상위 `database_type` 이 없다.** `database_type` 은 `metadata.database_type` 뿐이다.
- 이 DTO는 `ApprovalRequestInputDto.resources`(요청), `ApprovalRequestLatestDto.resources`(Step2),
  `ApprovedIntegrationResponseDto.resources`(Step3), `CloudResourceResponse.resources`(Step1) 에서
  **동일하게** 쓰인다. 즉 읽는 쪽·쓰는 쪽 모두 같은 계약이므로, "metadata에 담아 보내고 metadata에서
  읽는다"가 정답이다.

## 3. 왜 목업에서는 안 드러났나 (중요)

현재 화면이 값이 보이는 이유는 **목업이 계약 밖 shape로 값을 채워주기 때문**이지, 파이프라인이
올바르기 때문이 아니다. 실제 백엔드(계약 준수)로 바꾸면 빈 값이 드러난다.

- `lib/bff/mock/confirm.ts` `toResourceCatalogItem` 은 계약에 없는 **최상위 `database_type`**(L251)을
  방출한다. 클라이언트(`index.ts` L355)가 이 최상위 필드를 읽어 "동작하는 것처럼" 보인다.
  → 실제 백엔드는 이 필드를 안 주므로 Step1 테이블 Database Type 이 공란이 된다. (LIN-42)
- Step2/Step3 는 목업 `getApprovalRequestLatest`(L941-964)·`toResourceSnapshot`(L272-304)이
  **제출된 payload가 아니라 seed(`project.resources`)에서 metadata를 재파생**하기 때문에, 승인 요청
  payload가 metadata를 담든 말든 값이 보인다. → LIN-40/41/50 은 목업 화면만으로는 검증되지 않는다.
  (그래서 payload 빌더에 대한 **단위 테스트**로 검증한다 — §7)

이 문서의 수정에는 목업을 계약 위치로 맞추는 최소 변경을 포함한다(§6). 그래야 LIN-42 수정이
"거짓 빨강"(공란) 없이, LIN-47 수정이 "거짓 초록" 없이 검증된다.

## 4. 데이터 흐름과 유실 지점

```
/resources (CloudResourceResponse: TargetSourceResourceItemDto[])
  └─ toConfirmResourceItem (index.ts)                 [LIN-42] database_type ← 최상위(항상 undefined) ❌
        └─ CatalogItem { name, databaseType, metadata }
              └─ catalogToCandidates (resource-catalog) [LIN-44/45] name(resource_name) 미전달 ❌
                    └─ CandidateResource { databaseType, metadata } (resourceName 없음)
                          ├─ CandidateResourceTable    [LIN-43] 빈 db_type → 빈 badge ❌
                          ├─ toModalResources           [LIN-49] databaseType 누락 → 모달 표시 불가 ❌
                          │     └─ ApprovalRequestModal  [LIN-48] DB종류 컬럼 없음 ❌
                          └─ buildResourceInputs (approval-payload)
                                [LIN-41/50] metadata에 provider/region/db_type 누락 ❌
                                [LIN-44]    resource_name = resourceId (원본명 아님) ❌
                                → POST createApprovalRequest (ApprovalRequestInputDto)
IDC: toIdcApprovalRequestInput (IdcStep1TargetInput)  [LIN-40] metadata:{} 로 db_type 유실 ❌

Step2: WaitingApprovalCard ← latest.resources.metadata.{region,database_type}  ✅ (이미 계약 준수)
Step3: ApplyingApprovedCard.toSelectedRow                [LIN-46/47]
        region ← database_region(계약 밖), db_type ← endpoint_config.db_type ❌ → metadata.* 로 교정
```

## 5. 이슈별 분석과 수정

| 이슈 | 파일 | 문제(근본 원인) | 수정 |
|------|------|------|------|
| **LIN-42** | `app/lib/api/index.ts` `toConfirmResourceItem` | `databaseType` 를 `item.database_type`(계약에 없는 최상위)에서 읽어 항상 `''`. Step1 DB종류 공란의 진짜 원인. | `metadata.database_type` 에서만 읽음(최상위는 계약에 없어 제거). |
| **LIN-44** | `lib/types/resources/candidate.ts` | `CandidateResource` 에 원본 리소스명 필드가 없어 `resource_name` 이 유실. | `resourceName: string` 추가. |
| **LIN-45** | `lib/resource-catalog.ts` `catalogToCandidates` | catalog의 `name`(=resource_name)을 candidate로 전달 안 함. + `buildResourceInputs` 가 `resource_name: candidate.resourceId`(ID를 이름으로) 전송. | `resourceName: item.name` 전달, payload는 `candidate.resourceName` 사용. |
| **LIN-41** | `.../candidate/approval-payload.ts` `buildResourceInputs` | 선택 리소스 metadata가 endpoint(VM) 필드만 담아, 비-VM(credential/default)은 provider/region/db_type 전부 누락. | metadata 기본값을 `candidate.metadata`(provider/region) + `candidate.databaseType` 로 채우고 behavior 필드를 위에 spread. **provider는 wire 값으로 변환**(`cloudProviderToWireProvider`: 내부 `Azure`→계약 `AZURE`). |
| **LIN-50** | 위와 동일 | 위 metadata에 `database_type` 이 없음. | 위 수정에 포함(`database_type: candidate.databaseType`). |
| **LIN-49** | `approval-payload.ts` `toModalResources` | 모달용 resource에 `databaseType` 미포함 → 모달이 DB종류를 못 보여줌. | `databaseType: candidate.databaseType` 추가. |
| **LIN-48** | `app/components/features/process-status/ApprovalRequestModal.tsx` | `ApprovalRequestResource` 에 `databaseType` 필드·컬럼 없음. 승인자가 어떤 DB인지 확인 불가. | 필드 추가 + "포함 리소스" 테이블에 Database Type 컬럼(빈값 `—`). |
| **LIN-40** | `.../idc/steps/IdcStep1TargetInput.tsx` `toIdcApprovalRequestInput` | 선택 IDC 행을 `metadata:{}` 로 보내, 수동 입력한 `databaseTypeWire` 가 유실(IDC는 스캔이 없어 백엔드가 복원 불가). | 선택 행 metadata에 `provider:'IDC'`·`database_type: r.databaseTypeWire`. 낡은 "metadata is empty" 주석 갱신. |
| **LIN-46** | `lib/types.ts` `ResourceSnapshot` | approval 응답 metadata를 담을 자리가 없어 Step3에서 region/db_type 유실. | `metadata?: { provider?; region?; database_type? } | null` 추가. |
| **LIN-47** | `.../layout/ApplyingApprovedCard.tsx` `toSelectedRow` | region을 계약 밖 `database_region`, db_type을 `endpoint_config.db_type` 에서 읽음. | `metadata.region`·`metadata.database_type`(+계약 필드 `resource_type`)에서만 read, 계약 밖 fallback 제거. `integration_status`는 계약에 홈이 없어 유지(완료 카운트 소스, §9 후속). |
| **LIN-43** | `.../candidate/CandidateResourceTable.tsx` | `effectiveDbType===''` 이면 빈 파란 badge가 렌더(`getDatabaseLabel('')===''`). | 빈 문자열이면 badge 대신 `—`. |
| **LIN-39** | `app/hooks/useScanPolling.ts` | `loading` 은 성공 콜백(`handleUpdate`)에서만 `false` 로 풀림. 첫 폴링이 에러면 콜백이 안 불려 `loading` 이 영구 `true` → `CandidateResourceSection` L229 `disabled={initialLoading...}` 로 Run Infra Scan 버튼이 잠김. | 첫 응답이 에러로 settle돼도 `loading=false`(baseError effect에서 `firstFetchRef` 리셋). |

### LIN-39 — 이슈의 리터럴 처방을 그대로 따르지 않는 이유 (push-back)

이슈는 "폴링 에러 시 `null` 반환"을 제안한다. 그러나 `fetchLatestScan` 이 **모든** 에러를 `null` 로
삼키면:
1. 기존 테스트(`useScanPolling.test.ts` L47-48)가 검증하는 **error-stop 불변식**(연속 3회 실패 시
   폴링 종료, 에러 보존)이 깨진다.
2. 스캔 **진행 중** 일시적 blip에서도 `latestJob` 이 `null` 이 되어 진행 화면이 사라지는 **회귀**가 생긴다.

버튼이 잠기는 실제 원인은 `latestJob`(이미 null 처리됨)이 아니라 **`loading` 이 안 풀리는 것**이다.
따라서 완료 기준("폴링 실패 시에도 버튼 사용 가능")을 만족시키는 최소·정확한 수정은 `loading` 을 첫
settle에서 풀어주는 것이며, 에러 처리·불변식은 그대로 보존한다. (스캔 진행 중 버튼이 잠기는 선존
엣지케이스는 이 이슈 범위 밖 — 별도.)

## 6. 목업 계약 정합성(검증 가능하게 만드는 최소 변경)

- `lib/bff/mock/confirm.ts` `buildMetadata`: 반환 metadata에 `database_type` 추가.
- `toResourceCatalogItem`: 계약에 없는 **최상위 `database_type` 제거**(metadata로 이동).
  → LIN-42 수정 전이면 Step1 공란(버그 재현), 수정 후면 정상. 정직한 검증.
- `toResourceSnapshot`: Step3용 `metadata:{ provider, region, database_type }` 방출(LIN-47 검증).

이 변경들은 목업을 계약 위치로 맞추는 것이며 계약(swagger)은 절대 수정하지 않는다.

## 7. 검증 계획

- **단위 테스트(payload 빌더 — LIN-41/44/49/50)**: `toApprovalRequestInput`·`toModalResources` 결과가
  `metadata.{provider,region,database_type}`·최상위 `resource_name`·모달 `databaseType` 를 담고
  `schemas.TargetSourceResourceItemDto.parse()` 를 통과함을 단언(목업 재파생이 가리는 부분을 직접
  검증). IDC(LIN-40)는 3줄·계약 합법 변경으로 `tsc` + 계약 shape로 검증(무거운 IdcStep1Row fixture 생략).
- **훅 테스트(LIN-39)**: 첫 폴링 에러 후 `loading===false` 단언 추가.
- **화면 검증(LIN-42/43/46/47/48)**: 목업 정합 변경 후 Step1 DB종류·모달 DB종류·Step3 region/db_type 확인.
- `tsc`, `lint`, `test`, `build` 전부 통과.

## 8. 유사 위험 — 다른 필드에서도 발생 여지 (사용자 요청 항목)

이 12건은 **점 수정**이고, 뿌리에는 두 개의 구조적 원인이 있다. 지금 손대지 않되(범위 밖) 알고 있어야 한다.

1. **`getApprovedIntegration` 의 `as unknown as ResourceSnapshot[]` 캐스팅**(`app/lib/api/index.ts` L458).
   Step3 응답은 계약상 `TargetSourceResourceItemDto`(metadata 중첩·resource_name 최상위)인데, 코드가
   가공의 내부 타입 `ResourceSnapshot`(`endpoint_config`·`database_region`·`scan_status`·`credential_id`
   최상위)으로 강제 캐스팅한다. 이 필드들은 **계약 최상위에 없다.** 지금 목업(`toResourceSnapshot`)이
   그 shape로 방출하기 때문에 동작할 뿐, 실제 백엔드에서는 전부 `undefined` 위험. LIN-46/47 은 이 중
   region/db_type 만 metadata로 되돌리는 부분 교정이다. **동일 위험 필드**: `scan_status`,
   `integration_status`, `credential_id`, `endpoint_config`(→ 계약은 metadata.host/port/... 로 옴).

2. **`toConfirmResourceMetadata` 의 부분 매핑**(`index.ts` L314-336). `TargetSourceResourceMetadataDto`
   는 24개 필드를 선언하는데 어댑터는 그중 일부(provider/region/vpc/project/subscription/resource_group/
   server_name/host/port)만 camel로 옮기고 나머지는 버린다. 아직 UI가 안 쓰는 필드지만, 앞으로 표시가
   필요해지면 **같은 유형의 "필드 유실" 버그가 재발**한다. 현재 드롭되는 계약 필드:
   `instance_name`, `cloud_sql_type`, `host_network`, `host_project`, `credential_id`,
   `ip_configuration`, `oracle_service_id`(candidate metadata 기준), `idc_host_format`/`idc_ips`/
   `idc_host`/`idc_source_ips`, `nlb_index`.

3. **동일 패턴의 다른 진입점**: `resource_name` 을 원본이 아니라 `resourceId` 꼬리에서 파생하는
   `getResourceDisplayName`(`lib/resource/display-name.ts`) — LIN-44/45 로 candidate에 실제
   `resourceName` 이 생기면 Step1 표시도 원본명으로 통일 가능(후속). IDC 승인 요청은 db_type 외에
   host/port/ips 도 여전히 metadata로 안 실린다(LIN-40 범위는 provider/db_type 만) — 백엔드가 IDC
   접속정보를 필요로 하면 후속 확장 필요.

**결론(패턴):** "계약은 값을 `metadata` 안에 중첩해 주는데, 내부 어댑터/타입이 그것을 최상위로 읽거나
부분만 옮기거나 payload에서 빠뜨린다." 새 필드를 UI에 노출하거나 승인 payload에 실을 때는 **항상
`TargetSourceResourceItemDto`/`TargetSourceResourceMetadataDto` 의 정확한 위치를 확인**하고, 어댑터가
그 위치에서 읽고 그 위치로 쓰는지 검증할 것.

## 9. Codex 교차 리뷰 반영 (gpt-5.5 xhigh)

- **provider 값 정합**: 계약 `metadata.provider` enum은 대문자(`AWS|GCP|AZURE|IDC|UNKNOWN`)인데 내부
  `CloudProvider` 는 `Azure`(혼합). 정규화된 내부값을 그대로 보내면 안 됨 → `cloudProviderToWireProvider`
  (lib/types.ts)로 wire 대문자 변환 후 전송. 목업 `toResourceSnapshot` 과 관련 테스트도 `AZURE` 로 정합.
- **LIN-42 강화**: 최상위 `item.database_type` fallback 읽기까지 제거하고 `metadata.database_type` 에서만
  읽음(최상위는 계약에 없음). 관련 테스트 fixture도 database_type 을 metadata 로 이동.
- **범위 밖으로 확인된 지적**: approved-integration 목업 응답이 여전히 계약 밖 최상위 필드
  (`endpoint_config`/`credential_id`/`database_region`/`scan_status`/`integration_status`)를 방출한다는
  지적은 **본 변경 이전부터 존재**하던 §8의 systemic root(`as unknown as ResourceSnapshot` 캐스팅)이며,
  본 PR은 metadata 를 **추가**했을 뿐 해당 필드를 새로 도입하지 않음. 전면 정합은 별도 리팩터로 분리.

## 10. Codex 2차 리뷰 — 잔여 지적은 선존 계약 gap (수렴 불가)

2차 codex는 동일 systemic root를 3 Critical로 재지적(Mergeable: No). 근거 확인 결과:

- **계약에 홈이 없는 필드**: `integration_status`·`endpoint_config` 는 생성 계약 전체에 **부재**.
  `scan_status` 는 `ScanJobResponse`(스캔 잡)에만, `database_region` 은 `ResourceConfigDto`
  (confirmed-integration)에만 있고 **approved-integration/resources 의 `TargetSourceResourceItemDto`
  에는 없음**. 그런데 이 필드들은 신규/변경 태그·Step3 완료 카운트·테이블 필터 등 **본 12건과 무관한
  기존 기능**이 광범위하게 사용(`lib/types.ts` 주석이 "ResourceConfigDto extension fields — preserved
  through the approved-integration mapping"으로 **의도적 팀 관례**임을 명시). codegen 자체가 LOOSE
  (partial+passthrough)라 런타임 통과.
- **결론**: 이 필드들을 제거하면 기존 기능이 깨지고, swagger 추가는 **spec/BFF 소유자 권한**(수정 금지).
  즉 codex-0 은 본 PR 범위 안에서 달성 불가 → 매 라운드 동일 지적 반복(수렴하지 않음).
- **본 PR이 한 것**: LIN-47에서 내가 만진 `toSelectedRow` 의 죽은 계약-밖 fallback
  (`database_region`/`endpoint_config.db_type`)만 제거해 계약 정합화. 나머지 선존 필드는 미변경.
- **후속**: systemic root(`as unknown as ResourceSnapshot` 캐스팅 + `scan_status`/`integration_status`
  계약 gap)는 API 소유자 대상 별도 이슈로 분리.
