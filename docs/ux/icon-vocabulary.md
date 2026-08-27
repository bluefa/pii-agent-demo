# 아이콘 어휘 (Icon vocabulary)

이 앱의 아이콘은 `app/admin/pipelines/_components/icons.tsx` 의 `IconName` 하나로 관리된다.
이 문서는 **각 이름이 이 앱에서 이미 무슨 뜻인지**를 적어 둔다. 새 화면에서 아이콘을 고를 때
"예쁜 글리프"가 아니라 "안 쓰이고 있거나, 같은 뜻으로 쓰이고 있는 이름"을 고르기 위한 표다.

마지막 갱신 2026-08-27. 시안 아티팩트: <https://claude.ai/code/artifact/3ab2aebb-28d5-45ca-966b-ab3d6e962d27>

## 세는 법 (중요)

아이콘은 **두 가지 경로**로 렌더된다. 한쪽만 세면 "안 쓰인다"는 틀린 결론이 나온다.

- `<Icon name="…" />` — 직접 렌더
- `icon="…"` / `icon: '…'` — `PlEmptyState`, 알림 버킷(`ops/alerts/_components/buckets.ts`),
  액션 목록 등 **설정값으로 넘기는** 자리

정확한 census 는 둘 다 잡아야 한다:

```bash
grep -rhoE "(name|icon)[=:] ?[\"']<이름>[\"']" app --include=*.tsx --include=*.ts | wc -l
```

⚠️ 이름만 grep 하면(`grep -r "'cursor'"`) 과다 집계된다 — `link`·`table`·`install` 은
tiptap 마크·DB 어휘·도메인 낱말로도 쓰인다.

⚠️ 위 정규식도 **삼항으로 고르는 자리**는 못 잡는다 — `name={copied ? 'check' : 'copy'}`
(`CopyButton.tsx`) 같은 것. 0건으로 나온 이름은 `grep -rn "'<이름>'" app` 로 한 번 더 눈으로
확인한다.

## 뜻이 정해진 이름 (재사용 시 그 뜻을 따라야 함)

| 이름 | 이 앱에서의 뜻 | 대표 사용처 | 건수 |
|---|---|---|---|
| `arrow-ur` ↗ | **이 화면을 떠난다** — 방향이지 목적지가 아니다. 어디로 가는지는 앞의 마크가 말한다. 새 창 여부와는 무관하다 (오너 2026-08-27 규칙 개정, 이전 규칙은 「새 창으로 열리는 것만」) | `_dashboard/cells.tsx` | 9 |
| `inbox` | 큐·요청함 | `access/requests/[requestId]` | 15 |
| `chev-r` / `chev-l` / `chev-d` | 페이저·디스클로저 | 전역 | 11 / 3 / 1 |
| `clock` | 시각·경과 | `access-requests/page.tsx` | 11 |
| `warn-tri` | 경고 판정 | 전역 | 9 |
| `x` | 닫기·실패 | `FailureReasonModal` | 9 |
| `search` | 검색 입력 | `access/services` | 8 |
| `play` / `stop` | 실행 시작 / 중단 | `CurrentPipelineCard` | 7 / 1 |
| `ban` | 불가·차단 | `CurrentPipelineCard` | 5 |
| `arrow-up-right` | 상승 추세 (↗ 링크와 **다른** 이름이니 혼동 주의) | `CurrentPipelineCard` | 5 |
| `check` / `check-circle` | 완료 | `TaskFlow` | 5 / 4 |
| `info` | 안내 블록 | `CurrentPipelineCard` | 4 |
| `install` | ⛔ **쓰지 말 것** — 아래 「물린 이름」 참조 | — | 3 |
| `cursor` | ① 「좌측에서 하나 고르세요」 빈 상태 ② **「담당자가 보는 화면」 이정표**(2026-08-27 추가) | `services/[[...code]]/page.tsx` · `OpsHeader.tsx` | 4 |
| `shield` / `shield-check` | 권한 · 권한 확인됨 | `access/admins` | 3 / 2 |
| `x-circle` / `loader` | Terraform 상태 계열 | `terraformState.ts` | 3 / 3 |
| `link` | **연결(connection)** — 「연결 테스트 필요」 알림 버킷, Jira 티켓 연결 | `ops/alerts/_components/buckets.ts` | 3 |
| `plus` | 추가 | `CustomBuildStep` | 3 |
| `arrow-right` | 다음 단계 | `CurrentPipelineCard` | 2 |
| `compass` | 탐색·둘러보기 | `PipelineDetailView.tsx:317` | 1 |
| `flow` | 실행 기록 빈 상태 | `TcRunHistoryModal` | 1 |
| `cloud` · `package-plus` · `trash` · `blocks` · `clipboard-check` · `dots-v` · `table` · `bolt` | 각 1건 | — | 1 |

## 아직 비어 있는 이름 (뜻을 새로 붙일 수 있음)

`calendar` · `refresh` — 0건.

`copy` 는 census 정규식에는 0건으로 잡히지만 실제로는 **복사 버튼**의 글리프다
(`_components/CopyButton.tsx` — `name={copied ? 'check' : 'copy'}`). 뜻은 「이 값을 복사」로
이미 정해져 있다.

## 물린 이름 — `install`

`icons.tsx:145-147` 이 in-file 로 기록하고 있다:

> `install` (arrow into a tray) is the download idiom, and nothing is downloaded here —
> the pipeline provisions infrastructure INTO a customer account, so the arrow pointed the wrong way.

2026-08-14 라운드에서 파이프라인 `INSTALL` 타입 태그가 `package-plus` 로 갈아탔고,
2026-08-27 에 마스트헤드 「서비스 담당자가 보는 화면」 줄이 `cursor` 로 갈아탔다.
**남은 자리**(둘 다 빈 상태 마크): `RequestTab.tsx:365`, `confirm/panes.tsx:263`,
`tc/ConfirmedInfoCard.tsx:722`. 다음에 손볼 때 같이 정리한다.

## 세트에 없어서 못 쓰는 글리프

「남이 보고 있는 화면」을 가장 곧게 말하는 `eye`, 「다른 화면 하나」의 `app-window` 가 세트에 없다.
Lucide 1.31.0 격자(24×24 / stroke 2 / round cap+join)가 이 파일과 같으므로 path 를 그대로
떨어뜨리면 된다 — `icons.tsx:141-143` 이 `package-plus`·`blocks` 를 그렇게 들여왔다.

## 고를 때의 순서

1. **비어 있는 이름**이 뜻에 맞으면 그것을 쓴다 (뺏어 오는 뜻이 없다).
2. 이미 뜻이 있는 이름은 **그 뜻과 같을 때만** 쓴다. 다르면 안 쓴다 — 한 글리프가 두 뜻을
   지면 둘 다 못 읽는다.
3. **같은 화면 안에서** 같은 글리프가 두 번 다른 뜻으로 서지 않는지 본다. 이번 라운드의
   `install` 이 정확히 그 경우였다(마스트헤드=목적지, TC 탭=빈 상태).
4. 이정표 자리(`opsStyles.aboutMark` 등)의 마크는 본문보다 **한 단 옅다** — 값이 아니라
   이정표라서다. 눈에 먼저 걸리는 글리프는 그 계층을 이긴다.
