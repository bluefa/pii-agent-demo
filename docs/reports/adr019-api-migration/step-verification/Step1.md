# Step 1 API Verification — 연동 대상 선택 / IDC DB 입력

**Scope:** IDC Step1 (`IdcStep1TargetInput`) — the manual DB-input step. Cloud Step1 differences noted briefly at the end.
**Authoritative contract (per task):** `docs/swagger/install-v1.yaml`
**Intended-API source:** `/Users/study/pii-agent-migration-notes/01-target-source-detail-spec.md` §3
**Verified:** 2026-06-24 (read-only; no code edits)

> ⚠️ **Two swagger files carry divergent IDC contracts.** `install-v1.yaml` (declared authoritative) and `idc.yaml` describe the *same logical endpoints* with **different path segment orders and different schema names**. The running code follows **`idc.yaml`**, not the authoritative `install-v1.yaml`. This is the central finding of Step 1.

---

## Verification Matrix

| # | Intended API (spec §3) | In `install-v1.yaml` (authoritative)? | Currently called in code (file:line) | Verdict |
|---|---|---|---|---|
| 1 | `GET /target-sources/{id}/idc/resources` — load saved DB list on screen load | **MISSING.** No `idc/resources` path exists in install-v1.yaml. Only `idc/previous-request` (L2553) and `idc/installation-status` (L2621). (L3751 `idc/nlb/{i}/resources` is unrelated NLB admin.) | `app/lib/api/idc.ts:154` `getIdcResources` → `GET /idc/target-sources/{id}/resources`; called at `IdcStep1TargetInput.tsx:94` | **MISMATCH** (path exists only in `idc.yaml` L139, with reversed segments `/idc/target-sources/{id}/resources`; absent from authoritative install-v1) |
| 2 | `PUT /target-sources/{id}/idc/resources` — "이 DB들로 진행" temp-save | **MISSING** (same as #1). | `app/lib/api/idc.ts:175` `updateIdcResources` → `PUT /idc/target-sources/{id}/resources`; called at `IdcStep1TargetInput.tsx:203` (`handleSubmit`) | **MISMATCH** (only in `idc.yaml` L175; absent from install-v1) |
| 3 | `GET /target-sources/{id}/idc/previous-request` — "기존 요청 불러오기" | **PRESENT** at L2553 `…/idc/previous-request`, `operationId: getIdcPreviousRequest`, 200 → `IdcPreviousRequestResponse` (L5356: `{ resources: IdcResourceInput[] }`) | `app/lib/api/idc.ts:164` `getIdcPreviousRequest` → `GET /idc/target-sources/{id}/previous-request`; called via `IdcLoadRequestModal` (`IdcStep1TargetInput.tsx:336`) | **MISMATCH (path segments)** — method + response body shape MATCH (`{ resources: [...] }`), but code path `/idc/target-sources/{id}/previous-request` (matches `idc.yaml` L223) differs from authoritative `/target-sources/{id}/idc/previous-request`. Logical contract MATCH; only segment order diverges. |
| 4 | Approval submission — spec §3 says "저장 및 승인 요청" fires on submit (impl: `createApprovalRequest` in Step1) | **PRESENT** at L1022 `POST …/approval-requests`, `operationId: createApprovalRequest`, body `ApprovalRequestInputDto` (L4619: `{ resources: TargetSourceResourceItemDto[] }`, item requires `metadata`) | `IdcStep1TargetInput.tsx:213` calls `createApprovalRequest`; impl `app/lib/api/index.ts:393` → `POST {CONFIRM_BASE}/{id}/approval-requests`, `CONFIRM_BASE='/target-sources'` (index.ts:294), body via `normalizeApprovalRequestBody` → `{ resource_inputs: [...] }` (`lib/approval-bff.ts:379`) | **MISMATCH (body schema + swagger source).** Code routes to **`confirm.yaml`** L90 (`resource_inputs[]`, Issue #222 contract — confirm.yaml L103/L1196 `ApprovalRequestCreateRequest`), **NOT** install-v1's `ApprovalRequestInputDto`. install-v1 wants `resources[]` w/ required `metadata`; code sends top-level `resource_inputs[]` w/ `selected`/`exclusion_reason`. Same logical path, two contradictory swaggers. |

**Tally:** 4 intended APIs · **0 full MATCH** · **4 with gaps** (3 path-segment mismatches incl. 2 missing-in-authoritative; 1 body-schema mismatch).

---

## Gap Details

### GAP-1 (top gap): `idc/resources` GET+PUT absent from authoritative install-v1.yaml
Step 1's two primary calls (load list, save list) hit `GET`/`PUT /idc/target-sources/{id}/resources`. That path **does not exist in `install-v1.yaml`** at all — it exists only in `idc.yaml` (L139–222) and there with **reversed segments** (`/idc/target-sources/…` vs install-v1's `/target-sources/…/idc/…`). Either install-v1.yaml is missing the resources endpoints, or `idc.yaml` is the real source of truth for IDC. **Migration must resolve which swagger governs IDC before re-wiring** — they cannot both be authoritative.

### GAP-2: Path-segment order disagreement across swaggers
- `install-v1.yaml`: `/target-sources/{id}/idc/{previous-request|installation-status}` (provider segment **last**).
- `idc.yaml` + code: `/idc/target-sources/{id}/{resources|previous-request|installation-status}` (provider segment **first**).
Code consistently uses the `idc.yaml` order (`idcBase = /idc/target-sources/${id}`, idc.ts:152). Same logical operations (`operationId: getIdcPreviousRequest`, `getIdcInstallationStatus` appear in **both** files), schemas equivalent — only the URL shape differs.

### GAP-3: Approval body schema mismatch (install-v1 vs confirm)
`createApprovalRequest` sends `{ resource_inputs: [{ resource_id, selected, exclusion_reason? }] }` (confirm.yaml / Issue #222). install-v1's `ApprovalRequestInputDto` instead expects `{ resources: [{ metadata(req), selected, resource_id, resource_type, … }] }`. The mock honors the `resource_inputs` shape (`lib/bff/mock/confirm.ts:417`), so demo works, but the two published contracts for `POST …/approval-requests` are incompatible.

### Not a gap (correctly absent)
- IDC Step1 calls **no scan / creation-candidates** APIs (correct — those are Cloud-only).
- `confirm-targets` (idc.yaml L304) is **NOT wired** in Step1 — spec §3 confirms v15 uses the shared approval flow instead (idc.yaml L315 marks confirm-targets "v15 미사용"). Intentional, not a defect.

---

## Cloud Step1 (brief comparison)
IDC Step1 = **manual input** (no discovery). Cloud Step1 = **scan-driven discovery**: `POST/GET …/scan` (install-v1 L728 / scan.yaml L24) + `GET …/services/{serviceCode}/creation-candidates` (install-v1 L1392). Cloud uses a different DataProvider and component tree; the resources here come from scan results, not user-typed rows. Approval submission (`createApprovalRequest`) is the **shared** final step across IDC + all Cloud providers (so GAP-3 applies to Cloud Step1 too).

---

## Wire-isolation note (architecture is sound)
All three IDC calls go through the single wire↔domain boundary in `app/lib/api/idc.ts` (`toIdcResourceView` / `toIdcResourceInput`, raw snake passthrough via `fetchInfraJson`). The migration only needs to touch path strings (`idcBase`) and, if install-v1 wins, the previous-request schema name — the UI consumes domain models and is insulated from the wire change.
