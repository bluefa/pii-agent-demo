// @vitest-environment jsdom
import { render, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { useColumnResize } from '@/app/components/ui/useColumnResize';

/**
 * The persistence path had no coverage at all, which is how a whole class of storage bugs
 * reached review. These tests exercise it through the public hook — no internals.
 *
 * Widths hydrate one macrotask after mount (`setTimeout(0)`, deliberately not rAF), so every
 * assertion about a stored value waits rather than reading synchronously.
 */
const Probe = ({ storageKey }: { storageKey?: string }) => {
  const columns = useColumnResize({ clampToContent: true, storageKey });
  return <span data-testid="w">{String(columns.widthOf('id')?.width ?? 'unset')}</span>;
};

const KEY_A = 'pii:colw:test:a';
const KEY_B = 'pii:colw:test:b';

/**
 * jsdom here exposes a `localStorage` with NO methods (`getItem` and `setItem` are both
 * `undefined`, verified against jsdom 29.0.2 in this config). Every call therefore throws a
 * TypeError that the hook's own `catch` swallows — which is exactly why this feature could
 * ship with no coverage. A real in-memory Storage has to be installed before any of it is
 * observable. The property is a configurable getter, so it can be replaced outright.
 */
const store = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    get length() {
      return store.size;
    },
  },
});

describe('useColumnResize persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('hydrates a stored width one task after mount', async () => {
    localStorage.setItem(KEY_A, JSON.stringify({ id: 220 }));
    const { getByTestId } = render(<Probe storageKey={KEY_A} />);
    // Not on first paint: server and client have to agree on the class-owned defaults.
    expect(getByTestId('w').textContent).toBe('unset');
    await waitFor(() => expect(getByTestId('w').textContent).toBe('220'));
  });

  it('ignores a malformed or non-numeric stored value instead of throwing', async () => {
    localStorage.setItem(KEY_A, '{ not json');
    const { getByTestId, rerender } = render(<Probe storageKey={KEY_A} />);
    await waitFor(() => expect(getByTestId('w').textContent).toBe('unset'));

    localStorage.setItem(KEY_A, JSON.stringify({ id: 'wide' }));
    rerender(<Probe storageKey={KEY_A} />);
    await waitFor(() => expect(getByTestId('w').textContent).toBe('unset'));
  });

  // A second key is a second TABLE. Writing before the new key has hydrated stamps the previous
  // table's widths onto it — and because the write-back also persists them, the corruption is
  // permanent. Unreachable while every caller passes a literal, but the option's contract says
  // a key is just a key, and the obvious next change (scoping the key per target source, which
  // the round-14 defect note asks for) walks straight into it.
  it('does not stamp the previous key\'s widths onto a new key', async () => {
    localStorage.setItem(KEY_A, JSON.stringify({ id: 220 }));
    const { getByTestId, rerender } = render(<Probe storageKey={KEY_A} />);
    await waitFor(() => expect(getByTestId('w').textContent).toBe('220'));

    rerender(<Probe storageKey={KEY_B} />);
    await waitFor(() => expect(localStorage.getItem(KEY_A)).toBe(JSON.stringify({ id: 220 })));
    // KEY_B owns no widths yet: nothing has been resized on that table.
    expect(localStorage.getItem(KEY_B)).toBeNull();
  });

  it('writes nothing at all when no storageKey is given', async () => {
    const { getByTestId } = render(<Probe />);
    await waitFor(() => expect(getByTestId('w').textContent).toBe('unset'));
    expect(localStorage.length).toBe(0);
  });
});
