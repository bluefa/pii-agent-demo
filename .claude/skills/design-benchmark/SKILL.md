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

Output: a numbered problem list, each with the concrete evidence (file/screen location).

### 2. Collect external references

Find N real products/design systems that solve the *same class* of problem.
Order by relevance — most related first, and say why each was picked.

- Search broadly (WebSearch), then read pages (WebFetch) for specifics.
- Prefer top products with real, inspectable UI: Linear, Vercel, Stripe, AWS/GCP/Azure
  consoles, Retool, Datadog, Plaid, shadcn/carbon/polaris/cloudscape docs, Toss, etc.
- For each reference capture: **what problem it solves, how (the concrete mechanism),
  and which elements are worth benchmarking** (at least 5 benchmarkable elements
  across the whole set; per-reference strengths written out).

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

End with a recommendation: which proposal to take and why.

### 5. Publish as a design artifact

- Load `/artifact-design` before writing the page.
- One self-contained HTML file in the scratchpad directory, published via Artifact.
- Structure: 문제 진단 → 레퍼런스 카탈로그 (numbered, mockup + strengths + benchmark
  elements each) → 개선안 N개 (mockup + tradeoffs) → 추천안.
- Artifact body text is Korean (user-facing); keep it desktop-width friendly.
- Reply with the artifact link plus a 3–5 line summary of the diagnosis and the
  recommended proposal.

## Rules

- References must be real products, not invented composites (design-guide tracing rule).
- Relevance beats brand fame — a niche tool that solves the exact problem outranks
  a famous one that doesn't.
- Do not silently reuse research from a previous session if the target screen has
  changed since; re-verify against current code first.
- This skill is research-only: no app code changes. Implementation is a follow-up
  request (route to `/frontend-design` / `/feature-development`).
