/**
 * 인프라 작업 탭이 고르는 terraform 카탈로그 키.
 *
 * 계약이 SDU 를 말하는 자리는 **둘**이다 — `metadata.is_sdu_type` 과 `cloud_provider`
 * enum 의 `SDU`. 한쪽만 읽으면 다른 경로로 오는 SDU 대상이 조용히 밑에 깔린 CSP 의
 * 작업 이름을 받는다: SDU 의 작업은 `SDU_BDC_SERVICE_COMMON` · `SDU_BDC_SERVICE` 둘뿐인데
 * AWS 의 카탈로그가 서면 이 대상에 존재하지 않는 작업을 그리게 된다.
 *
 * 이 패널은 SDU 에서 이제야 닿을 수 있는 자리라(예전에는 탭 줄이 통째로 없었다) 그 판정을
 * 여기서 못 박는다.
 */
import { describe, it, expect } from 'vitest';

import { pipelineProviderKey } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/PipelineTab';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';

const detail = (over: Partial<RawTargetSourceDetail>): RawTargetSourceDetail =>
  ({ target_source_id: 1099, cloud_provider: 'AWS', metadata: {}, ...over }) as RawTargetSourceDetail;

describe('pipelineProviderKey — SDU 는 두 자리 중 어느 쪽으로 와도 SDU 다', () => {
  it('metadata.is_sdu_type 이면 sdu', () => {
    expect(pipelineProviderKey(detail({ metadata: { is_sdu_type: true } }))).toBe('sdu');
  });

  it('cloud_provider 가 SDU 면 플래그가 없어도 sdu', () => {
    // 이것이 truthiness 검사 하나로는 잡히지 않던 경우다 — 밑의 CSP 카탈로그가 섰다.
    expect(pipelineProviderKey(detail({ cloud_provider: 'SDU', metadata: {} }))).toBe('sdu');
  });

  it('플래그가 명시적으로 false 여도 provider 가 SDU 면 sdu', () => {
    expect(
      pipelineProviderKey(detail({ cloud_provider: 'SDU', metadata: { is_sdu_type: false } })),
    ).toBe('sdu');
  });

  it('SDU 가 아니면 제 프로바이더 키 그대로다', () => {
    expect(pipelineProviderKey(detail({ cloud_provider: 'AWS' }))).toBe('aws');
    expect(pipelineProviderKey(detail({ cloud_provider: 'IDC' }))).toBe('idc');
  });
});
