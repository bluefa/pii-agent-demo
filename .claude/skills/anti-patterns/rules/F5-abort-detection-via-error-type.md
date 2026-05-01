# F5. Abort detection via `instanceof DOMException`

Severity: 🔴 critical

`AbortController.abort(reason)` accepts any `reason`. When `reason` is a string, Chrome's `fetch()` rejects with that string verbatim — not a `DOMException`. Detecting abort by the caught value's shape (`instanceof` / `name` / `message`) is therefore unreliable.

The only deterministic signal is `controller.signal.aborted`.

```ts
// ❌ Bad — false when controller.abort('TIMEOUT') was used
try { await fetch(url, { signal: controller.signal }); }
catch (err) {
  if (err instanceof DOMException && err.name === 'AbortError') return;
  throw err;
}

// ✅ Good — works regardless of reject value shape
try { await fetch(url, { signal: controller.signal }); }
catch (err) {
  if (controller.signal.aborted) return;
  throw err;
}
```

## CSR callers

CSR code calls `fetchJson` (which now classifies abort correctly into `AppError { code: 'ABORTED' }`). Callers must guard with the structured code, never `instanceof DOMException`:

```ts
// ✅ Good — caller side
.catch((error: unknown) => {
  if (error instanceof AppError && error.code === 'ABORTED') return;
  // or: ignoreAborted(error)  -- see lib/errors.ts
  setState({ status: 'error', message: getErrorMessage(error) });
});
```

## Why this slipped past review

- TypeScript does not type a Promise's reject value (it is `any`).
- Unit tests mocking `DOMException('AbortError')` pass even when the production catch-branch is broken — see **AP-T1** for the test rule that closes this gap.
- Browser-level reject shapes vary; relying on any one shape is fragile.

## Reference
- PR #449 — fix(fetch-json): treat string abort reason as ABORTED, not UNKNOWN
- `lib/fetch-json.ts` — current correct implementation
- `lib/errors.ts` — `ignoreAborted` helper
