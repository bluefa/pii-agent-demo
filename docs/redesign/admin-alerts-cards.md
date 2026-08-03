# Admin · 운영 알림 4버킷 카드 (`/pass/admin/pipelines/ops/alerts`)

> 작성 2026-08-03 · 대상 화면 `/pass/admin/pipelines/ops/alerts`
> 적용 컴포넌트: `AlertsView`(헤더·요약 타일) / `AlertStageCard`(신규, 버킷 카드)
> 재사용: `pipelineStyles.card.flush` · `ProvTag` · `OpsPagination(always)` · `PlButton` · `Icon` 레지스트리 · `brandMarks.TerraformLogo`
> 시안: Figma `ZL0Y0okL8lReCrbf7JaVAp` node `1:123` (실행 중인 화면을 캡처해 Figma에서 재구성한 뒤 역방향 구현)

버킷은 서버가 소유한다(`GET /dashboard/summary` + `GET /dashboard/target-sources/{kind}`).
이 화면은 버킷 멤버십을 행 상태에서 재유도하지 않는다 — 모집단이 서비스 횡단이고 한 페이지가 전체 진실이 아니다.
이 문서는 확정된 변경과 다음 화면에 들고 갈 교훈만 남긴다.

---

## 1. 한 개 표 → 네 개 카드

| Before | After | 고쳐진 것 |
|---|---|---|
| 요약 타일 4개 = **필터**, 아래에 선택된 버킷 표 1개 | 네 버킷 카드를 2×2로 **동시** 노출 | "지금 뭘 먼저"를 알려면 네 버킷을 나란히 봐야 한다. 클릭 → 표 교체는 비교를 세 번의 클릭으로 만든다 |
| 페이징 상태 1개(버킷 전환 시 0으로 리셋) | 카드마다 자기 페이지 | 버킷 A의 3페이지와 버킷 B의 1페이지는 서로 무관한 좌표다 |
| 안내 섹션(제목 + 3줄 설명) | 삭제, 카드별 1줄 설명으로 분산 | 설명이 화면 상단에 뭉쳐 있으면 어느 카드 얘기인지 매핑을 독자가 한다 |

**교훈: "선택 → 상세" 는 대상이 많을 때의 문법이다.** 버킷이 고정 4개면 선택 자체가 비용이다.
요약 타일은 남겼지만 역할이 필터에서 **강조**(해당 카드 액센트바 primary)로 바뀌었다.

## 2. 열 5개 → 3개

| Before | After | 고쳐진 것 |
|---|---|---|
| Target Source · 서비스 · Provider · 연동 상태 · 필요한 작업 | Target · 서비스 · 클라우드 | 카드 폭 676px에 5열은 전부 잘린다 |
| `필요한 작업` 열이 모든 행에 같은 값 반복 | 요약 타일 3번째 줄이 이미 표기 | 버킷당 상수인 값은 열이 아니라 헤더의 몫 |
| `연동 상태` 칩 | 제거 | 버킷 자체가 상태다 — 같은 정보를 두 번 인코딩 |

## 3. 카드 높이는 콘텐츠 수가 아니라 레이아웃

`PAGE_SIZE = 3`. Figma 카드 본문 h320에 헤더(26)+설명(20)+표(34+3×41)+페이저가 정확히 들어가는 행 수다.
4행이면 페이저가 밖으로 밀린다. `OpsPagination`은 `always`로 렌더해 한 페이지짜리 버킷도 같은 높이를 유지한다
(`min-h-[320px]`이라 데이터가 적어도 네 카드가 어긋나지 않는다).

## 4. 설치 필요 = Terraform

`설치 필요` 카드 아이콘만 lucide `download` → `brandMarks.TerraformLogo`(브랜드 퍼플 `--pl-brand-tf`).
설치를 실제로 수행하는 주체가 Terraform 실행이라 중립 다운로드 글리프보다 정확하다.
`TerraformLogo`에 `size` prop만 추가했다(기본 16 유지, 이 카드만 20).

나머지 세 글리프(`clipboard-check` · `link` · `shield-check`)와 새로고침 `refresh`는
`app/admin/pipelines/_components/icons.tsx` 레지스트리에 추가했다 — 내보낸 Figma PNG를 쓰지 않고
같은 형상을 레포 아이콘 문법(24 viewBox · currentColor 스트로크)으로 그렸다.

## 5. 새로고침은 outline

`secondary`(회색 보더 + 그림자) → `outline`(primary 스트로크 + primary 텍스트).
상시 노출 도구 CTA라 filled보다 조용하고 회색 chrome보다 약하게 읽혀야 한다.
`pipelineStyles.button.outline`이 이미 그 슬롯이라 새 변형은 만들지 않았다.

## 6. 시안 hex → 토큰

Figma 시안은 실행 중인 화면 캡처에서 출발했으므로 hex는 전부 기존 토큰으로 되돌렸다:
`#2563EB → --pl-primary` · `#F2F4F6 → --pl-gray-100` · `#667085 → --pl-text-weak` ·
`#98A2B3 → --pl-text-faint` · `#E5E8EB → --pl-border` · `#4E5968 → --pl-gray-600`.
카드 표면은 `card.flush`(r12 + border + shadow-xs + overflow-hidden)가 시안과 동일해 그대로 썼다.

## 7. 남은 것

- 시안의 페이저 표기는 `‹ 1 / 2 ›`지만 레포 공용 `OpsPagination`(`‹ 1 2 3 ›`)을 재사용했다. 페이저 문법을 바꾸려면 이 화면이 아니라 컴포넌트 차원에서 결정할 일이다.
- 요약 타일 선택은 현재 액센트바 강조까지만 한다. 카드로 스크롤·포커스 이동은 넣지 않았다(2×2가 한 화면에 들어와서 필요가 없었다).
