# 확정 정보 편집기 v2.4 — 벤치마크 결정 기록

- **날짜**: 2026-09-03
- **대상 화면**: 운영 콘솔 Target Source › 확정 정보 탭 › 입력 모달
  (`app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/ConfirmEditorModal.tsx`)
- **아티팩트**: https://claude.ai/code/artifact/ef17deb5-b0bd-42a3-8f4e-4cac9f1bfe00
  (시안 v2.4 전문. 리서치 아티팩트 https://claude.ai/code/artifact/e2ceeb0d-60af-4d66-9b99-815b5a078507)
- **선행 기록**: `confirm-info-actions.md`(09-03, 입력·삭제 분리 — §4 C 항목이 이 문서로
  구현됨) · `confirm-editor-surface.md`(08-17, 편집기 타입·표면)
- **구현 PR**: #874

## 1. 문제 진단 (E1–E9)

`confirm-info-actions.md` §4 C 가 남겨 둔 "편집기 탈-API클라이언트"를 오너가 09-03 v2.4
시안으로 확정하면서 근거로 든 아홉 가지.

| # | 문제 |
|---|------|
| E1 | 라벨이 개발자 어휘다 — `POST`, `Parameters`, `Request body`, `Server response`. 이 화면을 쓰는 사람이 API 클라이언트 사용자가 아니다. |
| E2 | 선언 응답 코드표(9행)가 아무것도 답하지 않는다 — 201 본문이 계약에서 `type: object` 로만 선언돼 무엇이 오는지 표가 말해 줄 것이 없다. |
| E3 | 편집기가 모달의 28% 만 차지한다 — 나머지는 실행 전 빈 응답 칸·URL 줄·Parameters 표. |
| E4 | JSON 편집기인데 비례 폭 글꼴 — `--pl-font-mono` 가 앱 전역 결정으로 sans 를 가리켜(globals.css) 편집기까지 그 결정을 물려받았다. |
| E5 | 줄 번호 gutter 가 손으로 그린 흉내 — 정렬 규칙이 편집기 전용이 아니라 즉석이었다. |
| E6 | 제목이 곧 동작이 아니다 — 모든 모드가 「확정 정보」로 서고, 액션 버튼이 머리 줄과 URL 줄 두 군데로 갈린다. |
| E7 | 판정(성공/실패/진행)이 세 곳에 흩어진다 — 머리의 판정 문장, URL 줄의 버튼 라벨, 응답 칸의 status 배지. |
| E8 | 오류가 어디를 고쳐야 하는지 말하지 않는다 — 응답 칸에 ProblemDetails 만 던져 놓고 편집 면과의 연결이 없다. |
| E9 | 「수정」/「저장」 갈림길이 죽은 코드다 — 09-03 ① 지시로 문이 잠기면(등록이 있으면 `blocked`) 이 편집기는 다시는 `current` 를 받지 않으므로, 수정 분기는 도달 불가능한 채 남아 있었다. |

## 2. 실제로 차용한 레퍼런스

| 레퍼런스 | URL | 차용한 요소 | 확인 |
|---|---|---|---|
| Mintlify — API Playground | https://mintlify.com/docs/api-playground/overview | 응답은 실행 뒤에만 보인다 — 실행 전 빈 칸을 만들지 않는다(E3) | 확인함 |
| Carbon — Code snippet | https://carbondesignsystem.com/components/code-snippet/usage/ | 코드 12px · 다크 표면 · 최소 높이 보장 | 확인함 |
| Stripe — API Reference | https://docs.stripe.com/api | 밝은 페이지 안의 다크 코드 블록 — 한 화면에 다크 면은 하나뿐 | 확인함 |
| Cloudscape — Code editor | https://cloudscape.design/components/code-editor/ | 상태줄에 줄 수 + 유효성을 같이 건다 | 확인함 |
| 이 레포 — `ConfirmStepModal` 결과 프레임 | `app/components/ui/ConfirmStepModal.tsx` | 성공/실패가 같은 상자의 상태 전환이고, 성공은 닫기만·실패는 재시도 경로를 더 준다는 문법 | 코드 |

차용하지 않은 것: Postman·Insomnia·Hoppscotch·Bruno(직전 판의 API 클라이언트 문법 자체가
E1의 원인이라 이번 판에서 전부 걷어냈다).

## 3. 오너 지시(2026-09-03, 순서대로)

1. 문은 「수정」이 아니라 「입력」이다. 등록이 있으면 문 자체가 잠긴다(disabled) — 지운
   뒤에만 다시 입력한다.
2. 편집기가 화면을 지배해야 한다. 실행 중에는 같은 프레임 안에서 진행을 보여 주고, 결과는
   모달의 상태 전환으로 답한다(새 모달을 열지 않는다).
3. 위계는 나뉜다 — 옵션 계층, 추천값 강조, 복사·JSON 라벨은 없다.
4. 옵션·취소·입력은 한 계층(바닥 한 줄)에 선다. 취소는 채도를 낮춘 빨강이다.
5. 「AWS · Target Source」 칩을 뗀다.
6. 편집기는 다크 표면이다.
7. 추천값 버튼은 파랑, 「추천 N건」 문구는 뗀다. 옵션은 스위치로.
8. 1→2 단계 표시와 정리 아이콘을 뗀다.

## 4. 시안 v2.4 — 값의 출처

한 상자(`ModalShell variant="editor"`) 위에서 상태만 바뀐다 — 입력 프레임(고정 760)과
결과 프레임(auto, `!h-auto`)이 같은 다이얼로그의 두 내용이다.

| 값 | 근거 |
|---|------|
| 모달 960 폭 · 24 여백 · 760 높이 | 폭은 기존 `dialogEditor`(xwide 등급) 유지 — 근거는 mono JSON 한 줄(120자@14px)이 최대 콘텐츠. 높이는 편집 줄 수를 최대로 벌리는 값으로 낮춤(직전 판 920 은 URL 줄·Parameters 표가 있던 판의 치수라 이 판에는 근거가 없다) |
| 제목 20/700 | admin-pipeline-style-guide §1 다이얼로그 제목 — 26 은 Toss 확인창 등급, 이 모달은 그 밑 |
| 편집기 폭 912 | 960 − 좌우 24×2 |
| 편집기 mono 14/22 | Carbon `code-02`(14px) + 22px leading — E4 의 비례 폭 문제를 이 파일 안에서만 `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` 로 명시 선언해 고친다(앱 전역 `--pl-font-mono` 는 그대로 sans — 전역 결정과 충돌 없음) |
| gutter 44px, 오른 패딩 14 | Cloudscape code editor 의 gutter 비례를 이 폭에 맞춘 값 |
| 툴바 44 = sm 버튼 28 + 패딩 8 | PlButton `sm` 높이(28) + 상하 여백 |
| 상태줄 28 | Cloudscape code editor 상태줄 등급 |
| 스위치 36×20, 노브 16 | 이 콘솔에 스위치 컴포넌트가 없어 새로 그림 — iOS/Material 스위치의 흔한 비례(트랙:노브 ≈ 9:4) |
| 버튼 md 32 | PlButton md — 기존 pane 문(§confirm-info-actions.md P9)과 같은 등급 |
| 취소 `#BC574E` on 흰 배경 | 4.6:1(AA 통과, 흰 텍스트 기준) — Untitled red-600(`--pl-err-solid` `#D92D20`, 파괴 커밋용)보다 채도를 낮춰 "닫기"와 "지운다"를 구분(오너 지시 ④) |
| 편집기 팔레트(`--pl-editor-*`) | `--pl-editor-bg #1B1F27` 위에서 본문 텍스트(`--pl-editor-text #E6E9EF`) 12.9:1, 흐린 텍스트(`--pl-editor-text-muted #A3ACBC`) 7.4:1, gutter(`--pl-editor-gutter #808A9D`) 4.5:1 — 세 값 모두 AA 이상 |

## 5. 이번 판에서 걷어낸 것 (E1–E9 대응)

- `POST` 배지·URL 줄·Parameters 표·`Request body`/`Server response` 좌우 분할·선언
  응답 코드표(9행)를 전부 제거 — E1·E2·E3·E6 대응. 응답이 `type: object` 로만
  선언되므로(2절 참고) 표가 답할 것이 없었다.
- 「AWS · Target Source #N」 칩 제거(오너 지시 ⑤), 1→2 단계 표시·정리 아이콘 제거
  (오너 지시 ⑧) — E6 대응.
- `current` prop과 그것이 먹이던 초안 시드·「수정」/「저장」 갈림길 제거(E9) — 09-03 ①
  지시로 문이 잠긴 뒤 이 컴포넌트는 다시는 기존 확정을 받지 않는다. `dirty` 판정은
  이제 `draft !== BLANK` 하나로 접힌다.
- 응답면 전용이던 `colorize`(키만 색을 얹는 신택스 하이라이트)를 제거 — 편집 면은 순수
  `<textarea>` 라 오버레이를 새로 지을 이유가 없고(외부 의존성 금지), 결과 프레임의
  응답 본문은 색 없이 원문 그대로 보여준다.
- 판정을 한 자리로 모았다(E7) — 진행 중엔 헤더 아래 진행 바 + 입력 버튼 라벨
  (「입력하는 중」), 결과는 같은 상자의 프레임 전환(제목 자체가 판정: 「확정 정보를
  입력했습니다」/「입력하지 못했습니다」) 하나로.
- 오류 위치를 편집 면에 붙였다(E8) — 실패 뒤 [편집으로 돌아가기] 를 누르면 입력
  프레임으로 돌아오면서 상태줄 오른쪽에 「지난 응답 `<status>` · `<phrase>`」가 초안이
  바뀌기 전까지 남는다.

## 6. 이번 판에서 새로 만든 것

- `PlButton` `dangerMuted` variant(`app/admin/pipelines/_components/PlButton.tsx`,
  `lib/theme.ts` `pipelineStyles.button.dangerMuted`) — 오너 지시 ④의 "채도를 낮춘
  빨강" 취소 버튼.
- 편집기 다크 팔레트 12 토큰(`--pl-editor-*`)과 `--pl-danger-muted`/
  `--pl-danger-muted-hover`(`app/globals.css`) — 이 콘솔에서 유일한 다크 표면.
- 진행 바 키프레임 `pl-editor-progress`(`app/globals.css`) + `confirmEditorProgressBar`
  (`lib/theme.ts`) — `motion-safe:` 전용이라 모션이 꺼지면 세그먼트가 왼쪽 끝에 서서
  "진행 중"이라는 사실 자체는 남는다.
- `ModalShell` `editor` variant 높이를 920 → 760 으로 낮추고(입력 프레임 전용),
  결과 프레임은 호출부가 `className="!h-auto"` 로 되돌린다(`CancelModal` 이 이미
  같은 방식으로 폭을 되돌린 전례를 따름).
- 「추천값 불러오기」 두 번째 누름(덮어쓰기) 확인을 별도 버튼 쌍이 아니라 **같은 버튼의
  두 번째 누름 + 상태줄 경고 문구**로 옮겼다 — 툴바는 문이 하나뿐이어야 한다는 지시 ③과
  충돌하지 않게, 기존 `armedSwap` 가드를 그대로 재사용해 표현만 바꿨다.

## 7. 이번 구현에서 벗어난 것 (검토 요청)

- **미저장 이탈 확인을 없앴다.** 직전 판은 초안이 있는 채로 닫으면 "저장하지 않은
  편집이 있습니다" 확인 줄이 바닥에 따로 섰다. 이 브리프의 바닥 규격은 "옵션·취소·입력"
  세 자리만 명시하고, 로딩 상태는 별도로 적었지만 이탈 확인은 언급이 없다. 취소가 새
  `dangerMuted` 로 "이것은 닫는다(discard)"는 신호를 이미 얼굴에 지고 있어서, 이번
  구현은 취소를 즉시 닫힘으로 만들었다 — 사용자가 다시 여는 비용이 실제로는 낮다는
  판단이다. 데이터 유실이 우려되면 되돌릴 수 있다(리뷰 요청).
- **「등록된/보낸 리소스」 목록의 "종류" 열**은 `database_type` 우선, 없으면
  `resource_type` 으로 채웠다. 계약이 요청/응답 본문을 `type: object` 로만 선언해
  고정 스키마가 없으므로, 흔히 채워지는 필드를 관대하게 읽는 타입가드로 처리했다
  (`unknown` + 타입가드, `any` 없음).

## 8. 관련 문서

- `confirm-info-actions.md` §4 C 를 이 문서로 완료 처리(§3 항목 참고).
- 테스트: `app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/__tests__/ConfirmEditorModal.test.tsx`.
