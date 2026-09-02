/**
 * English count nouns have to agree with the number in front of them.
 *
 * Every UI string in this repo was written in Korean first, and Korean has no grammatical
 * plural: 「계정 1개」 and 「계정 2개」 spell the noun the same way. So the Korean side reads
 * correctly at every n by construction, and the English translation that hard-coded the
 * plural form ("1 accounts will be registered.") looked fine next to it — the sentence is
 * only wrong at one value of n, on a screen nobody re-reads in English.
 *
 * Nothing else in the suite can catch that. There is no Korean disagreement to mirror, no
 * type error, no lint rule: the string still renders, still interpolates, still compiles.
 * Only an explicit assertion of the rendered wording at n = 1 and n = 2 notices when a
 * count noun stops agreeing, so each string below is pinned verbatim at both.
 *
 * Grouped by dictionary. The Korean guard at the bottom states the premise: Korean reads
 * identically at every n, which is exactly why the English bug was invisible.
 */
import { describe, expect, it } from 'vitest';

import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';
import { CANDIDATE_COPY } from '@/app/target-sources/[targetSourceId]/_components/candidate/copy';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';
import { LAYOUT_COPY } from '@/app/target-sources/[targetSourceId]/_components/layout/copy';
import { SDU_COPY } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import { COPY } from '@/lib/copy';
import { plural } from '@/lib/plural';

describe('plural()', () => {
  it('takes the many form at n = 0', () => {
    expect(plural(0, 'owner', 'owners')).toBe('owners');
  });

  it('takes the one form at n = 1', () => {
    expect(plural(1, 'owner', 'owners')).toBe('owner');
  });

  it('takes the many form at n = 2', () => {
    expect(plural(2, 'owner', 'owners')).toBe('owners');
  });
});

describe('COPY.en', () => {
  const en = COPY.en;

  it('common.instanceCount agrees', () => {
    expect(en.common.instanceCount(1)).toBe('1 instance');
    expect(en.common.instanceCount(2)).toBe('2 instances');
  });

  it('access.ownersNamesMissing agrees', () => {
    expect(en.access.ownersNamesMissing(1)).toBe(
      'This service has 1 owner, but their name did not arrive',
    );
    expect(en.access.ownersNamesMissing(2)).toBe(
      'This service has 2 owners, but their names did not arrive',
    );
  });

  it('access.ownersHidden agrees', () => {
    expect(en.access.ownersHidden(1)).toBe('1 more owner is not listed here');
    expect(en.access.ownersHidden(2)).toBe('2 more owners are not listed here');
  });

  it('wizard.s4Count agrees', () => {
    expect(en.wizard.s4Count(1)).toBe('1 account will be registered.');
    expect(en.wizard.s4Count(2)).toBe('2 accounts will be registered.');
  });
});

describe('CANDIDATE_COPY.en', () => {
  const en = CANDIDATE_COPY.en;

  it('candidate.liveLoaded agrees', () => {
    expect(en.candidate.liveLoaded(1)).toBe('Loaded 1 integration target.');
    expect(en.candidate.liveLoaded(2)).toBe('Loaded 2 integration targets.');
  });

  // The three below take the already-formatted count as a string plus the raw number, so
  // the caller keeps its thousands separator and the sentence still gets a number to agree with.
  it('logicalDb.metaSchemaCount agrees', () => {
    expect(en.logicalDb.metaSchemaCount('1', 1)).toBe('1 schema');
    expect(en.logicalDb.metaSchemaCount('2', 2)).toBe('2 schemas');
  });

  it('logicalDb.excludeWholeDbSchemas agrees', () => {
    expect(en.logicalDb.excludeWholeDbSchemas('1', 1)).toBe(' — including its 1 schema');
    expect(en.logicalDb.excludeWholeDbSchemas('2', 2)).toBe(' — including its 2 schemas');
  });

  it('logicalDb.keptChanges agrees', () => {
    expect(en.logicalDb.keptChanges('1', 1)).toBe(
      'The change you picked (1) is still here. Closing discards it.',
    );
    expect(en.logicalDb.keptChanges('2', 2)).toBe(
      'The changes you picked (2) are still here. Closing discards them.',
    );
  });
});

describe('IDC_COPY.en', () => {
  const en = IDC_COPY.en;

  it('showMoreIps agrees', () => {
    expect(en.showMoreIps(1)).toBe('1 more IP ▾');
    expect(en.showMoreIps(2)).toBe('2 more IPs ▾');
  });

  it('submitDescEm agrees', () => {
    expect(en.submitDescEm(1)).toBe('1 is requested as an integration target');
    expect(en.submitDescEm(2)).toBe('2 are requested as integration targets');
  });

  it('reqApprovalDescEm agrees', () => {
    expect(en.reqApprovalDescEm(1)).toBe(
      'Request completion approval with the connection test results for 1 integration target',
    );
    expect(en.reqApprovalDescEm(2)).toBe(
      'Request completion approval with the connection test results for 2 integration targets',
    );
  });
});

describe('LAYOUT_COPY.en', () => {
  const en = LAYOUT_COPY.en;

  it('cloudApproval.descriptionStrong agrees', () => {
    expect(en.cloudApproval.descriptionStrong(1)).toBe(
      'Request completion approval with the connection test results for 1 target',
    );
    expect(en.cloudApproval.descriptionStrong(2)).toBe(
      'Request completion approval with the connection test results for 2 targets',
    );
  });

  it('cloudApproval.databaseCount agrees', () => {
    expect(en.cloudApproval.databaseCount(1)).toBe('1 database');
    expect(en.cloudApproval.databaseCount(2)).toBe('2 databases');
  });
});

describe('INSTALL_COPY.en', () => {
  const en = INSTALL_COPY.en;

  // The verb agrees here too, not just the noun: "target applies" / "targets apply".
  it('detail.naDesc agrees', () => {
    expect(en.detail.naDesc(1)).toBe(
      'None of the 1 integration target applies to this step, so there is nothing to do.',
    );
    expect(en.detail.naDesc(2)).toBe(
      'None of the 2 integration targets apply to this step, so there is nothing to do.',
    );
  });
});

describe('SDU_COPY.en', () => {
  const en = SDU_COPY.en;

  it('upload.firewallIntro agrees', () => {
    expect(en.upload.firewallIntro('ap-northeast-2', 1)).toBe(
      'The Region you defined in Step 1 is ap-northeast-2 — 1 in total. Your internal firewall has to allow outbound traffic to the endpoints and destination IPs below.',
    );
    expect(en.upload.firewallIntro('ap-northeast-2, us-east-1', 2)).toBe(
      'The Regions you defined in Step 1 are ap-northeast-2, us-east-1 — 2 in total. Your internal firewall has to allow outbound traffic to the endpoints and destination IPs below.',
    );
  });
});

describe('COPY.ko is unchanged', () => {
  // The premise of this whole file. Korean spells the counted noun the same at every n, so
  // the Korean sentence never had an agreement bug to reveal the English one. If these two
  // ever diverge in wording, the English fixes above were applied to the wrong side.
  it('wizard.s4Count reads identically at n = 1 and n = 2', () => {
    expect(COPY.ko.wizard.s4Count(1)).toBe('총 1개의 계정이 등록됩니다.');
    expect(COPY.ko.wizard.s4Count(2)).toBe('총 2개의 계정이 등록됩니다.');
  });
});
