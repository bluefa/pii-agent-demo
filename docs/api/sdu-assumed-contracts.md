# SDU (Self Data Upload) — Assumed Contracts (no backing in install-v1.yaml)

`docs/swagger/install-v1.yaml` says exactly three things about SDU, and none of them is
an operation:

- `cloud_provider: SDU` on the target-source enum,
- `metadata.is_sdu_type` (`.partial()`, so it may be absent),
- `metadata.is_china_region`,

plus the two terraform script names `SDU_BDC_SERVICE_COMMON` / `SDU_BDC_SERVICE`. There is
no endpoint anywhere for defining an SDU integration target, for the firewall rows, for
the upload commands, for the S3 Access Key recipients, or for the BDC resource step. **The
whole owner flow below is assumed.** Every section here 404s against the real BFF, so the
failure copy on these screens must not promise that a retry will work (same rule as
`ops-assumed-contracts.md` §8).

Design source of truth for shapes and copy: **`design/sdu/sdu-flow-design.html`** — read
`#step1`, `#step4`, `#contract` and the invalidation table under
"무엇을 고치면 무엇이 무효가 되나". Where this file and the storyboard disagree, the
deltas are listed at the bottom and the storyboard's open questions (Q1–Q18) are still
open.

Conventions follow install-v1: snake_case wire, `ErrorMessage`-shaped problem responses.
Base for every section: `/install/v1/target-sources/{targetSourceId}/sdu`.

Hand-written types live in `lib/types/sdu.ts` — **not** in `lib/generated/*`, which is
codegen output from the swagger and must never carry a shape the swagger does not declare.
Each route handler under `app/api/v1/target-sources/[targetSourceId]/sdu/**` carries an
`// ASSUMED CONTRACT — docs/api/sdu-assumed-contracts.md §N` marker. When the BFF ships a
real endpoint, delete the section here, its mock, its BFF method, and the marker.

## What SDU is, in one paragraph

SDU is not a cloud provider. `CloudProvider` stays `AWS | Azure | GCP | IDC`, and
`normalizeCloudProvider` folds `'SDU'` to `'AWS'`; SDU-ness is a *flag*
(`isSduTarget`, `lib/types.ts`). The owner does not have infrastructure we scan — they
upload data to an S3 bucket we own. So there is no approval step and no Terraform for
them to run: they **define** what they are going to upload (Step 1), **upload** it
(Step 2), and wait (Step 3, then 4).

**The owner-facing SDU flow is presented as 4 steps; the wire `ProcessStatus` lattice is
unchanged.** The 7-step lattice is shared with every other provider — SDU rides it and
folds it for presentation in `sduStepOf`
(`app/target-sources/[targetSourceId]/_components/sdu/sdu-steps.ts`):

| ProcessStatus | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
|---|---|---|---|---|---|---|---|
| SDU step | 1 | 2 | 2 | 2 | 3 | 3 | 4 |

Statuses 2·3 join 4 on SDU's step 2 because SDU has no approval; 5 joins 6 on step 3
because the admin's scan → Terraform → 연결 테스트 → Airflow run is one sentence to the
owner. The four blocks inside SDU's step 2 are **mock-only sub-state**, not statuses —
nothing on the wire names them.

## 1. Integration target definition — read

```
GET /install/v1/target-sources/{targetSourceId}/sdu/definition
→ 200 {
     region_scope: "GLOBAL" | "CHINA",   // read-only, derived from metadata.is_china_region
     targets: [{
       target_id:      string,
       cloud:          "AWS"|"GCP"|"AZURE"|"IDC"|"OTHER",
       region:         "asia"|"us"|"eu"|"cx"|"china",
       upload_ip:      string,       // IPv4, one per target
       database_types: string[],
     }],
     updated_at:   string | null,    // null until the first save
   }
```

