# v15 Step Progress Bar (`.pbar` / stepper) — EXACT extract

> Source: `design/SIT Prototype Athena v15.html`. CSS block lines **1615–1698**
> (2nd `<style>`), JS constants lines **8783–8816**. Resolver:
> `design/v15-extract/00-tokens.md`. Values transcribed verbatim — no rounding.
> The only `var(--x)` used in this component is `--font-mono` on the circle.
>
> Markup (built at runtime, lines 8847–8902):
> `<ol class="pbar" id="pbar" role="list" aria-label="설치 진행 단계">` (line 5636) →
> `li.pbar__item` → `div.pbar__col` → `div.circle` (+ two `span.layer`: number, checkmark) +
> `span.label`; sibling `div.connector` → `div.connector__fill` (omitted on last item).

---

## 1. `.pbar` — container `<ol>` (lines 1616–1622)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `list-style` | `none` | none | 1617 |
| `margin` | `0` | 0 | 1618 |
| `padding` | `0` | 0 | 1618 |
| `display` | `grid` | grid | 1619 |
| `grid-template-columns` | `repeat(7, minmax(0, 1fr))` | 7 equal columns | 1620 |
| `align-items` | `start` | start | 1621 |

Note: exactly **7** columns — matches the 7 `PBAR_LABELS`.

---

## 2. `.pbar__item` — each `<li>` (lines 1623–1630)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `relative` | relative | 1624 |
| `display` | `flex` | flex | 1625 |
| `align-items` | `flex-start` | flex-start | 1626 |
| `justify-content` | `center` | center | 1627 |
| `min-width` | `0` | 0 | 1628 |
| `cursor` | `pointer` | pointer | 1629 |

---

## 3. `.pbar__col` — inner column wrapper (lines 1631–1638)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `display` | `flex` | flex | 1632 |
| `flex-direction` | `column` | column | 1633 |
| `align-items` | `center` | center | 1634 |
| `width` | `100%` | 100% | 1635 |
| `position` | `relative` | relative | 1636 |
| `z-index` | `2` | 2 | 1637 |

---

## 4. `.pbar .circle` — node, **pending (base)** state (lines 1639–1651)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `relative` | relative | 1640 |
| `width` | `40px` | 40px | 1641 |
| `height` | `40px` | 40px | 1641 |
| `border-radius` | `50%` | 50% | 1642 |
| `display` | `grid` | grid | 1643 |
| `place-items` | `center` | center | 1644 |
| `font-family` | `var(--font-mono)` | `'Geist Mono', ui-monospace, 'SF Mono', Menlo, Monaco, Consolas, monospace` | 1645 |
| `font-size` | `12px` | 12px | 1646 |
| `font-weight` | `600` | 600 | 1647 |
| `transition` | `box-shadow 200ms ease` | box-shadow 200ms ease | 1648 |
| `background` | `#F3F4F6` | #F3F4F6 (= `--gray-100`) | 1649 |
| `color` | `#9CA3AF` | #9CA3AF (= `--gray-400` / `--color-pending`) | 1650 |

No `border` declared. No `letter-spacing` / `line-height` declared. `letter-spacing`
inherits the global `-0.018em` (body line 576), NOT `normal`. The circle's
`font-family` is the explicit `var(--font-mono)` override above (not inherited).

### 4a. `.pbar .circle.is-current` — **current** node (line 1652)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `#0064FF` | #0064FF (= `--color-primary`) | 1652 |
| `color` | `#fff` | #FFFFFF | 1652 |
| `box-shadow` | `0 0 0 6px rgba(0,100,255,0.10)` | 6px ring, primary @ 10% alpha (this is the "glow") | 1652 |

The current-step **glow** is this 6px box-shadow ring; it animates via the
inherited `transition: box-shadow 200ms ease` (line 1648).

### 4b. `.pbar .circle.is-completed` — **completed** node (line 1653)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `background` | `#45CB85` | #45CB85 (= `--color-success`) | 1653 |
| `color` | `#fff` | #FFFFFF | 1653 |

No box-shadow on completed (current-only glow).

---

## 5. `.pbar .circle .layer` — number/check stacking layer (lines 1654–1658)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `absolute` | absolute | 1655 |
| `inset` | `0` | 0 | 1655 |
| `display` | `grid` | grid | 1656 |
| `place-items` | `center` | center | 1656 |
| `transition` | `none` | none (comment: "RAF drives opacity") | 1657 |

