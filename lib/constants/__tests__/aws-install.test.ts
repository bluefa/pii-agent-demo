import { describe, expect, it } from 'vitest';

import {
  AWS_INSTALL_SUBS,
  AWS_INSTALL_TITLES,
  aggregateServiceScripts,
  buildAwsAutoItems,
  buildAwsManualItems,
  mapScriptStatus,
} from '@/lib/constants/aws-install';
import type { AwsInstallationStatus, V1ScriptStatus, V1ServiceScript } from '@/lib/types';

const makeScript = (status: V1ScriptStatus): V1ServiceScript => ({
  scriptName: `script-${status}`,
  status,
  resources: [],
});

const makeStatus = (
  overrides: Partial<AwsInstallationStatus> = {},
): AwsInstallationStatus => ({
  hasExecutionPermission: false,
  serviceScripts: [],
  bdcStatus: { status: 'PENDING' },
  lastCheck: { status: 'SUCCESS' },
  ...overrides,
});

describe('mapScriptStatus', () => {
  const cases: Array<[V1ScriptStatus, ReturnType<typeof mapScriptStatus>]> = [
    ['COMPLETED', 'done'],
    ['INSTALLING', 'running'],
    ['FAILED', 'failed'],
    ['PENDING', 'pending'],
  ];

  it.each(cases)('maps %s → %s', (input, expected) => {
    expect(mapScriptStatus(input)).toBe(expected);
  });
});

describe('aggregateServiceScripts', () => {
  const cases: Array<{
    name: string;
    scripts: V1ServiceScript[];
    status: ReturnType<typeof aggregateServiceScripts>['status'];
    completedCount: number;
    activeCount: number;
  }> = [
    { name: 'empty → pending', scripts: [], status: 'pending', completedCount: 0, activeCount: 0 },
    {
      name: 'all PENDING → pending',
      scripts: [makeScript('PENDING'), makeScript('PENDING')],
      status: 'pending',
      completedCount: 0,
      activeCount: 2,
    },
    {
      name: 'mixed INSTALLING / COMPLETED → running',
      scripts: [makeScript('COMPLETED'), makeScript('INSTALLING')],
      status: 'running',
      completedCount: 1,
      activeCount: 2,
    },
    {
      name: 'partial COMPLETED + PENDING → running',
      scripts: [makeScript('COMPLETED'), makeScript('PENDING')],
      status: 'running',
      completedCount: 1,
      activeCount: 2,
    },
    {
      name: 'one FAILED → failed (wins over COMPLETED)',
      scripts: [makeScript('COMPLETED'), makeScript('FAILED')],
      status: 'failed',
      completedCount: 1,
      activeCount: 2,
    },
    {
      name: 'all COMPLETED → done',
      scripts: [makeScript('COMPLETED'), makeScript('COMPLETED')],
      status: 'done',
      completedCount: 2,
      activeCount: 2,
    },
  ];

  it.each(cases)('$name', ({ scripts, status, completedCount, activeCount }) => {
    expect(aggregateServiceScripts(scripts)).toEqual({ status, completedCount, activeCount });
  });
});

describe('buildAwsAutoItems', () => {
  it('returns 3 cards with the auto-mode keys in order', () => {
    const items = buildAwsAutoItems(makeStatus());
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.key)).toEqual([
      'awsTfPermission',
      'awsServiceResources',
      'awsBdcResources',
    ]);
  });

  it('pins verbatim v15 titles and subs', () => {
    const items = buildAwsAutoItems(makeStatus());
    expect(items[0].title).toBe(AWS_INSTALL_TITLES.awsTfPermission);
    expect(items[0].sub).toBe(AWS_INSTALL_SUBS.awsTfPermission);
    expect(items[1].title).toBe(AWS_INSTALL_TITLES.awsServiceResources);
    expect(items[1].sub).toBe(AWS_INSTALL_SUBS.awsServiceResources);
    expect(items[2].title).toBe(AWS_INSTALL_TITLES.awsBdcResources);
    expect(items[2].sub).toBe(AWS_INSTALL_SUBS.awsBdcResources);
  });

  it('permission card is done when execution permission granted', () => {
    const items = buildAwsAutoItems(makeStatus({ hasExecutionPermission: true }));
    expect(items[0].status).toBe('done');
  });

  it('permission card is running while last check is in progress', () => {
    const items = buildAwsAutoItems(
      makeStatus({ hasExecutionPermission: false, lastCheck: { status: 'IN_PROGRESS' } }),
    );
    expect(items[0].status).toBe('running');
  });

  it('permission card is pending when no permission and check not in progress', () => {
    const items = buildAwsAutoItems(
      makeStatus({ hasExecutionPermission: false, lastCheck: { status: 'SUCCESS' } }),
    );
    expect(items[0].status).toBe('pending');
  });

  it('derives service card from serviceScripts aggregation', () => {
    const items = buildAwsAutoItems(
      makeStatus({ serviceScripts: [makeScript('COMPLETED'), makeScript('INSTALLING')] }),
    );
    expect(items[1]).toMatchObject({ status: 'running', completedCount: 1, activeCount: 2 });
  });

  it('derives BDC card from bdcStatus', () => {
    const items = buildAwsAutoItems(makeStatus({ bdcStatus: { status: 'FAILED' } }));
    expect(items[2].status).toBe('failed');
  });

  it('emits no onClick (cards are non-clickable)', () => {
    const items = buildAwsAutoItems(makeStatus());
    items.forEach((item) => expect(item.onClick).toBeUndefined());
  });
});

describe('buildAwsManualItems', () => {
  it('returns 2 cards with the manual-mode keys and no permission card', () => {
    const items = buildAwsManualItems(makeStatus());
    expect(items).toHaveLength(2);
    expect(items.map((i) => i.key)).toEqual(['awsServiceTerraform', 'awsBdcResources']);
  });

  it('pins verbatim v15 titles and subs', () => {
    const items = buildAwsManualItems(makeStatus());
    expect(items[0].title).toBe(AWS_INSTALL_TITLES.awsServiceTerraform);
    expect(items[0].sub).toBe(AWS_INSTALL_SUBS.awsServiceTerraform);
    expect(items[1].title).toBe(AWS_INSTALL_TITLES.awsBdcResources);
    expect(items[1].sub).toBe(AWS_INSTALL_SUBS.awsBdcResources);
  });

  it('derives service card from serviceScripts aggregation', () => {
    const items = buildAwsManualItems(
      makeStatus({ serviceScripts: [makeScript('COMPLETED'), makeScript('COMPLETED')] }),
    );
    expect(items[0]).toMatchObject({ status: 'done', completedCount: 2, activeCount: 2 });
  });

  it('derives BDC card from bdcStatus', () => {
    const items = buildAwsManualItems(makeStatus({ bdcStatus: { status: 'COMPLETED' } }));
    expect(items[1].status).toBe('done');
  });
});
