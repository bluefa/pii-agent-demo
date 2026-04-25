/**
 * Guide CMS — seed scaffold generator.
 *
 * Spec: docs/reports/guide-cms/spec.md §7.
 *
 * Generates a scaffold seed from step labels in process-guides.ts.
 * HTML content is authored directly in the CMS admin UI; the committed
 * seed (`lib/api-client/mock/guides-seed.ts`) is hand-reviewed and
 * the drift CI test asserts its shape stays in sync with GUIDE_NAMES.
 *
 * Run:
 *   npx tsx scripts/migrate-guides-to-html.ts > lib/api-client/mock/guides-seed.generated.ts
 */

import { AWS_AUTO_GUIDE, AWS_MANUAL_GUIDE, AZURE_GUIDE, GCP_GUIDE } from '@/lib/constants/process-guides';
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import { validateGuideHtml } from '@/lib/utils/validate-guide-html';

import type { GuideName } from '@/lib/types/guide';
import type { ProviderProcessGuide } from '@/lib/types/process-guide';

const SEEDED_AT = '2026-04-25T00:00:00Z';

/** Resolve the step label for a (provider, variant, step) tuple. */
const findStepLabel = (
  guide: ProviderProcessGuide,
  step: number,
): string | undefined => guide.steps.find((s) => s.stepNumber === step)?.label;

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

    // Step labels remain available for reference; HTML content is now
    // authored directly in the CMS and seeded in guides-seed.ts.
    const label = source ? findStepLabel(source, step) : undefined;
    if (!label) {
      console.error(`Missing step label for ${provider}/${variant ?? '-'}/step ${step}`);
      process.exit(1);
    }
    // De-dupe — shared names (e.g. AWS_TARGET_CONFIRM across AUTO+MANUAL)
    // emit identical HTML; keep the first.
    if (entries.some((e) => e.name === slot.guideName)) continue;
    // Placeholder HTML — real content is authored in the CMS admin UI.
    const ko = `<h4>${label}</h4>`;
    const result = validateGuideHtml(ko);
    if (!result.valid) {
      console.error(`validateGuideHtml failed for ${slot.guideName}:`, result.errors);
      process.exit(1);
    }
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
