/**
 * Guide CMS — seed generator.
 *
 * Spec: docs/reports/guide-cms/spec.md §7.
 *
 * One-shot script that transcribes `DEFAULT_STEP_GUIDES` (+ provider
 * overrides) from `lib/constants/process-guides.ts` into the HTML shape
 * consumed by the mock seed. Each generated HTML is validated with
 * `validateGuideHtml()` before emission; a failure exits non-zero.
 *
 * Run:
 *   npx tsx scripts/migrate-guides-to-html.ts > lib/api-client/mock/guides-seed.generated.ts
 *
 * The committed seed (`lib/api-client/mock/guides-seed.ts`) is the
 * hand-reviewed variant of this output; the drift CI test asserts the
 * shape stays in sync.
 */

import { AWS_AUTO_GUIDE, AWS_MANUAL_GUIDE, AZURE_GUIDE, GCP_GUIDE } from '@/lib/constants/process-guides';
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

import type { GuideName } from '@/lib/types/guide';
import type { GuideInline, ProviderProcessGuide, StepGuideContent } from '@/lib/types/process-guide';

const SEEDED_AT = '2026-04-25T00:00:00Z';

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const escapeAttr = (value: string): string => escapeHtml(value);

const inlineToHtml = (parts: GuideInline[]): string =>
  parts
    .map((part) => {
      if (typeof part === 'string') return escapeHtml(part);
      if ('strong' in part) return `<strong>${escapeHtml(part.strong)}</strong>`;
      // External `#` anchors in the source constants are not valid per
      // the URL scheme rule — rewrite to a deterministic internal path.
      const href = part.href === '#' ? '/docs' : part.href;
      return `<a href="${escapeAttr(href)}">${escapeHtml(part.link)}</a>`;
    })
    .join('');

const stepContentToHtml = (content: StepGuideContent): string => {
  const heading = `<h4>${escapeHtml(content.heading)}</h4>`;
  const summary = `<p>${inlineToHtml(content.summary)}</p>`;
  const bullets = content.bullets.length > 0
    ? `<ul>${content.bullets.map((b) => `<li>${inlineToHtml(b)}</li>`).join('')}</ul>`
    : '';
  return heading + summary + bullets;
};

/** Resolve the StepGuideContent for a (provider, variant, step) tuple. */
const findStepGuide = (
  guide: ProviderProcessGuide,
  step: number,
): StepGuideContent | undefined => guide.steps.find((s) => s.stepNumber === step)?.guide;

interface SeedEntry {
  name: GuideName;
  ko: string;
}

const collect = (): SeedEntry[] => {
  const entries: SeedEntry[] = [];
  for (const slot of Object.values(GUIDE_SLOTS)) {
    if (slot.placement.kind !== 'process-step') continue;
    const { provider, step } = slot.placement;
    const variant = 'variant' in slot.placement ? slot.placement.variant : undefined;

    let source: ProviderProcessGuide | undefined;
    if (provider === 'AWS') {
      source = variant === 'MANUAL' ? AWS_MANUAL_GUIDE : AWS_AUTO_GUIDE;
    } else if (provider === 'AZURE') {
      source = AZURE_GUIDE;
    } else {
      source = GCP_GUIDE;
    }

    const content = source && findStepGuide(source, step);
    if (!content) {
      console.error(`Missing StepGuideContent for ${provider}/${variant ?? '-'}/step ${step}`);
      process.exit(1);
    }
    const ko = stepContentToHtml(content);
    const result = validateGuideHtml(ko);
    if (!result.valid) {
      console.error(`validateGuideHtml failed for ${slot.guideName}:`, result.errors);
      process.exit(1);
    }
    // De-dupe — shared names (e.g. AWS_TARGET_CONFIRM across AUTO+MANUAL)
    // emit identical HTML; keep the first.
    if (entries.some((e) => e.name === slot.guideName)) continue;
    entries.push({ name: slot.guideName, ko });
  }
  return entries;
};

const emit = (entries: SeedEntry[]): void => {
  const lines: string[] = [];
  lines.push("import type { GuideDetail, GuideName } from '@/lib/types/guide';");
  lines.push('');
  lines.push(`const SEEDED_AT = '${SEEDED_AT}';`);
  lines.push('');
  lines.push('export const guidesSeed: Record<GuideName, GuideDetail> = {');
  for (const entry of entries) {
    lines.push(`  ${entry.name}: {`);
    lines.push(`    name: '${entry.name}',`);
    lines.push(`    contents: { ko: ${JSON.stringify(entry.ko)}, en: '' },`);
    lines.push('    updatedAt: SEEDED_AT,');
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  process.stdout.write(lines.join('\n'));
};

const main = (): void => {
  const entries = collect();
  emit(entries);
  console.error(`Generated ${entries.length} seed entries.`);
};

main();
