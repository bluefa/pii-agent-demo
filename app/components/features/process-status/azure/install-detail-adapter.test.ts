import { describe, expect, it } from 'vitest';
import type { z } from 'zod';
import type { schemas } from '@/lib/generated/install-v1';
import { buildAzureInstallDetail } from '@/app/components/features/process-status/azure/install-detail-adapter';

type WireResponse = z.infer<typeof schemas.AzureInstallationStatusResponse>;

/**
 * `installation_status_unavailable` 는 「못 읽었다」이지 「끝났다」도 「안 끝났다」도 아니다.
 *
 * 어댑터가 이 한 칸을 떨어뜨리면 그 뒤의 판정은 전부 **읽은 척**이 된다: 셀이 딸려 왔든
 * 안 왔든 그것은 설치의 판독이 아닌데, 화면은 그 셀로 「전부 완료」나 「N건 미완료」를
 * 말하게 된다. GCP 어댑터는 이 칸을 옮기고 있었고 Azure 만 빠져 있었다.
 */
const wire = (lastCheck: Record<string, unknown>): WireResponse =>
  ({
    last_check: lastCheck,
    resources: [
      {
        resource_id: 'azure-1',
        resource_name: 'db-1',
        installation_status: 'IN_PROGRESS',
        bdc_side_terraform_apply: { status: 'IN_PROGRESS' },
      },
    ],
  }) as WireResponse;

describe('buildAzureInstallDetail — unavailable 은 판독이 아니라는 사실이다', () => {
  it('wire 가 true 면 lastCheck 로 옮긴다', () => {
    const detail = buildAzureInstallDetail(
      wire({ status: 'SUCCESS', checked_at: '2026-08-31T01:00:00Z', installation_status_unavailable: true }),
    );

    expect(detail.lastCheck.unavailable).toBe(true);
  });

  it('false 거나 아예 없으면 키 자체가 없다 — 없는 사실을 false 로 주장하지 않는다', () => {
    expect(
      buildAzureInstallDetail(wire({ status: 'SUCCESS', installation_status_unavailable: false }))
        .lastCheck,
    ).not.toHaveProperty('unavailable');

    expect(buildAzureInstallDetail(wire({ status: 'SUCCESS' })).lastCheck).not.toHaveProperty(
      'unavailable',
    );
  });

  it('나머지 last_check 필드와 셀은 그대로다', () => {
    const detail = buildAzureInstallDetail(
      wire({
        status: 'FAILED',
        checked_at: '2026-08-31T01:00:00Z',
        fail_reason: 'THROTTLED',
        installation_status_unavailable: true,
      }),
    );

    expect(detail.lastCheck.status).toBe('FAILED');
    expect(detail.lastCheck.checkedAt).toBe('2026-08-31T01:00:00Z');
    expect(detail.lastCheck.failReason).toBe('THROTTLED');
    expect(detail.resources[0].cells.bdc.status).toBe('IN_PROGRESS');
    // VM 단계가 없는 리소스는 해당 없음(SKIP)이다 — 이 티켓이 바꾸지 않은 규칙.
    expect(detail.resources[0].cells.vmSubnet.status).toBe('SKIP');
  });

  it('a resource without a private endpoint DTO (a VM) settles the PE step as SKIP', () => {
    const detail = buildAzureInstallDetail({
      last_check: { status: 'IN_PROGRESS' },
      resources: [
        {
          resource_id: 'vm-1',
          resource_name: 'vm-1',
          installation_status: 'IN_PROGRESS',
          bdc_side_terraform_apply: { status: 'COMPLETED', guide: null },
          azure_virtual_machine_subnet_creation: { status: 'COMPLETED', guide: null },
          azure_virtual_machine_terraform_apply: { status: 'COMPLETED', guide: null },
        },
      ],
    } as never);

    expect(detail.resources[0].cells.pe.status).toBe('SKIP');
  });
});
