# 운영 콘솔 · 인프라 탭 미확정 게이트 재설계

- **일자**: 2026-08-27
- **대상 화면**: `/pass/admin/pipelines/ops/target-sources/{id}?tab=infra`
  (`PipelineTab` + `InfraStatusHead` + `TargetPipelineSections`)
- **기준**: origin/main `f3e6b693`
- **아티팩트**: https://claude.ai/code/artifact/598ed92b-7336-48bd-967d-a065e52f1fd8
- **선행 라운드**: `docs/ux/benchmark/ops-infra-tab.md` (PR #675)

이번 라운드는 선행 라운드가 다루지 않은 **미확정(게이트) 상태**를 다룬다. 확인 대상
#1029(1단계 IDLE, 이력 0), 대조군 #1006(미확정인데 RUNNING + 이력 3), #1010(확정·적용
완료·이력 0). 실측은 mock dev 서버 1440×1000.

## 문제 진단

| # | 문제 | 근거 | 등급 |
|---|------|------|------|
| P1 | "없다"를 네 곳에서 말한다 | 배너 제목 22px `확정된 연동 정보가 없습니다` → 빈 카드 20px `실행 중인 작업이 없습니다` → 비활성 버튼 밑 13px `확정된 연동 정보가 없어 시작할 수 없습니다`(배너와 같은 사실) → `작업 이력이 없습니다`. 게이트 아래 403px 카드 행 전체가 빈 상태 | UX 원칙 (동시 노출) |
| P2 | 게이트의 유일한 CTA가 막다른 길 | primary `연동 요청 정보 보기`가 같은 말을 하는 탭으로 보낸다. 1단계 대상은 운영자가 할 행동이 없는데 화면에서 가장 강한 컨트롤이 primary | UX 원칙 (회복 경로) |
| P3 | 게이트가 상태 스트립을 통째로 대체 | `has_confirmed_infra === false`면 3칸 스트립 대신 배너라 Terraform 적용 상태·작업 수·설치 현황이 사라진다. 게다가 정상 상태에서도 화면에 있는 건 조합 pill 하나뿐이고 작업별 상태는 모달 뒤에 있었다 | UX 원칙 (정보 손실) |
| P4 | 게이트가 단계를 모른다 | 배너 문장 하나가 요청 없음/승인 대기/확정 전을 전부 덮는다. `processStatus`(마스트헤드 StepPill이 이미 쓰는 값)를 안 읽는다 | UX 원칙 (맥락) |
| P5 | 세트 밖 글자 5종 | 22px(배너 제목)·15px(빈 상태 보조)·13px(사유줄·메타)·13.5/11.5px(실행 중 카드 impact note·칩). design-guide 세트는 12/14/16/18/20/24 | 수치 위반 |
| P6 | 카드에서 가장 큰 글자가 "없습니다" | 빈 상태 헤드라인 20px/500 > 섹션 제목 16px/700 | UX 원칙 (역할당 크기 1개) |
| P7 | 이력 0건에 `총 0건` + 페이저 `1` | `always`의 근거였던 "페이저가 사라지면 카드 높이가 변한다"는 `min-h-[266px]` + `flex-1`이 생긴 뒤 전제가 만료됐다 | 제안 |
| P8 | 정적 안내 카드가 첫 77px | #675 오너 지시라 이번 라운드는 유지, 접힘 변형(시안 E)만 선택지로 남김 | 제안 |

## 사용한 레퍼런스

