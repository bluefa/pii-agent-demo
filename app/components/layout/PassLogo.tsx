import { cn, navStyles } from '@/lib/theme';

/**
 * PASS wordmark — Outfit 900 letterforms as outlines, not live text.
 *
 * Why outlines: a logo drawn from a webfont is only as reliable as the font
 * load. It also has to exist at a weight the app ships — and app/fonts carries
 * Pretendard 400-800 only, so the previous `font-black` (900) silently rendered
 * at 800. Outlines remove the load, the fallback, and the missing weight at once.
 *
 * Why Outfit: it is OFL, which permits logo use and recommends exactly this
 * outline conversion. Measured against the outgoing Pretendard ExtraBold, its
 * stem is 20% thicker (0.281 vs 0.235 of cap height) at 1% less width, so the
 * mark gains weight without moving anything beside it.
 *
 * Ink follows the verdict reading: PA is ink, SS carries the brand blue, so the
 * result lands at the end of the name.
 *
 * The viewBox is the glyphs' real ink box, not the cap-height square they were
 * measured in. Two things depend on that: the S overshoots cap and baseline by
 * 1.7 units each way and would be clipped flat by the SVG root's default
 * overflow, and the P carries an 8.3-unit left side bearing that pushed the
 * wordmark 2px right of the descriptor's own left edge. Trimming to the ink box
 * fixes the clip and makes the two rows flush.
 *
 * `h-[32px]` is therefore the DRAWN height: 32 + 4 gap + 12 descriptor = a 48px
 * lockup, which is the 56px bar less the 4px above and below.
 *
 * The width is not a free parameter: the drawn mark is 3.34:1, so height picks
 * width (32px tall → 107px wide). A target box of another ratio has to give.
 */
export const PassLogo = () => (
  <span className="inline-flex flex-col items-start gap-1 my-1">
    <svg
      viewBox="8.29 -1.69 345.64 103.38"
      role="img"
      aria-label="PASS"
      className="h-[32px] w-auto"
    >
      <path className={navStyles.brand.wordmarkInk} d="M31.04 64.89V44.66H49.16Q52.39 44.66 55.13 43.33Q57.87 41.99 59.55 39.26Q61.24 36.52 61.24 32.44Q61.24 28.37 59.55 25.63Q57.87 22.89 55.13 21.56Q52.39 20.22 49.16 20.22H31.04V0H54.63Q64.33 0 72.12 3.86Q79.92 7.72 84.48 14.96Q89.04 22.19 89.04 32.44Q89.04 42.56 84.48 49.86Q79.92 57.16 72.12 61.03Q64.33 64.89 54.63 64.89ZM8.29 100V0H36.38V100Z" />
      <path className={navStyles.brand.wordmarkInk} d="M85.96 100 124.02 0H152.67L190.31 100H161.1L133.15 15.03H143.26L114.61 100ZM110.67 83.15V61.24H166.57V83.15Z" />
      <path className={navStyles.brand.wordmarkAccent} d="M229.21 101.69Q216.43 101.69 206.95 97.96Q197.47 94.24 189.47 86.1L207.02 68.54Q212.5 73.74 218.54 76.47Q224.58 79.21 231.46 79.21Q237.22 79.21 240.17 77.46Q243.12 75.7 243.12 72.61Q243.12 69.52 240.59 67.49Q238.06 65.45 233.92 63.83Q229.78 62.22 224.79 60.53Q219.8 58.85 214.89 56.46Q209.97 54.07 205.83 50.63Q201.69 47.19 199.16 42.06Q196.63 36.94 196.63 29.49Q196.63 19.8 201.26 12.78Q205.9 5.76 214.33 2.04Q222.75 -1.69 234.13 -1.69Q245.37 -1.69 254.99 1.9Q264.61 5.48 270.93 12.08L253.23 29.63Q248.6 25.14 243.96 22.96Q239.33 20.79 233.85 20.79Q229.49 20.79 226.9 22.19Q224.3 23.6 224.3 26.4Q224.3 29.35 226.83 31.25Q229.35 33.15 233.5 34.69Q237.64 36.24 242.63 37.92Q247.61 39.61 252.53 41.92Q257.44 44.24 261.59 47.82Q265.73 51.4 268.26 56.74Q270.79 62.08 270.79 69.66Q270.79 84.97 259.9 93.33Q249.02 101.69 229.21 101.69Z" />
      <path className={navStyles.brand.wordmarkAccent} d="M312.22 101.69Q299.44 101.69 289.96 97.96Q280.48 94.24 272.47 86.1L290.03 68.54Q295.51 73.74 301.54 76.47Q307.58 79.21 314.47 79.21Q320.22 79.21 323.17 77.46Q326.12 75.7 326.12 72.61Q326.12 69.52 323.6 67.49Q321.07 65.45 316.92 63.83Q312.78 62.22 307.79 60.53Q302.81 58.85 297.89 56.46Q292.98 54.07 288.83 50.63Q284.69 47.19 282.16 42.06Q279.63 36.94 279.63 29.49Q279.63 19.8 284.27 12.78Q288.9 5.76 297.33 2.04Q305.76 -1.69 317.13 -1.69Q328.37 -1.69 337.99 1.9Q347.61 5.48 353.93 12.08L336.24 29.63Q331.6 25.14 326.97 22.96Q322.33 20.79 316.85 20.79Q312.5 20.79 309.9 22.19Q307.3 23.6 307.3 26.4Q307.3 29.35 309.83 31.25Q312.36 33.15 316.5 34.69Q320.65 36.24 325.63 37.92Q330.62 39.61 335.53 41.92Q340.45 44.24 344.59 47.82Q348.74 51.4 351.26 56.74Q353.79 62.08 353.79 69.66Q353.79 84.97 342.91 93.33Q332.02 101.69 312.22 101.69Z" />
    </svg>

    {/* Descriptor stays live text: it is a label that translates and reflows,
        unlike the wordmark, which is a fixed asset. Colour lands on WORDS, not
        letters — per-letter colour at this size destroys the word boundaries.
        Still the first thing the bar gives back when it runs out of room (the
        rule this replaces gave back 145px the same way); the wordmark alone
        already identifies the product. */}
    <span
      className={cn(
        'hidden xl:block text-[12px] font-medium leading-none tracking-[-0.005em]',
        navStyles.brand.descriptorMuted,
      )}
    >
      <span className={navStyles.brand.descriptorSubject}>PII</span>{' '}
      <span className={navStyles.brand.descriptorInk}>Agent</span> Self Service
    </span>
  </span>
);
