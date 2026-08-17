/**
 * 요청 상태 → 판정 입력. 계약 enum 8종을 **전수로** 잰다 — 이 매핑이 부정형이었을 때
 * `CANCELLED`·`UNAVAILABLE`·`UNAVAILABLE_ACKNOWLEDGED`·`RESET` 넷이 "승인 대기" 로 떨어졌고,
 * 화면은 이미 끝난 요청을 아직 처리 중이라고 말했다. enum 은
 * `docs/swagger/install-v1.yaml` 의 `ApprovalRequestSummaryDto.status`.
 */
import { describe, expect, it } from 'vitest';
import { requestFacetOf } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/ConfirmTab';

const base = { loaded: true, present: true, requestId: 7, selectedCount: 3 };

describe('requestFacetOf — 계약 enum 전수', () => {
  it('계약이 대기라고 말한 것만 pending 이다', () => {
    expect(requestFacetOf({ ...base, status: 'PENDING' })).toEqual({
      kind: 'pending',
      requestId: 7,
    });
  });

  it('승인 두 종은 승인 번호와 건수를 들고 간다', () => {
    for (const status of ['APPROVED', 'AUTO_APPROVED']) {
      expect(requestFacetOf({ ...base, status })).toEqual({
        kind: 'approved',
        requestId: 7,
        count: 3,
      });
    }
  });

  it('반려는 자기 판정을 갖도록 closed 와 따로 남는다', () => {
    expect(requestFacetOf({ ...base, status: 'REJECTED' })).toEqual({ kind: 'rejected' });
  });

  it('승인 없이 끝난 셋은 closed 이고 대기가 아니다', () => {
    expect(requestFacetOf({ ...base, status: 'CANCELLED' })).toEqual({
      kind: 'closed',
      label: '요청 취소',
    });
    expect(requestFacetOf({ ...base, status: 'UNAVAILABLE' })).toEqual({
      kind: 'closed',
      label: '연동 불가',
    });
    expect(requestFacetOf({ ...base, status: 'UNAVAILABLE_ACKNOWLEDGED' })).toEqual({
      kind: 'closed',
      label: '연동 불가',
    });
  });

  it('어휘가 없는 값은 대기로 읽지 않고, 라벨도 지어내지 않는다', () => {
    // RESET 은 계약에 있으나 이 레포에 어휘가 없다.
    expect(requestFacetOf({ ...base, status: 'RESET' })).toEqual({ kind: 'closed', label: null });
    // 계약에 없는 미래 값도 같은 자리로 — 부정형이면 여기가 조용히 "대기" 가 된다.
    expect(requestFacetOf({ ...base, status: 'SOMETHING_NEW' })).toEqual({
      kind: 'closed',
      label: null,
    });
  });

  it('enum 여덟 값 중 pending 은 하나뿐이다', () => {
    const ENUM = [
      'PENDING',
      'APPROVED',
      'AUTO_APPROVED',
      'REJECTED',
      'CANCELLED',
      'UNAVAILABLE',
      'UNAVAILABLE_ACKNOWLEDGED',
      'RESET',
    ];
    const pending = ENUM.filter(
      (status) => requestFacetOf({ ...base, status }).kind === 'pending',
    );
    expect(pending).toEqual(['PENDING']);
  });

  it('로드 전과 요청 부재는 상태와 무관하게 앞선다', () => {
    expect(requestFacetOf({ ...base, loaded: false, status: 'APPROVED' })).toEqual({
      kind: 'unknown',
    });
    expect(requestFacetOf({ ...base, present: false, status: 'APPROVED' })).toEqual({
      kind: 'none',
    });
  });

  it('상태가 없으면 라벨을 지어내지 않는다', () => {
    expect(requestFacetOf({ ...base, status: null })).toEqual({ kind: 'closed', label: null });
  });
});
