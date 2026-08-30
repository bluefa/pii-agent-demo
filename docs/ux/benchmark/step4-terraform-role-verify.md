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

## 아티팩트가 정하지 않았고 구현이 정한 것 셋

**(a) 결과 슬롯은 enum 여섯 값에 대한 _긍정_ 술어로 갈린다.** 처음에는 `settled`(= `COMPLETED | SKIP`) 불리언 하나가 슬롯과 라벨을 정했다. 그런데 `!settled` 는 여섯 값 중 **넷**을 받는다 — FAIL · IN_PROGRESS · UNKNOWN · BDC_INSTALL_REQUIRED — 그리고 이 넷은 같은 문장을 나눠 가질 수 없다. 부정형 하나가 문장 하나를 강요한 것이 이 화면이 거짓말을 한 방식이다.

실시간 결과가 오기 전, 슬롯이 그리는 것:

| `verifyStatus` | 결과 슬롯 | 버튼 무게 |
|---|---|---|
| `FAIL` | 리드 줄 + 초대 문장 | outline |
| `IN_PROGRESS` · `UNKNOWN` | 초대 문장만 (리드 줄 없음) | ghost |
| `COMPLETED` · `SKIP` · `BDC_INSTALL_REQUIRED` | **아무것도 없음** | ghost |

- **`IN_PROGRESS` 는 「확인이 돌고 있다」가 아니다.** 나중 라운드가 가장 되돌리기 쉬운 판단이 이것이라 여기 적는다: 이 enum 에는 **'아직 안 함' 값이 없고**, 실시간 검증은 눌러야 나가는 동기 GET 이며 백그라운드로 이 검증을 돌리는 스케줄러가 없다. 그래서 프론트는 「돌고 있다」와 「한 번도 안 했다」를 구분할 수 없다. 구분할 수 없는 것을 말하지 않는 것이 답이므로, 이 상태는 진행 중이라고도(스피너·「확인 중」) 사용자가 조치해야 한다고도(「확인 필요」) 말하지 않는다. 초대 문장 하나만 선다.
- **`UNKNOWN` 은 어댑터의 정규화 싱크**(알 수 없는 wire 값이 떨어지는 자리)라 아는 것이 더 없다. 실시간 호출만이 정보의 출처이므로 같은 초대를 받는다.
- **`BDC_INSTALL_REQUIRED` 는 서비스 담당자의 차례가 아니다.** 30초짜리 호출로 초대하는 것은 남의 블로커에 그 30초를 쓰라는 말이 된다.
- 누르는 중 → 스켈레톤 · 결과 → `FindingBlock` 또는 통과 한 줄(아래 (d))

**「마지막 확인은 {절대시각} 기준이에요」 캡션은 삭제됐다.** settled 슬롯을 채우던 줄이고, 두 가지가 틀렸다. (1) 그 숫자는 `last_check.checked_at` — **설치 상태**를 마지막으로 폴링한 시각이지 Role 을 검증한 시각이 아니다. 그런데 바로 아래 버튼의 이름이 `다시 확인`(=Role 검증)이었다. 같은 시각을 카드 머리의 `LastCheckStamp` 가 **그 구분을 설명하는 툴팁과 함께** 이미 걸고 있는데, 몸이 숫자만 베껴 오면서 단서를 떨어뜨린 것이다. 30초 폴링마다 이 숫자는 올라가고 검증은 그대로였다. (2) `LastCheckInfoDto` 에 `required:` 가 없어 `checked_at` 은 안 올 수 있고, 그러면 결과 슬롯이 통째로 비었다 — 머리는 완료라고 말하면서.

버튼은 슬롯 **바깥**의 고정된 줄에 산다(오너가 이 설계에 붙인 조건). 슬롯 내용은 상태마다 바뀌고 버튼의 위치는 바뀌지 않는다. **소요 시간도 그 줄에 산다** — 행동의 성질이지 결과의 성질이 아니라, 슬롯을 따라 나타났다 사라지면 같은 버튼이 어떤 상태에서만 시간을 말하게 된다. 문장은 `최대 30초까지 걸릴 수 있어요`: 30000ms 는 라우트의 `expectedDuration`, 곧 **타임아웃 예산**이지 관측값이 아니다(실측 748ms). 「약 30초 걸려요」는 근거 없는 평균을 약속한다 — 이 저장소는 같은 이유로 「평균 5분 내외」를 지운 판례를 갖고 있다(`docs/redesign/step3-applying-approved.md:92-93`). 누르는 동안에는 감춘다(스켈레톤이 이미 말하고 있다).

