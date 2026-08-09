# 파이프라인 상세 헤더 — 벤치마크 결정 기록 (Round 2)

- **일자**: 2026-08-09
- **대상**: `/pass/admin/pipelines/{pipelineId}` 헤더 (PipelineDetailView)
- **아티팩트**: https://claude.ai/code/artifact/1f10470a-f43f-464e-b225-62fdca5628ba
- **구현 PR**: (이 문서가 포함된 PR)
- **선행**: Round 1(화면 전체) → PR #662, `pipeline-detail.md`

## 오너 공리 (2026-08-09 구두 — 진단의 기준)

1. 제일 중요한 정보 = **TargetSourceId + 서비스 이름·코드**
2. "AWS 설치"(provider+유형)가 recipe 설명문보다 중요 — 설명문은 hover 툴팁으로
3. 제목은 "Infra 작업 현황" 고정 라벨로만, **#131은 강등**(보이기만 하면 됨)
4. **Target 상세 확인이 더 중요** — 승격
5. lazy loading 할 것은 lazy로
6. CSP 아이콘은 ops 서비스 운영 목록의 것(`ProviderLogo` bare)과 동일하게
7. 현 헤더는 색 배합 등이 깔끔하지 않음

## 채택안: 시안 E — ops 카드 문법 이식 (시안 5개 중)

ops 서비스 운영 화면(ServiceDetailView)의 target 카드 3층 문법을 헤더로 이식:

- 좌: `ProviderLogo` bare(64px 박스·36px 모노톤 글리프) — 공리 6
- 1층: `#1006`(16px mono semibold, ops `tsTable.id` 값 복사) + SDU 칩/provider 평문 — 공리 1
- 2층: 서비스 이름(14px/600) + 서비스 코드(12px mono) — 공리 1; #8 도착 전 **220px 고정 스켈레톤**(텍스트 점프 제거, 공리 5)
- 3층: `Infra 작업 현황`(h1, 12px) · `run #131`(mono) · 재실행 배지·취소 요청 · **"AWS 설치" 결합 태그**(무채, DELETE만 err 톤) + ⓘ 툴팁(레시피명+설명문, hover+키보드 포커스) · 생성 시간 · 재시작됨 링크 — 공리 2·3
- 우: **[Target 상세 확인] primary 버튼**(PlButton 문법의 Link) — 공리 4, 헤더의 유일한 파랑(공리 7)

비교표 근거(아티팩트 §05): E는 오너 요구 7/7 충족 + 기존 문법 일관성 최대(수치 신규 0 — 전부 ops 카드에서 복사) + 비용 하. A(주어 헤로)와 격차는 "run 정체성이 3층으로 밀림"이었으나 오너가 #run 강등을 명시해 상쇄.

## 실제 차용한 레퍼런스

| 레퍼런스 | URL | 차용 |
|---|---|---|
| ops ServiceDetailView target 카드 | (내부) `app/admin/pipelines/ops/services/_components/ServiceDetailView.tsx` `tsTable` | 3층 문법·모든 수치 |
| GitHub Primer PageHeader | https://primer.style/components/page-header | 정적 라벨은 큰 타이틀 금지(medium/서브타이틀) |
| Shopify Polaris Page | https://shopify.dev/docs/api/app-home/polaris-web-components/structure/page | primary action 1개 규칙 |
| Ant Design PageHeader | https://4x.ant.design/components/page-header/ | avatar→title→tags→extra 한 행 문법 |
| GitHub Actions 런 페이지 | https://docs.github.com/actions/managing-workflow-runs/using-workflow-run-logs | 런 번호 강등(주어가 제목) |

전체 카탈로그 13종(전부 세션 내 확인)은 아티팩트 §03.

## 구현 노트

- provider 캐스팅: `normalizeCloudProvider`(lib/types)로 wire 'AZURE'→'Azure' 정규화 (ops의 `as CloudProvider` 캐스트보다 안전)
- 계보 중 '원본 작업' 별도 링크는 제거 — RestartBadge(3층, 클릭=원본 이동)와 originStrip이 이미 담당(중복 제거)
- `document.title`·경과 시간·실패 스트립 등 Round 1 산물은 그대로
- 헤더 높이 ~250px → **~110px**

## 스코프 밖

- recipe 설명은 `RECIPE_LABELS` 로컬 상수라 실제로는 lazy 아님 — 카탈로그(#12) desc는 노드/드로어 소관 유지
- 툴팁 컴포넌트 일반화(다른 화면 이식)는 수요 생기면
