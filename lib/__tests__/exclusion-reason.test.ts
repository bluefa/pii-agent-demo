import { describe, it, expect } from 'vitest';
import { resolveExclusionReason } from '@/lib/types';

describe('resolveExclusionReason', () => {
  it('shows a user-written reason verbatim and attaches no code', () => {
    expect(resolveExclusionReason('읽기 전용 복제본이라 원본만 연동')).toEqual({
      text: '읽기 전용 복제본이라 원본만 연동',
      code: undefined,
    });
  });

  it('labels a scan verdict and keeps the raw enum for the tip', () => {
    expect(resolveExclusionReason(undefined, 'GCP_CLOUD_SQL_HAS_PUBLIC_IP')).toEqual({
      text: '공인 IP 사용 중',
      code: 'GCP_CLOUD_SQL_HAS_PUBLIC_IP',
    });
  });

  // 요청 어댑터는 설치 불가 행의 판정 코드를 `exclusion_reason` 에 그대로 써 넣는다
  // (approval-payload.ts) — 그 경로로 들어와도 코드가 아니라 라벨이 보여야 한다.
  it('labels a verdict that arrived through exclusion_reason', () => {
    expect(resolveExclusionReason('AZURE_RESOURCE_VNET_INTEGRATED_MODE')).toEqual({
      text: 'VNet 통합 모드',
      code: 'AZURE_RESOURCE_VNET_INTEGRATED_MODE',
    });
  });

  // 프런트와 BFF 는 같은 순간에 배포되지 않는다 — 이름이 바뀌는 사이 옛 토큰이 그대로 와도
  // 새 이름으로 접어 읽는다. 떨어뜨리면 그 창 동안 사유 칸이 통째로 빈다.
  it('folds the pre-rename Azure token onto the new one', () => {
    expect(
      resolveExclusionReason(undefined, 'AZURE_RESOURCE_PRIVATE_ENDPOINT_CONNECTION_FAILED'),
    ).toEqual({
      text: 'VNet 통합 모드',
      code: 'AZURE_RESOURCE_VNET_INTEGRATED_MODE',
    });
  });

  // 사람이 남긴 근거가 그 행을 왜 뺐는지 아는 유일한 기록이다 — 기계 라벨이 덮으면 안 된다.
  it('lets a user-written reason win over the scan label, keeping the code for the tip', () => {
    expect(
      resolveExclusionReason('스테이징 DB라 연동 대상에서 뺍니다', 'GCP_CLOUD_SQL_HAS_PUBLIC_IP'),
    ).toEqual({
      text: '스테이징 DB라 연동 대상에서 뺍니다',
      code: 'GCP_CLOUD_SQL_HAS_PUBLIC_IP',
    });
  });

  // 계약에 없는 값에 라벨을 지어내지 않는다. 이 단계가 없으면 enum 이 늘어나는 순간
  // 그 행의 사유 칸이 통째로 빈다.
  it('passes an unrecognised code through verbatim', () => {
    expect(resolveExclusionReason(undefined, 'GCP_SOME_FUTURE_REASON')).toEqual({
      text: 'GCP_SOME_FUTURE_REASON',
      code: undefined,
    });
  });

  // 목의 toExcludedResourceInfo 는 사유가 없으면 '' 를 쓴다 — 빈 문자열은 값이 아니다.
  it('treats an empty exclusion_reason as absent and falls through', () => {
    expect(resolveExclusionReason('', 'GCP_CLOUD_SQL_HAS_PUBLIC_IP')).toEqual({
      text: '공인 IP 사용 중',
      code: 'GCP_CLOUD_SQL_HAS_PUBLIC_IP',
    });
  });

  // 대상 행은 사유가 없다 — 빈 칸이지 em-dash 가 아니다.
  it('returns null when neither field carries anything', () => {
    expect(resolveExclusionReason()).toBeNull();
    expect(resolveExclusionReason('', null)).toBeNull();
  });
});
