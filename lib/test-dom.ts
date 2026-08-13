/**
 * Test-only DOM narrowing.
 *
 * `closest()`, `querySelector()` and `getAttribute()` are all `T | null`, and a test that writes
 * `as HTMLElement` over that is asserting a fact it has not checked (anti-pattern A2). When the
 * markup moves, the assertion turns the failure into `Cannot read properties of null` somewhere
 * further down instead of naming what went missing.
 *
 * Prefer a semantic query (`getByRole`) — it narrows and throws on its own. Reach for this only
 * where the thing being reached for has no role of its own: a wrapping cell, a row, an element
 * addressed by `aria-controls`.
 */
export const required = <T>(value: T | null | undefined, what: string): T => {
  if (value == null) throw new Error(`test expected ${what} to exist, found none`);
  return value;
};
