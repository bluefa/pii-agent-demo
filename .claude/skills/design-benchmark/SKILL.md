---
name: design-benchmark
description: Design benchmarking research workflow. Use when the user asks to diagnose a screen's design problems, collect external design references, and propose improvements as a design artifact. Triggers on requests like "레퍼런스 N개", "벤치마킹", "개선안/시안 N개 + design artifact".
---

# Design Benchmark

Turn one screen/component complaint into a shareable research artifact:
**diagnosis → external references → benchmarkable elements → improvement proposals**.

## Inputs

From the user's message, extract:

- **Target**: the page/component/modal being criticized (e.g. `pass/services` 인프라 등록 modal)
- **Pain points**: the specific complaints stated
- **Reference count**: default **13** unless the user says otherwise (they often say 10 or 12)
- **Proposal count**: default **5**

If the target screen is ambiguous, ask before researching.

## Workflow

### 1. Diagnose the current design

Read the target's actual code on the latest state (components, mock data, and the
running dev server if one is up). Do not diagnose from memory — the UI changes
weekly (logo, service panel, headers). Ground findings in:

- The user's stated complaints (always listed first)
- `/design-guide` values (font/spacing sets, hierarchy rules) for objective violations
- Information-hierarchy and flow problems a first-time user would hit

Output: a numbered problem list, each with the concrete evidence (file/screen location)
**and an evidence grade** so a non-designer can tell what to trust:

- `수치 위반` — violates a design-guide set value (objective; cite the value)
- `UX 원칙` — breaks a general heuristic (name it: scan speed, hierarchy levers, etc.)
- `제안` — subjective judgment; explicitly marked as opinion

### 2. Collect external references

Find N real products/design systems that solve the *same class* of problem.
Order by relevance — most related first, and say why each was picked.

- Search broadly (WebSearch), then read pages (WebFetch) for specifics.
- Prefer top products with real, inspectable UI: Linear, Vercel, Stripe, AWS/GCP/Azure
  consoles, Retool, Datadog, Plaid, shadcn/carbon/polaris/cloudscape docs, Toss, etc.
- For each reference capture: **what problem it solves, how (the concrete mechanism),
  and which elements are worth benchmarking** (at least 5 benchmarkable elements
  across the whole set; per-reference strengths written out).
- **Every reference must carry a real, clickable URL** to the page or doc it came
  from, plus a verification badge: `확인함` (actually fetched/viewed this session)
  or `기억 기반` (from training knowledge, not re-verified). Never present a
  memory-based reference as verified — the user checks references by following
  the links, so a dead or wrong URL destroys trust in the whole set.

### 3. Reconstruct references visually (artifact constraint)

The artifact CSP blocks all external images — hotlinked screenshots will NOT render
(past render rate: 3/28). For every reference, **re-build the relevant UI fragment as
a small inline HTML/CSS mockup** inside the artifact instead of linking an image.
Keep each mockup to the one pattern being borrowed, labeled with the product name.

### 4. Propose N improvements

Default 5 proposals/시안. Each proposal must:

- Name which references it borrows from
- Show a visual mockup (inline HTML/CSS, same technique as step 3) — not just prose
- State the tradeoff (what it costs: space, clicks, implementation effort)
- Respect domain constraints already established (check memory/docs before inventing
  behavior — e.g. SDU is decided server-side post-submission, TC runs per TargetSource)
- **Reuse existing metrics**: px/spacing/icon sizes come from an existing screen with
  the same role in this app, never from component defaults. Name the source screen
  per value so the implementation step can't drift.

End with a **comparison table** scoring all proposals on the same axes —
problem coverage (which diagnosed problems each one fixes), implementation cost,
and consistency with existing screens — and a recommendation that follows from
the table, not from taste.

### 5. Publish as a design artifact

- Load `/artifact-design` before writing the page.
- One self-contained HTML file in the scratchpad directory, published via Artifact.
- Structure: 문제 진단 → 레퍼런스 카탈로그 (numbered, mockup + strengths + benchmark
  elements each) → 개선안 N개 (mockup + tradeoffs) → 추천안.
- Artifact body text is Korean (user-facing); keep it desktop-width friendly.
- Reply with the artifact link plus a 3–5 line summary of the diagnosis and the
  recommended proposal.

### 6. Leave a decision record (when a proposal is adopted)

The artifact lives on claude.ai, outside repo history. When the user adopts a
proposal and implementation follows, write `docs/ux/benchmark/<slug>.md`
(Korean allowed in this path) containing:

- Date, target screen, problem summary (with evidence grades)
- References actually used: name + URL + which element was borrowed
- Chosen proposal and why (the comparison-table rationale)
- Artifact URL and the implementation PR number

Commit this file **inside the implementation PR** so the design decision and the
code change share one history entry. Optionally also copy the artifact HTML to
`design/benchmark/` when the visual record itself is worth preserving.
Research that ends without adoption needs no record — the artifact URL is enough.

## Rules

- References must be real products, not invented composites (design-guide tracing rule).
- Relevance beats brand fame — a niche tool that solves the exact problem outranks
  a famous one that doesn't.
- Do not silently reuse research from a previous session if the target screen has
  changed since; re-verify against current code first.
- This skill is research-only: no app code changes. Implementation is a follow-up
  request (route to `/frontend-design` / `/feature-development`).
