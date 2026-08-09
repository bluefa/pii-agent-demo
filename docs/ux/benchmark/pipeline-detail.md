# 파이프라인 상세 화면 — 디자인 벤치마크 결정 기록

- **일자**: 2026-08-09
- **대상**: `/pass/admin/pipelines/{pipelineId}` (PipelineDetailView · TaskFlow · TaskDrawer)
- **아티팩트**: https://claude.ai/code/artifact/c645e31f-ba37-4cbc-91ae-b4ac149e8f08
- **구현 PR**: [#662](https://github.com/bluefa/pii-agent-demo/pull/662)

## 문제 요약 (근거 등급)

| # | 문제 | 등급 |
|---|---|---|
| P1 | 실패 원인까지 3클릭 드릴다운 — 진입 시 화면이 아무것도 먼저 보여주지 않음 | UX 원칙 (효율성) |
| P2 | "진행 단계 1/4"이 완료 수 표시 (2번째 실행 중인데 1/4) + RUNNING/IN_PROGRESS 이원 어휘 | UX 원칙 (멘탈 모델) |
| P3 | 노드 설명·헤더 그룹라벨·드로어 idle 탭 대비 ≈2.6:1 (`#98A2B3`/`#94A3B2` on white, 기준 4.5:1) | 수치 위반 |
| P4 | 타입 램프(28/18/15/13…)가 SSOT 세트 {12,14,16,20,24,32}와 모순 — 문서 정합 문제 | 수치 위반 (판례 유의) |
| P5 | 실행 시간(시작→종료·경과) 페이지 어디에도 없음 | UX 원칙 (정보 요구) |
| P6 | 브레드크럼 부재 + 모든 런의 h1/탭 제목이 동일 "작업 현황" | UX 원칙 (웨이파인딩) |
| P7 | 최신 런이 아니면 재시작 CTA가 사유 없이 사라짐 | 제안 |
| P8~P10 | 노드 설명 보일러플레이트 / 캔버스 여백 / 드로어 닫기 아이콘 | 제안 (이번 스코프 밖) |

## 실제 차용한 레퍼런스

| 레퍼런스 | URL | 차용 요소 |
|---|---|---|
| AWS Step Functions 실행 상세 | https://docs.aws.amazon.com/step-functions/latest/dg/concepts-view-execution-details.html | 오류 배너(실패 스트립) + 복구 불가 사유 명시 |
| GitHub Actions 워크플로우 런 로그 | https://docs.github.com/actions/managing-workflow-runs/using-workflow-run-logs | 실패 스텝 자동 확장 → 실패 태스크 드로어 자동 오픈 |
| GitLab CI 파이프라인 미니 그래프 | https://docs.gitlab.com/ci/pipelines/ | 태스크당 세그먼트 진행바 |
| Temporal Web UI | https://docs.temporal.io/web-ui | Duration을 헤더/밴드 1급 정보로 |
| Databricks Lakeflow Jobs | https://docs.databricks.com/aws/en/jobs/monitor | '재시도 대기' 전용 상태색(warn) |
| Zapier Zap 런 상세 | https://help.zapier.com/hc/en-us/articles/20512774106125-View-specific-Zap-run-details | replay 계보 표식(기존 유지 확인) |

전체 카탈로그(13종, 전부 세션 내 문서 확인)는 아티팩트 §4.

## 채택안과 근거

비교표(아티팩트 §6) 기준 — 시안 3·1·5·2는 전부 저비용이면서 객관 위반 2건 + UX 원칙
위반 4건(P1~P6)을 전부 커버하고, 기존 문법(originStrip·PlBreadcrumb·band)만 재사용해
일관성 리스크가 없다. **시안 4(하단 도킹 팬)는 오너 기각** — Figma 70:35 이탈 + 중상
비용, 낮은 해상도에서 캔버스·팬이 빠듯.

| 시안 | 구현 내용 |
|---|---|
| 3 대비·SSOT | nd-meta·idle 탭·그룹라벨 → `--pl-text-weak`(4.97:1), nd-meta 13→14px(훅 강제), 스타일 가이드에 Figma 예외 경로 명문화 |
| 1 실패 우선 랜딩 | FAILED 진입 시 실패 태스크 드로어 자동 오픈 + 캔버스 센터링, 밴드 아래 실패 스트립(원인 + 재시작 불가 사유 `#N 열기`) |
| 5 웨이파인딩·시간 | PlBreadcrumb 복원(대시보드 › target › 작업 #N — 고아였던 `pipelineCrumbs` 재활용), h1 옆 서비스명, document.title, 밴드 경과/소요 + 시작→종료 툴팁 |
| 2 스텝바·어휘 | 연속 진행바 → 태스크당 세그먼트(>12노드 폴백), "n/M단계 실행 중" 서수 문구(`progressPhrase`), 상태 라벨 한글 한 벌(`statusKo`) |

## 스코프 밖 (후속 백로그)

- P8 노드 설명 정보 가치 — 태스크 카탈로그 문안(데이터) 개선 건, 디자인 아님
- P10 드로어 닫기 chev-r→✕ — 시안 4와 함께 기각된 패널 개편에 묶여 있던 항목, 단독 재검토 가능
- 드로어 주석의 420px vs 실제 500px 문서 부식
