/**
 * `toAlertListPage` — 계약에 **없는** 두 필드가 wire 에서 화면까지 살아남는지.
 *
 * `delay_seconds`/`status_changed_at` 은 swagger 에 없다. 생성 스키마의 passthrough 를
 * 타고 런타임에만 존재하므로 타입이 잡아 주는 것이 하나도 없다 — reader 안에서
 * `delaySeconds` 라고 오타를 내도 컴파일도 되고 테스트도 다 초록인 채로 지연 열만
 * 영영 '—' 가 된다. 그래서 이 한 홉은 값으로 박아 둔다.
 *
 * 화면 쪽 테스트(`alerts.test.tsx`)는 이 값을 **prop 으로 건네받아** 그린다. 그건
 * `DelayText` 를 박는 것이지 snake→camel 변환을 박는 것이 아니다.
 */
import { describe, expect, it } from 'vitest';

import { toAlertListPage } from '@/lib/types/task-queue';

const wire = (row: Record<string, unknown>) => ({
  content: [row],
  number: 0,
  totalPages: 1,
  totalElements: 1,
  size: 10,
  first: true,
  last: true,
  numberOfElements: 1,
  empty: false,
});

const ROW = {
  targetSourceId: 1861,
  serviceName: '정산서비스',
  serviceCode: 'STL',
  cloudProvider: 'AWS',
  confirmStatus: 'CONFIRMED',
};

const firstRow = (row: Record<string, unknown>) =>
  // 계약 밖 필드라 wire 타입이 모른다 — 이 테스트의 대상이 정확히 그 사실이다.
  toAlertListPage(wire(row) as Parameters<typeof toAlertListPage>[0]).content[0];

describe('toAlertListPage — 계약 밖 지연 쌍', () => {
  it('snake 로 온 두 값이 camel 로 도착한다', () => {
    const row = firstRow({
      ...ROW,
      delay_seconds: 262000,
      status_changed_at: '2026-07-17T18:56:00Z',
    });

    expect(row.delaySeconds).toBe(262000);
    expect(row.statusChangedAt).toBe('2026-07-17T18:56:00Z');
    // 계약 필드도 같이 살아 있어야 한다 — 델타 reader 가 기존 reshape 를 덮지 않는지.
    expect(row.targetSourceId).toBe(1861);
    expect(row.serviceCode).toBe('STL');
  });

  it('업스트림이 아직 안 주면 null 이다 — 열은 그때 — 를 그린다', () => {
    const row = firstRow(ROW);

    expect(row.delaySeconds).toBeNull();
    expect(row.statusChangedAt).toBeNull();
  });

  it('타입이 틀린 값은 받지 않는다', () => {
    // 계약이 없으니 업스트림이 무엇을 실을지도 계약이 안 정해 준다. 문자열 초를
    // 그대로 통과시키면 DelayText 가 숫자 연산을 문자열에 한다.
    const row = firstRow({ ...ROW, delay_seconds: '262000', status_changed_at: 1750000000 });

    expect(row.delaySeconds).toBeNull();
    expect(row.statusChangedAt).toBeNull();
  });
});
