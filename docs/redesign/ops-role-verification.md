# Admin Ops · 스캔 권한 카드의 자격 검증 표현

> 작성 2026-08-10 · 근거 화면 `/pass/admin/pipelines/ops/target-sources/{id}?tab=scan`
> 계약: `GET …/aws/verify-scan-role` · `verify-execution-role` → `AwsRoleVerificationResponse`
> 적용: `roleVerification.ts`(신설) / `ScanCredentialCard` / `ScanTab` / `OpsTargetView`(모달 콜백만)
> 시안: 세션 아티팩트 "Role 검증 표현 설계" (지금/제안 비교)

BFF 가 `fail_reason` 을 안정 enum 으로 확정하면서, "실패했습니다" 한 문장으로 뭉개던 여섯
원인이 각각 다른 조치를 가리키게 됐다. 이 문서는 그 enum 을 어떻게 접고 무엇이라고 쓸지의
확정 결정만 남긴다.

**범위: 스캔 탭 권한 카드 하나.** 헤더 role 행 판정과 인프라 작업 탭의 Terraform Role 카드는
시안에 있었으나 오너 결정으로 제외했다 (§4).

---

## 1. 접기 규칙 — 9 조합 → 화면 4상태

톤을 정하는 것은 `status` 가 아니라 `fail_reason` 이다. 상태를 가르는 기준은 심각도가 아니라
**운영자가 다음에 누를 것**이다.

| status | fail_reason | 적용 엔드포인트 | 화면 상태 | 조치 |
|---|---|---|---|---|
| VALID | (생략) | scan·exec | 정상 (ok) | — |
| INVALID | `ROLE_NOT_CONFIGURED` | scan·exec | 설정 필요 (off) | 등록하기 |
| INVALID | `INVALID_ROLE_ARN` | scan·exec | 검증 실패 (err) | 수정하기 |
| INVALID | `ROLE_NOT_FOUND` | exec 전용 | 검증 실패 (err) | 수정하기 |
| INVALID | `SCAN_ROLE_NOT_CONFIGURED` | exec 전용 | 설정 필요 (off) | **Scan Role** 등록하기 |
| INVALID | `SCAN_ROLE_NOT_ASSUMABLE` | exec 전용 | 검증 실패 (err) | **Scan Role** 수정하기 |
| UNVERIFIED | `ROLE_VERIFICATION_UNAVAILABLE` | scan·exec | 판정 불가 (warn) | 다시 확인 |

매핑은 여섯 코드를 모두 담는다(계약이 그렇게 말하므로). 다만 `exec 전용` 셋은 이번 범위에
그 화면이 없어 실제로는 그려지지 않는다 — 그 화면이 생기는 순간 코드 변경 없이 붙는다.

**`ROLE_NOT_CONFIGURED` 는 계약상 INVALID 지만 화면은 중립으로 그린다.** 아직 아무것도 등록하지
않은 대상을 빨갛게 칠하면, 같은 순간 헤더가 말하는 "미등록"과 어긋난다. `fail_reason` 이 안정
키라서 `status` 와 무관하게 결정할 수 있다. (백엔드 의도 확인 항목 — §5)

## 2. 맵에 없는 코드는 뭉개지 않는다

`gen-api` 가 enum 을 strip 하므로 생성 타입은 `string` 이다. 즉 **`roleVerification.ts` 의 맵이
이 계약의 유일한 표현**이고, 모르는 코드는 실제로 그냥 들어온다.

- 매핑이 없으면 `status` 로 판정한다. 무조건 "판정 불가"로 보내지 **않는다** — `INVALID` 는 서버가
  이미 확정했다는 뜻이고, GCP·Azure 는 자기 코드 체계(`SA_NOT_CONFIGURED` 등)를 쓰면서 status
  어휘는 공유한다. (시안 초안은 미지 코드를 전부 판정 불가로 보냈다 — 구현에서 교정)
- 코드 문자열은 안내 박스에 그대로 노출한다. "알 수 없는 오류"로 접으면 제보가 끊긴다.
- `fail_message` 는 deprecated 라 **매핑이 없는 코드에서만** 폴백으로 쓴다. 이 한 줄이 GCP·Azure
  를 종전 동작 그대로 유지시킨다.

## 3. UNVERIFIED 의 의미가 뒤집혔다

`admin-scan-tab.md` §4 에 "UNVERIFIED(미검증)는 오류가 아니다 — off 톤"이 확정 결정으로 적혀
있었다. 그 판단은 **구 계약에서 옳았다**(아직 검증 안 함). 새 계약의 UNVERIFIED 는 "해봤는데
판정하지 못했다"(throttling·timeout·네트워크·IAM 조회 권한 부족·partition 불일치)다.

→ 회색 off 가 아니라 **warn + [다시 확인]**. 되돌린 것이 아니라 계약 변경에 따른 갱신이다.

