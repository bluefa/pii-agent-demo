# 운영 콘솔 · 인프라 탭 상태 스트립 → 카드 하나

- **일자**: 2026-08-30
- **대상 화면**: `/pass/admin/pipelines/ops/target-sources/{id}?tab=infra` (`InfraStatusHead`)
- **기준**: origin/main `8240ec1e`
- **아티팩트**: 라운드 1 https://claude.ai/code/artifact/8329d671-995e-4b5d-88cb-635df3d419b1 ·
  라운드 2 https://claude.ai/code/artifact/f3294747-1d7c-4811-a371-9303fb29fb2e
- **선행 라운드**: `docs/ux/benchmark/ops-infra-tab.md` (PR #675) ·
  `docs/ux/benchmark/ops-infra-gate.md` (PR #820)
- **구현 PR**: PR #___

선행 두 라운드가 만든 2열 상태 스트립 자체를 다룬다. 실측은 mock dev 1710×947,
Target #1003(Azure).

## 문제 진단

| # | 문제 | 근거 | 등급 |
|---|------|------|------|
| P1 | 화면에서 가장 큰 글자가 이 탭의 주인공이 아니다 | 스트립 값 `확정됨` 16px/700 > 섹션 제목 `작업 이력` 14px/600 > `현재 작업` 12px/600(`scopeTag`). design-guide §3 "역할당 크기 1개" | 수치 위반 |
| P2 | 한 행의 74%가 빈칸 | 오른쪽 슬롯 952px, 작업 행 912px인데 잉크는 이름 118 + 태그 38 + pill 85 = 241px. `flex-1 truncate`가 남는 폭을 전부 이름 칸에 준다 | 수치 위반 |
| P3 | 이름과 그 이름의 상태가 793px 떨어져 있다 | `AZURE_BDC_SERVICE` 잉크 끝 x=926, `BDC` 태그 시작 x=1719 | UX 원칙 (여백 7원칙 §5 스캔 속도) |
| P4 | 성격이 다른 두 사실이 한 컨테이너에 산다 | 왼쪽=승인·확정 절차의 산물(전제), 오른쪽=Terraform이 만든 리소스의 현재 상태. **⛔ 이 진단은 라운드 2에서 오너 지시로 폐기됨**(아래 참조) | UX 원칙 |
| P5 | 주인공이 224px 아래에서 시작 | 안내 카드 77 + 간격 16 + 스트립 86 = 머리 179px, 탭 줄 → `현재 작업` 224px. 뷰포트 947px의 24% | UX 원칙 (동시 노출) |
| P6 | 정상 상태가 예외 상태의 크기를 지불한다 | 이 스트립은 08-27 라운드가 미확정 게이트 배너를 흡수하려고 만든 골격이라, 확정됨 + 적용 완료라는 대다수 정상 상태에서도 같은 크기를 쓴다 | 제안 |
| P7 | 로딩이 자기가 아닌 것의 높이를 예약 | `h-[146px]`(AWS 3행) 고정인데 Azure 실측 86px — 렌더 순간 60px 점프 | 수치 위반 |

## 라운드 1 전량 기각 (오너 2026-08-30)

다섯 시안이 전부 "쪼개는" 방향이었고, 오너가 전제를 뒤집었다. 기각 목록:

- **시안 A 메타 줄** — 컨테이너를 없애고 확정 정보를 탭 아래 메타 줄로
- **시안 B 소속으로 분가** — 확정 정보는 머리에 한 줄로 남기고 Terraform 상태는 `현재 작업` 카드의 바닥 줄로
- **시안 C 요약을 든 채로 접는 Essentials**
- **시안 D 상태 적응형** — 정상(확정됨 + 전부 적용 완료)이면 12px 한 줄, 예외에서만 슬롯 카드로 승격
- **시안 E 최소 변경** — 활자·폭만 강등

그리고 **⛔ P4 폐기**: "성격이 다른 두 사실이 한 컨테이너에 살면 안 된다"는 진단은 오너가
담으라고 지시했으므로 전제가 만료됐다. **재제안 금지.**

**라운드 2 전제(오너 지시)**: 연동 확정 정보와 Terraform 상태를 **하나의 카드**로, 확정 정보는
**태그 또는 그냥 라벨**로 강등.

## 사용한 레퍼런스

라운드 2에서 실제로 채택안에 반영된 것만.

| 레퍼런스 | URL | 가져온 요소 |
|---|---|---|
| AWS Cloudscape — Container | https://cloudscape.design/components/container/index.html.md | 컨테이너 안 컨테이너 금지, 내부 구분은 헤어라인 |
| AWS Cloudscape — Header | https://cloudscape.design/components/header/index.html.md | 헤더 슬롯 화이트리스트(title / counter / description / info link / actions), 컨테이너 제목은 h2 급이라 페이지 섹션 제목을 넘을 수 없다 |
| AWS Cloudscape — Key-value pairs | https://cloudscape.design/components/key-value-pairs/index.html.md | label(작고 회색) / value(본문 급) 위계, 값 자리에 status indicator·링크 허용, 묶음이 하나면 그룹 제목을 붙이지 않는다 — **채택안의 헌장** |
| AWS Cloudscape — Badge vs Status indicator | https://cloudscape.design/components/badge/index.html.md | 상태를 배지로 그리지 말 것 — 두 축은 서로 다른 어휘를 쓴다 |
| Shopify Polaris — Badge | https://polaris.shopify.com/components/feedback-indicators/badge | 배지는 자기가 라벨하는 대상 옆에서만 주어가 정해진다 → 남의 카드에 들어간 사실은 주어를 글자로 되돌려야 한다(태그를 버리고 라벨을 택한 근거) |
| Atlassian — Lozenge | https://developer.atlassian.com/platform/forge/ui-kit/components/lozenge/ | 부정 상태는 톤만 바꾼다 · 잘린 lozenge는 focus 불가 = 접근 불가 → 단계명을 태그에 넣지 않는다 |
| GitHub Primer — Label / StateLabel / Token | https://primer.style/product/components/state-label/ | 배지가 "누구 것인지"를 모양·아이콘이 말한다 (우리에겐 아이콘 어휘가 없다) |
| Argo CD — Sync + Health | https://argo-cd.readthedocs.io/en/stable/operator-manual/health/ | 두 축의 값 어휘와 색 램프를 겹치지 않는다 |
| IBM Carbon — Tag usage | https://carbondesignsystem.com/components/tag/usage/ | 한 줄 태그 6개 상한 · 줄바꿈 금지 · 시스템 생성 이름은 태그가 아니다 |
| HCP Terraform — workspace 목록 행 | https://developer.hashicorp.com/terraform/enterprise/workspaces/browse | 한 행은 이름 + 상태 + 규모 + 시각, 가운데를 비우지 않는다 · 수는 무채색, 상태만 색 |

## 채택안 — 시안 C "카드 하나 + 라벨:값 한 줄" (오너 선택 2026-08-30)

1. **2열 스트립을 삭제하고 카드 하나로.** 골격은 `detailStyles.sectionCard` — 현재 작업·작업
   이력 카드와 **같은 부품**이라 세 카드가 한 가족으로 읽힌다. 내부 구분은 상자가 아니라
   헤어라인.
2. **카드 제목은 `opsStyles.scopeTag`로 `Terraform 적용 상태`.** 카드의 주인은 Terraform
   상태다 — 확정 정보는 이 탭이 다루는 대상이 아니라 실행의 **전제**이고, 그 상세는 확정 정보
   탭이 소유한다.
3. **확정 정보는 태그가 아니라 라벨:값 한 줄.** 라벨 `연동 정보`(12px 회색) + 값
   `확정됨` / `미확정`(12px/600). 태그로 가면 배치가 주어를 못 정해 `연동 확정됨` 같은 접두어가
   필수인데, 라벨을 앞에 두면 그 문제가 아예 발생하지 않는다. 앰버는 **값에만** 실린다
   (08-27 규칙 그대로 — 미확정은 정상 작업의 한 단계이지 실패가 아니다).
4. **미확정이면 같은 줄에 `{n}단계 · {label}`을 잇는다.** 08-27 게이트 라운드가 산 "어느 단계에
   멈췄는지"를 반납하지 않는다. 단계명이 태그가 아니라 본문 텍스트라 focus 가능한 자리에 남는다.
5. **`조회 {checked_at}`는 제목 줄 오른쪽 끝(`sectionCard.meta`)으로.** 목록 전체를 한정하는
   사실이라 행 밑에 두면 마지막 작업의 각주로 읽힌다. 반면 `상세정보 보기`는 **라벨 줄에서 값
   바로 뒤에** 남는다 — 그 링크가 여는 것은 목록이 아니라 방금 읽은 그 값(확정 정보)이고,
   확정됨일 때만 존재한다. 둘을 같은 자리로 보내면 링크가 무엇의 상세인지 잃는다.
6. **열 머리 줄을 두지 않는다.** 카드 제목이 이미 목록의 이름이고 행은 provider별 최대 3개
   (AWS 3 · GCP/IDC/SDU 2 · Azure 1)라, 열 머리는 한 줄을 쓰고 아무것도 사지 않는다.
7. **이름 칸은 `flex-1`을 버리고 240px 고정.** 마스트헤드 `opsStyles.fmFold`가 같은 화면에서
   같은 이유로 `1fr`을 버린 값 그대로. 793px 공백(P3)의 직접 해법이다.
8. **로딩 예약을 새 카드의 3행 높이로 맞춘다** (P7).

### 의도적으로 버린 것

- **라운드 1 시안 A~E 전부**: 오너 전량 기각. **재제안 금지.**
- **P4(두 사실을 한 컨테이너에 담지 마라)**: 오너 지시로 전제 만료. **재제안 금지.**
- **제목 옆 태그(라운드 2 시안 A)**: 오너가 라벨을 택했다. 태그로 가면 `연동 확정됨` 접두어와
  무채색 고정이 따라붙는데, 라벨은 그 두 장치가 필요 없다.
- **직교 2태그(라운드 2 시안 B)**: 두 번째 태그가 판정이면 08-27의 조합 상태 폐기 지시를
  되살리게 되고, 수치면 작업 1개인 Azure에서 바로 아래 줄을 반복한다.
- **⛔ 제목 옆 태그와 라벨 줄의 동시 적용**: 같은 사실을 두 번 말하면 강등이 아니라 승격이 된다.
  **재제안 금지.**
- **세 번째 카드로 내려보내기(라운드 2 시안 D)**: 머리 224px를 실제로 회수하는 유일한 안이지만,
  #675가 정한 2:1 그리드를 2:1:1로 바꾸는 결정이라 **오너 확인 대기**. 이번 PR 범위 밖이다.
- **카드 머리의 작업 수 counter**: 행이 바로 아래에서 세어 준다.

## 남은 문제

- **⚠️ P5 는 고쳐지지 않았고, 오히려 악화됐다.** 벤치마크 단계에서 새 카드를 약 90px 로 추정했으나
  **구현 후 실측은 그 추정이 틀렸음을 보여 준다** — 스트립이 갖지 않았던 카드 머리(`sectionCard.head`
  = `px-6 pt-5`)와 자기 행을 쓰는 라벨 줄이 붙기 때문이다.

  | 대상 | 기존 스트립 | 시안 C 카드 |
  |---|---|---|
  | Azure · 1작업 | 86px | **133px** |
  | AWS · 3작업 | 146px | **193px** |
  | 안내 카드 ~ 카드 바닥 | 179px | **226px** (Azure) |

  탭 줄에서 `현재 작업` 까지가 224px → **271px**. 높이를 이루는 값이 전부 형제 카드와 공유하는
  토큰이라, 조이려면 세 카드의 문법을 깨야 한다 — 그래서 조이지 않았다. 세로 회수는 여전히
  위 시안 D(세 번째 카드로 내려보내기) 결정에 달려 있고, 그 결정 전까지 P5 는 열린 채로 둔다.
- **로딩 예약**은 새 카드의 3행 실측(193px)에 맞춰 갱신했다(P7). 응답 전에는 작업 수를 알 수 없어
  가장 높은 경우를 예약한다 — 아래 카드를 덮지 않는 쪽이다.
