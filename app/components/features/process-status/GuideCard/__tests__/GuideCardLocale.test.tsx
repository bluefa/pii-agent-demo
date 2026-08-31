/**
 * The guide rail follows the reader's language.
 *
 * Every other test in this folder renders OUTSIDE `LocaleProvider`, so they all read the
 * provider's default (`ko`) and would stay green if `GuideCardContainer` stopped consulting
 * the locale at all. This file is the only thing that mounts the provider, and so the only
 * thing that can catch the wiring coming undone.
 *
 * It pins three couplings, not just the words:
 * - the BODY is picked by locale (`STEP_GUIDE_HTML[locale]`),
 * - the `lang` stamp names the language actually rendered — a body in one language under a
 *   stamp in the other is announced in the wrong voice,
 * - the source's visual grammar (`<mark>` pill, 참고 가이드 바, `<em>… ↗`) survives the
 *   translation. Those are styled by TAG, so a shape lost in English is invisible in a copy
 *   diff and silent in `validateGuideHtml`.
 */
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import { GuideCardContainer } from '@/app/components/features/process-status/GuideCard/GuideCardContainer';
import { GuideCardPure } from '@/app/components/features/process-status/GuideCard/GuideCardPure';
import { LocaleProvider } from '@/app/components/LocaleProvider';

import type { GuideSlotKey } from '@/lib/constants/guide-registry';
import type { Locale } from '@/lib/locale';

const rail = (locale: Locale, slotKey: GuideSlotKey): string =>
  renderToStaticMarkup(
    <LocaleProvider initial={locale}>
      <GuideCardContainer slotKey={slotKey} bare />
    </LocaleProvider>,
  );

describe('locale wiring', () => {
  it('renders the English body and stamps lang=en', () => {
    const html = rail('en', 'process.aws.auto.2');
    expect(html).toContain('lang="en"');
    expect(html).toContain('The PII Agent owner is reviewing your request.');
    expect(html).not.toContain('PII Agent 담당자');
  });

  it('still renders Korean and lang=ko by default', () => {
    const html = rail('ko', 'process.aws.auto.2');
    expect(html).toContain('lang="ko"');
    expect(html).toContain('PII Agent 담당자의 검토를 기다리고 있어요.');
  });

  it('renders the card header and the invalid-state card in English', () => {
    const header = renderToStaticMarkup(
      <LocaleProvider initial="en">
        <GuideCardPure content="<p>body</p>" />
      </LocaleProvider>,
    );
    expect(header).toContain('Guide');
    expect(header).not.toContain('가이드');

    const invalid = renderToStaticMarkup(
      <LocaleProvider initial="en">
        <GuideCardPure content="<script>alert(1)</script>" />
      </LocaleProvider>,
    );
    expect(invalid).toContain('The guide cannot be displayed.');
  });

  it('renders step 5 pills, ref bars and external links in English', () => {
    const html = rail('en', 'process.aws.auto.5');
    expect(html.match(/<em /g)).toHaveLength(2);
    expect(html).toContain('DB Credential registration page ↗');
    expect(html).toContain('Guide to the DB Credential registration page');
    expect(html).toContain('&#x27;Run again&#x27;');
    expect(html).toContain('&#x27;Request approval&#x27;');
  });

  it('renders step 4 AWS auto with its pill and both ref bars', () => {
    const html = rail('en', 'process.aws.auto.4');
    expect(html).toContain('>Automatic install</mark>');
    expect(html).toContain('Execution permission guide');
    expect(html).toContain('What happens at this step');
  });

  it('renders step 7 with its step names taken from the install road', () => {
    const html = rail('en', 'process.aws.auto.7');
    expect(html).toContain('Rerun connection test');
    expect(html).toContain('Change infrastructure');
    expect(html).toContain('Select target DBs');
  });
});
