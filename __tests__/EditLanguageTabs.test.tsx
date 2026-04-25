/**
 * Tests for `EditLanguageTabs` (W3-b §Step 3).
 *
 * The component is presentational — `useRef` / `useCallback` are
 * harmless under `renderToStaticMarkup`. Each case asserts the visible
 * "filled / empty" label so the dot rendering survives token swaps.
 */

import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { EditLanguageTabs } from '@/app/integration/admin/guides/components/EditLanguageTabs';

const noop = (): void => undefined;

describe('EditLanguageTabs — selection', () => {
  it('marks the active tab with aria-selected="true"', () => {
    const html = renderToStaticMarkup(
      <EditLanguageTabs value="ko" onChange={noop} koFilled enFilled={false} />,
    );
    expect(html).toMatch(/한국어[\s\S]*aria-selected="true"|aria-selected="true"[\s\S]*한국어/);
    // `English` should be the unselected tab.
    expect(html).toMatch(/aria-selected="false"[^>]*>[\s\S]*English/);
  });

  it('switches to English when value="en"', () => {
    const html = renderToStaticMarkup(
      <EditLanguageTabs value="en" onChange={noop} koFilled enFilled />,
    );
    // English should now be selected, Korean unselected.
    expect(html).toMatch(/aria-selected="false"[^>]*>[\s\S]*한국어/);
  });
});

describe('EditLanguageTabs — filled / empty labels', () => {
  it('renders "작성됨" when ko has content', () => {
    const html = renderToStaticMarkup(
      <EditLanguageTabs value="ko" onChange={noop} koFilled enFilled={false} />,
    );
    expect(html).toContain('작성됨');
    expect(html).toContain('미작성');
  });

  it('renders "미작성" for both when nothing is filled', () => {
    const html = renderToStaticMarkup(
      <EditLanguageTabs value="ko" onChange={noop} koFilled={false} enFilled={false} />,
    );
    const hits = html.match(/미작성/g) ?? [];
    expect(hits.length).toBe(2);
  });
});

describe('EditLanguageTabs — accessibility shell', () => {
  it('exposes role="tablist" with a Korean aria-label', () => {
    const html = renderToStaticMarkup(
      <EditLanguageTabs value="ko" onChange={noop} koFilled enFilled />,
    );
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-label="가이드 언어"');
  });

  it('roving tabindex: only the active tab gets tabIndex=0', () => {
    const html = renderToStaticMarkup(
      <EditLanguageTabs value="ko" onChange={noop} koFilled enFilled />,
    );
    // Two `tabindex` attributes total (one per tab).
    const tabIndexes = html.match(/tabindex="[-0-9]+"/g) ?? [];
    expect(tabIndexes).toEqual(['tabindex="0"', 'tabindex="-1"']);
  });
});
