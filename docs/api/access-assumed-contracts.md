# 서비스 접근 권한 — Contracts

The 접근 권한 admin menu group (`/admin/pipelines/access/**`) and the requester screen
(`/access-requests`) run on the **backend spec the owner supplied (2026-08-13, updated
2026-08-14)** — paths, field names and status codes are followed verbatim.

None of these endpoints are in `docs/swagger/install-v1.yaml` yet, so they 404 against the
real BFF and the feature is mock-first (`lib/bff/mock/access.ts`). Conventions follow
install-v1: snake_case wire, Spring `Page` for the paged reads, `ErrorMessage` problems.

## 2026-08-14 오너 업데이트 — 무엇이 바뀌었나

| | 바뀐 것 | 우리 쪽 반영 |
|---|---|---|
| **B4 해소** | 본인 신청 내역이 `GET /user/permission-access?status=&page=&size=` 로 생겼다 (반려 사유 포함) | `listMyRequests` 경로 교체. 우리가 제안했던 `/permission-access/mine` 은 폐기 |
| **의미 반전** | `GET /user/services/page` 가 **담당 서비스만** 준다 (ADMIN 은 전체) | "내가 접근할 수 있는 서비스" 탭이 이 호출이 됐다 |
| **새 엔드포인트** | 전체 목록이 `GET /services/page` 로 갈라졌다 — `access_status` + `owners`(담당자 표시명) + `owner_count` + `service_abbr_name` | "요청할 수 있는 서비스" 탭이 이쪽으로 옮겼고, 담당자를 행의 둘째 단에 그린다 |
| **필드 추가** | 두 목록 모두 `is_eos_service` 를 싣는다 (infra 카탈로그 값) | wire 에 선언. 요청 화면은 아직 그리지 않는다 |
| **권한 축소** | `GET /users/search` 가 ADMIN 전용 실구현 (임직원 명부라서) | 요청자 화면은 부르지 않는다. 아래에서 관리자 API 로 옮겨 적었다 |
| **실구현** | `GET /services/{code}/authorized-users` 가 고정 응답에서 실구현으로 | 프론트는 `/owners` 만 쓴다 — 중복 정리는 여전히 오너 몫 |
| **검색 축 추가** | `GET /services` 를 코드·이름에 더해 **담당자**로도 검색한다 | 목의 매칭과 레일 검색창 라벨을 함께 넓혔다 |
| **표기 통일** | 관리 화면 응답 DTO 가 snake_case 로 통일 | 이미 snake wire 로 읽고 있어 변경 없음 |

