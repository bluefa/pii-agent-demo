# 서비스 접근 권한 관리 — Assumed Contracts

The 접근 권한 admin menu group (`/admin/pipelines/access/**`) needs eleven endpoints that
**do not exist in `docs/swagger/install-v1.yaml`**. They are implemented mock-first behind
Next.js routes with the shapes below — the same exception the Ops console took
(`docs/api/ops-assumed-contracts.md`). When the BFF ships real endpoints, replace the mock
handlers and delete the corresponding section here.

Conventions follow install-v1: snake_case wire, Spring `Page` for pagination, `ErrorMessage`
problem responses.

## Owner decisions baked in (2026-08-13)

Three answers from the draft backend spec review shape every section below:

- **`email` is the identity key.** Every write addresses a person by email; nothing is
  addressed by an internal id. Comparison is case-insensitive.
- **`knox_id` is what screens display.** `UserSummary` carries no person name, so the
  tables, the picker and the audit log all print the Knox ID — an identifier, set in mono
  like a service code, not a name.
- **There is no grant metadata.** 담당자 목록은 사용자 목록 그 자체다. Who granted it, when,
  and by which path are NOT fields on the list; those facts survive only as `/history`
  events (`GRANTED` = 직접 부여, `APPROVED` = 요청 승인).

A consequence worth stating plainly: the 담당자 표 is two columns wide (Knox ID · 이메일).
That is what the contract supports, and inventing a third would mean rendering a value the
server never sent.

## The one real endpoint this feature already has

```
GET /install/v1/services/{serviceCode}/authorized-users
→ 200 AuthorizedUsersResponse { users: UserInfo[] }   // UserInfo = { id, name, email }
```

Read-only, unpaged, and has no writer. The owner confirmed (2026-08-13) that this set and
the draft spec's **owners** are the same thing — so one of the two should eventually go.
§1 supersedes it for the admin surface; the existing route is untouched here because it has
no caller (`getPermissions()` in `app/lib/api/index.ts` is dead), which also makes it the
cheaper of the two to retire.

Note the shape difference the merge has to resolve: this endpoint returns
`{ id, name, email }` while the draft spec's `UserSummary` is `{ knox_id, email, role }`.
The screens are built on `UserSummary`.

## Two audiences, two path prefixes

`/admin/access/**` is ADMIN-only. `/access/**` is what any signed-in user calls for their
own requests — a service manager with no permission on a service must still be able to ask
for one, so those three endpoints deliberately sit outside the admin gate.

---

## 1. 서비스별 권한 사용자 목록

```
GET /admin/access/services/{serviceCode}/users?page={0}&size={10}
→ 200 Page<UserSummary>

UserSummary {
  knox_id: string      // 화면에 찍는 값
  email:   string      // 모든 쓰기의 식별 키
  role:    string
}
```

The page item IS the user — no `granted_at`, no `granted_by`, no `grant_type`. "이 사람이 왜
이 서비스에 접근하지?" is answered by §5's history instead, where `GRANTED` (직접 부여) and
`APPROVED` (요청 승인) are separate event types. Rows are ordered by `knox_id`, since without
a grant timestamp there is nothing chronological to sort on.

## 2. 서비스 권한 부여 (직접 부여)

```
POST /admin/access/services/{serviceCode}/users
body    { emails: string[] }          // 1건 이상, 이미 가진 사용자는 서버가 무시
→ 200  { service_code: string, granted_count: number }
```

Bulk by design — the picker grants a checked set in one call, not one call per row.

## 3. 서비스 권한 해제

```
POST /admin/access/services/{serviceCode}/users/remove
body    { email: string }
→ 204
```

POST with a body rather than `DELETE …/{email}`: the key is an email address, and an email
in a URL path is personal data written into every access log, proxy trace and referrer
header along the way. The same reasoning applies to §6's admin removal.

## 4. 접근 권한 요청 — 관리자 측

