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

## Checklist before any boundary change

1. Find the exact `schemas.<Name>` for the request/response. Read the WHOLE object.
2. Type the value as `z.infer<typeof schemas.<Name>>` (request) / return it as that type (response).
3. `schemas.<Name>.parse(raw)` at the route.
4. No `as any` / parallel `*Wire` / invented field / out-of-contract key — anywhere.
5. Mock emits the same contract shape (`schemas.X.parse()` accepts it without casts).
