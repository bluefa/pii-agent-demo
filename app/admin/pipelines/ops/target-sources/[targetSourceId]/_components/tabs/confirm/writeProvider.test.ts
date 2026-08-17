import { describe, expect, it } from 'vitest';
import { resolveWriteProvider } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/confirm/writeProvider';

describe('resolveWriteProvider', () => {
  it('네 CSP 를 계약 어휘로 돌려준다', () => {
    expect(resolveWriteProvider({ cloud_provider: 'AWS' })).toBe('AWS');
    expect(resolveWriteProvider({ cloud_provider: 'GCP' })).toBe('GCP');
    expect(resolveWriteProvider({ cloud_provider: 'IDC' })).toBe('IDC');
  });

  it('Azure 는 도메인 어휘와 계약 어휘가 다르다 — 어느 쪽으로 와도 AZURE 다', () => {
    // 도메인 CloudProvider 는 'Azure', 계약 ConfirmedResourceProvider 는 'AZURE'.
    // 정규화한 도메인 값을 대문자 목록과 그대로 대조하면 여기서만 null 이 된다.
    expect(resolveWriteProvider({ cloud_provider: 'AZURE' })).toBe('AZURE');
    expect(resolveWriteProvider({ cloud_provider: 'Azure' })).toBe('AZURE');
    expect(resolveWriteProvider({ cloud_provider: ' azure ' })).toBe('AZURE');
  });

  it('SDU 는 쓰기 경로가 없다 — 두 신호 각각으로 막힌다', () => {
    expect(resolveWriteProvider({ cloud_provider: 'SDU' })).toBeNull();
    expect(resolveWriteProvider({ cloud_provider: 'AWS', metadata: { is_sdu_type: true } })).toBeNull();
  });

  it('모르는 provider 는 AWS 로 떨어지지 않고 거절된다', () => {
    // normalizeCloudProvider 의 폴백을 그대로 쓰면 여기서 'AWS' 가 나와, 알 수 없는
    // 대상이 AWS path 로 POST 된다.
    expect(resolveWriteProvider({ cloud_provider: 'ORACLE_CLOUD' })).toBeNull();
    expect(resolveWriteProvider({ cloud_provider: '' })).toBeNull();
    expect(resolveWriteProvider({})).toBeNull();
  });
});
