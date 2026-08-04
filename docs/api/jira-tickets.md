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
JiraTicketResponse:       { id, targetSourceId, serviceCode, issueKey, cloudProvider }
JiraTicketAttachRequest:  { issueKey }        # required
JiraTicketDetachResponse: { issueKey }        # 해제된 티켓 키를 되돌려준다
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

#### `issueKey` 는 넣는 값과 나오는 값의 형태가 다르다

`POST` 로 **넣는** 값은 티켓 키 문자열(`BDCDIP-12312`)이고, `GET` 응답에 **실려 오는** 값은
티켓 주소(`https://{domain}/some/path/BDCDIP-12312`)다. 계약은 양쪽 다 `string` 하나로만
선언하므로 이 비대칭은 스키마에 드러나지 않는다.

화면은 주소의 마지막 `/` 뒤 조각만 보여주고 링크는 받은 값을 그대로 쓴다
(`lib/jira-ticket.ts`). 프론트가 도메인·경로를 조립하지 않는 이유는, 조립하는 순간
프로젝트 키 체계나 Jira 도메인이 바뀔 때마다 프론트가 같이 깨지기 때문이다.
값이 주소가 아니라 키로 오면 링크가 아니라 글자로 보여준다 — 없는 주소를 지어내지 않는다.

`issueKey` 는 프론트가 검증하지 않는다. 존재하지 않는 키의 판정은 Jira 를 아는
BFF 몫이고, 프론트가 형식을 넘겨짚으면 프로젝트 키 체계가 바뀔 때마다 깨진다.

---

## 2. 알림 사용자 등록 (제안 — 아직 계약 없음)

티켓 알림을 받을 사용자 등록. 등록 단위는 **target source** 이며,
기존 `GET /install/v1/target-sources/{targetSourceId}/jira-ticket` 과 같은 키를 쓴다.

```
POST /install/v1/target-sources/{targetSourceId}/jira-ticket/users
```

| 위치 | 이름 | 타입 | 필수 |
|------|------|------|------|
| path | `targetSourceId` | `integer(int64)` | ✅ |
| body | `userId` | `string` | ✅ |

```json
{ "userId": "kim.chulyong" }
```

Response `200 OK` — 등록 후 사용자 목록

```json
{
  "targetSourceId": 1027,
  "issueKey": "BDCDIP-1027",
  "users": [{ "id": "kim.chulyong", "name": "김철용", "email": "chulyong@example.com" }]
}
```

| 코드 | 상황 |
|------|------|
| `404` | targetSourceId 에 매핑된 Jira ticket 없음 / userId 없음 |
| `409` | 이미 등록된 사용자 |

`userId` 는 `GET /install/v1/users/search` 의 `UserInfo.id`.

### 해제 API 는 만들지 않는다 (오너 결정)

등록만 제공한다. 잘못 등록한 사용자는 이 API 로 되돌릴 수 없다.

### 조회는 기존 응답 확장 필요

현재 `JiraTicketResponse` 에 `users` 가 없어 **등록해도 화면에 표시할 방법이 없다.**
신규 엔드포인트 대신 필드 추가를 제안한다.

```yaml
JiraTicketResponse:
  properties:
    # …기존 5개…
    users:                                    # 추가
      type: array
      items: { $ref: "#/components/schemas/UserInfo" }
```

**이 확장이 없는 동안 프론트는 사용자 등록 UI 를 붙이지 않는다.** 등록만 되고 결과를
못 보여주는 화면은 사용자가 성공 여부를 알 수 없어 없느니만 못하다.

---

## 3. 스코프 밖

- 티켓 `summary` / `status` — Jira 실시간 조회가 필요해 별도 논의. 현재 UI 는 표시하지 않는다
- 알림 발송 트리거·채널 — 등록 대상만 다룬다
- 서비스 단위 일괄 사용자 등록