`region_scope` (권역) is **read-only and derived**: it is `metadata.is_china_region`
(`project.isChinaRegion`) read through, exactly as AWS branches on that same field. The
owner never picks it, so Step 1 has no scope control — it states the scope in one line and
draws the region choices the scope owns. The `cloud_provider` enum has one `SDU`, not
`SDU_GLOBAL`/`SDU_CHINA` (storyboard Q1), which is why the value has to be carried here at
all; it is echoed on §1 so the screen does not have to re-derive it from a second source.

`region` is **our** name, not an AWS region code. GLOBAL owns `asia|us|eu|cx`, CHINA owns
`china` — a scope owns its regions exclusively, which is why a China target source always
has exactly one upload path.

## 2. Integration target definition — write

```
PUT /install/v1/target-sources/{targetSourceId}/sdu/definition
body { targets[] }                      // target_id optional on a row never saved before
                                        // no region_scope — it is not writable
→ 200  the same shape as §1
→ 400  INVALID_PARAMETER
```

Server rules — all of them need the **stored** definition to decide, so none is duplicated
on the client:

- every `region` must belong to the target source's scope (derived, §1). A body that still
  carries `region_scope` is not rejected — the field is ignored.
- `database_types`: ≤ 20 per target, each ≤ 50 characters, non-empty after trim.
- `upload_ip`: a valid IPv4 (the same reader IDC uses, `isValidIdcIp`).
- `cloud` must be one of the five.

### Invalidation

A save recomputes what the Step-2 (데이터 업로드) answers still mean. This is the
storyboard's table, and it is why every upload-step response is keyed by region: an
answer stored as
"이 Region에 대해 이렇게 답했다" can be kept or dropped one region at a time, where a
per-block boolean would be wiped by every edit and the owner would learn to avoid going
back.

| edited in Step 1 | firewall acks | recipients | upload acks |
|---|---|---|---|
| region added | (nothing to drop — it simply has no ack) | kept | (nothing to drop) |
| region removed | that region's ack dropped | kept | that region's ack dropped |
| `upload_ip` changed | **all** dropped | kept | kept |
| `database_types` only | kept | kept | kept |
| `cloud` only | kept | kept | kept |

`upload_ip` is the only edit with a blast radius wider than its own row, because a
firewall rule is a **source → destination pair**: a new source makes every rule a
different rule. The commands do not carry the source IP, so they survive. (The storyboard
also notes, Q10, that the IP is on the BDC bucket policy's allowlist, so a change is not
finished by the owner re-confirming — that half is not in this contract.)

The result is reported back on §4 as `invalidation`, and it is **told once**: the next
`PUT …/upload/acks` clears it.

## 3. Submit

```
POST /install/v1/target-sources/{targetSourceId}/sdu/definition/submit
→ 204
→ 400  INVALID_PARAMETER   // no targets
```

Requires at least one target. Moves the target source from ProcessStatus 1
(`WAITING_TARGET_CONFIRMATION`) to 4 (`INSTALLING`) — SDU has no approval step, so
submitting is what puts the owner on 데이터 업로드. No response body is read: the screen
re-reads `process-status` to learn which step it is on now.

## 4. Data upload step

One response for the whole step. Every list in it is keyed by region.

```
GET /install/v1/target-sources/{targetSourceId}/sdu/upload
→ 200 {
     submitted_at: string | null,
     regions:      string[],          // distinct, canonical order: asia, us, eu, cx, china
     firewall: {
       rows: [{ region, s3_endpoint: string, port: number, destination_ips: string[] }],
       acked_regions: string[],
     },
     recipients: {
       users:      [{ id: string, name: string, email: string }],
       updated_at: string | null,
     },
     commands: {
       rows:          [{ region, command: string }],
       acked_regions: string[],
     },
     bdc: {
       status:       "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED",
       checked_at:   string,
       completed_at: string | null,
     },
     invalidation: {
       added_regions: string[], removed_regions: string[], upload_ip_changed: boolean,
     },
   }
```

`regions` is derived from the definition: the upload path is per **region**, not per
database type, so targets sharing a region share one bucket path. `firewall.rows` and
`commands.rows` have exactly one entry per entry in `regions`.