같은 값을 사용자 화면(`app/components/features/scan/scan-permission.tsx`)은 반대로 빨간 실패로
그린다. 이번 범위 밖이라 손대지 않았다 — 잔여 과제.

## 4. 카드 안에서 끝낸다

| 무엇 | 어디 |
|---|---|
| 조회·판정·재조회 | `ScanCredentialCard` 자신. 화면에 검증이 한 자리뿐이라 호출도 한 번이다 |
| 조치 CTA 가 여는 모달 | `OpsTargetView`(RoleEditModal 의 기존 주인) → `ScanTab` → 카드로 콜백만 내려온다 |

**제외한 것** — 시안에는 있었으나 오너 결정으로 빼기로 했다:

- 헤더 role 행의 판정 점 (`OpsHeader`)
- 인프라 작업 탭의 Terraform Execution Role 카드 (`PipelineTab`)

둘을 빼면서 "verify-\* 를 여러 자리에서 부르지 않도록 `OpsTargetView` 가 조회를 소유한다"는
시안의 결정도 함께 사라졌다 — 부르는 자리가 하나면 그 카드가 갖는 것이 맞다.

그 밖의 확정 사항:

- **순서**: [안내 + 조치] → [응답 원문] → [마지막 검증]. 원문 박스는 **접지 않는다**(오너 결정) —
  백엔드 대조는 상시 작업이고, 클릭 한 번을 요구하면 대조를 안 하게 된다. 바뀐 것은 위치뿐이다.
- **"다시 확인"은 조건부**: 상시 재검증 버튼은 이전에 걷어낸 것이므로(`admin-scan-tab.md`, "새로고침으로
  충분") 되살리지 않는다. 판정 불가에서만 인라인으로 뜬다. 스켈레톤 전환은 클릭 핸들러에서
  한다 (이펙트 안 setState 는 연쇄 렌더).
- **Role 저장 → 재검증**: 고친 자격을 옛 판정 위에 두지 않도록 `reloadKey` 로 다시 부른다.
- **시점 없는 판정은 안 그린다**: `last_verified_at` 이 없으면 시각 행 생략(현행 유지).
- **조치는 수행 가능할 때만**: GCP·Azure 는 등록·수정 계약이 없어 CTA 를 그리지 않는다.

## 5. 목에서 실패 상태를 여는 법

목이 늘 `VALID` 만 돌려주면 판정 넷 중 하나만 볼 수 있어 화면을 검증할 수 없다. 두 갈래로 연다
(`lib/bff/mock/aws.ts`).

**① 대상별 기본값** — 링크만으로 네 판정을 다 본다. 나머지 AWS 대상(1006·1007·1018 …)은 `VALID`
그대로라 행복 경로도 남는다.

| Target | 판정 |
|---|---|
| 1008 | 설정 필요 (`ROLE_NOT_CONFIGURED`) |
| 1010 | 검증 실패 (`INVALID_ROLE_ARN`) |
| 1011 | 판정 불가 (`ROLE_VERIFICATION_UNAVAILABLE`) |
| 1012 | 매핑에 없는 코드 (`ROLE_SESSION_POLICY_DENIED`) |

**② 저장한 Role 이름** — 아무 대상에서나 원하는 코드를 불러낸다(①을 덮어쓴다).
운영 화면에서 Role [수정] → 이름에 키워드 포함 → 저장.

| 이름에 포함 | 결과 |
|---|---|
| `not-configured` | `ROLE_NOT_CONFIGURED` (설정 필요) |
| `bad-arn` | `INVALID_ROLE_ARN` |
| `not-found` | `ROLE_NOT_FOUND` |
| `scan-missing` | `SCAN_ROLE_NOT_CONFIGURED` |
| `scan-denied` | `SCAN_ROLE_NOT_ASSUMABLE` |
| `unavailable` | `ROLE_VERIFICATION_UNAVAILABLE` (판정 불가) |
| `unknown-code` | 매핑에 없는 코드 — 화면이 삼키지 않는지 확인용 |

목은 신규 코드에 `fail_message` 를 싣지 않는다 — 화면이 `fail_reason` 만으로 말하는지 보기 위해서다.

## 6. 미결

1. `ROLE_NOT_CONFIGURED` 가 실제로 `INVALID` 로 오는지 — 백엔드 확인. 화면은 이 코드만 중립으로
   그리므로 답이 무엇이든 동작하지만, 의도가 다르면 톤을 맞춰야 한다.
2. swagger 미반영 — 현재 `AwsRoleVerificationResponse.status`/`fail_reason` 은 enum 없는 plain
   string. 갱신돼도 codegen 이 enum 을 strip 하므로 생성 타입은 그대로다.
3. `verify-execution-role` 은 라우트·클라이언트 함수가 있는데 소비자가 없다 — exec 전용 코드 셋이
   여전히 화면에 없다.
4. 사용자 화면(`scan-permission.tsx`)의 UNVERIFIED 처리 — §3 참조.