**(b) 버튼의 무게는 `settled` 가 아니라 「할 일이 있는가」를 잰다.**

```ts
const heavy = blocked || Boolean(finding) || state.phase === 'error';   // blocked = verifyStatus === 'FAIL'
```

처음에는 무게도 `settled` 하나에 걸었다. 그러면 정착한 대상에서 다시 확인을 눌러 원인이 나왔을 때 **고스트 텍스트 버튼 아래 빨간 원인 블록**이 서는 조합이 생긴다 — 조치할 일이 화면에 떴는데 그 조치의 입구는 크롬을 벗은 채다.

이 조합은 현재 픽스처로는 도달할 수 없지만(1009 를 눌러 보면 CLEAN 이 온다) 제품에서는 도달한다: 마지막 설치 상태 폴링이 권한 회수보다 **앞선** 대상은 enum 이 여전히 COMPLETED 라고 말하고, 그 자리에서 실시간 확인을 누르면 계약의 판정이 방금 반박된다. 그 순간 `settled` 는 상황을 설명하는 말이 아니다.

그다음 `!settled` 가 같은 병을 여기서도 앓는다는 것이 드러났다. 부정형은 IN_PROGRESS 와 BDC_INSTALL_REQUIRED 에 **채운 CTA 무게**를 줬다 — 둘 다 사용자가 지금 눌러야 할 이유가 없는 상태다. 그리고 요청이 실패했을 때(`phase === 'error'`)는 반대로 고스트를 줬다: 다시 눌러야 하는 그 순간에 버튼이 가장 약해진다.

그래서 무게도 긍정 술어로 잰다. outline 은 셋 중 하나일 때 — 계약이 막혔다고 했거나(FAIL), 실시간 확인이 원인을 찾았거나, 방금 요청이 실패했거나. 나머지는 고스트다. 버튼은 여전히 안 움직이고 무게는 여전히 **한 식**에서 나온다. 라벨은 종전대로 `settled || data` 를 따른다 — 「다시」인가 「처음」인가는 계약이 답했는지가 실제로 맞는 질문이라, `isSettledInstallStatus` 가 정당하게 남는 유일한 자리다.

**(d) 통과 한 줄은 응답이 통과라고 _말했을 때만_ 선다.** 「방금 확인했고, 막힌 곳은 없었어요.」는 처음에 `data && !finding` 에 걸려 있었다. 그런데 `terraformRoleFinding` 은 살아 있는 `status: 'IN_PROGRESS'` 에도, 문장 없는 미매핑 status 에도 `null` 을 준다 — 그 함수의 주석대로 "할 말이 없으면 블록을 그리지 않는다". 침묵을 합격으로 번역하면 화면이 응답에 없는 사실을 만든다. 판정 어휘는 검증 API 의 status enum 을 아는 파일이 갖는다:

```ts
export const terraformRolePassed = (data: AwsRoleVerification): boolean =>
  data.status === 'VALID' || data.status === 'COMPLETED';
```

응답은 왔는데 원인도 통과도 아니면 슬롯은 아무것도 그리지 않는다.

**(e) 결과는 낭독된다.** 결과가 페이지 로드가 아니라 **누름**으로 오게 되면서, 화면을 보지 않는 사용자에게 결과를 알릴 자리가 필요해졌다. 불러오기 실패 줄은 이미 `role="alert"` 를 갖고 있었고, 원인 블록과 통과 줄은 아무것도 없었다. 저장소 문법 그대로 상주 `sr-only` 라이브 리전 한 줄(`RecentScanCard` · `CandidateResourceSection` 과 같은 형태)을 두고, 결과가 있을 때만 문장을 갈아 끼운다 — 슬롯 전체를 리전으로 만들면 무관한 리렌더에도 다시 읽힌다.

**(c) 대기 슬롯은 글리프 없는 왼쪽 정렬 평문 세 줄이다.**

