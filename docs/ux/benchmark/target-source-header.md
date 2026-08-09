# Target Source 상세 헤더 — 벤치마킹 결정 기록

- **날짜**: 2026-08-09
- **대상 화면**: `app/target-sources/[targetSourceId]` 상세 헤더 (ProjectPageMeta)
- **구현 PR**: #627 (`feat/target-source-header`)
- **리서치 아티팩트**: [벤치마킹 리포트 (진단 P1~P6 · 레퍼런스 14곳 · 시안 5안)](https://claude.ai/code/artifact/4c11da2a-6b69-4a32-baef-79bb595cfce9) · [헤더 면 색상 5안 (C1~C5)](https://claude.ai/code/artifact/15d5941e-75f2-4831-81ed-29804fd32a27)

## 문제 요약 (근거 등급)

| # | 문제 | 등급 |
|---|---|---|
| P1 | 헤더가 콘텐츠 카드와 같은 카드 크롬(radius 20 + 그림자) + 최다 장식 — 크롬이 콘텐츠를 이김 | UX 원칙 (여백 7원칙 ⑥) · 사용자 지적 |
| P2 | H1이 서비스명(코드) — 페이지 정체성("PII Agent 설치") 부재 | UX 원칙 · 사용자 지적 |
| P3 | 페이지 H1 24px vs 카드 타이틀 22px — 인접 계층 레버 부족 | 수치 위반 (design-guide §3) |
| P5 | 스텝퍼가 40px 숫자 원 + 성공색 + 모션 + 24px 죽은 여백으로 헤더 풋터 점유 | UX 원칙 |

(P4 이중 거처·P6 면 비대칭은 후속 시안 3·5에서 다룸 — 이 PR 범위 아님)

## 실제 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 |
|---|---|---|
| AWS Cloudscape — details/create 패턴 | https://cloudscape.design/patterns/resource-management/details/details-page-with-tabs/ | 헤더=플랫 밴드, 흰색+그림자는 콘텐츠 컨테이너 전용 |
| GitHub Primer — PageHeader | https://primer.style/components/page-header | 플랫 행 적층, "정적 페이지 타이틀" 의미론 |
| Atlassian — page-header (배포 CSS 실측) | https://cdn.jsdelivr.net/npm/@atlaskit/page-header@13.1.3/dist/cjs/PageHeader/outer-wrapper.compiled.css | 크롬 0 기준선 — 헤더/본문 구분을 여백만으로 (C3의 직접 근거) |
| IBM Carbon — PageHeader 6-zone | https://raw.githubusercontent.com/carbon-design-system/ibm-products/main/packages/ibm-products/src/components/PageHeader/PageHeader.mdx | "배경은 복잡도 기반 opt-in — 단순 레이아웃은 무배경" (C3의 직접 근거) |
| Argo CD — Application 상세 | https://argo-cd.readthedocs.io/en/latest/getting_started/ | 진행 상태를 얇은 플랫 밴드로 (콰이어트 스텝퍼) |

교차 판정: 조사한 디자인 시스템 5/5가 페이지 헤더를 카드로 만들지 않으며, 스텝퍼를 헤더 카드 안에 두는 곳은 0곳.

## 채택안과 근거

1. **시안 1 — 헤더 카드 해체 → 플랫 크롬** (이 PR의 본체).
   비교표 근거: P1·P5를 구현 비용 0(기 구현)으로 해소하는 유일안. 카드 크롬 제거, 서비스 코드 칩,
   12→14px 2단 계층, 8px 점 콰이어트 스텝퍼.
2. **헤더 면 색 = C3 무배경** (오너 선택, 2026-08-09).
   후보 5색(C1 #F8F9FC 확정 토큰 / C2 화이트+헤어라인 / C3 무배경 / C4 #EBEFF0 침강 / C5 #F3F7FF 틴트) 중
   **본문 워시(#F4F4FB)와 동일면 — 경계 없는 헤더**를 선택. 헤더는 자체 면·헤어라인을 그리지 않고
   route layout 워시 위에 타이포만 얹는다 (Atlassian/Carbon 무배경 변형).
   - 파생 조정 (워시 위 가시성): 프로바이더 아이콘 박스 #F1F3F7→#ECEDF4, 구분선 #EDEFF3→#E4E5EE,
     설치 모드(자동) 칩 #F0F4FA→#EAEEF7, 스텝퍼 점 ring #F8F9FC→#F4F4FB(면과 동색 규칙).
   - **워시는 램프 한 칸을 잡아먹는다** (오너 지적 "색감이 너무 흐려보여서요", 2026-08-09 실측).
     흰 카드를 벗자 조용한 계층 전체가 AA 아래로 내려갔다 — #6B7684은 흰색 위 4.62:1이지만
     #F4F4FB 위에서는 4.22:1. 헤더 전역을 한 칸씩 내렸다: kv 라벨·설명·gloss·모드 노트
     #6B7684→#4E5968(6.50:1), 블록 아이브로우 #4E5968→#333D4B(10.04:1).
   - 스텝퍼는 색을 6개에서 3개로 줄이며 재구성. 라벨은 2단(현재 #0050D6 semibold 6.15:1 /
     나머지 #4E5968 6.50:1)이고 done↔pending 구분은 점이 담당한다(#6B7684 4.22:1 /
     #0050D6, 현재 점은 8→10px). 트랙은 #B0B8C1(ΔE00 14.9), 지나온 길은 #0050D6(6.15:1).
     이전 값 #8B95A1(2.78:1)·#DFE3EA(1.18:1)·#CFE0FF(1.22:1)이 "흐리다"의 실체였다.
   - 재발 방지: `lib/design-guard.test.ts`에 헤더·스텝퍼 20쌍을 워시 기준으로 등록.
     라인 단위 훅은 면이 조상 레이아웃에 선언되면 구조적으로 볼 수 없다.
     **교훈(메트릭 선택)**: 지나온 길 #CFE0FF는 ΔE00 10.72로 면 규칙을 통과했지만 대비는 1.22:1이었다 —
     연한 파랑은 라벤더 워시와 색상거리는 멀되 휘도차가 거의 없고, 2px 선은 휘도로 읽힌다.
     상태를 나르는 얇은 선은 ΔE00이 아니라 대비비(3:1)로 판정한다.
3. **시안 2 — 작업명 타이틀 재구조** (오너 지시, 2026-08-09).
   H1 = "PII Agent 설치"(페이지 정체성, `pageHeaderTitleStyle` 재사용). 서비스명 + 코드 칩은
   바로 아래 '설치 대상' 식별 라인(`kvLabel` 12px + `providerName` 14px + `codeChip`)으로 강등 —
   존닝 검토의 옵션 1 그대로. 좌측 서비스 레일이 "어느 서비스인가"를 상시 답하므로 정보 손실 없음.
   프로바이더는 식별 라인에 넣지 않는다(아래 '클라우드 정보' 그룹과 중복 방지). P2·P3 해소.
4. **main 재베이스 시 #661 TC 헤더 태그 포팅** (2026-08-09 squash 재베이스).
   태그는 플랫 헤더 타이틀 행(h1 형제)으로 이식. 헤더가 레이아웃 소유가 되면서
   Step 5 폴링(liveJob)이 태그까지 닿지 않는다 — 실행 중 실시간 판정은 Step 5 카드가,
   태그는 진입 시 latest_version 1회 조회가 담당(TcHeaderTag 계약이 지원하는 모드).
   실시간 공유가 필요해지면 폴링 소유를 레이아웃으로 올리는 후속 검토가 필요하다.

## 미채택/보류

- C1(#F8F9FC 3단 사다리)은 기본값이었으나 오너가 C3로 교체 결정.
- 시안 3(메타 레일 이관 + 헤더 2단), 시안 5(레일 면 통일)는 후속 결정 대기.
- C4(레일 계열 침강)는 시안 5 착수 시 재론 후보.