`command` is **one string of exactly three lines** — two proxy exports and one `ls`:

```
export http_proxy=http://proxy.bdc.com:8080
export https_proxy=http://proxy.bdc.com:8080
aws s3 ls s3://bdc-sdu-<aws-region>/<targetSourceId>/ --recursive --human-readable
```

The screen shows it verbatim and never parses it. The moment a screen pulls `s3://` out
of that string, the wire format becomes a screen contract — and a fourth line, or a
different proxy address, breaks the screen instead of just changing what it displays.
Conversely the firewall side is **structured**, because the screen stacks those values
one CIDR per line — one form line is one CIDR.

Region → AWS region / endpoint mapping is the **server's**, and the client only reads it
(storyboard Q3 — it may not be one fixed table, and China is a different partition:
`amazonaws.com.cn`). The mock keeps its illustrative table in one place,
`REGION_FACTS` in `lib/bff/mock/sdu.ts`.

## 5. Confirmation answers

```
PUT /install/v1/target-sources/{targetSourceId}/sdu/upload/acks
body { kind: "FIREWALL" | "UPLOAD", regions: string[], confirmed: boolean }
→ 204
→ 400  INVALID_PARAMETER   // a region not in the current definition
```

`confirmed: true` adds the regions to the matching `acked_regions`, `false` removes them.
`regions` must be a subset of §4's `regions`.

`false` is a first-class value, not a missing answer. The upload-step gates block forward
only — a finished block folds, it does not lock — so every one of them keeps a way back.

Storing an ack also clears `invalidation` (§2).

## 6. S3 Access Key recipients

```
PUT /install/v1/target-sources/{targetSourceId}/sdu/upload/recipients
body { user_ids: string[] }
→ 204
→ 400  INVALID_PARAMETER   // unknown user id
```

**A list, not a send.** The key is delivered by an administrator over mail; this endpoint
records who it goes to and nothing else. No section of this contract has sending
semantics, and no screen built on it may imply that saving the list dispatched anything.

### Where the candidates come from — not assumed

The people offered are the target source's own service owners, read from a **real**
contract:

```
GET /install/v1/services/{serviceCode}/authorized-users
→ 200 { users: [{ id, name, email }] }
```

Not `/users/search`: a directory search offers everyone in the company a key that belongs
to one service. The two answer the same `{id, name, email}` shape, so the swap cost the
picker nothing but let it drop the debounce, the query field, and the `excludeIds` round
trip — the already-registered are struck from a list the screen already holds.

Both facts are confirmed (오너, 2026-08-28), so nothing here is assumed but the caller:

- **the endpoint is not ADMIN-only** — a service manager gets a 200. The mock had gated it
  on ADMIN, which locked the owner out of their own screen; it now uses the gate every
  other owner-facing mock uses — ADMIN or a manager of that service.
- **the response is `id · name · email`**, so `id` is the only thing to key on and it is
  what `user_ids` carries. `/upload/recipients` is ours to specify, so that is settled
  here rather than asked of the BFF.

## 7. BDC progression and system reset

Not an endpoint — a rule §4's `bdc` reports.

`bdc.status` becomes `IN_PROGRESS` when **every** current region is acknowledged on both
lists and there is at least one recipient, and `COMPLETED` 60 s later, which moves the
target source to ProcessStatus 5 (`WAITING_CONNECTION_TEST`). Losing any of those
conditions before completion returns it to `NOT_STARTED`: an invalidated ack means BDC is
waiting again, not that it is half-done.

