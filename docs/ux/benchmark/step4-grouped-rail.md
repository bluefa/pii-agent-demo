# Step4 · Agent 설치 — 벤치마킹 → 그룹 레일 채택 기록

> 작성 2026-08-09 (design-benchmark §6 decision record, PR #659 머지 후 소급)
> 대상 화면: `/pass/target-sources/{id}` 4단계 "Agent 설치" (AWS 선행 적용)
> 구현 PR: **#659** (squash `59cb6e05`) · 상세 결정: `docs/redesign/step4-grouped-rail.md`

## 아티팩트

| 단계 | 아티팩트 |
|---|---|
| 리서치 (진단 · 레퍼런스 13 · 방향 5안) | https://claude.ai/code/artifact/d79aa9d8-343a-46a7-907c-68b6249dc385 |
| 해결 설계 v2 (레일 마스터-디테일) | https://claude.ai/code/artifact/6b8efa3a-57d7-4295-a8db-f167f0606295 |
| 레이아웃 v3 (v3.1~v3.6 확정 시안) | https://claude.ai/code/artifact/8633fe93-f660-40fa-ab58-f38466bd31a6 |

시안 HTML 원본은 `design/step4/`에 커밋됨 (리서치 본은 4MB 캡처 임베드라 repo 제외).

## 문제 요약 (근거 등급)

1. **처음 온 담당자가 "내가 뭘 해야 하는지"를 구분할 수 없다** — `UX 원칙`
   (정보 구조가 상태별 나열이라 실행 주체를 반영하지 않음; 스캔 속도·계층 레버 위반)
2. **step `guide`가 실 응답에서 전부 null인데 합성 목이 채워서 가림** — `수치 위반` 급 객관 근거
   (`lib/mock-data/aws-wire-sample.ts` 실캡처 대조; UI는 guide를 15자 절단 `SUMMARY_LIMIT`)
3. **GCP/Azure 자기모순 라벨** — `UX 원칙` (side='서비스측' 파란 강조인데 serviceAction 부재
   → "확인할 항목 없어요" 고정)
4. **리소스 수에 따라 카드가 세로로 무한 성장, 패널·설명이 한 컴포넌트로 안 읽힘** — `제안`
   (오너 지적에서 출발, v3 시안의 직접 동기)

## 실제로 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 | 검증 |
|---|---|---|---|
| GitHub Primer / Actions 패널 | https://primer.style | 헤어라인 테두리 + blur 없는 1px 오프셋 그림자 → `shadows.hair`/`hairRing` 토큰. "계층은 낮은데 윤곽은 또렷한" 카드 | `기억 기반` (리서치 세션에서 확인, 본 세션 재검증 안 함) |
| WinUI NavigationView | https://learn.microsoft.com/en-us/windows/apps/design/controls/navigationview | PaneFooter → 레일 푸터(분절 진행바+요약, `mt-auto` 앵커); "헤더 = 스크롤 클리핑 지점" → 고정 560px에서 카드 본문만 스크롤 | `기억 기반` |
| Microsoft Defender for Cloud 권고 | https://learn.microsoft.com/en-us/azure/defender-for-cloud/review-security-recommendations | 조치 필요 항목 그룹핑 — 그룹핑 토글은 기각하고 레일 2그룹(내가 할 일/BDC 자동 진행)으로 번역 | `기억 기반` |
| (사내) Admin ops 콘솔 | `/pass/admin/pipelines/ops/services/idc` | 회색 래퍼가 카드를 감싸는 문법(래퍼 ⊃ 메타바+레일+흰 카드) — "한 컴포넌트" 문제의 직접 해법 | `확인함` (구현 세션에서 실화면 대조) |
| Grafana 대시보드 새로고침 분할 컨트롤 | https://grafana.com/docs/grafana/latest/dashboards/use-dashboards/ | **검토 후 기각** — 새로고침·주기 컨트롤 비노출 결정(폴링이 조용히 담당)의 비교 대상 | `기억 기반` |

리서치 카탈로그 전체(13종: Vercel 도메인 검증, SES DKIM, Datadog AWS 연동,
GitHub self-hosted runner, Elastic Fleet, Confluent PrivateLink, Cloudflare Tunnel,
Search Console 수정확인, Azure Advisor, Dependabot, Datadog CSM, Code scanning 등)와
각각의 벤치마킹 요소는 리서치 아티팩트에 있다 — 위 표는 **출시 코드에 실제로 남은 것**만.

## 채택안과 이유

방향 5안(A 배선수리 / B 할일 우선 체크리스트 / C 행 드로어+필터 / D 액션 플라이아웃 / E 허브 보드)
중 비교표 권장은 **A 즉시 → B 골격 + C 드로어**였다. 진행 중 조정 2건:

- **v1(카드 3개 적층) 오너 기각** — "공간 효율" 요구로 B 골격을 PR #587의 224px 레일
  마스터-디테일에 얹는 v2로 재설계. 문제 1(주체 구분)의 답이 카드가 아니라 **레일의
  정보 구조**라는 판단.
- **C의 행 확장 드로어는 v3.1에서 기각** — 리소스 행은 플랫 유지(오너 결정, 재도입 금지).

최종 출시 형태 = **레일 2그룹 + v3.6 감싸기 레이아웃** (확정 결정 표는
`docs/redesign/step4-grouped-rail.md` §1). 채택 근거는 비교표 축 그대로: 문제 1·4를
직접 해소, 기존 레일 재사용으로 구현 비용 최소, admin ops 문법 재사용으로 기존 화면
일관성 유지. 문제 2·3은 계약 협의(guide null 등 4건)로 분리되어 백로그에 남음.
