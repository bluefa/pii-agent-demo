# Redesign notes

Per-screen redesign records. Each document states, for every change:
**before → after → what it fixed**. These are not specs — they are what was actually shipped and why,
so the next screen does not re-litigate decisions already made.

Documents may be written in Korean (this README must stay English — repo rule).

## Index

| Screen | Document | Status |
|---|---|---|
| Step 2 · approval waiting (`/pass/target-sources/{id}`) | [`step2-approval-waiting.md`](step2-approval-waiting.md) | shipped (PR #590) |
| Step 2 · live review session log | [`step2-review-session-log.md`](step2-review-session-log.md) | reference |
| Step 3 · applying approved (`/pass/target-sources/{id}`) | [`step3-applying-approved.md`](step3-applying-approved.md) | shipped |
| Text scale & spacing tokens | [`typography-and-spacing.md`](typography-and-spacing.md) | shipped (Step 4 applied) |

Step 3 (`ApplyingApprovedCard`) shares the toolbar, table and pagination with Step 2, so the Step 2
document also covers part of what changed there. Step 3's own pass then deleted every control that
was unique to it, so the two screens now run the same card.

## How these sessions run

The Step 2 redesign was done live against the running app, not from a written spec:

1. Start the dev server and open the real screen with mock data.
2. Ask for **one** change, apply it immediately, look at it, then decide the next one.
3. Run `npx eslint <file>` and `npx vitest run app/target-sources/` after each change.
4. Record the change in the screen's document as before → after → what it fixed.

Two things made this work. Small request units meant reverting cost almost nothing — one change
(centering table cells) was undone the moment it was on screen. And the test suite failed on every
label rename, which is how it kept surfacing which strings other code treats as a contract.

## Checklist for the next step

Ordered by how often it caught something real in Step 2.

**Delete before you design.** Every "does this need to be here?" in that session ended in a deletion:
percentages, color swatches, a duplicate filter segment, a duplicate row count, a reset button, a
status dot. If two controls carry the same information, one of them goes.

**Separate tiers by widening axes you already have** — weight, color, size, indentation — instead of
adding a new font size. And lowering a tier is not the same as fading it: drop size/weight and keep
contrast at 4.5:1. Measure it; three regressions in Step 2 were introduced by the hierarchy edits
themselves and only found by measuring.

**A column header is a question, the cell is the answer.** `연동 대상` containing the value `대상` was
half the answer in the header. Also check the value reads forward into the next column
(`제외` → `제외 사유`).

**Color, badges and tags are signals — match them to real risk and real importance.** A red trash
button for an action that only rewinds a step teaches the wrong thing. One badge per row is the
budget; a second one competes with the verdict.

**Ask what breaks at 20 rows / 20 options — and at one long value.** Mock fixtures hide wrapping,
scrolling and truncation. A fixture whose column is *empty* means that column's width has never been
tested at all: Step 2 shipped with no exclusion reasons, and the same column overflowed the table
horizontally the moment Step 3 fed it real ones.

**When a value looks wrong, suspect the data source, not the styling.** The Database Type filter
listing `RDS_CLUSTER` while cells showed `PostgreSQL` was a real bug (two different fields) found
inside a request to make the filter prettier.

**A column with no source in the swagger is not a column.** Grep the generated contract before
styling a value. Step 3's `연동 이력` column, its status filter and a progress counter were all fed by
`integration_status`, which only the mock generates — in production the column is empty and the
counter is permanently zero. Deleting the three of them removed both `variant` props and 339 lines.
Check what the tests guard, too: all four tests over that column existed to pin an off-contract field.

**"Make it stand out more" is usually a contrast problem, not a background problem.** A row
highlight marks position; it does not make the row easier to read. Lifting the row's secondary text
toward near-black on hover took it from 6.45:1 to 15.0:1, which is what the request actually meant.
Measure the resting state first — the tint that was already there scored 1.06:1 against white, and
excluded rows had no hover at all because their tint class replaced the hover class outright. Mirror
whatever you add onto `focus-within`, or keyboard users get none of it.

**Emphasis: use the axis that still has headroom, per column — and only one of them.** The anchor
column was inert on hover because its neutral color was already maxed (15.9:1), so it switched
color *family* instead (neutral to brand). Weight was available too — it is free in a monospace
column, since Geist Mono's advance width is weight-invariant (measured 520.80px at 400 vs 520.79px
at 700), while the proportional column beside it widens 4% at the same change. Available is not the
same as worth using: color plus weight on the one differently-colored cell in a row reads as
shouting. Measure the font to learn which axes are safe, then still spend one.

**A tooltip that repeats what is already on screen is an obstacle, not a hint.** Show the
full-value tip only when the cell is actually clipped, and measure that at open time
(`scrollWidth > clientWidth`) rather than watching every cell. Check the clipping container AND its
child: one of them can report no overflow while the other is clipped by 4x.

**A tooltip carrying a bare value does not say which field it belongs to** — the trigger that
opened it is behind the box. Title it with the field name, and split the two tiers on size as well
as color. Identifiers also need `break-all`: an ARN has no spaces, so default wrapping runs it
straight out of a fixed-width popover.

**Reusing a component is not the same as reusing its variant.** The dark popover here was authored
to explain a state; pointing it at a clipped cell value made it read as UI from another system
sitting on a white table. Add a variant rather than restyling the existing one — the old ones were
transcribed from a spec and still correct where they are. When a variant introduces a border, the
rotated-square arrow needs edges on its two outward faces only, and its offset shifts by the border
width — guard that shift so borderless variants keep their exact original geometry.

**Sweep the whole surface, do not spot-check the thing you just touched.** Raising one label to AA
while never measuring the card around it is how a fresh violation ships in the same commit. Walk
every text node against its *effective* background — the parent chain, not "white" — and the count
is what it is: 7 of 73 here, one of them newly introduced.

**Brand blue is not automatically accessible on a tinted row.** #0064FF passes on white (4.92:1)
and fails on the hover background (4.46:1); 14px stays under the large-text threshold even at
semibold, so 4.5:1 still applies. The dark primary already in the palette holds 6.11:1.

**Measure before you restyle.** "These values feel too heavy" was, on inspection, byte-identical
typography to the screen it was being compared against — the weight came from values wrapping to
2–3 lines and leaving row heights ragged. Dump the computed styles of both screens before changing
a token. And when the perceived problem is visual weight, suspect layout (line count, row height)
before font size, color or family.

**Assert state only after the data that decides it lands.** Rendering a status tag and its
supporting sentence before the fetch resolves lets the header contradict what appears under it.
Hold them behind skeletons — but only the parts the response decides; the step number and the title
are already settled by the time the card mounts.

**Left-align data tables.** Aligned starting characters are the scan baseline; centering only pays
off for a column whose values are uniformly short (a single badge).

**Shared tokens repaint other screens.** `idcStyles.table.*`, `Pagination`, `identityBarStyles` were
left alone on purpose. Touch them only as a deliberate, separately verified change (`cardStyles.cardTitle`
tracking was one, and it hits 18 call sites).

**Step position comes from the code.** Write the step number from `INSTALL_STEPS`, not from counting
what is on screen.

**`cn` is a plain join, not tailwind-merge.** Layering conflicting utilities leaves the winner to CSS
order — declare the final value on the element instead.

## Adding a document

Name it after the screen (`stepN-<screen>.md`). Keep the before/after tables; they are what makes the
record usable later. End with a follow-ups checklist for anything knowingly left undone.
