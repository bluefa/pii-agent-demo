# 확정 정보 입력·삭제 분리 — 벤치마크 결정 기록

- **날짜**: 2026-09-03
- **대상 화면**: 운영 콘솔 Target Source › 확정 정보 탭
  (`app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ConfirmTab.tsx`,
  `tabs/confirm/panes.tsx`, `tabs/confirm/ConfirmEditorModal.tsx`)
- **진단 기준**: `origin/main a7a58eb3` 라이브 DOM 실측 (Chrome 2133×1197, mock
  #1642 AWS · 확정 6건 · Terraform APPLIED / #1029 미등록)
- **아티팩트**: https://claude.ai/code/artifact/8d468a78-56f6-4317-947a-446ca1e7b449
  (진단 10건 · 레퍼런스 13종 · 시안 5종 전문. claude.ai 에 있어 저장소 이력 밖이라 이 문서를 남긴다)
- **선행 기록**: `confirm-editor-surface.md`(08-17, 편집기 타입·표면). 이 라운드는 그 위의
  **동작 구조**(입구와 삭제)다.
- **구현 PR**: #874

## 1. 문제 진단

오너 지적 두 가지 — "확정 정보 입력 디자인이 마음에 안 든다", "삭제가 이상하다 · 삭제/입력
2개로 나눠야" — 를 먼저 놓고 실측으로 여덟 가지를 이었다.

| # | 문제 | 근거(실측) | 등급 |
|---|------|-----------|------|
| P1 | 삭제가 편집의 하위 모드 — pane 의 문은 「확정 정보 수정」 하나, 삭제는 모달 안 모드 전환, 되돌아가는 버튼이 「편집으로 돌아가기」 | 디스클로저 3단 | UX 원칙 (오너 지적) |
| P2 | 입력 화면이 API 호출의 모양 — POST 배지·URL 줄·Parameters/Request body/Server response·응답 코드표 9행 | 개발 어휘 라벨 11개, 응답 코드표 상시 노출 | UX 원칙 (오너 지적) |
| P3 | 편집 면 28% / 실행 전 아무것도 못 하는 응답 칸 44% | textarea 412×600 ↔ 모달 960×920, 응답 칸 481×799, 실행 전 공백 481×390 | UX 원칙 |
| P4 | JSON 88줄 중 null 키 43%, 편집기 글꼴이 비등폭 | 리소스당 14키 중 6키 null · `--pl-font-mono: var(--pl-font-sans)`(globals.css:412) · scrollWidth 551 > 412 | UX 원칙 · 수치 위반 |
| P5 | 삭제 화면이 한 프레임에서 두 말 — "6건이 지워집니다" ↔ "지울 수 없습니다", primary 파랑 「인프라 철거로 이동」이 Send 자리, 입력란 disabled 채 존재 | h3 ↔ desc, CTA `#2563EB` in urlbar | UX 원칙 (오너 지적) |
| P6 | 확인 모달 안에 탐색 도구 일습 | 검색 360×32 · 페이저 5컨트롤 · 행 아이콘 6×22px | UX 원칙 |
| P7 | 액션이 두 줄(머리 [삭제][취소] / URL 줄 [저장]), 파괴 버튼이 취소 옆에 같은 크기 | 세 버튼 모두 h 32 | UX 원칙 |
| P8 | 제목이 동작을 말하지 않음 — 세 모드 모두 「확정 정보」 | 동작 표기는 12px 판정 줄과 배지뿐 | UX 원칙 |
| P9 | 같은 pane 에서 버튼 28px, 인풋 32px | editBtn 88×28 (`sm`) ↔ 검색 인풋 32 | 수치 위반 (design-guide §1) |
| P10 | 삭제가 막혔다는 사실을 삭제를 열어야만 안다 | 탭은 terraform `overall_state` 를 이미 보유 | 제안 |

## 2. 실제로 차용한 레퍼런스

아티팩트에는 13종이 있고, 채택안(A+B)이 실제로 값·규칙을 가져온 것은 아래 7종이다.

| 레퍼런스 | URL | 차용한 요소 | 확인 |
|---|---|---|---|
| Cloudscape — Delete with additional confirmation | https://cloudscape.design/patterns/resource-management/delete/delete-with-additional-confirmation/ | 영향 요약 + 타이핑 게이트 · **전제 미충족 = disabled + 사유**(막힘 변형) | 확인함 |
| GitHub — Deleting a repository | https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository | 삭제는 편집 폼 밖의 제 입구(Danger Zone) | 확인함 |
| Vercel — Managing projects | https://vercel.com/docs/projects/managing-projects | 같은 상자·다른 게이트 강도, 먼저 할 일 안내 | 확인함 |
| NN/g — Confirmation Dialogs | https://www.nngroup.com/articles/confirmation-dialog/ | 본문에 대상·건수, 결과를 말하는 버튼 라벨, 결정 하나 | 확인함 |
| Carbon — Dialog pattern | https://carbondesignsystem.com/patterns/dialog-pattern/ | 제목 = 동작 · 막힘 = acknowledgment 형(버튼 하나) | 확인함(v10 미러) |
| GitHub Primer — Button | https://primer.style/product/components/button/ | primary 1 + 보조 1 은 나란히 가능 · danger 는 확인 다이얼로그와 짝 | 확인함 |
| Cloudscape — Actions | https://cloudscape.design/patterns/general/actions/ | 컬렉션 전체 동작은 컬렉션 머리에 | 확인함 |
| 이 레포 — `DangerTab`(연동 초기화) + `ConfirmStepModal` | `tabs/DangerTab.tsx`, `app/components/ui/ConfirmStepModal.tsx` | 같은 콘솔의 파괴 동작 문법: 제목=질문 · 설명 · 취소/실행 짝 · warning 톤 · 결과 프레임 | 코드 |

차용하지 않은 것: Apple HIG · Atlassian · Material(기억 기반 — 본문 미수신) · AWS IAM ·
Grafana · GCP(시안 C·D 전용, 이번 범위 밖).

## 3. 채택안 — A + B (오너 선택 "A, B 먼저")

비교표에서 A+B 는 판례 충돌이 없는 유일한 조합이고 비용이 S 다. C(편집기 재구성)는
08-17 오너 지시 "입력·response 2분할"과 상충해 오너 답을 기다린다. E(인라인 편집)는
08-12 B 안 기각 사유(같은 컨테이너에서 요청↔초안 번갈아 보기)가 재현돼 제외.

### A. 두 개의 문
- pane 머리: `[확정 정보 삭제]`(PlButton `danger` outline, 등록이 있을 때만) ·
  `[확정 정보 입력]`(primary — 등록이 있으면 disabled, 오너 지시 09-03: 지운 뒤 다시
  입력한다). 둘 다 **md 32px** — 같은 pane 검색 인풋 32와 같은 높이(P9).
  낱말은 상태와 무관하게 늘 「입력」이다. 잠긴 얼굴은 native `disabled` 가 아니라
  PlButton `blocked` 로 만든다 — 사유("확정 정보를 삭제한 뒤 입력할 수 있습니다")를 지는
  툴팁이 hover 로도 포커스로도 닿아야 하고, native `title` 은 08-30 오너 지시로 버렸다.
- 삭제는 `ConfirmDeleteModal`(신규) — `ConfirmStepModal sm 480` 위에, 연동 초기화 탭과
  같은 `tone="warning"`. 빨강 채움(`tone="danger"`)은 부품 변경이 필요해 넣지 않았다.
- 편집기(`ConfirmEditorModal`)에서 삭제 모드·DELETE 배지·「편집으로 돌아가기」·
  「인프라 철거로 이동」·Terraform 게이트 제거. 편집기는 편집만 한다(P1·P7).

### B. 삭제 모달 3변형 (+ 확인 중)
`deleteVariantOf(gate)` 순수 함수가 정한다. 막는 상태는 현행과 같이 **APPLIED 뿐**.

| 변형 | 제목 | 본문 | 실행 |
|---|---|---|---|
| checking | 확정 정보 N건을 삭제할까요? | 「대상 id 타이핑」만(disabled) | disabled |
| blocked (APPLIED) | 지금은 삭제할 수 없습니다 | 본문 없음 — 제목 + Terraform 문장이 전부 | `인프라 작업 탭으로`(default 톤, 출구) |
| allowed | 확정 정보 N건을 삭제할까요? | 「대상 id 타이핑」만 | `삭제`, id 일치 시 |
| unknown (조회 실패) | Terraform 상태를 확인하지 못했습니다 | `다시 확인` + 체크 "인프라가 없음을 직접 확인했습니다" + 타이핑 | 체크 ∧ id 일치 시 |

- **목록 자체를 없앴다**(오너 지시 09-04, P6 의 결론). 확인 모달의 질문은 "이 N건을 지울 것인가" 하나이고, 모달은 건수만 말한다 — 지워질 것의 이름은 뒤 화면(확정 정보 탭)이 든다.
- 막힘 변형에는 "지워집니다"가 없다(P5). primary 는 곧 출구라 파랑이 맞다.
- 성공은 모달이 스스로 닫히고 탭을 다시 읽는다(뒤 화면이 기록) · 실패만 결과 프레임.
- 모달은 탭이 이미 든 `overall_state` 로 첫 프레임을 그리고(P10), 마운트 시 재조회가 끝나기 전까지 입력·실행을 잠근다 — 조회 중 프레임이 높이를 고정해 막힘 변형 아래 빈 공간을 남기던 것을 막는다.

### 값의 출처
| 값 | 출처 |
|---|---|
| 버튼 md 32/14 | PlButton md — 같은 pane 의 검색 인풋 32 |
| 모달 480 · 제목 26/700 · 설명 14/1.5 | `ConfirmStepModal sm` — 제목 26 은 실측(컴포넌트 확인 프레임 눈금) |
| 확인 인풋 280×32 | 현 DeletePanel 입력란 그대로 |

## 4. 남은 것 (오너 결정 대기)
- **C** 편집기 탈-API클라이언트 — 09-03 오너 지시로 확정, `confirm-editor-v2.md` 로
  구현(PR #874). ~~질문~~ 답: 응답은 결과 프레임(모달 상태 전환)으로만 보고, 실행 전
  칸에 상시로 두지 않는다.
- **D** C 위의 `[표 | JSON]` 렌즈 — "비교 렌즈 제거"(08-13) 정서와 인접, 오너 판단 대기 (미착수).
- P4 의 등폭 글꼴은 C 에서 편집기에만 `ui-monospace` 를 명시 선언한다(앱 단일 서체 결정과 충돌 없음).
