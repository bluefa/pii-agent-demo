/**
 * SDU / 중국 on every admin list row.
 *
 * An SDU target arrives as `cloud_provider: "AWS"` plus a flag, so an adapter that drops
 * the flag draws the row as plain AWS — silently, on a screen that otherwise looks
 * right. Each list has its own adapter and its own spelling of the pair; all five are
 * pinned here. Absent flags must read false: three of the five are requested from the
 * BE (2026-09-28) and not yet confirmed on the wire.
 */
import { describe, expect, it } from 'vitest';

import { schemas } from '@/lib/generated/install-v1';
import {
  toAlertListPage,
  toApprovalHistoryPage,
  toIntegrationTimelinePage,
  toProcessStatusPage,
  toRequestListPage,
  type TargetKindFlags,
} from '@/lib/types/task-queue';

const page = <T>(content: T[]) => ({ content, totalElements: content.length, totalPages: 1 });

const flags = ({ isSduType, isChinaRegion }: TargetKindFlags): TargetKindFlags => ({
  isSduType,
  isChinaRegion,
});

const BOTH: TargetKindFlags = { isSduType: true, isChinaRegion: true };
const NEITHER: TargetKindFlags = { isSduType: false, isChinaRegion: false };

describe('SDU / 중국 flags survive every list adapter', () => {
  it('process-statuses — camel pair on target_source', () => {
    // Parsed the way the route parses it: the pair is not declared on
    // `TargetSourceMetadataResponse`, so a schema that strips unknown keys would drop it
    // before the adapter ever ran.
    const [sdu, plain] = toProcessStatusPage(
      schemas.PageProcessStatusCurrentResponse.parse(
        page([
          { target_source: { cloudProvider: 'AWS', isSduType: true, isChinaRegion: true } },
          { target_source: { cloudProvider: 'AWS' } },
        ]),
      ),
    ).content;
    expect(sdu.cloudProvider).toBe('AWS');
    expect(flags(sdu)).toEqual(BOTH);
    expect(flags(plain)).toEqual(NEITHER);
  });

  it('target-sources/page — declared snake pair in metadata', () => {
    const [sdu, plain] = toRequestListPage(
      page([
        { cloudProvider: 'AWS', metadata: { is_sdu_type: true, is_china_region: true } },
        { cloudProvider: 'AWS' },
      ]),
    ).content;
    expect(flags(sdu)).toEqual(BOTH);
    expect(flags(plain)).toEqual(NEITHER);
  });

  it('dashboard/target-sources/{kind} — same DTO, same pair', () => {
    const [sdu] = toAlertListPage(
      page([{ cloudProvider: 'AWS', metadata: { is_sdu_type: true, is_china_region: true } }]),
    ).content;
    expect(flags(sdu)).toEqual(BOTH);
  });

  it('approval-history — camel pair on the flat row', () => {
    const [sdu, plain] = toApprovalHistoryPage(
      page([
        { cloudProvider: 'AWS', isSduType: true, isChinaRegion: true },
        { cloudProvider: 'AWS' },
      ]),
    ).content;
    expect(flags(sdu)).toEqual(BOTH);
    expect(flags(plain)).toEqual(NEITHER);
  });

  it('integration-timeline — snake pair on the row', () => {
    const [sdu, plain] = toIntegrationTimelinePage(
      page([
        { cloud_provider: 'AWS', is_sdu_type: true, is_china_region: true },
        { cloud_provider: 'AWS' },
      ]),
    ).content;
    expect(flags(sdu)).toEqual(BOTH);
    expect(flags(plain)).toEqual(NEITHER);
  });

  it('reads `cloud_provider: "SDU"` as SDU with no flag — the contract says it in both places', () => {
    expect(toIntegrationTimelinePage(page([{ cloud_provider: 'SDU' }])).content[0].isSduType).toBe(true);
    expect(toRequestListPage(page([{ cloudProvider: 'SDU' }])).content[0].isSduType).toBe(true);
  });
});
