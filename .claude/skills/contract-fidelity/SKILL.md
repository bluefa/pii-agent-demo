---
name: contract-fidelity
description: ABSOLUTE rule for every API request/response, type, mock, adapter, and route. The generated swagger schema is the only contract — never use a field it does not declare, never edit the swagger, never doubt it. Use whenever touching anything that crosses the BFF boundary (route.ts, app/lib/api/*, lib/bff/*, mocks, adapters, request bodies, response shapes, types).
---

# Contract Fidelity — the swagger is the only truth

`docs/swagger/install-v1.yaml` → `lib/generated/install-v1.ts` (`npm run gen:api`) is the
**sole, authoritative API contract**. This is a hard constraint, not a guideline.

## The absolute rule

**You may only use fields that the generated schema declares — in requests AND responses.
Using any field not in the contract is forbidden. There are no exceptions.**

- A request body must be exactly `z.infer<typeof schemas.<RequestDto>>`. Sending an extra or
  renamed field (e.g. `resource_inputs` when the contract says `resources`, or a top-level
  `exclusion_reason_default` the DTO never declares) is a violation.
- A response is consumed exactly as `z.infer<typeof schemas.<ResponseDto>>`. Reading a field
  the schema never declares (e.g. `r.testAck` when the response has no such key) is a violation —
  it silently yields `undefined` and hides bugs.

## Never touch, never doubt the swagger

- **NEVER edit `docs/swagger/install-v1.yaml`.** It is owned by the spec/BFF author. Do not add
  `required`, `nullable`, or "fix" a pattern. If the spec seems wrong, **you are misreading it.**
- **NEVER delete or supersede the swagger**, and never treat another source (old hand types, the
  mock, your memory of "how it used to work") as the contract. The generated schema wins, always.
- The single codegen incompatibility (`cloud_type`'s `(?i)` regex) is handled in the generated
  OUTPUT by `scripts/gen-api.mjs` — never by editing the spec. Do not add new spec edits.

## Make a violation a COMPILE ERROR

The constraint must be enforced by the type system, not by discipline:

- **Type every boundary value with the generated type.** Request: `const body: z.infer<typeof
  schemas.X> = {...}`. Response: the API client returns `Promise<z.infer<typeof schemas.X>>`.
  TypeScript's excess-property check then rejects any field the contract does not declare, and a
  missing required field surfaces at compile time.
- **Validate at the boundary with `schemas.X.parse(raw)`** (route) — a runtime backstop that
  throws on contract drift (loud-fail → ProblemDetails).
- **Forbidden escape hatches** (they defeat the rule — do not use them to smuggle a field in):
  `as any`, `as SomeWiderType`, `@ts-expect-error`, a hand-written parallel `interface ...Wire`
  with extra fields, a `normalize*` that *invents* a field, `Record<string, unknown>` indexing of
  a typed payload. If you reach for one of these to make a field "fit," stop — the field is not in
  the contract.

## The "missing field" trap (do not fall for it)

If a field looks absent from a schema, **re-read the FULL schema before concluding anything.**
Generated enums can be 50+ values long and push later fields far down — a truncated view (`head`,
a short `sed` range) hides them. `exclusion_reason`, `integration_category`, etc. live *after* a
giant `resource_type` enum in `TargetSourceResourceItemDto`. Read the whole object (`{ ... }`),
or `grep` the field name directly in `lib/generated/install-v1.ts`. **Never** conclude "the
swagger is incomplete / stale / wrong" — that conclusion is itself the bug.

## When a UI shape and the contract differ

The contract wins. Map the UI/internal shape *to* the generated type (a genuine reshape adapter is
fine — it still only emits contract fields). Do not invent a wire field to carry UI data; if the
data has no contract home, it is not sent. Re-read the full DTO first (see the trap above) — the
field you think is missing is usually there.

## A value is not "sent" until it survives every hop

"Wired it up" means the value reaches the call that **persists** it — not the first call that
mentions it. Count the hops before you claim a field is sent, and assert the body of the last one.

**Round-trip endpoints are the trap.** Some flows are two calls where the second posts back what
the first returned — `creation-candidates` (35) returns a candidate, `createTargetSource` (36)
posts that same candidate. A key the contract does not declare **cannot survive the turnaround**:
the upstream has no reason to echo it, and the mock deletes it outright (`buildCandidateMetadata`
in `lib/bff/mock/target-sources.ts` rebuilds `metadata` from a fixed whitelist). The value must be
re-attached from local state right before the second post — see `attachLinkedAccount` (PR #704).

This bug shape is silent and passes review, because every test is green:

- a unit test asserting call 1's body proves only that call 1 is correct;
- the form validates and requires the field, so the UI looks right;
- the mock returns 200 and registration "succeeds" — with the field missing.

Rules:

- **Count the call sites.** `grep` the wire key across the whole flow. One hit for a two-call flow
  is a bug, not a wiring.
- **Test the persisting call.** Assert the body of the call that creates/updates, not just preview.
- **Never rely on echo for an undeclared key.** If the contract does not declare it, assume every
  response drops it and re-attach from the source of truth (form/domain state).
- **When an endpoint is swapped or renamed, diff the old request body field-by-field.** The
  original loss here came from #507 replacing `registration-preview` with `creation-candidates`:
  `awsLinkedAccountId` had no counterpart in the new DTO and vanished with no test to notice.

## Checklist before any boundary change

1. Find the exact `schemas.<Name>` for the request/response. Read the WHOLE object.
2. Type the value as `z.infer<typeof schemas.<Name>>` (request) / return it as that type (response).
3. `schemas.<Name>.parse(raw)` at the route.
4. No `as any` / parallel `*Wire` / invented field / out-of-contract key — anywhere.
5. Mock emits the same contract shape (`schemas.X.parse()` accepts it without casts).
6. `grep` the wire key across the flow — every call that must carry it, carries it. For a
   round trip, that is the preview call AND the create/update call.