The existing `POST …/reset` (Step 4 완료's 연동 대상 수정) clears the SDU **upload** state —
acks, recipients, BDC — and **keeps the definition**. Reset returns the target to Step 1,
and Step 1 is where the definition is edited; wiping it would hand the owner an empty
screen to re-type from memory, which is the same reasoning that keeps the scan results.

## Deltas from the storyboard's proposed shapes

The storyboard's `#contract` section sketches four separate endpoints
(`sdu/firewall-targets`, `sdu/upload-commands`, `sdu/acks`, `sdu/credential-recipients`)
with a **camelCase** wire and `answer: "YES" | "NO"`. This file deviates on three points,
and they are choices, not transcription errors:

1. **snake_case, not camel.** The storyboard argued camel from `TargetSourceResponse`.
   Every *assumed* contract in this repo is written snake (ops §1–§5, access), and the
   two boundaries that would have to know the difference (`lib/bff/http.ts`,
   `app/lib/api/sdu.ts`) are per-domain. One casing rule for assumed contracts is worth
   more than matching a response we do not call. If BE answers camel, the change is
   confined to `app/lib/api/sdu.ts` and the wire types.
2. **`GET …/upload` is one response**, not three (`firewall-targets` +
   `upload-commands` + `credential-recipients`). The step is a chain of gates whose state
   is computed *across* the three — `bdc` cannot be answered without all of them, and
   `invalidation` describes all of them at once. Three calls would let the screen render a
   gate against a definition the other two calls had not seen yet.
3. **`confirmed: boolean`, not `answer: "YES" | "NO"`.** Two values with two names is one
   value. `NO` and "no answer yet" are already distinguished by the region's absence from
   `acked_regions`, so the enum's third state would be unreachable.

Also added, with no storyboard counterpart: `§1/§2 definition` (the storyboard draws the
Step-1 screen but proposes no endpoint for it), `§3 submit`, and the `invalidation` block
(the storyboard states the rules as a table but does not put them on the wire — a screen
cannot say "이 Region은 다시 확인해주세요" without being told which).

## Open questions inherited from the storyboard

These are the storyboard's, unresolved, and each one changes a screen if it is answered
differently. Full text in `design/sdu/sdu-flow-design.html` §07.

- **Q1** where `region_scope` lives (enum split / separate field / server-derived).
  **Answered (오너, 2026-08-27): server-derived** from `metadata.is_china_region`, so
  Step 1 has no scope control. What stays open is whether the BFF echoes the field on §1
  or the screen reads the target source's metadata directly.
- **Q2** whether cloud and region are per-target or per-target-source. §1 assumes
  per-target — "Region 2곳" only exists if a row can differ.
- **Q3** the region → bucket/endpoint mapping: fixed, per-target-source, or per-scope.
- **Q4** whether the destination IPs really arrive structured; a plain string would
  replace §4's firewall table with a terminal block, and the CIDR count cap is unknown.
- **Q6** whether `upload_ip` stays scalar or opens to an array.
- **Q10** what else an `upload_ip` change requires on our side (bucket policy allowlist).
- **Q16** what a `database_types`-only edit changes for the admin's scan comparison —
  it invalidates nothing here, which is not the same as nothing happening.

## Mock implementation

`lib/bff/mock/sdu.ts` — a `globalThis`-guarded `Map<number, SduState>`
(`__sduMockStore`), lazily seeded per target source. `resetSduMockStore()` clears it for
tests; `completeSduBdcForTest(id)` backdates the BDC start past its duration and
re-evaluates, so a test drives the same transition a real minute drives rather than
setting the terminal state by hand.

BDC progression is evaluated **on read and on every write**, comparing elapsed time —
the pattern `lib/mock-installation.ts` uses for terraform scripts. A `setTimeout` would
not survive a hot reload and would keep the test process alive.

Fixtures (`lib/mock-data.ts`): **1100** is mid-upload-step (2 targets / regions `us`+`eu`,
firewall acked for `us` only, 2 recipients — two of the `SDU` service's three owners, so
the picker still has one left to offer); **1101** is Global at Step 1 with an empty
definition; **1102** is the same at China (`isChinaRegion: true`). **1099** is left alone
— it is pinned by `OpsTargetView.sdu.test.tsx` and `lib/bff/mock/__tests__/pipeline.test.ts`.
