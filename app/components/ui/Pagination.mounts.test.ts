/**
 * Console tables carry the 14px pagination bar — enforced at the SOURCE level.
 *
 * The owner set this in round 17 ("target-sources/1006 에서 보여지는 pagination
 * footer 디자인 차용", at 14px) and had to repeat it on 08-23 ("pagination footer는
 * 14 픽셀로 고정하자 … 2번 말하게 하지마") after steps 1·2·3·4 and the admin
 * confirmed tab all mounted the bar on the 12px `sm` default. The drift is
 * structural: `size` defaults to `sm` for the ~20 legacy v15 screens, so every
 * NEW console-table caller silently regresses unless it passes `size="md"`.
 *
 * Rule: every component file that RENDERS a console-grammar table AND mounts
 * <Pagination> must pass `size="md"` on every mount. Rendering, not importing —
 * several legacy files (IdcResourceTable, ConnectionTestCard, CloudReqApprovalModal)
 * import cell helpers from WaitingApprovalTable while their own table is still
 * pre-console; their pagers stay `sm` until LIN-99/100 migrate them, at which
 * point the new render tag pulls them into this scan automatically — pass the
 * prop then, do not loosen the scan.
 */
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../../..');

/** Rendering any of these marks the file as a console-grammar table caller. */
const CONSOLE_TABLE_TAGS = ['<ConsoleTable', '<WaitingApprovalTable', '<CandidateResourceTable'];

const tsxFilesUnder = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return tsxFilesUnder(full);
    return entry.name.endsWith('.tsx') && !entry.name.includes('.test.') ? [full] : [];
  });

/** Each mount's prop block: from `<Pagination` to its first `/>` (arrows are `=>`, never `/>`). */
const paginationMounts = (source: string): string[] => {
  const mounts: string[] = [];
  const open = /<Pagination[\s\n]/g;
  for (let m = open.exec(source); m; m = open.exec(source)) {
    const close = source.indexOf('/>', m.index);
    mounts.push(source.slice(m.index, close === -1 ? undefined : close));
  }
  return mounts;
};

describe('Pagination mounts under console tables', () => {
  it('every console-table caller passes size="md" (the standing 14px order)', () => {
    const offenders: string[] = [];
    for (const file of tsxFilesUnder(path.join(root, 'app'))) {
      const source = readFileSync(file, 'utf8');
      if (!CONSOLE_TABLE_TAGS.some((tag) => source.includes(tag))) continue;
      for (const mount of paginationMounts(source)) {
        if (!mount.includes('size="md"')) offenders.push(path.relative(root, file));
      }
    }
    expect(offenders, `pagination footer는 14px 고정 — add size="md" in: ${offenders.join(', ')}`).toEqual([]);
  });

  // The scan is only as good as its ability to see a mount at all; prove it sees
  // the known-good caller rather than silently matching nothing.
  it('the scan actually finds mounts (step 7 confirmed table is one)', () => {
    const source = readFileSync(
      path.join(
        root,
        'app/target-sources/[targetSourceId]/_components/confirmed/ConfirmedIntegrationTable.tsx',
      ),
      'utf8',
    );
    expect(paginationMounts(source).length).toBeGreaterThan(0);
  });
});
