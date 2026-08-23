// @vitest-environment jsdom
import { fireEvent, render, waitFor } from '@testing-library/react';
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

/** `Probe` with `id` declared session-only — the shape a `ConsoleTable` flex column takes.
 *  Reads a second column too, so a test can tell "nothing hydrated" from "id was dropped". */
const EphemeralProbe = ({ storageKey }: { storageKey?: string }) => {
  const columns = useColumnResize({ clampToContent: true, storageKey, ephemeralKeys: ['id'] });
  return (
    <>
      <span data-testid="w">{String(columns.widthOf('id')?.width ?? 'unset')}</span>
      <span data-testid="region">{String(columns.widthOf('region')?.width ?? 'unset')}</span>
    </>
  );
};

/** `EphemeralProbe` in a real table, so the keyboard path has a `<th>` to measure and the
 *  widths can be driven the way a user drives them. jsdom reports 0 for every box, so the
 *  resulting numbers are the hook's floors — which is all these tests read. */
const ResizableProbe = ({ storageKey }: { storageKey?: string }) => {
  const columns = useColumnResize({ clampToContent: true, storageKey, ephemeralKeys: ['id'] });
  return (
    <>
      <table>
        <thead>
          <tr>
            {(['id', 'region'] as const).map((key) => (
              <th key={key} style={{ position: 'relative' }}>
                <span {...columns.handleProps(key, key)} />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>a</td>
            <td>b</td>
          </tr>
        </tbody>
      </table>
      <span data-testid="w">{String(columns.widthOf('id')?.width ?? 'unset')}</span>
      <span data-testid="region">{String(columns.widthOf('region')?.width ?? 'unset')}</span>
    </>
  );
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

  /**
   * Round 19. The flex column's width is session-only: stored, it would take that column out
   * of `flex`, so the table stops following the container on every future visit with nothing
   * on screen saying why. Both directions matter — this was found on a browser holding a
   * value written before the rule existed, so filtering only the write-back would have left
   * that reader stuck for one more load every time.
   */
  it('never hydrates an ephemeral key, even from a value stored before the rule', async () => {
    localStorage.setItem(KEY_A, JSON.stringify({ id: 381, region: 200 }));
    const { getByTestId } = render(<EphemeralProbe storageKey={KEY_A} />);
    // `region` proves the read itself still works; `id` stays unset because it is the sink.
    await waitFor(() => expect(getByTestId('region').textContent).toBe('200'));
    expect(getByTestId('w').textContent).toBe('unset');
  });

  it('keeps a RESIZED ephemeral key out of storage while persisting its siblings', async () => {
    // Both columns are actually resized here. Asserting on a hydrated-only state would pass
    // with the write-back filter deleted — `id` never reaches `widths` in that case, so the
    // test proves nothing about the write. (Confirmed: that version survived the mutation.)
    localStorage.setItem(KEY_A, JSON.stringify({ region: 200 }));
    const { getByTestId, getAllByRole } = render(<ResizableProbe storageKey={KEY_A} />);
    // Waiting on the hydrated sibling is also waiting on the write-back gate to open.
    await waitFor(() => expect(getByTestId('region').textContent).toBe('200'));
    fireEvent.keyDown(getAllByRole('separator')[0], { key: 'ArrowRight' });
    // The width is live for this session…
    await waitFor(() => expect(getByTestId('w').textContent).not.toBe('unset'));
    // …but only the sized one is written down.
    await waitFor(() => {
      const stored = JSON.parse(localStorage.getItem(KEY_A) ?? '{}') as Record<string, number>;
      expect(Object.keys(stored)).toEqual(['region']);
    });
  });
});