```
Terraform 권한 확인 필요                       14px / 600 / #101828
권한을 직접 확인하면 막힌 원인까지 알 수 있어요   14px / 400 / #364153
약 30초 걸려요                                 12px / 400 / #6A7282
```

⛔ **리드 줄은 원인 블록의 「확인 필요」 라벨 활자를 빌리지 않는다.** 그 라벨은 `12px / bold / tracking 0.02em / statusColors.error.textDark` 이고, 두 줄은 **낱말 「확인 필요」를 공유한다**. 활자까지 같아지면 대기 슬롯이 오류 슬롯의 회색 복사본이 되고, 그것이 바로 글리프를 지워서 막았던 붕괴다(아래 문단). 그래서 아래 문장과 **같은 크기**, 무게와 색만 한 단 위인 `textStyles.bodyStrong` + `textColors.primary` 을 쓴다 — 상태 라벨이 아니라 리드 줄이다. 나중 라운드에서 둘을 "정리해서 통일"하지 말 것.

글리프도 같은 이유로 없다. 처음에는 28px 중성 파선 원(1.5px, `borderColors.strong`)을 가운데 놓았다. 브라우저 실측 결과 흰 바닥에서 **1.47:1** — 안 보인다. 그리고 보이게 darken 하는 순간 그것은 상태 문장 옆의 원형 표시, 즉 **몸이 그리면 안 되는 그 상태 인디케이터**가 된다(P4). 그래서 지웠다.

지워도 Cloudscape 의 요구는 지켜진다. 원인 블록은 3px 빨강 좌측 룰 + 「확인 필요」 라벨을 갖고, 대기 슬롯은 평문 세 줄이다 — **구분은 장식이 아니라 구조가 한다.** 가운데 정렬도 함께 버렸다: 위의 식별 행(96px 라벨 열)과 아래 버튼 줄이 모두 왼쪽 정렬이라 가운데 블록은 두 이웃 사이에 떠서 외부 컴포넌트처럼 읽혔다. 실측 후 다섯 왼쪽 모서리(AWS 계정 라벨 · 대기 세 줄 · 버튼)가 모두 `x=576` 에 선다.

## 적용

```
app/components/features/process-status/aws/TerraformRoleVerifyPanel.tsx
  - 마운트 useEffect 삭제, 초기 phase 'idle', fetch 를 클릭 핸들러로
  + verifyStatus prop, blocked·invitesCheck·heavy 긍정 술어, IdlePrompt(lead), sr-only 라이브 리전
  - lastCheckedAt prop, 마지막 확인 캡션, 대기 슬롯의 「약 30초 걸려요」
app/components/features/process-status/aws/AwsInstallStatusDetail.tsx
  + verifyStatus={status.roleVerify.status}
app/components/features/process-status/aws/terraform-role-finding.ts
  + terraformRolePassed — 「원인 없음」과 「통과」를 가른다
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
| 대기 슬롯 왼쪽 모서리 정렬 | 다섯 요소 모두 `x=576` · 파선 요소 0개 |
| 대기 슬롯 대비 | 17.75:1 · 10.30:1 (리드 줄 · 초대 문장, 둘 다 AA 통과) |
| 대기 슬롯 줄 간격 | 4px (`stackGap.tight`, 줄높이 20px → 기준선 24px) |
| 소요 시간 줄 | 4.84:1 — 토큰(`caption`+`tertiary`) 그대로, 자리만 슬롯 → 버튼 줄 |
| 폐기한 파선 글리프 | 1.47:1 |

1009(COMPLETED)는 열린 할 일이 아니므로 레일이 이 단계를 기본 선택하지 않는다 — 정착한 대상에서는 패널이 아예 안 열리는 것이 정상 경로다.

## 남은 것

- **`IN_PROGRESS` 를 「확인 중」으로 그리자는 제안**이 다시 오면 위 (a) 를 먼저 읽을 것. 계약에 '아직 안 함' 값이 생기거나 백그라운드 검증이 생기기 전에는 그 표기가 만들 수 있는 사실이 없다.
- **시안 E(시각+버튼을 단계 헤더로)** 는 기각이 아니라 보류다. 헤더 4요소가 실제로 무너지는지 실측하지 않았으므로, 헤더 문법을 손볼 때 함께 재개할 수 있다.
