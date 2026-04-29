import { describe, expect, it } from 'vitest';

import {
  buildGcpPipelineItems,
  GCP_STEP_KEYS,
  GCP_STEP_PIPELINE_LABELS,
  GCP_STEP_PIPELINE_SUBS,
} from '@/lib/constants/gcp';
import type { GcpResourceStatus, GcpStepStatusValue } from '@/app/api/_lib/v1-types';

const makeResource = (
  resourceId: string,
  steps: {
    serviceSideSubnetCreation: GcpStepStatusValue;
    serviceSideTerraformApply: GcpStepStatusValue;
    bdcSideTerraformApply: GcpStepStatusValue;
  },
): GcpResourceStatus => ({
  resourceId,
  resourceName: resourceId,
  resourceType: 'CLOUD_SQL',
  installationStatus:
    steps.serviceSideSubnetCreation === 'COMPLETED' &&
    steps.serviceSideTerraformApply === 'COMPLETED' &&
    steps.bdcSideTerraformApply === 'COMPLETED'
      ? 'COMPLETED'
      : 'IN_PROGRESS',
  serviceSideSubnetCreation: { status: steps.serviceSideSubnetCreation },
  serviceSideTerraformApply: { status: steps.serviceSideTerraformApply },
  bdcSideTerraformApply: { status: steps.bdcSideTerraformApply },
});

describe('buildGcpPipelineItems', () => {
  it('returns three items in GCP_STEP_KEYS order with pipeline labels and subs', () => {
    const items = buildGcpPipelineItems([]);
    expect(items).toHaveLength(3);
    items.forEach((item, idx) => {
      const key = GCP_STEP_KEYS[idx];
      expect(item.key).toBe(key);
      expect(item.title).toBe(GCP_STEP_PIPELINE_LABELS[key]);
      expect(item.sub).toBe(GCP_STEP_PIPELINE_SUBS[key]);
    });
  });

  it('maps empty resources to pending status with zero counts', () => {
    const items = buildGcpPipelineItems([]);
    items.forEach((item) => {
      expect(item.status).toBe('pending');
      expect(item.activeCount).toBe(0);
      expect(item.completedCount).toBe(0);
    });
  });

  it('maps all-COMPLETED resources to done with full counts', () => {
    const items = buildGcpPipelineItems([
      makeResource('r1', {
        serviceSideSubnetCreation: 'COMPLETED',
        serviceSideTerraformApply: 'COMPLETED',
        bdcSideTerraformApply: 'COMPLETED',
      }),
      makeResource('r2', {
        serviceSideSubnetCreation: 'COMPLETED',
        serviceSideTerraformApply: 'COMPLETED',
        bdcSideTerraformApply: 'COMPLETED',
      }),
    ]);
    items.forEach((item) => {
      expect(item.status).toBe('done');
      expect(item.activeCount).toBe(2);
      expect(item.completedCount).toBe(2);
    });
  });

  it('maps mixed IN_PROGRESS / COMPLETED to running with partial counts', () => {
    const items = buildGcpPipelineItems([
      makeResource('r1', {
        serviceSideSubnetCreation: 'COMPLETED',
        serviceSideTerraformApply: 'IN_PROGRESS',
        bdcSideTerraformApply: 'IN_PROGRESS',
      }),
      makeResource('r2', {
        serviceSideSubnetCreation: 'COMPLETED',
        serviceSideTerraformApply: 'COMPLETED',
        bdcSideTerraformApply: 'IN_PROGRESS',
      }),
    ]);
    expect(items[0]).toMatchObject({
      key: 'serviceSideSubnetCreation',
      status: 'done',
      activeCount: 2,
      completedCount: 2,
    });
    expect(items[1]).toMatchObject({
      key: 'serviceSideTerraformApply',
      status: 'running',
      activeCount: 2,
      completedCount: 1,
    });
    expect(items[2]).toMatchObject({
      key: 'bdcSideTerraformApply',
      status: 'running',
      activeCount: 2,
      completedCount: 0,
    });
  });

  it('maps any FAIL to failed status', () => {
    const items = buildGcpPipelineItems([
      makeResource('r1', {
        serviceSideSubnetCreation: 'COMPLETED',
        serviceSideTerraformApply: 'FAIL',
        bdcSideTerraformApply: 'COMPLETED',
      }),
    ]);
    expect(items[1].status).toBe('failed');
  });

  it('excludes SKIP resources from active count', () => {
    const items = buildGcpPipelineItems([
      makeResource('r1', {
        serviceSideSubnetCreation: 'SKIP',
        serviceSideTerraformApply: 'COMPLETED',
        bdcSideTerraformApply: 'COMPLETED',
      }),
      makeResource('r2', {
        serviceSideSubnetCreation: 'COMPLETED',
        serviceSideTerraformApply: 'COMPLETED',
        bdcSideTerraformApply: 'COMPLETED',
      }),
    ]);
    expect(items[0]).toMatchObject({
      key: 'serviceSideSubnetCreation',
      status: 'done',
      activeCount: 1,
      completedCount: 1,
    });
  });

  it('all-SKIP step results in pending with activeCount=0', () => {
    const items = buildGcpPipelineItems([
      makeResource('r1', {
        serviceSideSubnetCreation: 'SKIP',
        serviceSideTerraformApply: 'COMPLETED',
        bdcSideTerraformApply: 'COMPLETED',
      }),
    ]);
    expect(items[0]).toMatchObject({
      key: 'serviceSideSubnetCreation',
      status: 'pending',
      activeCount: 0,
      completedCount: 0,
    });
  });
});

describe('GCP_STEP_PIPELINE_LABELS / SUBS — design copy', () => {
  it('pins each step title verbatim', () => {
    expect(GCP_STEP_PIPELINE_LABELS.serviceSideSubnetCreation).toBe('Subnet 생성 진행');
    expect(GCP_STEP_PIPELINE_LABELS.serviceSideTerraformApply).toBe('서비스 측 리소스 설치 진행');
    expect(GCP_STEP_PIPELINE_LABELS.bdcSideTerraformApply).toBe('BDC 측 리소스 설치 진행');
  });

  it('pins each step sub-text verbatim', () => {
    expect(GCP_STEP_PIPELINE_SUBS.serviceSideSubnetCreation).toBe(
      'Project 내 모니터링용 Subnet (10.30.0.0/22) 생성',
    );
    expect(GCP_STEP_PIPELINE_SUBS.serviceSideTerraformApply).toBe(
      'VPC Peering / Firewall / Service Account 권한 위임 구성',
    );
    expect(GCP_STEP_PIPELINE_SUBS.bdcSideTerraformApply).toBe(
      'PII Agent GCE 인스턴스 + Service Account + IAM Role 자동 배포',
    );
  });
});
