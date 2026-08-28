import { describe, expect, it } from 'vitest';
import { extractTargetSourceFromSnake } from '@/lib/target-source-response';

/** The wire type is module-local, so the parameter itself is the contract here. */
type TargetSourceDetailWire = Parameters<typeof extractTargetSourceFromSnake>[0];

/**
 * `metadata.is_china_region` is the ONE field both the AWS and the SDU 1단계 branch on.
 * A key that never gets mapped arrives as `undefined` at the screen, which reads as
 * Global — a wrong answer that looks exactly like a right one.
 */
const wire = (metadata: Record<string, unknown> | null): TargetSourceDetailWire =>
  ({
    target_source_id: 1102,
    service_code: 'SDU',
    cloud_provider: 'AWS',
    created_at: '2026-08-01T09:00:00Z',
    ...(metadata ? { metadata } : {}),
  }) as unknown as TargetSourceDetailWire;

describe('extractTargetSourceFromSnake — 권역', () => {
  it('is_china_region 을 isChinaRegion 으로 넘긴다', () => {
    expect(extractTargetSourceFromSnake(wire({ is_china_region: true }), 'IDLE')).toMatchObject({
      isChinaRegion: true,
    });
  });

  it('없으면 키 자체가 없다 — 부재는 false 가 아니라 모름이다', () => {
    expect('isChinaRegion' in extractTargetSourceFromSnake(wire(null), 'IDLE')).toBe(false);
    expect('isChinaRegion' in extractTargetSourceFromSnake(wire({}), 'IDLE')).toBe(false);
  });
});
