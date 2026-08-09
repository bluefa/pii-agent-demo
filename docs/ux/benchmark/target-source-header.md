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
   - 파생 조정 (워시 위 가시성): 프로바이더 아이콘 박스 #F1F3F7→#ECEDF4, 구분선·스텝퍼 트랙 #EDEFF3→#E4E5EE,
     설치 모드(자동) 칩 #F0F4FA→#EAEEF7, 스텝퍼 점 ring #F8F9FC→#F4F4FB(면과 동색 규칙).
   - 알려진 경계값: kv 라벨 #6B7684(12px)의 #F4F4FB 위 대비 ≈ 4.3:1로 AA(4.5) 소폭 미달
     (#F8F9FC 위에서도 4.48로 동일 계열 이슈). 지적되면 #5B6672 한 단계 강하가 예비안.
3. **main 재베이스 시 #661 TC 헤더 태그 포팅** (2026-08-09 squash 재베이스).
   태그는 플랫 헤더 타이틀 행(h1 형제)으로 이식. 헤더가 레이아웃 소유가 되면서
   Step 5 폴링(liveJob)이 태그까지 닿지 않는다 — 실행 중 실시간 판정은 Step 5 카드가,
   태그는 진입 시 latest_version 1회 조회가 담당(TcHeaderTag 계약이 지원하는 모드).
   실시간 공유가 필요해지면 폴링 소유를 레이아웃으로 올리는 후속 검토가 필요하다.

## 미채택/보류

- C1(#F8F9FC 3단 사다리)은 기본값이었으나 오너가 C3로 교체 결정.
- 시안 2(작업명 타이틀), 시안 3(메타 레일 이관 + 헤더 2단), 시안 5(레일 면 통일)는 후속 결정 대기.
- C4(레일 계열 침강)는 시안 5 착수 시 재론 후보.
