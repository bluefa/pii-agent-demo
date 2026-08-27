# 운영 헤더의 설정 두 칸 — 「설정」 병합 셀 + About 문법

- 날짜: 2026-08-26
- 대상 화면: `app/admin/pipelines/ops/target-sources/[targetSourceId]` 마스트헤드 (`OpsHeader` 의 `fmGrid`)
- 아티팩트: https://claude.ai/code/artifact/169b8060-9e00-498e-9c23-41a039ecddca
- 구현 PR: #795

## 발주

오너: "실데이터, 설치 모드를 공간을 덜 차지하면서 수정 가능하게 할 방법이 없을까?"
(앞선 발언: "이 부분이 너무 많은 공간을 차지하는 것 같아")

## 진단

| # | 문제 | 증거 등급 |
|---|------|-----------|
| P1 | 이 그리드가 "고칠 수 있는 값"을 **두 문법**으로 말한다 — Role 셀은 값에 밑줄, 설정 셀은 흰 면 태그 + 「수정」 링크 | UX 원칙 (일관성) |
| P2 | 한 칸이 `라벨 + 태그 + 수정` 세 요소이고 그게 두 번 — 사실은 낱말 두 개뿐인데 240px 칸 두 개를 쓴다 | 수치 (셀당 −69px 회수 가능) |
| P3 | 실데이터 한 칸 때문에 AWS 자동 배치에서 4열 그리드가 2행이 된다 (≈52px) | 수치 |
| P6 | 흰 면 = "수정 가능" 규칙이 흔들렸다 — Role 값이 밑줄로 바뀌면서 흰 면은 "수정 가능하지만 클릭 대상은 옆" 이라는 뜻이 됐다 | UX 원칙 |

## 쓴 레퍼런스 (13건, 전부 이번 세션에 fetch)

빌려온 것만 적는다. 전체 목록·근거는 아티팩트에 있다.

| # | 출처 | URL | 빌린 것 |
|---|------|-----|---------|
| 01 | AWS Cloudscape — Inline edit | https://cloudscape.design/patterns/resource-management/edit/inline-edit/ | 값이 곧 컨트롤 (`fmValueEdit` 의 근거) |
| 02 | PatternFly — Inline edit 가이드 | https://www.patternfly.org/components/inline-edit/design-guidelines/ | 라벨 소실의 대가 — 값이 스스로를 설명해야 한다 |
| 03 | AWS Cloudscape — Edit resource | https://cloudscape.design/patterns/resource-management/edit/ | 컨테이너 edit → 모달 (지금 두 모달이 그 답) |
| 04 | GitHub — 리포지토리 About 패널 | https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics | **관련 페이지 블록의 문법** — 마크가 앞에 서고 이름이 링크 |
| 05 | AWS Console — S3 Properties | https://docs.aws.amazon.com/AmazonS3/latest/userguide/default-bucket-encryption.html | 어포던스 개수를 필드 수와 무관하게 고정 |
| 08 | NN/g — Consequential options | https://www.nngroup.com/articles/proximity-consequential-options/ | 결과가 다른 값을 나란히 두는 비용 |
| 12 | Retool — Inspector 패널 | https://retool.com/blog/simplifying-retools-inspector | **반례** (아래) |

## 채택안: 시안 A(「설정」 병합 셀) + F 문법

두 칸을 **한 칸**으로 합치고, 값은 F 문법(파란 밑줄 낱말)이 진다. 모달은 손대지 않았다.

```
전:  설치모드          실데이터
     [자동] 수정       [미포함] 수정

후:  설정
     자동 설치 · 실데이터 미포함      ← 두 낱말 각각이 제 모달을 연다
```

- 라벨이 하나로 줄었으므로 **값이 스스로를 설명한다** — 「자동」이 아니라 「자동 설치」, 「미포함」이 아니라 「실데이터 미포함」 (02 가 경고한 라벨 소실의 대가).
- AWS 자동 배치에서 그리드가 **2행 → 1행** (계정 · Scan Role · TF Role · 설정 = 정확히 4칸). 마스트헤드 ≈198px → ≈146px.
- 그리드에서 흰 면 태그가 사라져 P1·P6 이 함께 닫힌다. `opsStyles.metaTag` 는 이 라운드에 은퇴했다.
- `미확인`(값 없음) 3상태는 그대로 살아 있다 — 평문으로 「실데이터 미확인」.

### 같이 채택: 관련 페이지 = GitHub About 문법 (04)

오너: "Github About으로 관련 사이트도 구성하면 좋겠음."
목적지마다 **마크가 앞에 서고 이름이 링크**다 (Jira 로고 + 티켓 번호 / 설치 아이콘 + 「서비스가 보는 화면」).
About 패널이 링크 뒤에 표식을 붙이지 않으므로 ↗ 를 줄마다 반복하지 않는다 —
새 창으로 여는 Jira 에만 남긴다. 그건 목적지가 아니라 **어디에 열리는지**의 표식이라 다른 축이다.

## 남긴 반례 (12 · Retool)

Retool 기준이면 답은 자리 이동이 아니라 **모달까지 팝오버로 접어 왕복을 없애는 것**이고,
채택안은 클릭 두 번(값 → 모달 → 저장)을 그대로 둔다.
이 반례가 이기는 조건은 **이 헤더의 주업이 대조가 아니라 편집이 될 때**이며 지금은 아니다
(사실 4~6개 대 설정 2개, 그리고 PatternFly 가 "The editing is the primary function of the view" 를
inline edit 의 **배제** 조건으로 적는다). 주업이 바뀌면 이 결정은 만료한다.

## 채택하지 않은 것

- **시안 C(설정을 그리드 밖 머리 줄로)** — 아티팩트의 추천안이었다. 같은 라운드에 머리 줄이
  알약·도장을 받았고 관련 페이지가 별도 단이 되면서 그 줄의 폭 예산이 사라졌다. A 가 행을
  똑같이 주면서 머리 줄을 건드리지 않는다. C 는 A 위에 나중에 얹을 수 있다 — 배타적이지 않다.
- **⛔ 태그 자체를 클릭 대상으로** (08-20 오너 결정). A+F 는 태그를 없애므로 이 판례와 무관하다.
