# 파이프라인 재시작 — 프론트엔드 구현 명세

> 브랜치: `feat/pipeline-restart` (베이스: `fix/admin-feedback-round1`)
> 설계 원본: `pipeline-orchestrator-restart-design/docs/pipeline-restart-design.md` §8
> 백엔드 계약: 같은 저장소 `docs/changes-pipeline-restart-backend.md` §4·§5·§7
> 검증: `npx tsc --noEmit` 0, `npx eslint` 0, `npx vitest run` 163 files / 1297 tests pass

**계약 대조.** 업스트림 구현(`bluefa/pipeline-orchestrator` PR #42, `feat/pipeline-restart`)의
`TargetSourcePipelineController` · `RestartPreview` · `RestartOriginView` · `RestartPipelineRequest` ·
`PipelineQueryService.toDetail` 와 경로·쿼리·본문·응답 필드를 1:1 대조했다. mock 도 동일 검증
순서와 동일 파생식(`resumed_from_sequence`, `restarted_by_pipeline_id`)을 따른다.

**전제.** 백엔드(#13 `restart-preview` / #14 `restart`)는 아직 배포 전이다. 신규 응답
필드는 **전부 optional** 로 선언해 구버전 백엔드에서도 화면이 깨지지 않고(칩·계보·CTA가
렌더되지 않을 뿐), Mock 모드(`USE_MOCK_DATA=true`)에서는 재시작 전 경로가 실제로 동작한다.

## 1. 배선 (§8.5)

| 층 | 파일 | 내용 |
|---|---|---|
| 타입 | `lib/pipeline/types.ts` | `PipelineSummary.origin_pipeline_id?`, `TaskSummary/TaskDetail.origin_task_id?`, `PipelineDetail.origin_pipeline_id?/origin?/restarted_by_pipeline_id?`, 신규 `RestartOriginView`·`RestartPreview`·`RestartSkippedTask`·`RestartTaskToRun`·`RestartPipelineRequest` |
| BFF 계약 | `lib/bff/types.ts` | `PipelineBffClient.restartPreview` / `.restart` (#13/#14) |
| BFF 실 클라이언트 | `lib/bff/http.ts` | 기존 12경로와 동일한 verbatim 프록시 |
| BFF mock | `lib/bff/mock/pipeline.ts` | `computeRestart()` + `restartPreview()` / `restart()` |
| 라우트 | `app/api/v1/orchestrator/target-sources/[targetSourceId]/pipelines/[pipelineId]/restart-preview/route.ts`, `.../restart/route.ts` | LIN-25 verbatim proxy 패턴 그대로 |
| CSR | `app/lib/api/pipeline.ts` | `getRestartPreview()`, `restartPipeline()` |

Mock 은 설계의 검증 순서를 그대로 구현한다: 404 `PIPELINE_NOT_FOUND` → 409
`PIPELINE_NOT_RESTARTABLE`(DONE·RUNNING·PENDING) → 409 `PIPELINE_NOT_LATEST` → 400
`INVALID_RESUME_SEQUENCE` → 400 `UNKNOWN_TASK` → 409 `PIPELINE_ALREADY_ACTIVE`.
suffix 는 **첫 non-DONE task부터**(결정 3), 새 파이프라인은 type·recipe·provider 를
원본에서 승계하고(결정 1) sequence 를 0부터 재부여하며 `origin_task_id` 를 스탬핑한다.

> 검증 순서에서 `INVALID_RESUME_SEQUENCE` 를 `UNKNOWN_TASK` 보다 먼저 본다 — suffix 자체가
> `from_sequence` 에 의존하기 때문이다. 명세 문서의 번호(4→5)와는 다르지만 **실제 구현
> (`PipelineRestarter.compute`: resolveResumeSequence → toStep)과 같은 순서**다.

## 2. 진입점 — 현재 작업 섹션 3분기 (§8.1)

`TargetDetailView` 의 latest 상태별 분기:

| latest | 카드 | CTA |
|---|---|---|
| RUNNING/PENDING | `CurrentPipelineCard` (기존) | (상세 이동) |
| **FAILED/CANCELLED** | **`LastRunFailedCard` (신규)** | **[실패 지점부터 재시작]** + [새 작업 시작] |
| DONE·이력 없음 | `EmptyPipelineCard` (기존) | [작업 시작] |

- 기존에는 latest 가 live 일 때만 detail 을 폴링했다. 이제 terminal FAILED/CANCELLED 도
  **1회 fetch** 한다(`focusId`) — 실패 카드가 실패 task 이름·`error_code`·진행도를
  같은 화면에서 보여주기 위해서다. 폴링은 여전히 live 일 때만 돈다.
- 이 표가 결정 5 의 프론트 게이팅이다. 게이팅은 편의일 뿐이므로 서버 409 가 최종 방어선이다.

## 3. RestartModal (§8.2)

`app/admin/pipelines/_detail/RestartModal.tsx` — Target 상세와 작업 상세가 공유한다.

- 열릴 때 `#13` 을 호출하고, **원본 전체 체인**을 R24 seq-node 캔버스에 그린다:
  skipped 는 `dim` + "완료 — 건너뜀", 재시작 지점은 신규 `fail` 톤 + `실패 N회 · ERROR_CODE`,
  이후는 일반 톤. `warnings` 는 `ModalNote`(PreviewModal 에서 export) 로.
- CTA 는 `[N단계부터 재시작]` (N = `resume_from_sequence + 1`, 원본 기준 번호).
- 409 3종(`NOT_RESTARTABLE`/`NOT_LATEST`/`ALREADY_ACTIVE`)은 미리보기든 실행이든 동일하게:
  모달 닫기 → 토스트 → latest 재조회 후 그쪽으로 이동 + 호출자 `onStale` 로 화면 갱신.
- 호출자가 **열려 있을 때만 mount** 한다(매번 새 상태). effect 안 동기 setState 를 쓰지
  않기 위한 구조이기도 하다(`react-hooks/set-state-in-effect`).
- `from_sequence`(앞당기기)는 설계대로 **2차 범위** — API·mock 은 이미 지원하지만 UI 는
  기본 지점 고정이다.
- 부수 정리: `TYPE_DESCS.CUSTOM` 의 "실패 구간만 골라 재실행할 때" 문구 제거(정식 경로가 생겼다).

## 4. 계보 표시 (§8.3 / §8.4)

- **이력 테이블**(`TargetDetailView`): `origin_pipeline_id` 가 있으면 작업 컬럼에 `↻ #123`
  칩 — 클릭 시 원본 상세로(행 클릭과 분리). 유형 컬럼은 INSTALL 그대로(결정 1의 화면 가치).
- **작업 상세 헤더**: `계보` 그룹 행 신설 — `원본 작업 #123 ↗` / `재시작됨 ↻ #124 ↗`.
  metaGrid 가 4열이라 기존 두 행에 끼워 넣으면 정렬이 깨져 **행을 추가**했다(설계의 "작업
  그룹에 추가"에서 벗어난 유일한 배치 변경).
- **exec band**: live → [중단], terminal FAILED/CANCELLED + 최신 + 미재시작 → [실패 지점부터
  재시작], DONE → 없음. "최신인가"는 `#8 latest` 로 판정한다(기존 `listPipelinesByTarget`
  1건 조회를 대체 — 호출 수 동일, 판정은 정확).
- **컨텍스트 스트립**: 재시작 실행이면 flow 위에 `원본 #123의 N단계 중 M단계 완료 — K단계부터
  재실행`. 진행도(0/N)는 자기 suffix 기준을 유지한다(ghost 노드 없음).
- **TaskDrawer**: `origin_task_id` 가 있으면 "이전 실행 이력 보기 ↗" → 원본 상세로 이동하며
  `?task={originTaskId}` 로 해당 task 드로어를 프리셀렉트한다.

## 5. 남은 것

- `from_sequence` 오버라이드 UI(dimmed DONE 노드 클릭 토글) — 2차.
- 오너 게이트(§8.6): `LastRunFailedCard` 시안, exec band 재시작 CTA 배치. 현재는 설계
  문서의 서술대로 구현했다.
- 백엔드 #13/#14 배포 전까지 실 스택에서는 CTA 를 눌러도 404 다(mock 모드에서만 동작).
