import { describe, expect, it } from 'vitest';
import {
  deleteVariantOf,
  terraformSentence,
  type GateState,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/deleteVariant';

const gate = (state: GateState['state'], overallState: string | null = null): GateState => ({
  state,
  overallState,
});

describe('deleteVariantOf — 막는 상태는 APPLIED 하나뿐이다', () => {
  it('조회 중이면 아직 판정하지 않는다', () => {
    expect(deleteVariantOf(gate('loading'))).toBe('checking');
    // 조회 중에는 직전 값이 남아 있을 수 있다 — 그래도 로딩이 이긴다.
    expect(deleteVariantOf(gate('loading', 'APPLIED'))).toBe('checking');
  });

  it('조회가 실패하면 허용도 차단도 아니다', () => {
    expect(deleteVariantOf(gate('failed'))).toBe('unknown');
  });

  it('APPLIED 만 막는다', () => {
    expect(deleteVariantOf(gate('ready', 'APPLIED'))).toBe('blocked');
  });

  it('나머지 상태는 전부 허용이다 — 넓히면 지울 수 없는 확정이 생긴다', () => {
    for (const state of [
      'NEVER_APPLIED',
      'DESTROYED',
      'APPLYING',
      'APPLY_FAILED',
      'DESTROYING',
      'DESTROY_FAILED',
      'SOMETHING_NEW',
    ]) {
      expect(deleteVariantOf(gate('ready', state))).toBe('allowed');
    }
    expect(deleteVariantOf(gate('ready', null))).toBe('allowed');
  });
});

describe('terraformSentence — 상태만 말한다', () => {
  it('조회 중·실패는 조회에 대해 말한다', () => {
    expect(terraformSentence(gate('loading'))).toBe('Terraform 상태를 확인하는 중입니다.');
    expect(terraformSentence(gate('failed'))).toBe('Terraform 상태를 불러오지 못했습니다.');
  });

  it('APPLIED 는 막힌 이유와 출구를 같이 말한다', () => {
    expect(terraformSentence(gate('ready', 'APPLIED'))).toBe(
      'Terraform 이 이 확정 정보로 인프라를 올린 상태입니다. 인프라 작업 탭에서 철거가 끝난 뒤 삭제할 수 있습니다.',
    );
  });

  it('철거할 인프라가 없다는 말은 NEVER_APPLIED 에서만 한다', () => {
    expect(terraformSentence(gate('ready', 'NEVER_APPLIED'))).toBe(
      'Terraform 은 아직 적용된 적이 없어 철거할 인프라가 없습니다.',
    );
    expect(terraformSentence(gate('ready', 'DESTROYED'))).not.toContain('철거할 인프라가 없습니다');
  });

  it('그 밖의 상태는 라벨만 적는다 — 모르는 값은 「알 수 없음」', () => {
    expect(terraformSentence(gate('ready', 'DESTROYED'))).toBe('Terraform 은 삭제됨 상태입니다.');
    expect(terraformSentence(gate('ready', 'APPLY_FAILED'))).toBe(
      'Terraform 은 적용 실패 상태입니다.',
    );
    expect(terraformSentence(gate('ready', 'SOMETHING_NEW'))).toBe(
      'Terraform 은 알 수 없음 상태입니다.',
    );
    expect(terraformSentence(gate('ready', null))).toBe('Terraform 은 알 수 없음 상태입니다.');
  });
});
