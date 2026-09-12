# 연결 테스트 탭 — 「왜 아직 5단계인가」를 두 행으로 답한다

- 날짜: 2026-09-12
- 대상: 운영 콘솔 `/admin/pipelines/ops/target-sources/{id}?tab=tc` — `tabs/TcTab.tsx` ·
  `tabs/tc/TcLatestRunCard.tsx` (관리자 화면만. 서비스 Step 5 는 범위 밖.)
- 리서치 아티팩트: https://claude.ai/code/artifact/8bef3504-fa4f-4402-8f45-6db75d6b6b54
- 채택안: 시안 E 「5단계 종료 조건 두 행」 (오너 2026-09-12 "E안 적용해봐")

## 문제 (증거 등급)

목 1583(IDC · 5단계)을 브라우저에서 읽은 값이다. 최신 실행은 06-01 성공(3/3), 관리자는 07-19 에
재실행을 요청했고(REJECTED + 사유), 서비스는 아직 다시 실행하지 않았다.

| # | 진단 | 등급 |
|---|------|------|
| P1 | 「현재 단계」 로젠지가 붙은 탭이 **왜 여기 멈춰 있는지**를 말하지 않는다. 마스트헤드 「5단계」, 탭 「현재 단계」, 밴드 「모든 리소스가 연결에 성공했어요」가 한 화면에 서면 "성공했는데 왜 5단계인가"라는 질문이 생기고 답은 이 탭에 없다 | 관측된 결함 |
| P2 | 관리자가 쓴 **재실행 요청과 사유가 이 탭에 0바이트**. 서비스 Step 5 는 같은 값을 `TcRejectionNotice` 로 보여 준다 — 사유를 쓴 쪽만 못 본다 | 관측된 결함 |
| P3 | 「승인 요청 미클릭」을 말하는 문장이 콘솔 전체에서 승인 탭 조건 ① 캡션 하나뿐이고(`showsHandoffCaption`), 반려 뒤에는 그 캡션도 사라져 두 탭이 다 조용하다 | 관측된 결함 |
| P4 | **차례(turn)가 없다.** 5단계는 서비스의 차례이고 관리자가 할 일이 없는 단계인데 화면이 그것을 말하지 않는다 | UX 원칙 |
| P5 | 밴드의 슬롯 CTA 「연결 테스트」는 이 탭의 유일한 행동이지만 **그 실행은 5단계를 풀지 못한다** — 6단계로 넘기는 것은 서비스의 승인 요청이다 | UX 원칙 |
| P6 | 반려가 실행보다 뒤인지(이 실행이 반려된 실행인지)를 가르는 판정(`ackIsStale`, #785)이 줄과 함께 화면에서 사라졌다 | 관측된 결함 |

뿌리는 하나다: 이 탭은 「최신 실행이 어땠나」만 말하고 「이 단계가 끝나려면 무엇이 더 있어야
하나」를 말하지 않는다. 실행 결과는 5단계 종료 조건의 절반이다.

## 채택 — 시안 E 「5단계 종료 조건 두 행」

관리자 승인 탭의 승인 조건 카드 문법(판정 마크 ✓/✗/⚠ + 요건문 + 라벨–값 근거 행)을 실행 밴드
**바로 위** 한 프레임에 두 행으로 옮겨 심는다.

1. **최신 연결 테스트 결과가 성공이어야 합니다** — 판정은 승인 조건 ② 의 `tcRunGate` 그대로.
   근거: 완료 시각 · 성공/실패 수. 미충족이면 태그 「실패」「실행 없음」, 진행 중이면 「진행 중」.
2. **서비스 담당자가 승인 요청을 눌러야 합니다** — 「승인 요청됨」(충족) / 「재실행 요청됨」
   (관리자가 돌려보냄: 재실행 시각 · 사유 · 다음 행동) / 「승인 요청 대기」(성공 + 미요청) /
   ① 이 안 섰으면 아직 물을 수 없는 행(시계 마크, 회색).

머리 줄 오른쪽에 차례 한 마디(「지금은 서비스 담당자 차례입니다.」 / 「연결 테스트가 끝나기를
기다리고 있습니다.」 / 「단계 반영을 기다리고 있습니다.」). 조회 실패는 모름이라 차례를 말하지 않는다.

- **5단계(INSTALLED)에서만 선다.** 6단계가 되면 사라진다 — 끝난 단계의 사유는 소식이 아니다.
  SDU 는 승인 요청 버튼 자체가 없어 서지 않는다.
- **게이트가 아니다.** 실행 버튼을 잠그지 않는다(#856 과 같은 규칙).
- **반려는 최신 실행과 시각을 견준다.** 반려 뒤 새 실행이 시작됐으면 반려는 지난 기록이라
  ②는 「승인 요청 대기」로 서고 근거에 「재실행 요청 {시각} · 이전 실행 기준」이 남는다(P6).
- **새 API 0.** 입력은 페이지가 이미 받는 `processStatus` · `tcStatus` · `latest` 뿐.
  `completion-status`(정책 변경 갈래)는 부르지 않는다 — 오너 결정 사항.

비교표 근거: 다섯 시안 중 진단 여섯을 전부 덮고 기각 판례에 저촉하지 않는 유일한 안. A(밴드
곁줄)는 가장 싸지만 사실 둘을 한 줄에 우겨 넣어야 하고(한 줄 한 사실 규칙 위반) 오너가 08-25 에
걷은 「초록 헤드라인의 각주」 자리에 다시 선다. D(탭 로젠지 낱말)는 #894 저촉. B(info 상자)는 한
카드에 상자 셋. C(마스트헤드 태그)는 E 의 후속 후보.

08-25 「승인 요청 줄은 없앴다」와의 관계: 그 전제는 「상시로 서서 '아직 요청 안 함' 하나를
반복한다」였다. 이 프레임은 5단계에서만 서고 종료 조건 둘을 말하므로 전제가 다르다.

## 실제 차용한 레퍼런스

| 레퍼런스 | 빌린 요소 | URL |
|----------|----------|-----|
| Azure Pipelines — Approvals and checks | 멈춘 단계의 종료 조건은 **목록**이고 조건마다 판정 + 지시문이 붙는다 | https://learn.microsoft.com/en-us/azure/devops/pipelines/process/approvals |
| GitHub — Required status checks | 종료 조건 목록은 결과 버튼 **바로 곁**에 선다 (밴드 바로 위) | https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/collaborating-on-repositories-with-code-quality-features/about-status-checks |
| AWS CodePipeline — Manual approval | 멈춤은 실패가 아니라 대기이고 낱말이 그걸 가른다; 「누가 풀 수 있는가」가 멈춘 자리에 선다 | https://docs.aws.amazon.com/codepipeline/latest/userguide/approvals.html |
| HCP Terraform — Run states | 상태 태그가 필요한 행위를 품는다(「승인 요청 대기」「재실행 요청됨」) | https://developer.hashicorp.com/terraform/cloud-docs/run/states |
| Zendesk — Open · Pending · On-hold | 상태 옆에 **누구 차례인지**를 적는다 | https://support.zendesk.com/hc/en-us/articles/4408843029658-About-open-vs-pending-and-on-hold-tickets |
| AWS Cloudscape — Status indicator | 상태는 글자로 말한다(색 점 금지, 오너 09-11 과 같은 규칙) | https://cloudscape.design/components/status-indicator/ |

전체 13개(확인함 12 · 기억 기반 1)와 시안 A~E 비교표는 아티팩트 참조.

## 구현 노트

- `tabs/tc/stepHold.ts` — `stepHoldView()` 접기 함수. 갈래마다 테스트(`stepHold.test.ts`).
- `tabs/tc/StepHoldGate.tsx` — 그리기만. 마크·활자·근거 행 치수는 승인 탭 `GateCard` 값
  그대로(마크 20px · 요건문 14/600 · 라벨 12px `--pl-gray-600` / 값 14px `--pl-text-medium`).
  프레임은 밴드와 같은 10px 라운드 + `--pl-border` 헤어라인, 면은 흰색 — 바로 아래 밴드가
  국면의 면을 입으므로 프레임까지 칠하면 카드 안에 색 판이 둘이 된다.
- `TcLatestRunCard` 에 `stepHoldSlot` — 알림 상자들 아래·밴드 위. `TcTab` 이 `processStatus` ·
  `tcStatus` · `tcStatusFailed` 를 새로 받고(`OpsTargetView` 가 이미 들고 있던 값), SDU 는
  `provider === 'sdu'` 로 가른다.
- 승인 탭 `GateCard` 는 추출하지 않았다 — 그쪽 껍데기(한 행 세 열 카드)는 여기 쓰이지 않고
  빌린 것은 마크와 근거 행 활자뿐이라, 두 파일이 같은 값을 적는 것으로 족하다.
