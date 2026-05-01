# T1. Exception-handling tests must cover atypical reject values

Severity: 🔴 critical

When a `catch` branches on the caught value's shape (`instanceof` / `name` / `message` / `code`), test fixtures must reject with values **other than the expected shape** — string, plain object, custom class. A test that only mocks the "expected" shape cannot detect a broken discriminator.

The trigger for this rule was PR #449: a `fetch()` rejecting with a string (from `controller.abort('TIMEOUT')`) was never tested, so the broken `instanceof DOMException` branch (see **AP-F5**) shipped to production.

```ts
// ❌ Bad — only the "expected" reject shape is tested
it('aborts gracefully', async () => {
  fetchMock.mockRejectedValueOnce(new DOMException('aborted', 'AbortError'));
  await expect(load()).resolves.toBeUndefined();
});

// ✅ Good — discriminator is exercised on every plausible reject shape
it.each([
  ['DOMException AbortError', new DOMException('aborted', 'AbortError')],
  ['string reason from controller.abort("X")', 'TIMEOUT'],
  ['custom Error with name=AbortError', Object.assign(new Error('x'), { name: 'AbortError' })],
  ['plain object', { name: 'AbortError' }],
])('aborts gracefully when fetch rejects with %s', async (_, value) => {
  fetchMock.mockRejectedValueOnce(value);
  await expect(load()).resolves.toBeUndefined();
});
```

## When this rule applies

- Any `catch` block that branches on `instanceof`, `err.name`, `err.code`, or `err.message`.
- Wrappers around external APIs whose reject values are not contractually fixed: `fetchJson`, `useApiMutation`, polling helpers, third-party SDK adapters.
- For each discriminator key the catch reads, include at least two reject shapes per test suite (the expected shape plus one atypical shape).

## Why

- TypeScript does not type Promise reject values (`Promise<T>` rejects as `any`).
- Browsers, libraries, and the network layer can reject with arbitrary shapes; the catch must handle them deterministically.
- Mocking only the "expected" shape gives false confidence: the test passes even when the production discriminator is wrong.

## Reference
- PR #449 — fetch-json string-reason abort regression
- AP-F5 — Abort detection via `instanceof DOMException`
- AP-F2 — `try/catch` silent swallow