| 레퍼런스 | URL | 가져온 요소 |
|---|---|---|
| HashiCorp Helios — Show, hide, and disable | https://helios.hashicorp.design/patterns/disabled-patterns | 전제조건이 있으면 disabled 버튼 대신 맥락 안내 + 해결 장소 링크. "provide CTAs directly to the place where users can take immediate action" |
| HashiCorp Helios — Application State | https://helios.hashicorp.design/components/application-state | 페이지 primary는 하나, 본문 최대폭 480px |
| HCP Terraform — Run states | https://developer.hashicorp.com/terraform/cloud-docs/run/states | 종료 상태 이름이 결과를 담으므로 두 번째 pill이 필요 없다 |
| GCP Infrastructure Manager — Deployments/Revisions | https://docs.cloud.google.com/infrastructure-manager/docs/deployments-revisions | 표 헤더 없는 한 줄 리스트(이름·상태)로 읽히는 실행 단위 |
| Cloudscape — Disabled and read-only states | https://cloudscape.design/patterns/general/disabled-and-read-only-states/ | 사용자가 풀 수 없는 조건이면 숨긴다, 이유는 한 채널만, 카피 공식 "available when [condition]" |
| Cloudscape — Empty states | https://cloudscape.design/patterns/general/empty-states/ | 설명은 이유가 있을 때만, 카운터와 컨트롤 분리 |
| IBM Carbon — Empty states | https://carbondesignsystem.com/patterns/empty-states-pattern/ | 같은 행에 빈 상태가 여럿이면 아이콘 반복은 신호가 아니다(텍스트 전용) |
| PatternFly — Empty state | https://www.patternfly.org/components/empty-state/design-guidelines/ | 카드 안 빈 상태는 xs, 카피는 결핍이 아니라 다음 행동 |
| Segment Evergreen — Empty states | https://evergreen.segment.com/patterns/empty-states | 같은 화면에서 CTA를 두 번 주지 않는다, in-table은 표 헤더를 남긴다 |
| GitLab Pajamas — Empty states | https://design.gitlab.com/patterns/empty-states/ | Configuration required 유형, 빈 상태가 활성이면 주변 크롬을 숨긴다 |
| env0 — Environments | https://docs.envzero.com/docs/environments | 대기·승인 대기까지 상태값이 흡수한다(배너가 아니라) |
| GitHub Actions — Manually running a workflow | https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow | 이력 0건은 표 셸 없이 한 문장, 준비 안 된 상태에서는 실행 버튼 자리에 준비 액션 |
| Azure — Deployment history | https://learn.microsoft.com/en-us/azure/azure-resource-manager/templates/deployment-history | 개요는 개수+링크, 표는 한 단계 아래 (반증 레퍼런스: 이력 카드 유지 결정의 반대편) |

## 채택안 — 시안 A + B + C + D (오너 승인 2026-08-27)

1. **⛔ 오너 지시로 조합 상태 폐기.** "Terraform은 각 작업이 어떤 상태인지 보여주도록 하자.
   조합 상태는 필요없음". `overall_state` pill 삭제, 「Terraform 작업」 칸이 `tasks[]`를 작업
   이름(mono)·실행 주체 태그·상태 pill 행으로 편다. 어휘는 `terraformState.ts`의
   `STATE_META`/`TONE` 그대로. 계약상 작업 수는 provider별 최대 3(AWS 3 · GCP/IDC/SDU 2 ·
   Azure 1)이라 상한·스크롤 없음.
2. **게이트 배너 삭제, 스트립은 항상 렌더.** 2칸(`1fr 2fr`). 「연동 정보」 값이
   `확정됨 / 미확정`(앰버는 값에만) + 보조줄은 확정이면 최근 확정 시각, 미확정이면
   `STEP[processStatus]`의 `{n}단계 · {label}`. 「Terraform 작업」 보조줄은 `조회 {checked_at}`.
3. **TerraformStatusModal 삭제.** 표는 칸으로 옮겨졌고 `overall_state`는 폐기, `최근 확정`·
   `조회 시각`은 두 칸이 받으므로 남는 근거가 없다. #675의 "Terraform 설치 현황은 모달로"
   지시를 이 라운드가 대체한다.
4. **차단된 「현재 작업」은 안내 블록 하나.** 비활성 버튼·사유줄·아이콘 삭제. `gateStage.ts`가
   단계별 문장과 액션 하나를 준다: IDLE → 담당자 화면 링크, PENDING → 관리자 승인 탭, 그
   외·null → 확정 정보 탭(secondary). primary는 없다.
5. **빈 상태를 세트로.** 헤드라인 16px/600, 본문 14px 한 문장, 아이콘 삭제. 이력 0건은
   표 헤더 + 12px 한 줄, `총 0건` 숨김, 페이저는 2페이지부터(`always` 해제).

### 의도적으로 버린 것

- **시안 E(안내 카드 접기)**: #675 오너 지시(info 카드)를 바꿔야 하고 A+B 뒤에는 회수할
  세로가 절실하지 않다.
- **이력을 스트립 칸으로 접기(Azure 문법)**: #675의 2:1 결정을 존중한다.
- **헤드의 `작업 시작` CTA, 상태 의존 헤드 CTA, 마지막 성공 슬롯, 두 시각 한 셀 병합**: #675
  기각 판례 그대로 유지.
- **실행 중 카드의 13.5/11.5px 칩**: 이 라운드 범위 밖(기록만).

## 리뷰 반영 (오너 2026-08-27 2차)