이 업데이트로 **`description` 요청(C-1)은 철회한다.** 행이 이름 하나로 끝나던 문제는
`owners` 가 대신 푼다 — 오너가 그 필드를 붙인 이유("이름이 비슷한 서비스가 많아 어디에
신청할지 헷갈린다")가 화면이 설명을 달라고 한 이유와 같은 것이었다.

## Decisions this contract encodes

- **`email` is the identity key.** Every write addresses a person by email, compared
  case-insensitively. Nothing is addressed by an internal id.
- **`knox_id` is what screens display.** `UserSummary` carries no person name, so tables,
  the picker and the audit log print the Knox ID — an identifier, set in mono like a
  service code.
- **No grant metadata.** 권한 사용자 목록은 사용자 목록 그 자체다. Who granted it, when, and
  by which path are not fields; those facts survive only as `/history` events
  (`GRANTED` = 직접 부여, `APPROVED` = 요청 승인). The 권한 사용자 표 is therefore two
  columns wide — that is what the contract supports.
- **Terminology split.** The contract says *owners*; the UI says **권한 사용자**. The wire
  keeps the spec's word, the screens keep the user's.

## Two audiences, two prefixes

`/admin/**` is ADMIN-only. `/services/{code}/permission-access` and the requester reads are
what any signed-in user calls — a service manager with no permission must still be able to
ask, so those sit outside the admin gate.

**Base path assumption (여전히 미확인):** 오너의 표는 사용자 API 만 전체 경로
(`/install/v1/…`)로 적고 관리 API 는 계속 bare (`/services`, `/admins`,
`/permission-access`, `/history`) 로 적는다. 08-14 업데이트도 마찬가지다 — 본문에서는
사용자 API 인 `/install/v1/services/page` 를 그냥 `/services/page` 로 부르므로, **bare 는
"prefix 생략"이지 "prefix 없음"이 아니다**. 그래서 이것으로는 관리 API 의 base 를
가릴 수 없다. 우리는 저장소 관례(`/admin/queue/*`, `/admin/ops/*`)를 따라
`/install/v1/admin/…` 에 걸어 두었다. **BFF 나가기 전에 확인해야 한다.**

## Shared shapes

```
UserSummary { knox_id: string, email: string, role: string }
```

---

## 관리자 API

### 서비스

```
GET  /admin/services?page={0}&size={20}&q={검색어}
→ 200 Page<AdminServiceRow>

AdminServiceRow {
  service_code:     string
  service_name:     string
  owner_count:      number          // 레일이 권한자 수를 여기서 읽는다
  owners:           UserSummary[]
  last_modified_at: string | null
}
```

```
GET  /admin/services/{serviceCode}/owners
→ 200 ServiceOwnersResponse

ServiceOwnersResponse {
  service_code: string
  service_name: string
  owners:       UserSummary[]       // 페이지가 아니다 — 전체를 준다
}

POST /admin/services/{serviceCode}/owners
body    { emails: string[] }        // 직접 부여, 이미 가진 사용자는 서버가 무시
→ 200  ServiceOwnersResponse        // 갱신된 전체 목록

POST /admin/services/{serviceCode}/owners/remove
body    { email: string }
→ 200  ServiceOwnersResponse
```

쓰기가 갱신된 전체 목록을 돌려주므로 화면이 재조회할 필요가 없다. 목록이 페이지가
아니므로 나눠 그리는 일은 화면 몫이다 (`sliceToPage`).

### 관리자

```
GET  /admin/admins
→ 200 AdminListResponse { admins: UserSummary[] }   // 페이지 아님

POST /admin/admins
body    { email: string }           // 단수 — 여러 명은 호출을 반복한다
→ 200  UserSummary

POST /admin/admins/remove
body    { email: string }
→ 204                                // 마지막 관리자면 400
```

회수 규칙은 "자기 자신"이 아니라 **"마지막 한 명"**이다. 관리자가 둘 이상이면 스스로를
내릴 수 있고, 그 순간 이후의 관리자 조회는 정상적으로 403 이 된다.

### 접근 권한 요청

```
GET  /admin/permission-access?status={PENDING}&page={0}&size={20}
→ 200 Page<PermissionRequestRow>

PermissionRequestRow {
  request_id:   number
  service_code: string
  service_name: string
  requester:    UserSummary
  requested_at: string (date-time)
}
```

> **GAP — B3.** 행에 `reason` 도 `status` 도 없다. 요청 사유는 상세에만 있어서 승인 대기·
> 반려 카드가 사유 미리보기를 그리지 못한다. 행마다 상세를 부르면 N+1 이 되므로 지금은
> 열을 두지 않았다. `reason`·`status`·`processed_at` 세 필드가 행에 붙으면 열이 되살아난다.

```
GET  /admin/permission-access/{requestId}
→ 200 PermissionRequestDetail

PermissionRequestDetail {
  request_id, service_code, service_name
  requester:      UserSummary
  reason:         string
  status:         "PENDING" | "APPROVED" | "REJECTED"
  requested_at:   string
  processed_at:   string | null
  processed_by:   UserSummary | null
  processed_note: string | null     // 승인 메시지 또는 반려 사유
}

POST /admin/permission-access/{requestId}/approve
body    { message?: string }        // 선택
→ 204                                // 담당자 부여까지 한 트랜잭션. 이미 처리된 건 400

POST /admin/permission-access/{requestId}/reject
body    { reason: string }          // 필수
→ 204                                // 이미 처리된 건 400
```

승인이 곧 부여다 — 뒤따르는 부여 호출은 없다. 응답이 204 라 화면은 결과 문구를 스스로
만들고 목록을 다시 읽는다.

### 이력

```
GET /admin/history?service_code={CODE}&type={TYPE}&page={0}&size={20}
→ 200 Page<AccessHistoryRow>

AccessHistoryRow {
  history_id:   number
  type:         "APPROVED" | "REJECTED" | "GRANTED" | "REVOKED" | "ADMIN_GRANTED" | "ADMIN_REVOKED"
  service_code: string | null       // null = 관리자 권한 부여/회수 (서비스와 무관)
  service_name: string | null
  target_user:  UserSummary
  actor_user:   UserSummary
  note:         string | null
  created_at:   string (date-time)
}
```

`service_code` 가 요구사항의 "service code 단위 이력 조회" 축이다. 생략하면 전역 로그.
**`type` enum 값은 아직 확인받지 못했다** — 위 여섯은 화면이 가정한 값이고, 배지 어휘가
여기서 나온다.

### 사용자 검색

```
GET /users/search?q={q}
→ 200 { users: UserSummary[] }
```

**질의 키는 `q` 다** — swagger 가 `searchUsers` 로 선언한 이름이고, 08-14 노트는 응답
본문만 바꿨다. 우리가 한때 `query` 로 가정했던 건 근거가 없었고, 실 BFF 에 그대로
나가면 서버가 조용히 무시해 검색창이 아무 일도 하지 않는 채로 명부 전체가 온다.

**ADMIN 전용이다** (2026-08-14). 임직원 명부(knox_id·email·role)를 돌려주므로 인증만으로
열어 둘 수 없다는 오너 판단이고, 실제로 부르는 화면도 담당자 피커(관리자 전용) 하나뿐이다.

이름이 없으므로 `knox_id` 와 `email` 로만 매칭한다. "이미 가진 사람"을 아는 쪽은 화면이고,
**제외도 화면이 한다** — swagger 의 `excludeIds` 가 무엇으로 키잉되는지 미확정이고 새
응답에는 id 가 없어 실을 값이 없다(E4). 그래서 피커는 **현재 페이지가 아니라 전체 목록**을
들고 있어야 한다(2페이지의 담당자가 후보로 다시 올라오면 안 된다).

**빈 질의는 빈 목록을 돌려준다.** `q` 없이 부르면 사람 디렉터리 전체를 열거하는
창구가 되므로, mock 은 빈 질의에 아무도 주지 않고 화면도 검색어가 생긴 뒤에만 부른다.
**실 BFF 도 같은 규칙이어야 한다** — 화면 쪽 규칙만으로는 다른 호출자가 우회할 수 있다.

---

## 사용자 API

```
POST /services/{serviceCode}/permission-access
body    { reason: string }          // 필수. 담당자 검사 면제
→ 204                                // 멱등 — PENDING 이 있으면 그대로 두고 성공
```

```
GET /user/permission-access?status={PENDING}&page={0}&size={20}
→ 200 Page<PermissionRequestDetail>  // 호출자 본인 것만, 최신순. 반려 사유 포함
```

B4 가 이것으로 닫혔다. 화면은 `status` 를 붙이지 않는다 — 헤더 판정이 반려·대기·승인을
한 문장으로 세므로 상태별로 나눠 받으면 호출이 셋이 된다.

```
GET /services/page?query=&page={0}&size={20}
→ 200 Page<{ service_code, service_name, service_abbr_name,
             access_status, is_eos_service, owners, owner_count }>

access_status: "OWNED" | "REQUESTED" | "REJECTED" | "NONE"
owners:        string[]   // 담당자 표시명
```

**요청할 수 있는 서비스** 탭이 이 호출이다 — `NONE` 또는 `REJECTED` 만 남긴다. 행의
둘째 단이 `owners` 다: 내 요청을 볼 사람이 누구인지, 그리고 이름이 비슷한 둘 중 어느
쪽이 내가 아는 그 서비스인지. 이름은 둘까지 쓰고 나머지는 `owner_count` 로 접는다.

```
GET /user/services/page?query=&page={0}&size={20}
→ 200 Page<{ service_code, service_name, access_status, is_eos_service }>
```

**내가 접근할 수 있는 서비스** 탭. 담당 서비스만 오지만 **ADMIN 에게는 전체가 오므로**
화면이 `OWNED` 로 한 번 더 거른다 — 관리자는 role 로 통과할 뿐 담당자는 아니다.
담당자는 싣지 않는다(그쪽 목록에서는 내가 이미 담당자다).

기존 `bff.users.getServicesPage` 도 같은 업스트림을 보지만 스웨거 계약
(`PageServiceItem`)으로 파싱해 이 필드들을 버리므로, 접근 권한 기능은 별도 투영으로 읽는다.

> **⚠️ 두 응답 형태 모두 아직 `docs/swagger/*.yaml`(api-docs) 어디에도 없다.**
> `access_status` 도 `owners` 도 이 문서가 적어 두는 것이고, 화면 셋(요청 가능·접근
> 가능·헤더 판정)이 전부 그 위에 서 있다. 필드 이름이나 enum 이 다르면 세 탭이 함께
> 빈다 — 확정되면 `lib/bff/types.ts` 의 `ServiceAccessStatusWire`·`ServicePageRowWire`
> 부터 맞춘다.

---

## 아직 열려 있는 것

| | 내용 |
|---|---|
| B3 | 요청 목록 행에 `reason`·`status`·`processed_at` 추가 여부 (08-14 업데이트에도 안 들어왔다) |
| D4 | `/history` 의 `type` enum 실제 값 |
| D6 | 관리자 API base path (`/install/v1/admin/…` 로 가정) — 08-14 표기로도 가려지지 않았다 |
| E1 | `GET /services/page` 가 `query` 를 받나. 화면에 검색창이 있고 지금은 받는다고 가정한다 |
| E2 | `owners` 원소가 문자열인가 `UserSummary` 인가. "담당자 표시명"으로 적혀 있어 문자열로 읽는다 — 객체면 `toServicePageRow` 한 곳만 바뀐다 |
| E3 | `service_abbr_name` 을 실제로 채워 주는 서비스가 어떤 것들인가. 목은 카탈로그에 약어가 없어 전부 `null` 이고, 화면도 아직 그리지 않는다 |
| **E4** | `GET /users/search` 의 `excludeIds` 는 무엇으로 키잉되나. 새 응답(`UserSummary`)에는 id 가 없어 실을 값이 없다 — **확인 전까지 보내지 않고 화면이 응답에서 거른다** |
| E5 | swagger 의 `UserSearchResponse`(id·name·email)가 08-14 실구현(knox_id·email·role)과 다르다. `/install/v1/users/search` 를 부르는 기존 라우트(`app/api/v1/users/search`)는 그 stale 스키마로 파싱한다 — 스펙 갱신은 오너 몫 |
| — | `authorized-users` 가 실구현됐지만 `owners` 와 같은 집합이다. 둘 중 하나는 없어져야 한다 — 프론트는 `/owners` 만 쓴다 |

**닫힌 것** — B4(본인 신청 내역 `/user/permission-access`), C-1(`description` 요청은
철회, `owners` 가 대신한다).