Two `.layer` spans per circle: number layer (`textContent` = `String(i+1).padStart(2,'0')`,
e.g. `01`) and checkmark layer. Opacity is set inline by JS — number `opacity: 1`
when not completed / `0` when completed; check `opacity: 1` when completed / `0`
otherwise (lines 8870, 8876).

---

## 6. `.pbar .circle .layer svg` — checkmark glyph (lines 1659–1662)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `width` | `16px` | 16px | 1660 |
| `height` | `16px` | 16px | 1660 |
| `stroke` | `currentColor` | inherits circle `color` (#fff when completed) | 1661 |
| `stroke-width` | `2.5` | 2.5 | 1661 |
| `fill` | `none` | none | 1661 |

Checkmark SVG markup (line 8816):
`<svg viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/></svg>`

---

## 7. `.pbar .label` — step label text, **pending (base)** (lines 1663–1673)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `margin-top` | `10px` | 10px | 1664 |
| `font-size` | `12px` | 12px | 1665 |
| `font-weight` | `500` | 500 | 1666 |
| `color` | `#9CA3AF` | #9CA3AF (= `--gray-400`) | 1667 |
| `text-align` | `center` | center | 1668 |
| `line-height` | `1.35` | 1.35 | 1669 |
| `max-width` | `130px` | 130px | 1670 |
| `word-break` | `keep-all` | keep-all | 1671 |
| `transition` | `color 220ms ease` | color 220ms ease | 1672 |

No `letter-spacing` declared → inherits the global `-0.018em` (body line 576),
NOT `normal`. `font-family` inherited (not the mono override — that's circle-only),
so it resolves to `Geist` (inline body 5168; the **body line-572 stack**
`'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Pretendard', sans-serif`
is the fallback chain), NOT `--font-sans` (which additionally lists `'Malgun Gothic'` / `system-ui`).

### 7a. `.pbar .label.is-current` — **current** label (line 1674)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `#0064FF` | #0064FF (= `--color-primary`) | 1674 |
| `font-weight` | `600` | 600 | 1674 |

### 7b. `.pbar .label.is-completed` — **completed** label (line 1675)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `color` | `#2A7D52` | #2A7D52 (= `--color-success-dark`) | 1675 |
| `font-weight` | `500` | 500 | 1675 |

Note: completed label color `#2A7D52` differs from the completed circle
background `#45CB85` (deliberate — darker green text for contrast).

---

## 8. `.pbar .connector` — track line (lines 1676–1686)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `absolute` | absolute | 1677 |
| `top` | `19px` | 19px | 1678 |
| `left` | `calc(50% + 24px)` | 50% + 24px | 1679 |
| `right` | `calc(-50% + 24px)` | -50% + 24px | 1680 |
| `height` | `2px` | 2px | 1681 |
| `background` | `#E5E7EB` | #E5E7EB (= `--gray-200` / `--border-default`) | 1682 |
| `border-radius` | `2px` | 2px | 1683 |
| `overflow` | `hidden` | hidden | 1684 |
| `z-index` | `1` | 1 | 1685 |

`top: 19px` centers the 2px line on the 40px circle's vertical mid (≈ 20px).
Connector is rendered for every item except the last (line 8889).

---

## 9. `.pbar .connector__fill` — animated fill, **base** (lines 1687–1694)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `position` | `absolute` | absolute | 1688 |
| `inset` | `0` | 0 | 1688 |
| `background` | `#45CB85` | #45CB85 (= `--color-success`) | 1689 |
| `border-radius` | `2px` | 2px | 1690 |
| `transform` | `scaleX(0)` | scaleX(0) — empty by default | 1691 |
| `transform-origin` | `left center` | left center | 1692 |
| `will-change` | `transform` | transform | 1693 |

No CSS `transition` on the fill — the wave-front animation is driven by
`requestAnimationFrame` in JS (the `.is-completed` class is the static fallback).

### 9a. `.pbar .connector__fill.is-completed` — **completed** fill (line 1695)

| property | literal | resolved | v15 line |
|---|---|---|---|
| `transform` | `scaleX(1)` | scaleX(1) — full | 1695 |

---

## 10. Reduced-motion override (lines 1696–1698)

`@media (prefers-reduced-motion: reduce)` →
`.pbar .label, .pbar .circle { transition: none !important; }` (line 1697).
Disables the label color and circle box-shadow transitions only.

---

## 11. JS constants — labels, colors, motion timing (lines 8783–8816)

### `PBAR_LABELS` (lines 8783–8791) — 7 steps, in order

| idx (1-based) | label (literal) |
|---|---|
| 1 | `연동 대상 DB 선택` |
| 2 | `연동 대상 승인 대기` |
| 3 | `연동 대상 반영중` |
| 4 | `Agent 설치` |
| 5 | `연결 테스트` |
| 6 | `관리자 승인 대기` |
| 7 | `완료` |

### `PBAR_MOTION` (lines 8792–8806)

| key | literal value | v15 line | meaning |
|---|---|---|---|
| `fillMsMin` | `420` | 8793 | min connector fill duration (ms) |
| `fillMsMax` | `1200` | 8794 | max connector fill duration (ms) |
| `circleMs` | `180` | 8795 | circle state transition (ms) |
| `iconCrossfadeMs` | `220` | 8796 | number↔check crossfade (ms) |
| `visualHandoff` | `0.98` | 8797 | fill→circle handoff progress (0–1) |
| `slowFactor` | `3` | 8798 | "slow version: ×3" — multiplies fill/circle/icon durations |

### `PBAR_MOTION.colors` (lines 8799–8805) — state colors

| key | literal | resolved | v15 line | matches CSS |
|---|---|---|---|---|
| `pendingBg` | `#F3F4F6` | --gray-100 | 8800 | circle base bg (1649) |
| `currentBg` | `#0064FF` | --color-primary | 8801 | `.is-current` bg (1652) |
| `completedBg` | `#45CB85` | --color-success | 8802 | `.is-completed` bg (1653) |
| `pendingText` | `#9CA3AF` | --gray-400 | 8803 | circle base text (1650) |
| `activeText` | `#FFFFFF` | white | 8804 | `#fff` current/completed text |

Effective durations (slowmo path, used by this prototype):
fill = `clamp(420, computed, 1200) × 3`; circle = `180 × 3 = 540ms`;
icon crossfade = `220 × 3 = 660ms` (lines 8972–8978).

Easing functions (lines 8807–8809): fill uses `_easeOutQuart` (`1-(1-t)^4`);
circle/icon use `_easeOutCubic` (`1-(1-t)^3`). Color interpolation via `_mixHex`
(linear RGB lerp, line 8812).

---

## Ambiguities / inherited / computed (per rules)

- **`.circle` font-family** is the ONLY `var()` in the block: `var(--font-mono)`
  → resolved from 00-tokens.md to the Geist Mono stack. Labels do NOT get mono
  (no font-family declared on `.label`) — they inherit `Geist` (inline body 5168;
  the **body line-572 stack** `'Geist', -apple-system, BlinkMacSystemFont, 'Apple SD
  Gothic Neo', 'Pretendard', sans-serif` is the fallback chain), NOT `--font-sans`.
- **`.circle` letter-spacing**: not declared → inherits the global `-0.018em`
  (body line 576), NOT `normal`. **line-height**: not declared → browser initial.
  The number text `01`–`07` is centered via `place-items: center`.
- **`.label` letter-spacing**: not declared → inherits the global `-0.018em`
  (body line 576), NOT `normal`.
- **`.label` font-family**: inherited (not the mono override) → `Geist` (inline body
  5168; the **body line-572 stack** is the fallback chain, NOT `--font-sans`, which
  additionally lists `'Malgun Gothic'` / `system-ui`).
- **`.circle` has NO `border`** in any state — pending look is bg + text color only.
- **Glow** = `box-shadow: 0 0 0 6px rgba(0,100,255,0.10)` on `.is-current` ONLY
  (line 1652). `rgba(0,100,255,...)` equals `--color-primary` #0064FF in rgb.
  It is NOT a keyframe animation — it eases in via the circle's
  `transition: box-shadow 200ms ease`.
- **Connector fill animation**: no CSS `transition`/`@keyframes`; driven by RAF
  in JS (`PBAR` object, lines 8835+). The `.is-completed` scaleX(1) is the
  static end-state / fallback. Real-time durations come from `PBAR_MOTION`
  (slowFactor ×3 applied for this "slow-mo wave-front" prototype).
- **`pendingBg`/`pendingText`/`currentBg`/`completedBg`** in JS duplicate the CSS
  literals exactly — no divergence found.
- **Completed label vs circle green differ**: label `#2A7D52` (success-dark),
  circle bg `#45CB85` (success) — both literal, intentional, not an error.
