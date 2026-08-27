/**
 * `resolveStepSlot` / `resolveProjectStepSlot` for SDU.
 *
 * Two claims, and the second is the one that can silently break: an SDU target still
 * carries a real `cloudProvider`, so a resolver that checked the provider first would hand
 * it that provider's guide — a correct-looking key for a step the reader is not on.
 */

import { describe, expect, it } from 'vitest';

import {
  resolveProjectStepSlot,
  resolveStepSlot,
} from '@/app/components/features/process-status/GuideCard/resolve-step-slot';
import { GUIDE_SLOTS } from '@/lib/constants/guide-registry';
import { ProcessStatus } from '@/lib/types';

/** The whole fold, status by status — 승인 두 상태와 설치가 2단계, 연결 테스트가 3단계로. */
const CASES = [
  [ProcessStatus.WAITING_TARGET_CONFIRMATION, 'process.sdu.1'],
  [ProcessStatus.WAITING_APPROVAL, 'process.sdu.2'],
  [ProcessStatus.APPLYING_APPROVED, 'process.sdu.2'],
  [ProcessStatus.INSTALLING, 'process.sdu.2'],
  [ProcessStatus.WAITING_CONNECTION_TEST, 'process.sdu.3'],
  [ProcessStatus.CONNECTION_VERIFIED, 'process.sdu.3'],
  [ProcessStatus.INSTALLATION_COMPLETE, 'process.sdu.4'],
] as const;

describe('resolveStepSlot — SDU', () => {
  it.each(CASES)('status %d resolves to %s', (status, key) => {
    expect(resolveStepSlot('AWS', status, { sdu: true })).toBe(key);
    expect(GUIDE_SLOTS[key]).toBeDefined();
  });

  it('ignores the underlying provider entirely', () => {
    // Same status, four different clouds, one answer. ⛔ If this ever starts returning
    // `process.aws.*` for an SDU target, the reader gets a guide for a step whose screen
    // they are not looking at.
    for (const provider of ['AWS', 'Azure', 'GCP', 'IDC'] as const) {
      expect(resolveStepSlot(provider, ProcessStatus.INSTALLING, { sdu: true })).toBe(
        'process.sdu.2',
      );
    }
  });

  it('has exactly four SDU slots, and every one of them is reachable', () => {
    // 네 슬롯이 곧 담당자가 걷는 네 단계다 — 다섯 번째가 생기면 아무도 닿지 못하는
    // 가이드이고, 하나가 빠지면 화면 하나가 가이드 없이 선다.
    const sduKeys = Object.keys(GUIDE_SLOTS).filter((key) => key.startsWith('process.sdu.'));
    expect(sduKeys.sort()).toEqual([
      'process.sdu.1',
      'process.sdu.2',
      'process.sdu.3',
      'process.sdu.4',
    ]);
    expect(new Set(CASES.map(([, key]) => key))).toEqual(new Set(sduKeys));
  });

  it('still refuses a status outside the seven', () => {
    expect(resolveStepSlot('AWS', 0 as ProcessStatus, { sdu: true })).toBeNull();
    expect(resolveStepSlot('AWS', 8 as ProcessStatus, { sdu: true })).toBeNull();
  });
});

describe('resolveProjectStepSlot — SDU', () => {
  const project = (isSduType?: boolean) => ({
    cloudProvider: 'AWS' as const,
    processStatus: ProcessStatus.WAITING_CONNECTION_TEST,
    isTerraformExecutionGranted: true,
    ...(isSduType === undefined ? {} : { isSduType }),
  });

  it('reads isSduType off the project', () => {
    expect(resolveProjectStepSlot(project(true))).toBe('process.sdu.3');
  });

  it.each([
    ['absent', undefined],
    ['false', false],
  ] as const)('leaves a cloud target alone when isSduType is %s', (_name, value) => {
    // The flag is optional on `CloudTargetSource`, so absence must mean "cloud", not
    // "unknown" — a truthiness check here would be right by accident and a `=== false`
    // check would be wrong for the absent case.
    expect(resolveProjectStepSlot(project(value))).toBe('process.aws.auto.5');
  });
});
