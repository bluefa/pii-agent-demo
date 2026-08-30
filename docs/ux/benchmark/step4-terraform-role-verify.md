# 4단계 Terraform 권한 부여 확인 — 판정은 머리가, 근거는 몸이

- **일자**: 2026-08-30
- **대상 화면**: `pass/target-sources/{id}` → 4단계 설치 현황, 레일 항목 「Terraform 권한 부여 확인」의 오른쪽 패널
- **아티팩트**: https://claude.ai/code/artifact/21921b8d-a940-439e-a75e-3975e7a36d60
- **채택**: 시안 D (실시간 확인을 버튼 뒤로, 몸은 계약 enum 으로 말한다)
- **구현 PR**: #831

## 문제

패널이 마운트되는 순간 30초짜리 실시간 IAM 검증(`GET …/aws/verify-execution-role`)을 스스로 불렀다.

| | 진단 | 근거 등급 |
|---|---|---|
| P1 | 마운트 이펙트가 조건 없이 검증을 발사한다. 그런데 `perm` 은 그룹 레일이 **기본 선택**하는 항목이다 — `InstallStatusDetail.tsx:609` 이 `group === 'todo'` 중 열린 첫 항목을 고르고, 권한 확인이 그 자리다. 4단계에 들어올 때마다, 그리고 이 단계로 되돌아올 때마다 30초짜리 호출이 나갔다 | **수치 위반** — NN/g 응답 한계 10초의 3배를 사용자가 요청한 적 없이 소비 |
| P2 | 그 호출이 진입 시점에 사 오는 것이 없다. 판정은 이미 화면에 있다 — 설치 상태가 함께 실어 보내는 `terraform_execution_role_verify.status` 가 패널 **헤더의 상태 알약**으로 걸려 있고, 이 enum 은 COMPLETED · SKIP · FAIL · IN_PROGRESS 네 경우를 모두 덮는다 | **수치 위반** — 계약(install-v1.yaml)이 이미 주는 값의 중복 취득 |
| P3 | enum 이 못 싣는 것은 둘이다: `fail_reason`(동결된 여섯 코드)과 검증 시각. 이 둘은 실시간 오퍼레이션에만 있다. 즉 **버튼은 살아야 하고, 마운트 호출만 죽어야 한다** | UX 원칙 (사용자가 요청한 비용만 청구) |
| P4 | 몸이 판정을 두 번째로 말할 위험이 상존한다. 설치 상태는 `COMPLETED/FAIL/…`, 검증 API 는 `VALID/INVALID/…` 로 어휘가 달라, 같은 단계가 두 어휘로 서로 다른 말을 하게 된다 | UX 원칙 (한 사실에 한 화자) |

`fail_reason` 이 응답에만 있다는 사실이 이 설계 전체의 축이다 — 진입 시점의 화면은 **왜**를 말할 수 없고, 말할 수 없는 것을 말하려 들지 않는 것이 답이다.

## 레퍼런스 (13종 중 실제로 판단을 바꾼 것)

13종 **전부**가 같은 분업을 하고 있었다: **판정은 머리(헤더·행 요약)가 걸고, 몸은 근거와 최신성을 싣는다.** 머리에서 판정을 떼어 몸으로 내리자고 말한 레퍼런스는 하나도 없었다.

| 제품 / 시스템 | URL | 빌려온 것 |
|---|---|---|
| HashiCorp HCP Terraform — health assessment ↔ Drift 탭 | https://developer.hashicorp.com/terraform/tutorials/cloud/drift-and-policy | **가장 가까운 동형 사례.** 워크스페이스 머리가 drift 여부(판정)를 걸고, Drift 탭은 무엇이 어긋났는지(근거)만 편다. 판정을 두 번 그리지 않는다 |
| IBM Carbon — status indicator 패턴 | https://v10.carbondesignsystem.com/patterns/status-indicator-pattern/ | "use plain text instead to avoid the overuse of status indicators." 몸의 한 줄을 **평문 캡션**으로 둔 근거 — 알약도 글리프도 아니다 |
| AWS Cloudscape — empty states | https://cloudscape.design/patterns/general/empty-states/ | "Don't use empty states for errors." 대기 슬롯과 원인 블록이 **구조로** 갈라져야 한다는 요구 |
| AWS Cloudscape — StatusIndicator | https://cloudscape.design/components/status-indicator/ | `not-started` 가 일급 타입으로 존재한다 — "아직 확인 안 함"은 오류가 아니라 **정상 상태**라는 판정 |
| Auth0 — Try Connection | https://auth0.com/docs/authenticate/identity-providers/test-connections | **반증 레퍼런스.** 캐시된 신호 없이 버튼만 있는 화면은 사용자를 불안한 재시도로 몬다 → 버튼만 남기고 enum 을 안 쓰는 안(진입 시 빈 슬롯)을 기각한 근거 |
| NN/g — Response Time Limits | https://www.nngroup.com/articles/response-times-3-important-limits/ | 10초는 주의가 끊기는 한계. 우리 호출은 30초다 — 사용자가 **명시적으로 요청했을 때만** 지불할 수 있는 비용 |

나머지 7종은 위 결론을 반복 확인했을 뿐 별도로 인용하지 않는다.

## 왜 시안 D 인가

D 와 E 는 **진단이 같고 처방도 같았다**. 마운트 호출 제거, enum 으로 진입 화면 구성, 버튼 뒤로 실시간 확인 — 여기까지 동일하다. 갈린 지점은 하나뿐이다: **[마지막 확인 시각 + 확인 버튼] 묶음을 단계 헤더에 올릴 것인가(E), 몸에 둘 것인가(D).**