1. **한 카드가 모든 실행 상태를 그린다.** `LastRunFailedCard` 삭제. 실행 중·실패·중단·
   완료(DONE)가 전부 `CurrentPipelineCard` 한 갈래로 들어가고, 끝난 작업도 Task 실행 흐름을
   그대로 그린다. 오너: "Task 목록을 보여주는게 중요함", "완료되어도 Task를 잘 보여주는게
   중요할듯". `TargetPipelineSections`의 `focusId`가 `latest != null`이면 전부 덮으므로
   (DONE·PENDING 포함) 성공으로 끝난 작업이 빈 카드로 사라지던 것이 없어졌다. live/terminal로
   갈리는 건 액션 묶음 하나뿐 — `작업 중단` vs `재시작`(FAILED·CANCELLED만)·`새 작업 시작`.
2. **삭제한 문구.** "작업이 중단되어 인프라가 부분 상태일 수 있습니다"(오너: "작업이중단되어~
   이런 부분은 없애"), "「Task」에서 실패했습니다/중단됐습니다"(오너: "어디서 중단되었습니다.
   이건 우선은 따로 보여주지말자고"), "전체 N단계 중 M단계를 완료했습니다". 멈춘 지점은 흐름
   안의 빨간 링이 말한다.
3. **`TerraformImpactNote` 전체 삭제.** 오너: "이 작업은 실제 인프라를 변경합니다 / APPLY 2건 /
   PLAN 2건 이 부분은 없애". 근거: 바로 아래 Task 카드가 각자 `JobKindTag`(PLAN/APPLY/DESTROY)를
   달고 있어 같은 사실을 합계로 한 번 더 말하던 것이고, **어느** Task가 지우는지는 per-task
   형태만 답한다.
4. **카드 헤드는 파란 태그.** 오너: "보조 텍스트 삭제하고 현재작업은 태그로 선언해쥐실래요?
   파란색태그". `detailStyles.sectionCard.title`이 `opsStyles.scopeTag`(#792에서 승인한 저채도
   blue)를 **그대로 참조**하고(손복사 금지), `sectionCard.desc`는 삭제. 현재 작업·작업 이력 두
   카드가 같은 헤드를 공유하므로 둘 다 적용되고, 아이콘도 함께 빠졌다(태그는 제목 행이 아니다).
5. **진행 문구는 「Task 실행 흐름」 오른쪽 중립 태그로.** 오너: "(0/4 단계 완료) → 몇번째단계
   진행중 이렇게바꾸고 Task 실행흐름 오른쪽에 태그로 보여주시죠". 공용 헬퍼 `progressPhrase`를
   `{n}/{total}단계 {상태어}` 한 꼴로 정리 — 진행 중 · 대기 · 실패 · 중단. **DONE만 예외로
   `{total}단계 완료`**(끝난 작업에서 n은 언제나 total이라 분자가 정보를 나르지 않는다). 대기·
   중단이 "완료"로 읽히던 것이 이걸로 없어졌고, 같은 헬퍼를 쓰는 파이프라인 상세 실행 밴드도
   같이 고쳐졌다. 태그는 중립 톤 — 파랑은 헤드가 이미 쓴다.
6. **실행 이름 18px, 시각은 `yy.mm.dd HH:MM:SS` + 시계 아이콘.** 오너: "시작 옆에 시계 아이콘
   적용해주세요", "시간은 yy.mm.dd HH:MM:SS 이렇게". `fmtDateTimeShortSec` 신규(`fmtDateTimeShort`에
   초를 남긴 꼴). 메타 줄은 `🕐 시작 … · 경과 …` 한 줄이고 시계는 시작에만 붙는다. 이름 18px는
   12px 섹션 태그와 두 단 벌리기 위한 값. 이 파일의 세트 밖 글자(13/13.5/11.5px)는 전부 정리돼
   12/14/16/18만 남았다.
7. **미확정이면 `작업 시작`은 비활성 버튼.** 오너: "연동 정보 미확정 상태면 파이프라인 시작은
   불가능하게 만들어줘. 버튼 비활성화 오케이?". ⛔ 이 지시가 1차 채택안 4의 "비활성 버튼·사유줄·
   아이콘 삭제"를 **대체한다** — 옛 문장으로 다시 따지지 말 것. 돌아온 것은 버튼뿐이고 **사유줄은
   여전히 없다**: 문장은 바로 위 안내 블록에 한 번만 서고, 죽은 버튼은 그 문장을 `title`로만
   나른다. 게이트는 `has_confirmed_infra === false`가 **확실할 때만** 잠근다 — 조회 중·조회 실패
   (`status == null`)는 허용한다. 서버가 미확정 시작을 스스로 거절하고, 일시적 조회 실패로 정상
   작업을 막을 이유가 없다.
   *예외 한 곳*: 「최근 작업」 카드의 `재시작`·`새 작업 시작`은 비활성 + 짧은 사유줄
   (`확정된 연동 정보가 없어 시작할 수 없습니다.`)을 유지한다. 그 카드에는 안내 블록이 없어
   문장이 설 다른 자리가 없고, 사유줄 한 마디는 안내 블록의 두 문장 인계를 담지 못한다.
