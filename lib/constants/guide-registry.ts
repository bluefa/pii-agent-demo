/**
 * Guide CMS — slot registry.
 *
 * Spec: docs/reports/guide-cms/spec.md §3.3. Maps 28 slot keys to 22
 * guide names; many slots can share one name (e.g. AWS AUTO step 1 and
 * AWS MANUAL step 1 both point to `AWS_TARGET_CONFIRM`).
 *
 * Re-exports `GUIDE_NAMES` / `GuideName` from `@/lib/types/guide` so
 * downstream waves can import either path.
 */

import type { GuideSlot } from '@/lib/types/guide';

export { GUIDE_NAMES } from '@/lib/types/guide';
export type { GuideName } from '@/lib/types/guide';

export const GUIDE_SLOTS = {
  // AWS AUTO (7)
  'process.aws.auto.1': {
    guideName: 'AWS_TARGET_CONFIRM',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO', step: 1, stepLabel: '연동 대상 확정' },
    component: 'GuideCard',
  },
  'process.aws.auto.2': {
    guideName: 'AWS_APPROVAL_PENDING',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO', step: 2, stepLabel: '승인 대기' },
    component: 'GuideCard',
  },
  'process.aws.auto.3': {
    guideName: 'AWS_APPLYING',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO', step: 3, stepLabel: '연동 대상 반영 중' },
    component: 'GuideCard',
  },
  'process.aws.auto.4': {
    guideName: 'AWS_AUTO_INSTALLING',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO', step: 4, stepLabel: '설치 진행 (자동)' },
    component: 'GuideCard',
  },
  'process.aws.auto.5': {
    guideName: 'AWS_CONNECTION_TEST',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO', step: 5, stepLabel: '연결 테스트' },
    component: 'GuideCard',
  },
  'process.aws.auto.6': {
    guideName: 'AWS_ADMIN_APPROVAL',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO', step: 6, stepLabel: '관리자 승인 대기' },
    component: 'GuideCard',
  },
  'process.aws.auto.7': {
    guideName: 'AWS_COMPLETED',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'AUTO', step: 7, stepLabel: '완료' },
    component: 'GuideCard',
  },
  // AWS MANUAL (7) — only step 4 diverges from AUTO.
  'process.aws.manual.1': {
    guideName: 'AWS_TARGET_CONFIRM',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 1, stepLabel: '연동 대상 확정' },
    component: 'GuideCard',
  },
  'process.aws.manual.2': {
    guideName: 'AWS_APPROVAL_PENDING',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 2, stepLabel: '승인 대기' },
    component: 'GuideCard',
  },
  'process.aws.manual.3': {
    guideName: 'AWS_APPLYING',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 3, stepLabel: '연동 대상 반영 중' },
    component: 'GuideCard',
  },
  'process.aws.manual.4': {
    guideName: 'AWS_MANUAL_INSTALLING',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 4, stepLabel: 'TF Script 수동 설치' },
    component: 'GuideCard',
  },
  'process.aws.manual.5': {
    guideName: 'AWS_CONNECTION_TEST',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 5, stepLabel: '연결 테스트' },
    component: 'GuideCard',
  },
  'process.aws.manual.6': {
    guideName: 'AWS_ADMIN_APPROVAL',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 6, stepLabel: '관리자 승인 대기' },
    component: 'GuideCard',
  },
  'process.aws.manual.7': {
    guideName: 'AWS_COMPLETED',
    placement: { kind: 'process-step', provider: 'AWS', variant: 'MANUAL', step: 7, stepLabel: '완료' },
    component: 'GuideCard',
  },
  // AZURE (7) — no variant.
  'process.azure.1': {
    guideName: 'AZURE_TARGET_CONFIRM',
    placement: { kind: 'process-step', provider: 'AZURE', step: 1, stepLabel: '연동 대상 확정' },
    component: 'GuideCard',
  },
  'process.azure.2': {
    guideName: 'AZURE_APPROVAL_PENDING',
    placement: { kind: 'process-step', provider: 'AZURE', step: 2, stepLabel: '승인 대기' },
    component: 'GuideCard',
  },
  'process.azure.3': {
    guideName: 'AZURE_APPLYING',
    placement: { kind: 'process-step', provider: 'AZURE', step: 3, stepLabel: '연동 대상 반영 중' },
    component: 'GuideCard',
  },
  'process.azure.4': {
    guideName: 'AZURE_INSTALLING',
    placement: { kind: 'process-step', provider: 'AZURE', step: 4, stepLabel: '설치' },
    component: 'GuideCard',
  },
  'process.azure.5': {
    guideName: 'AZURE_CONNECTION_TEST',
    placement: { kind: 'process-step', provider: 'AZURE', step: 5, stepLabel: '연결 테스트' },
    component: 'GuideCard',
  },
  'process.azure.6': {
    guideName: 'AZURE_ADMIN_APPROVAL',
    placement: { kind: 'process-step', provider: 'AZURE', step: 6, stepLabel: '관리자 승인 대기' },
    component: 'GuideCard',
  },
  'process.azure.7': {
    guideName: 'AZURE_COMPLETED',
    placement: { kind: 'process-step', provider: 'AZURE', step: 7, stepLabel: '완료' },
    component: 'GuideCard',
  },
  // GCP (7) — no variant.
  'process.gcp.1': {
    guideName: 'GCP_TARGET_CONFIRM',
    placement: { kind: 'process-step', provider: 'GCP', step: 1, stepLabel: '연동 대상 확정' },
    component: 'GuideCard',
  },
  'process.gcp.2': {
    guideName: 'GCP_APPROVAL_PENDING',
    placement: { kind: 'process-step', provider: 'GCP', step: 2, stepLabel: '승인 대기' },
    component: 'GuideCard',
  },
  'process.gcp.3': {
    guideName: 'GCP_APPLYING',
    placement: { kind: 'process-step', provider: 'GCP', step: 3, stepLabel: '연동 대상 반영 중' },
    component: 'GuideCard',
  },
  'process.gcp.4': {
    guideName: 'GCP_INSTALLING',
    placement: { kind: 'process-step', provider: 'GCP', step: 4, stepLabel: '설치' },
    component: 'GuideCard',
  },
  'process.gcp.5': {
    guideName: 'GCP_CONNECTION_TEST',
    placement: { kind: 'process-step', provider: 'GCP', step: 5, stepLabel: '연결 테스트' },
    component: 'GuideCard',
  },
  'process.gcp.6': {
    guideName: 'GCP_ADMIN_APPROVAL',
    placement: { kind: 'process-step', provider: 'GCP', step: 6, stepLabel: '관리자 승인 대기' },
    component: 'GuideCard',
  },
  'process.gcp.7': {
    guideName: 'GCP_COMPLETED',
    placement: { kind: 'process-step', provider: 'GCP', step: 7, stepLabel: '완료' },
    component: 'GuideCard',
  },
} as const satisfies Record<string, GuideSlot>;

export type GuideSlotKey = keyof typeof GUIDE_SLOTS;

export function resolveSlot(key: GuideSlotKey): GuideSlot {
  return GUIDE_SLOTS[key];
}

export function findSlotsForGuide(name: import('@/lib/types/guide').GuideName): GuideSlot[] {
  return Object.values(GUIDE_SLOTS).filter((slot) => slot.guideName === name);
}