```
GET  /admin/access/requests?status={PENDING|REJECTED|ALL}&page={0}&size={10}
→ 200 Page<AccessRequestItem>

GET  /admin/access/requests/{requestId}
→ 200 AccessRequestItem

POST /admin/access/requests/{requestId}/approve
body    { message: string }           // 선택, maxLength 1000
→ 200  AccessRequestItem              // status=APPROVED, 권한은 이 호출로 부여된다

POST /admin/access/requests/{requestId}/reject
body    { reason: string }            // 필수, maxLength 1000
→ 200  AccessRequestItem              // status=REJECTED

AccessRequestItem {
  request_id:      number
  service_code:    string
  service_name:    string
  requester:       UserSummary
  reason:          string             // 요청자가 적은 사유
  requested_at:    string (date-time)
  status:          "PENDING" | "APPROVED" | "REJECTED"
  processed_at:    string | null
  processed_by:    { id, name } | null
  verdict_message: string | null      // 승인 메시지 또는 반려 사유
}
```

Approving is what grants the permission — there is no separate grant call afterwards. A
request that is not PENDING answers 409 to either action, so two admins racing on the same
row cannot double-decide it.

## 5. 승인·반려 이력

```
GET /admin/access/history?service_code={CODE}&type={TYPE}&page={0}&size={10}
→ 200 Page<AccessHistoryItem>

AccessHistoryItem {
  history_id:  number
  type:        "APPROVED" | "REJECTED" | "GRANTED" | "REVOKED" | "ADMIN_GRANTED" | "ADMIN_REVOKED"
  service_code: string | null         // null = 서비스와 무관한 항목(관리자 권한 부여/회수)
  service_name: string | null
  target_user: { knox_id, email }     // 권한을 받거나 잃은 사람
  actor:       { knox_id, email }     // 그렇게 만든 사람
  reason:      string | null          // 반려 사유 / 승인 메시지
  created_at:  string (date-time)
}
```

`service_code` is the filter the 서비스별 권한 상세가 쓰는 축이다 — 요구사항의 "service code
단위 이력 조회"가 이 파라미터 하나로 끝난다. Omit it for the global log.

## 6. 관리자 권한

```
GET    /admin/access/admins?page={0}&size={10}
→ 200  Page<UserSummary>               // 여기도 부여 메타데이터는 없다

POST   /admin/access/admins
body     { emails: string[] }
→ 200   { granted_count: number }

POST   /admin/access/admins/remove
body     { email: string }
→ 204                                  // 자기 자신은 400 — 마지막 관리자가 스스로를 지우는 사고 방지
```

## 7. 사용자 검색 (권한 부여 피커)

```
GET /admin/access/users?query={q}&exclude_service_code={CODE}&role={ADMIN}
→ 200 { users: UserSummary[] }         // 상한 50건, knox_id 오름차순
```

`query` matches `knox_id` and `email` only — there is no name to match on.

`/user/search` (install-v1) was not reused: it filters `role != ADMIN` out, which makes it
unable to feed the 관리자 권한 picker, and it cannot exclude "already granted on this
service". `exclude_service_code` drops users who already hold that service; `role=ADMIN`
drops users who are already admins.

---

## 8. 요청 가능한 서비스 — 사용자 측

```
GET /access/requestable-services?query={q}&page={0}&size={10}
→ 200 Page<{ service_code: string, service_name: string }>
```

Services the caller does **not** have permission for, minus the ones they already have a
PENDING request on. `/user/services/page` cannot answer this — it returns only what the
caller already holds, which is the exact complement.

## 9. 접근 권한 요청 생성 — 사용자 측

```
POST /access/requests
body    { service_code: string, reason: string }   // reason 필수, maxLength 1000
→ 200  AccessRequestItem                            // status=PENDING
```

409 when the caller already has a PENDING request on that service, or already holds it.

## 10. 내 요청 내역 — 사용자 측

```
GET /access/requests?page={0}&size={10}
→ 200 Page<AccessRequestItem>          // 호출자 본인 것만, 최신순
```

승인·반려 결과(`status`, `processed_at`, `verdict_message`)를 같은 shape 으로 실어 보내므로
요청 화면과 결과 화면이 한 모델을 쓴다.
