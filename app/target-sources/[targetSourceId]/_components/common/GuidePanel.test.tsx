// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, it, expect, vi } from 'vitest';

vi.mock('@/app/components/features/process-status/GuideCard/GuideCardContainer', () => ({
  GuideCardContainer: () => <div data-testid="guide-card" />,
}));

import { GuidePanel } from '@/app/target-sources/[targetSourceId]/_components/common/GuidePanel';

const baseProps = {
  slotKey: null,
} as const;

const STORAGE_KEY = 'pii:rail:v1:guide';

/**
 * jsdom here exposes a `localStorage` with NO methods — `getItem`/`setItem` are both
 * `undefined`. Every call throws a TypeError that `useRailCollapse`'s own `catch`
 * swallows, so without this the fold would silently never persist and every assertion
 * below would still pass on the width default. A real in-memory Storage has to be
 * installed before any of it is observable. (Same footgun, same fix, as
 * `useColumnResize.test.tsx` — the property is a configurable getter, so it can be
 * replaced outright.)
 */
const store = new Map<string, string>();
Object.defineProperty(window, 'localStorage', {
  configurable: true,
  value: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, String(value)),
    removeItem: (key: string) => void store.delete(key),
    clear: () => store.clear(),
  },
});

/** jsdom reports 1024, i.e. under RAIL_OPEN_MIN_WIDTH — set it per test rather than
 *  inheriting whichever side of the default a given machine happens to land on. */
const setViewportWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
};

/**
 * The fold resolves on a `setTimeout(0)` after mount. Until it does, BOTH halves are
 * mounted and the media query arbitrates — so "settled" is exactly when one fold control
 * is left instead of two.
 */
const settled = () =>
  waitFor(() =>
    expect(screen.getAllByRole('button', { name: /가이드 (접기|펼치기)/ })).toHaveLength(1),
  );

beforeEach(() => {
  localStorage.clear();
  setViewportWidth(1440);
});

describe('GuidePanel — collab-channel card states', () => {
  it('renders the explicit 미연결 state when no Jira ticket is mapped (404 → null)', () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy();
    expect(screen.getByText('아직 연결된 협업 채널이 없어요')).toBeTruthy();
    expect(screen.queryByTitle('협업 채널 — Jira에서 논의하기')).toBeNull();
  });

  it('renders a distinct error row on fetch failure — never the 미연결 state', () => {
    render(<GuidePanel {...baseProps} jiraTicket="error" />);
    expect(screen.getByText('협업 채널 정보를 불러오지 못했어요')).toBeTruthy();
    expect(screen.queryByText('아직 연결된 협업 채널이 없어요')).toBeNull();
  });

  it('links the mapped issue key (owner ask: blue underlined hyperlink)', () => {
    render(
      <GuidePanel
        {...baseProps}
        jiraTicket={{ issueKey: 'PII-42', browseUrl: 'https://jira.example.com/browse/PII-42' }}
      />,
    );
    const link = screen.getByTitle('협업 채널 — Jira에서 논의하기') as HTMLAnchorElement;
    expect(link.getAttribute('href')).toBe('https://jira.example.com/browse/PII-42');
    expect(link.getAttribute('target')).toBe('_blank');
    const key = screen.getByText('PII-42');
    expect(key.className).toContain('underline');
  });

  it('browseUrl 이 없으면 링크를 지어내지 않고 키만 보여준다', () => {
    render(<GuidePanel {...baseProps} jiraTicket={{ issueKey: 'PII-42', browseUrl: null }} />);
    expect(screen.queryByTitle('협업 채널 — Jira에서 논의하기')).toBeNull();
    expect(screen.getByText('PII-42')).toBeTruthy();
  });
});

describe('GuidePanel — the rail folds, it does not vanish', () => {
  // The defect this replaces: `hidden … min-[1360px]:flex` meant the viewport decided
  // whether the rail EXISTED, and this file is the only render site for the guide, the
  // history, the Jira channel and (formerly) 인프라 삭제. `hidden` is `display:none`, so
  // below 1360px all of them left the accessibility tree with no way back.
  it('mounts at a narrow viewport instead of being display:none', async () => {
    setViewportWidth(1280);
    const { container } = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    const aside = container.querySelector('aside');
    expect(aside).toBeTruthy();
    const classes = aside?.className.split(/\s+/) ?? [];
    // ⛔ Neither of these may come back: `hidden` removes the rail outright and the
    // breakpoint variant is what used to make the viewport the authority.
    expect(classes).not.toContain('hidden');
    expect(classes.some((c) => c.startsWith('min-[1360px]:'))).toBe(false);
    // Narrow ⇒ folded by default, and the control that unfolds it is on screen.
    expect(screen.getByRole('button', { name: '가이드 펼치기' })).toBeTruthy();
  });

  it('starts open at 1360px and above', async () => {
    setViewportWidth(1360);
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();
    expect(screen.getByRole('button', { name: '가이드 접기' })).toBeTruthy();
    expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy();
  });

  it('folds and unfolds on press, taking the rail body with it', async () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();

    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    await waitFor(() => expect(screen.queryByText('도움이 필요하신가요?')).toBeNull());

    fireEvent.click(screen.getByRole('button', { name: '가이드 펼치기' }));
    await waitFor(() => expect(screen.getByText('도움이 필요하신가요?')).toBeTruthy());
  });

  it('remembers the fold across mounts, and a press beats the width default', async () => {
    // Wide, so the default is open — then fold it and prove the preference outranks
    // the breakpoint on the next visit rather than the rail springing back.
    const first = render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();
    fireEvent.click(screen.getByRole('button', { name: '가이드 접기' }));
    await waitFor(() => expect(localStorage.getItem(STORAGE_KEY)).toBe('1'));
    first.unmount();

    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();
    expect(screen.getByRole('button', { name: '가이드 펼치기' })).toBeTruthy();
  });

  it('falls back to the width default when the stored value is not one it wrote', async () => {
    // A restored value that skipped the gesture's invariants is how a rail comes back in
    // a state no press could have produced — so anything but '1'/'0' is not a preference.
    localStorage.setItem(STORAGE_KEY, 'true');
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();
    expect(screen.getByRole('button', { name: '가이드 접기' })).toBeTruthy();
  });
});

describe('GuidePanel — 인프라 삭제 is not on the rail', () => {
  it('holds no destructive action, so folding cannot take one off the screen', async () => {
    render(<GuidePanel {...baseProps} jiraTicket={null} />);
    await settled();
    // ⛔ Putting it back here fails this. The rail folds and used to disappear entirely;
    // the only copy of an irreversible action cannot live on a surface that can go away.
    // It renders at the foot of the content column instead — see
    // CloudTargetSourceLayout.coverage.test.tsx.
    expect(screen.queryByRole('button', { name: '인프라 삭제' })).toBeNull();
  });
});
