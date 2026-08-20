# 스캔 시각 표기 — 뷰어 로컬 타임존 + 오프셋 라벨

- **날짜**: 2026-08-20
- **대상**: Step1 스캔 스트립·이력·상세 / Admin `ops/target-sources/[id]?tab=scan`
- **구현 PR**: #738
- **계기**: BE 가 `ScanJobResponse.created_at`/`updated_at` 에 존 지정자를 붙였다
  (`"2026-08-20T09:31:31.230343Z"`).

## 1. Z 가 실제로 고친 것 — 파싱

존 지정자가 없는 문자열(`2026-08-20T09:31:31.230343`)은 JS 가 **로컬 벽시계로**
해석한다. 그래서 KST 브라우저에서는 방금 끝난 스캔이 `formatRelativeTime` 을 거쳐
"9시간 전"으로 찍혔다. Z 가 붙으면서 값이 instant 로 확정됐고, 그제서야 "내 시간으로
언제였나"를 말할 수 있게 됐다.

## 2. 진단 — 두 화면이 기준부터 달랐다

| 화면 | 포맷터 | 기준 |
|---|---|---|
| Step1 스트립·이력·상세 | `formatDate(…, 'datetime')` | 브라우저 로컬 |
| Admin 스캔 이력 | `fmtDateTime` | **Asia/Seoul 고정** |
| Admin 최근 스캔·결과 모달 | `fmtDateTimeSec` | **Asia/Seoul 고정** |

같은 스캔이 두 화면에서 다른 숫자로 읽힐 수 있었고, 어느 쪽도 존을 밝히지 않았다.

## 3. 결정

**기준은 뷰어의 로컬 타임존, 라벨은 GMT 오프셋.**

- 라벨은 `Intl` 의 `timeZoneName: 'shortOffset'` → `GMT+9` · `GMT-4` · `GMT+5:30`.
- ⛔ **`KST` 는 쓸 수 없다.** `Intl` 은 `Asia/Seoul` 에 약어를 주지 않는다
  (`short` 도 `shortOffset` 도 `GMT+9`). `short` 를 쓰면 존마다 약어와 오프셋이
  섞여 나온다(`UTC` / `EDT` / `GMT+2`) — 어느 존에서 읽느냐에 따라 문법이 달라진다.
- 표기 shape 는 각 화면 것을 유지한다. 기준과 라벨만 바뀐다.

| 화면 | 변경 후 (KST 브라우저) |
|---|---|
| Step1 | `2026. 08. 20. 오전 09:55 GMT+9` |
| Admin 이력 표 | `2026-08-20 09:55 GMT+9` |
| Admin 최근 스캔·모달 | `2026-08-20 09:55:42 GMT+9` |

상대시간 구조는 그대로 뒀다 — 스트립 메인만 `마지막 스캔 방금 전`, 나머지는 절대시각.
이력 표와 Admin 에 상대시간을 병기하는 안은 표 폭 때문에 기각했다.

## 4. 경계 — 로컬로 옮긴 건 스캔 시각 6곳뿐

`lib/pipeline/format` 의 `fmtDateTime`/`fmtDateTimeSec` 은 admin 약 35개 파일이
공유하는 **Asia/Seoul 고정**이고 그대로 둔다(파일 doc: "never the machine TZ").
대시보드·연동 요청 큐·상태 변경 이력은 여전히 KST 기준이다.

옮긴 자리: `ScanStrip` · `ScanDetail` · `ScanHistoryModal` (Step1),
`ScanHistoryCard` · `RecentScanCard` · `ScanDetailModal` (Admin).

⚠️ 남은 불일치: 같은 스캔 탭의 `ScanCredentialCard` "마지막 검증"은 아직 Seoul 고정에
라벨이 없다. 스캔 시각이 아니라 권한 검증 시각이라 이번 범위 밖으로 뒀다.

## 5. 회귀 방지

`lib/utils/__tests__/date-local-zone.test.ts` 는 `process.env.TZ` 를
Asia/Seoul · America/New_York · UTC 로 바꿔가며 `vi.resetModules()` + dynamic import 로
모듈을 재적재한다(모듈 로드 시점에 `Intl.DateTimeFormat` 이 존을 굳히기 때문).
Seoul 고정이 되살아나면 세 존의 출력이 같아지므로 즉시 깨진다 — 뮤테이션으로 확인했다.
