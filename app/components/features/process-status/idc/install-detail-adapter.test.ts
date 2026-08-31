import { describe, expect, it } from 'vitest';
import { buildIdcInstallDetail } from '@/app/components/features/process-status/idc/install-detail-adapter';
import type { IdcInstallationView } from '@/app/lib/api/idc';

/**
 * IDC 를 나머지 셋과 같은 모양으로 세우는 어댑터 — 키는 IDC Step 4 가 세우는 그 셋이다.
 * 키가 갈리면 단계 이름 매핑이 한쪽 화면에서만 맞는다.
 */
const view = (over: Partial<IdcInstallationView> = {}): IdcInstallationView => ({
  lastCheck: { status: 'COMPLETED', checkedAt: '2026-08-31T01:00:00Z' },
  resources: [
    {
      resourceId: 'idc-1',
      installationStatus: 'IN_PROGRESS',
      cxTerraform: { status: 'COMPLETED' },
      bdpTerraform: { status: 'IN_PROGRESS', guide: '설치가 진행 중입니다.' },
      firewallCheck: { status: '해괴한값' },
    },
  ],
  ...over,
});

describe('buildIdcInstallDetail', () => {
  it('셀은 cx · bdp · firewall 셋이고, 계약 밖 값은 UNKNOWN 으로 떨어진다', () => {
    const { resources } = buildIdcInstallDetail(view());

    expect(Object.keys(resources[0].cells)).toEqual(['cx', 'bdp', 'firewall']);
    expect(resources[0].cells.cx.status).toBe('COMPLETED');
    expect(resources[0].cells.bdp.status).toBe('IN_PROGRESS');
    expect(resources[0].cells.bdp.guide).toBe('설치가 진행 중입니다.');
    // 모르는 값을 아는 값으로 반올림하지 않는다.
    expect(resources[0].cells.firewall.status).toBe('UNKNOWN');
    // guide 가 없으면 null 이다 — undefined 로 새어 나가지 않는다.
    expect(resources[0].cells.cx.guide).toBeNull();
  });

  it('IDC 에는 리소스 이름이 없다 — 지어내지 않고 null 로 둔다', () => {
    expect(buildIdcInstallDetail(view()).resources[0].resourceName).toBeNull();
  });

  it('last_check 는 3값 버킷으로 접힌다 — COMPLETED·SUCCESS 는 SUCCESS', () => {
    expect(buildIdcInstallDetail(view()).lastCheck).toEqual({
      status: 'SUCCESS',
      checkedAt: '2026-08-31T01:00:00Z',
    });
    expect(
      buildIdcInstallDetail(view({ lastCheck: { status: 'FAILED', failReason: 'TIMEOUT' } }))
        .lastCheck,
    ).toEqual({ status: 'FAILED', failReason: 'TIMEOUT' });
    // 시각도 사유도 없는 조회는 진행 중으로 남는다(끝났다고 말하지 않는다).
    expect(buildIdcInstallDetail(view({ lastCheck: undefined })).lastCheck).toEqual({
      status: 'IN_PROGRESS',
    });
  });

  it('unavailable 은 계약이 준 그대로 실린다', () => {
    expect(
      buildIdcInstallDetail(view({ lastCheck: { status: 'COMPLETED', unavailable: true } }))
        .lastCheck.unavailable,
    ).toBe(true);
    expect(buildIdcInstallDetail(view()).lastCheck).not.toHaveProperty('unavailable');
  });
});
