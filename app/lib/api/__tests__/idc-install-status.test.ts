import { describe, it, expect } from 'vitest';
import {
  IDC_INSTALL_TASK_STATUS,
  idcInstallStatusLabel,
  toIdcInstallationView,
} from '@/app/lib/api/idc';

describe('IDC install status — UNKNOWN → 작업중', () => {
  it('label: UNKNOWN renders "작업중"', () => {
    expect(idcInstallStatusLabel('UNKNOWN')).toBe('작업중');
  });

  it('bucket: UNKNOWN shares the in-progress bucket with IN_PROGRESS', () => {
    expect(IDC_INSTALL_TASK_STATUS.UNKNOWN).toBe('running');
    expect(IDC_INSTALL_TASK_STATUS.UNKNOWN).toBe(IDC_INSTALL_TASK_STATUS.IN_PROGRESS);
  });

  it('adapter: a resource with installation_status UNKNOWN → domain UNKNOWN → "작업중"', () => {
    const view = toIdcInstallationView({
      last_check: { status: 'IN_PROGRESS', checked_at: '2026-06-23T04:00:00Z' },
      resources: [
        {
          resource_id: 'idc-r2',
          installation_status: 'UNKNOWN',
          bdc_side_cx_terraform_apply: { status: 'IN_PROGRESS' },
          bdc_side_bdp_terraform_apply: { status: 'UNKNOWN' },
          firewall_check: { status: 'IN_PROGRESS' },
        },
      ],
    });
    const r = view.resources[0];
    expect(r.installationStatus).toBe('UNKNOWN');
    expect(idcInstallStatusLabel(r.installationStatus)).toBe('작업중');
    // step-level: bdp step UNKNOWN also reads "작업중"
    expect(idcInstallStatusLabel(r.bdpTerraform.status)).toBe('작업중');
  });

  it('missing status defaults to UNKNOWN ("작업중"), never COMPLETED', () => {
    const view = toIdcInstallationView({ resources: [{ resource_id: 'x' }] });
    expect(view.resources[0].installationStatus).toBe('UNKNOWN');
    expect(view.resources[0].cxTerraform.status).toBe('UNKNOWN');
  });

  it('lastCheck maps checked_at → checkedAt', () => {
    const view = toIdcInstallationView({
      last_check: { status: 'COMPLETED', checked_at: '2026-06-23T04:00:00Z' },
      resources: [],
    });
    expect(view.lastCheck?.checkedAt).toBe('2026-06-23T04:00:00Z');
    expect(view.lastCheck?.status).toBe('COMPLETED');
  });
});
