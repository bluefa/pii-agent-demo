# Jira Ticket — 서비스 연결(attach/detach)과 알림 사용자

운영 콘솔 `admin/pipelines/ops/services/{serviceCode}` 의 Jira Ticket 영역이 쓰는 계약.
1장은 **install-v1.yaml 에 이미 있는 실계약**, 2장은 **아직 없는 제안**이다.

---

## 1. 연결 / 연결 해제 (실계약)

CloudProvider 는 `AWS · GCP · AZURE · IDC · SDU` 5종. 서비스 1건은 provider 마다
Jira ticket 을 **최대 1개** 연결한다(경로에 provider 가 들어가므로 provider 가 키다).

> swagger enum 에는 `UNKNOWN` 이 하나 더 있다. 운영 화면은 이 5종만 타일로 그리므로,
> `cloudProvider: "UNKNOWN"` 으로 돌아온 매핑은 화면에서 보이지도, 해제되지도 않는다.
> `UNKNOWN` 은 provider 를 특정하지 못한 상태를 나타내는 방어값이지 연결 대상이 아니라고
> 보고 노출하지 않는다 — 실제로 그런 티켓이 생긴다면 그건 데이터 문제이고, 5종 중 하나로
> 정정되어야 한다. 이 전제가 깨지면 UI 는 5종 목록이 아니라 응답이 준 provider 를 그리도록
> 바꿔야 한다.

| Method | Path | operationId | 응답 |
|---|---|---|---|
| `GET` | `/install/v1/services/{serviceCode}/jira-tickets` | `getJiraTickets` | `JiraTicketResponse[]` |
| `POST` | `/install/v1/services/{serviceCode}/jira-tickets/{cloudProvider}` | `attachJiraTicket` | `204 No Content` |
| `DELETE` | `/install/v1/services/{serviceCode}/jira-tickets/{cloudProvider}` | `detachJiraTicket` | `JiraTicketDetachResponse` |

```yaml
JiraTicketResponse:       { id, targetSourceId, serviceCode, issueKey, cloudProvider, browseUrl }
JiraTicketAttachRequest:  { issueKey, validate? }   # issueKey required; validate=true 면 Jira 에서 존재 확인 후 연결
JiraTicketDetachResponse: { issueKey }              # 해제된 티켓 키를 되돌려준다
```

### ⚠️ `DELETE` 는 Jira 티켓을 삭제하지 않는다

이 API 의 대상은 **"서비스 ↔ 티켓 매핑"이지 티켓 자체가 아니다.**

| | 일어나는 일 | 일어나지 않는 일 |
|---|---|---|
| `POST` (연결) | 이미 존재하는 Jira 티켓의 `issueKey` 를 이 서비스·provider 에 **매핑**한다 | Jira 에 티켓을 **생성하지 않는다** |
| `DELETE` (연결 해제) | 그 **매핑만 끊는다**. 응답으로 끊긴 `issueKey` 를 알려준다 | Jira 의 티켓을 **삭제·종료·상태 변경하지 않는다**. 티켓은 Jira 에 그대로 남는다 |

그래서 UI 문구는 "삭제"가 아니라 **"연결 해제"** 로 쓴다. 실수로 해제해도 티켓은 살아
있으므로, 같은 `issueKey` 를 다시 `POST` 하면 원상복구된다 — 되돌릴 수 없는 작업이 아니다.
(EOS 처리와 톤을 구분해야 하는 이유. EOS 는 진짜로 되돌릴 수 없다.)

#### 열 주소는 `browseUrl` 이 싣는다 — 프론트는 파싱·조립하지 않는다

(v5 이전에는 `issueKey` 가 넣을 땐 키, 나올 땐 주소인 비대칭이 있어 프론트가 마지막
`/` 뒤 조각을 파싱해 보여줬다. `browseUrl` 이 계약에 실리면서 그 파싱은 삭제됐다.)

`issueKey` 는 양쪽 다 티켓 키 문자열(`BDCDIP-12312`)이고, 티켓을 여는 실제 주소는
`browseUrl` 로 BFF 가 조립해 준다. 화면은 라벨에 `issueKey` 를, 링크에 `browseUrl` 을
그대로 쓴다 — 프론트가 도메인·경로를 조립하면 Jira 도메인이 바뀔 때마다 같이 깨진다.
`browseUrl` 이 없거나 http(s) 가 아니면 링크가 아니라 글자로 보여준다
(`lib/jira-ticket.ts` `safeBrowseUrl` — 스킴 가드만 남았다).

`issueKey` 존재 여부의 판정은 Jira 를 아는 BFF 몫이다 — `validate: true` 로 연결 전에
존재를 확인할 수 있고(없으면 실패), `false` 면 확인 없이 매핑한다. UI 는 이 옵션을
체크박스(기본 켬)로 노출한다. 프론트는 키 형식을 넘겨짚지 않는다.

---

## 2. Watcher 등록 (실계약 — v5 랜딩)

§2 의 옛 제안(`/target-sources/{id}/jira-ticket/users`, 200 + 사용자 목록)은 다른 형태로
실계약이 됐다: 등록 단위는 target source 가 아니라 **서비스 × cloudProvider** 고,
응답은 목록이 아니라 `204 No Content` 다.

```
POST /install/v1/services/{serviceCode}/jira-tickets/{cloudProvider}/watchers
operationId: addWatcherToJiraTicket
body   JiraTicketWatcherRequest { userId }   # required
→ 204 No Content
```

에러는 전부 범용 `ErrorMessage`(timestamp/status/code/message/path) — **이 엔드포인트
전용 error code enum 은 swagger 에 없다** (`code` 는 자유 문자열). 프론트는 HTTP status 로
분기하지 않고 서버 `message` 를 그대로 보여준다 (`userErrorText` 경로).

### 해제 API 는 없다

등록만 제공한다. 잘못 등록한 사용자는 이 API 로 되돌릴 수 없다 — UI 문구가 이걸 말해야 한다.

### 조회 계약은 여전히 없다 (write-only)

`JiraTicketResponse` 에 watcher 목록 필드가 없어 **등록한 사용자를 화면에 보여줄 방법이
없다.** 옛 §2 는 이 이유로 UI 를 붙이지 않기로 했으나, 오너 결정(2026-08-08)으로 등록
UI(⋮ → Watcher 추가)를 write-only 로 먼저 붙였다 — 성공은 모달 닫힘으로, 중복은 서버
409 message 로만 확인된다. 목록 조회 계약이 생기면 타일에 watcher 표시를 추가한다.

---

## 3. 스코프 밖

- 티켓 `summary` / `status` — Jira 실시간 조회가 필요해 별도 논의. 현재 UI 는 표시하지 않는다
- 알림 발송 트리거·채널 — 등록 대상만 다룬다
- 서비스 단위 일괄 사용자 등록
