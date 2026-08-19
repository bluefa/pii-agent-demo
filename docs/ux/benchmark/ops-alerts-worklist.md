# 운영 알림 — 4버킷 카드를 워크리스트로 (디자인 벤치마크 결정 기록)

- **일자**: 2026-08-19 (벤치마크 2라운드: 구조 + 디자인)
- **대상**: `/pass/admin/pipelines/ops/alerts` (AlertsView · 구 AlertStageCard)
- **아티팩트**: https://claude.ai/code/artifact/5a19c853-2d21-4745-9bd6-1b7fbc1bd35d
- **구현 PR**: [#733](https://github.com/bluefa/pii-agent-demo/pull/733)

## 문제 요약 (근거 등급)

1라운드 — 구조 (오너: "정보가 확 와닿지 않는다. 결국 Target Source 관리 페이지로 이동하는 것 아닌가"):

| # | 문제 | 등급 |
|---|---|---|
| P1 | 알림 11건이 카드 4장으로 파편화 — 데이터 행은 카드 면적의 34% (실측 1467×812) | UX 원칙 (파편화) |
| P2 | 같은 건수가 요약 타일과 카드 배지에 두 번 | UX 원칙 (RULE 8 — 같은 사실은 한 표면) |
| P3 | 모든 행의 목적지가 Target Source 운영 화면 하나 — 버킷은 행의 속성이지 컨테이너가 아님 | UX 원칙 (RULE 7·10) |
| P4 | 타일이 `aria-pressed`인데 강조만 하고 거르지 않음 — 가짜 필터 | UX 원칙 (어포던스 약속 위반) |
| P5 | 카드당 3행 페이지네이션 — 버킷이 커지면 즉시 병목 | UX 원칙 (스케일) |
| P6 | 지연(우선순위 축) 없음 — `TargetSourceInfo`에 `delay_seconds` 필드 부재 | 계약 갭 (BE 요청 병행) |

2라운드 — 디자인 (오너: "시안 A 골격은 좋은데 너무 휑해 보일 수 있다"):

| # | 문제 | 등급 |
|---|---|---|
| Q1 | 40px 숫자 앵커를 지우고 14px 세그 접미로 — 첫 시선이 앉을 자리 상실 | UX 원칙 |
| Q2 | 업무 지시문(need·description)이 부유하는 한 줄로 강등 — RULE 17(부착) 위반 | UX 원칙 |
| Q3 | 계약이 이미 주는 `description`·`cloudProvider`를 행에 안 그림 — 잉크 빈약 | UX 원칙 |
| Q4 | 흰 바닥 위 맨몸 표 — 세 요소(문장·필터·표)를 묶는 표면 0겹 | 제안 |

## 실제 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 |
|---|---|---|
| Datadog Monitor List | https://docs.datadoghq.com/monitors/manage/ | 상태 카운트 = 클릭 필터 (타일→필터 승격) |
| Shopify Polaris IndexFilters | https://polaris-vue.ownego.com/components/index-filters | 탭 = 저장된 뷰, 목록은 하나 |
| Sentry Issues 스트림 | https://docs.sentry.io/product/issues/ | 필터 탭 + 채워진 행(좌측 표식·2줄·시간 메타) |
| Cloudscape Dashboard Item | https://cloudscape.design/patterns/general/service-dashboard/dashboard-items/ | 헤더가 제목·설명·액션을 소유 (카드 헤더) |
| 내부 — pipelines 대시보드 BucketTile | app/admin/pipelines/page.tsx (#710·#711) | "타일이 곧 필터" 메커니즘 + active(흰 면+브랜드 스트로크+shadow-sm) |
| 내부 — pipelines 대상 셀 `TargetCell` | app/admin/pipelines/_dashboard/cells.tsx | 글리프 + Target #·코드 1행 / 서비스명 2행, hover 보라, 행 활성화 |
| 내부 — 2줄 정체성 스택 정렬 (PR #663) | memory: stacked-identity-alignment | 2줄 스택 정렬 판례 (TargetCell이 이미 준수) |

전체 카탈로그(1R 12종 + 2R 6종, 배지 포함)는 아티팩트 §02·§06.

## 채택안과 근거

**시안 A(필터 + 단일 표) + 드레싱 A1·A4·A3 조합.** 비교표(아티팩트 §04·§08) 기준:

- **골격 = A**: P1~P5를 닫는 세 안(A·B·C) 중 신규 부품 0개는 A뿐. B(레일)는 큐 레일
  브랜치 미머지로 순서 역전, C(스테퍼)는 버킷↔상태 매핑이 목 가정.
- **A1 (타일 = 필터)**: 현행 타일(h120·40px)을 그대로 진짜 필터로 승격 — Q1을 닫는
  유일한 안이자 pipelines 대시보드 `BucketTile`과 같은 메커니즘. 숫자는 타일에 한 번만,
  선택은 항상 하나(기본 = 건수>0 첫 버킷, 프로세스 순서), 토글 해제 제거.
- **A4 (카드 헤더)**: 표를 카드 한 겹에 넣고 헤더가 버킷명+설명+새로고침 소유(건수는
  안 실음). Q2·Q4 해소.
- **A3 (행 밀도)**: 대상 셀 = pipelines `TargetCell` 재사용(오너: "pipelines에서처럼
  대상을 정리"), 설명 열 = 계약 필드 `description`. Q3 해소. 지연 열은 계약 랜딩 전까지
  자리만 예약(그리지 않음).
- **기각**: A5 깔때기/분포 바 — 버킷 4개는 독립 대기열이라 모집단 불연속, 연결 시각화가
  없는 흐름을 발명. A2 부착 세그는 세로 공간이 급해질 때의 예비안.

## 구현 노트

- 요청 수 5회 → 2회 (summary + 선택 버킷 1개), 페이지 크기 3 → 10 (계약 기본값).
- 스켈레톤 행수 = min(버킷 건수, 10) — 타일이 이미 아는 값으로 도착 시 시프트 방지.
- need 캡션 `--pl-text-faint` → `--pl-text-weak` (faint는 밝은 바닥 금지 판례).
- 버킷 전환은 `key={kind}` 리마운트 — 페이지 인덱스가 목록보다 오래 살지 않게.
- 목: `getAlertTargetSources`에 `description` 추가 (계약 필드, 미등재 id는 undefined 유지).
- 후속: BE에 `TargetSourceInfo.delay_seconds`(+`status_changed_at`) 노출 요청 —
  랜딩 시 표 마지막 열에 `DelayText`, 타일에 지연 점(1차 시안 E로 증분 진화).
