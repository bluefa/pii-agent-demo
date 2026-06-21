import { describe, expect, it } from 'vitest';

import {
  deriveAzurePhases,
  buildAzurePipelineItems,
  type AzurePhaseResource,
  type AzureInstallStep,
} from '@/lib/constants/azure-install';
import type { InstallTaskStatus } from '@/lib/constants/install-task';

const vm = (step: AzureInstallStep): AzurePhaseResource => ({ isVm: true, step });
const db = (step: AzureInstallStep): AzurePhaseResource => ({ isVm: false, step });

interface ExpectedPhase {
  status: InstallTaskStatus;
  completedCount: number;
  activeCount: number;
}

interface Case {
  name: string;
  resources: AzurePhaseResource[];
  phase1: ExpectedPhase;
  phase2: ExpectedPhase;
  phase3: ExpectedPhase;
}

const cases: Case[] = [
  {
    // DB-only: no VMs → phase1/2 done (0/0). PE_PENDING = approval in flight =>
    // active => phase3 running.
    name: '0 VMs, DB at PE_PENDING',
    resources: [db('PE_PENDING'), db('PE_NOT_REQUESTED')],
    phase1: { status: 'done', completedCount: 0, activeCount: 0 },
    phase2: { status: 'done', completedCount: 0, activeCount: 0 },
    phase3: { status: 'running', completedCount: 0, activeCount: 2 },
  },
  {
    name: 'VM blocked at SUBNET_REQUIRED',
    resources: [vm('SUBNET_REQUIRED')],
    phase1: { status: 'pending', completedCount: 0, activeCount: 1 },
    phase2: { status: 'pending', completedCount: 0, activeCount: 1 },
    phase3: { status: 'pending', completedCount: 0, activeCount: 1 },
  },
  {
    // Subnet done (phase1 done) but VM terraform still required (phase2 pending).
    name: 'VM at VM_TF_REQUIRED',
    resources: [vm('VM_TF_REQUIRED')],
    phase1: { status: 'done', completedCount: 1, activeCount: 1 },
    phase2: { status: 'pending', completedCount: 0, activeCount: 1 },
    phase3: { status: 'pending', completedCount: 0, activeCount: 1 },
  },
  {
    // A PE rejection drives phase3 to failed; VM is past subnet/tf so phases 1/2 done.
    name: 'VM with PE_REJECTED',
    resources: [vm('PE_REJECTED')],
    phase1: { status: 'done', completedCount: 1, activeCount: 1 },
    phase2: { status: 'done', completedCount: 1, activeCount: 1 },
    phase3: { status: 'failed', completedCount: 0, activeCount: 1 },
  },
  {
    name: 'all COMPLETED (VM + DB)',
    resources: [vm('COMPLETED'), db('COMPLETED')],
    phase1: { status: 'done', completedCount: 1, activeCount: 1 },
    phase2: { status: 'done', completedCount: 1, activeCount: 1 },
    phase3: { status: 'done', completedCount: 2, activeCount: 2 },
  },
  {
    // Mixed: one COMPLETED + one PE_PENDING → phase3 has partial progress → running.
    name: 'mixed PE_PENDING (phase3 running)',
    resources: [vm('COMPLETED'), db('PE_PENDING')],
    phase1: { status: 'done', completedCount: 1, activeCount: 1 },
    phase2: { status: 'done', completedCount: 1, activeCount: 1 },
    phase3: { status: 'running', completedCount: 1, activeCount: 2 },
  },
];

describe('deriveAzurePhases', () => {
  for (const c of cases) {
    it(c.name, () => {
      const phases = deriveAzurePhases(c.resources);
      expect(phases.phase1).toEqual(c.phase1);
      expect(phases.phase2).toEqual(c.phase2);
      expect(phases.phase3).toEqual(c.phase3);
    });
  }

  it('empty input → all phases pending (nothing installed; avoid 3x 완료)', () => {
    const phases = deriveAzurePhases([]);
    expect(phases.phase1).toEqual({ status: 'pending', completedCount: 0, activeCount: 0 });
    expect(phases.phase2).toEqual({ status: 'pending', completedCount: 0, activeCount: 0 });
    expect(phases.phase3).toEqual({ status: 'pending', completedCount: 0, activeCount: 0 });
  });
});

describe('buildAzurePipelineItems', () => {
  it('always builds exactly 3 cards with the v15 keys', () => {
    const items = buildAzurePipelineItems([vm('COMPLETED')]);
    expect(items).toHaveLength(3);
    expect(items.map((i) => i.key)).toEqual([
      'azureServiceResources',
      'azureBdcResources',
      'azurePrivateLink',
    ]);
  });

  it('maps phase1/2/3 status and counts onto cards 1/2/3', () => {
    const resources = [vm('VM_TF_REQUIRED'), db('PE_REJECTED')];
    const phases = deriveAzurePhases(resources);
    const items = buildAzurePipelineItems(resources);

    expect(items[0].status).toBe(phases.phase1.status);
    expect(items[0].completedCount).toBe(phases.phase1.completedCount);
    expect(items[0].activeCount).toBe(phases.phase1.activeCount);

    expect(items[1].status).toBe(phases.phase2.status);
    expect(items[1].completedCount).toBe(phases.phase2.completedCount);
    expect(items[1].activeCount).toBe(phases.phase2.activeCount);

    expect(items[2].status).toBe(phases.phase3.status);
    expect(items[2].completedCount).toBe(phases.phase3.completedCount);
    expect(items[2].activeCount).toBe(phases.phase3.activeCount);
  });

  it('cards have no onClick (pipeline-only, non-interactive)', () => {
    const items = buildAzurePipelineItems([vm('COMPLETED')]);
    for (const item of items) {
      expect(item.onClick).toBeUndefined();
    }
  });
});
