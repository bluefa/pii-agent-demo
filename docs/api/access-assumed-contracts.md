# 서비스 접근 권한 — Contracts

The 접근 권한 admin menu group (`/admin/pipelines/access/**`) and the requester screen
(`/access-requests`) run on the **backend draft spec the owner supplied (2026-08-13)** —
paths, field names and status codes are followed verbatim. Two things in it do not exist
yet; both are marked **GAP** below.

None of these endpoints are in `docs/swagger/install-v1.yaml` yet, so they 404 against the
real BFF and the feature is mock-first (`lib/bff/mock/access.ts`). Conventions follow
install-v1: snake_case wire, Spring `Page` for the paged reads, `ErrorMessage` problems.

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

**Base path assumption:** the spec gave full paths only for the user API
(`/install/v1/services/{serviceCode}/permission-access`) and bare paths for the admin side
(`/services`, `/admins`, `/permission-access`, `/history`). We mounted the admin set under
`/install/v1/admin/…`, following the repo's existing `/admin/queue/*` and `/admin/ops/*`.
**Confirm this before the BFF ships.**

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

---

## 사용자 API

```
POST /services/{serviceCode}/permission-access
body    { reason: string }          // 필수. 담당자 검사 면제
→ 204                                // 멱등 — PENDING 이 있으면 그대로 두고 성공
```

```
GET /user/services/page?query=&page={0}&size={20}
→ 200 Page<{ service_code, service_name, access_status }>

access_status: "OWNED" | "REQUESTED" | "REJECTED" | "NONE"
```

`/access-requests` 의 서비스 탭 둘이 이 한 번의 호출을 나눠 쓴다 — 요청할 수 있는
서비스 = `NONE` 또는 `REJECTED`, 내가 접근할 수 있는 서비스 = `OWNED`. 자르는 축이
`access_status` 뿐이라 상태별 엔드포인트를 따로 두지 않았다.

기존 `bff.users.getServicesPage` 도 같은 업스트림을 보지만 스웨거 계약
(`PageServiceItem`)으로 파싱해 이 필드를 버리므로, 접근 권한 기능은 별도 투영으로 읽는다.

> **⚠️ 이 응답 형태는 아직 `docs/swagger/*.yaml`(api-docs) 어디에도 없다.** `access_status`
> 는 이 문서가 선언하는 가정이고, 화면 셋(요청 가능·접근 가능·헤더 판정)이 전부 그 위에
> 서 있다. 업스트림이 필드를 다른 이름으로 주거나 enum 값이 다르면 세 탭이 함께 빈다 —
> 계약이 확정되면 `lib/bff/types.ts:ServiceAccessStatusWire` 부터 맞춘다.

```
GET /users/search?query={q}&excludeEmails={a,b}
→ 200 { users: UserSummary[] }
```

이름이 없으므로 `knox_id` 와 `email` 로만 매칭한다. "이미 가진 사람"을 아는 쪽은 화면이라
제외 목록을 화면이 넘긴다 — 그래서 피커는 **현재 페이지가 아니라 전체 목록**을 들고 있어야
한다(2페이지의 담당자가 후보로 다시 올라오면 안 된다).

**빈 질의는 빈 목록을 돌려준다.** `query` 없이 부르면 사람 디렉터리 전체를 열거하는
창구가 되므로, mock 은 빈 질의에 아무도 주지 않고 화면도 검색어가 생긴 뒤에만 부른다.
**실 BFF 도 같은 규칙이어야 한다** — 화면 쪽 규칙만으로는 다른 호출자가 우회할 수 있다.

> **GAP — B4.** 사용자 본인의 요청 내역을 볼 엔드포인트가 없다. `access_status` 만으로는
> 반려 사유도 처리 일시도 말할 수 없어 "승인 내역 조회" 요구사항이 성립하지 않는다.
> 오너가 추가하기로 했고, 그때까지 화면은 제안한 모양을 쓴다:
>
> ```
> GET /permission-access/mine?page={0}&size={20}
> → 200 Page<PermissionRequestDetail>          // 호출자 본인 것만, 최신순
> ```

---

## 아직 열려 있는 것

| | 내용 |
|---|---|
| B3 | 요청 목록 행에 `reason`·`status`·`processed_at` 추가 여부 |
| B4 | 사용자 본인 요청 내역 엔드포인트 (오너 추가 예정) |
| D4 | `/history` 의 `type` enum 실제 값 |
| D6 | 관리자 API base path (`/install/v1/admin/…` 로 가정) |
| — | `authorized-users` 와 `owners` 는 같은 집합으로 확인됐다. 둘 중 하나는 없어져야 한다 — 프론트는 `/owners` 선호, `getPermissions()` 는 호출자가 없어 삭제 비용 0 |