레퍼런스는 헤더를 가리켰다(HCP Terraform 이 정확히 그 배치다). 그럼에도 D 를 고른 것은 이 앱의 헤더가 이미 **[주체 · 상태 알약]** 을 싣고 있어, 네 번째 요소가 들어가면 제목이 긴 단계에서 줄이 무너지기 때문이다. 오너 결정이며, **그 붕괴를 실측해서 확인하지는 않았다** — 측정 비용을 치르지 않고 몸을 고른 선택이라는 뜻이다. 헤더 폭에 여유가 생기면 E 는 다시 열릴 수 있다.

## 아티팩트가 정하지 않았고 구현이 정한 것 둘

**(a) 결과 슬롯은 세 갈래가 아니라 두 갈래다.** 아티팩트는 COMPLETED / FAIL / IN_PROGRESS 를 나눠 그렸지만, **누르기 전의 FAIL 과 IN_PROGRESS 는 할 말이 같다** — 이유는 응답에만 있고 둘 다 아직 응답이 없기 때문이다. 둘이 갈리는 것은 오직 버튼의 무게다. 그래서 `settled`(= `COMPLETED | SKIP`) 불리언 하나가 슬롯 내용 · 버튼 무게 · 버튼 라벨 셋을 전부 정한다.

- `settled` + 실시간 결과 없음 → 평문 캡션 한 줄 `마지막 확인은 {절대시각} 기준이에요.` (알약 없음, 글리프 없음, **판정 어휘 반복 없음** — 헤더가 이미 완료/해당 없음을 말했다)
- `!settled` + 실시간 결과 없음 → 대기 슬롯 두 줄
- 누르는 중 → 기존 스켈레톤 · 결과 → 기존 `FindingBlock` 또는 「방금 확인했고, 막힌 곳은 없었어요.」

버튼은 슬롯 **바깥**의 고정된 줄에 산다(오너가 이 설계에 붙인 조건). 슬롯 내용은 상태마다 바뀌고 버튼의 위치는 바뀌지 않는다.

**(b) 대기 슬롯은 글리프 없는 왼쪽 정렬 평문이다.** 처음에는 28px 중성 파선 원(1.5px, `borderColors.strong`)을 가운데 놓았다. 브라우저 실측 결과 흰 바닥에서 **1.47:1** — 안 보인다. 그리고 보이게 darken 하는 순간 그것은 상태 문장 옆의 원형 표시, 즉 **몸이 그리면 안 되는 그 상태 인디케이터**가 된다(P4). 그래서 지웠다.

지워도 Cloudscape 의 요구는 지켜진다. 원인 블록은 3px 빨강 좌측 룰 + 「확인 필요」 라벨을 갖고, 대기 슬롯은 평문 두 줄이다 — **구분은 장식이 아니라 구조가 한다.** 가운데 정렬도 함께 버렸다: 위의 식별 행(96px 라벨 열)과 아래 버튼 줄이 모두 왼쪽 정렬이라 가운데 블록은 두 이웃 사이에 떠서 외부 컴포넌트처럼 읽혔다. 실측 후 네 왼쪽 모서리(AWS 계정 라벨 · 대기 두 줄 · 버튼)가 모두 `x=576` 에 선다.

## 적용

```
app/components/features/process-status/aws/TerraformRoleVerifyPanel.tsx
  - 마운트 useEffect 삭제, 초기 phase 'idle', fetch 를 클릭 핸들러로
  + verifyStatus / lastCheckedAt props, settled 불리언, IdlePrompt
app/components/features/process-status/aws/AwsInstallStatusDetail.tsx
  + verifyStatus={status.roleVerify.status}  lastCheckedAt={status.lastCheck.checkedAt ?? null}
lib/bff/mock/aws.ts
  - roleVerify === 'COMPLETED' 불리언  → + ROLE_VERIFY_WIRE_STATUS 두 enum 간 번역
lib/mock-data.ts
  + 대상 소스 1019 — roleVerify: 'FAILED' (실패 화면의 유일한 진입점)
```

### 실측 (브라우저)

| | 값 |
|---|---|
| 진입 시 `verify-execution-role` 호출 수 | **0** (이전: 진입·복귀 때마다 1) |
| 버튼 1회 클릭 후 호출 수 | 1 (748ms, `확인 중...` + `disabled` + `aria-busy`) |
| 대기 슬롯 왼쪽 모서리 정렬 | 네 요소 모두 `x=576` · 파선 요소 0개 |
| 대기 슬롯 두 줄 대비 | 10.30:1 · 4.84:1 (둘 다 AA 통과) |
| 폐기한 파선 글리프 | 1.47:1 |

1009(COMPLETED)는 열린 할 일이 아니므로 레일이 이 단계를 기본 선택하지 않는다 — 정착한 대상에서는 패널이 아예 안 열리는 것이 정상 경로다.

## 남은 것

- **시안 E(시각+버튼을 단계 헤더로)** 는 기각이 아니라 보류다. 헤더 4요소가 실제로 무너지는지 실측하지 않았으므로, 헤더 문법을 손볼 때 함께 재개할 수 있다.
- `settled` 대상에서 다시 확인을 눌러 원인이 나오면 **고스트 텍스트 버튼 아래 빨간 원인 블록**이 선다. 「버튼은 안 움직인다 + 무게는 `settled` 가 정한다」의 논리적 귀결이고 아티팩트가 그리지 않은 조합이라, 무게를 올릴지는 열어 둔다.