8. **GCP 헤더 — 두 주체가 같은 층에, 주소는 전문으로.** 오너: "gcp의 header에서 terraform
   service account도 scan service account와 같은 층에 보이도록", "gcp는 full mail 주소를
   보여줘야됨", "2층으로 나타내지말고, 1층으로 나타내봐". 결과는 두 행이다 — 1행 `프로젝트 · 설정`,
   2행 `Scan SA · Terraform SA`(각 `fmCellWide` 2열, Scan 칸에 `col-start-1`로 행을 강제).
   1층은 1440에서 성립하지 않는다: kv 레인이 928px인데 주소 둘만 341+365=706px이라, 남는
   222px에 프로젝트(115)·설정(74)과 간격 3×18=54px를 넣으면 21px이 모자란다. 2열 병합이면
   칸이 451px이라 둘 다 절단 없이 선다(실측). **이 928px은 1440 기준이다** — 1920 창에서 재면
   레인이 1400px이라 1층이 되는 것처럼 보이고, 이 라운드에서 실제로 그 오독으로 절단본을 한 번
   커밋했다. 축약(`gcpServiceAccountDisplay`)은 오너 지시로 쓰지 않는다 — 헬퍼는 남지만 호출부가
   없다.

### 이 라운드에서 바뀐 판례

- **#675 "Terraform 설치 현황은 모달로"** → `TerraformStatusModal` 삭제. 전제(헤드엔 pill 하나,
  상세는 클릭 뒤)가 조합 pill 폐기와 함께 만료됐다. 표는 헤드 스트립의 「Terraform 작업」 칸이
  작업당 한 행으로 받는다.
- **이 문서 1차 채택안 4 "차단된 카드는 안내 블록 하나, 비활성 버튼 삭제"** → 비활성 버튼 복원
  (위 7). 사유줄·아이콘 삭제는 그대로 유효하다.
- **「같은 층」을 1행 4칸(`fmGridGcp`)으로 풀던 중간안** → 2행 병합으로 되돌림(위 8). 1행은
  1440에서 주소를 잘랐다 — 같은 층은 얻었지만 전문 표시를 잃는다.

## 구현

- 브랜치 `feat/ops-infra-gate`
- 신규 `gateStage.ts`(단계 → 문장·액션 허용목록)
- 삭제 `TerraformStatusModal.tsx`, `LastRunFailedCard`, `TerraformImpactNote`
- 신규 `fmtDateTimeShortSec`(`yy.mm.dd HH:MM:SS`); `progressPhrase` 는 `n/N단계 {상태어}` 한 꼴
- `PipelineTab`이 `processStatus`와 탭 이동 콜백을 받는다
- `TargetPipelineSections`가 `startBlockedReason` 문자열 대신 게이트 객체를
  `EmptyPipelineCard`로 전달한다

**검증 기준**(2차 반영 후):

- 게이트 + 이력 0(#1029)에서 "확정/없다"가 1회 — 헤드는 `미확정` 값만, 문장은 안내 블록에만.
- **응답하는** primary 0개. (원안의 `primary 0개`는 폐기 — 지시 7로 비활성 primary `작업 시작`
  하나가 다시 섰다.)
- 작업별 상태 행이 게이트 상태에서도 렌더되고 조합 pill 없음. (유효)
- #1006에서 실행 중 카드와 미확정 값이 공존하며 「적용 중」이 어느 작업인지 행에서 읽힌다. (유효)
- 끝난 작업(DONE·FAILED·CANCELLED)이 빈 카드로 떨어지지 않고 Task 실행 흐름을 유지한다. (2차 추가)
- ~~문서 높이 ≤ 902px @1440~~ **삭제** — 안내 블록만 있던 1차 몸통에서 잰 값이라, 버튼 행이
  돌아오고(7) 헤드가 작업 행 스트립(로딩 예약 104→146px)으로 바뀐 지금은 근거가 없다. 다시
  쓰려면 재실측이 먼저다.

PR: #800
