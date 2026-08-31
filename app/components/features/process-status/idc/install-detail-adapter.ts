import {
  normalizeInstallStepValue,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallStepCell,
} from '@/app/components/features/process-status/install-status-detail/model';
import type { IdcInstallationView, IdcInstallStepView } from '@/app/lib/api/idc';

/**
 * IDC installation-status view (`IdcInstallationView`, already unwrapped by
 * `app/lib/api/idc`) → the shared InstallStatusDetail model, the same shape the
 * AWS / Azure / GCP adapters produce.
 *
 * IDC is the odd one out in two ways, and both are contract facts rather than gaps:
 *
 * - There is no `resource_name`. IDC rows are identified by their endpoint, not by a
 *   scan-assigned name (design-spec §8), so `resourceName` is null and callers fall back
 *   to the resource id — exactly what IDC Step 4 does.
 * - `IdcInstallStatus` is the loose codegen string, so every status goes through
 *   `normalizeInstallStepValue`; anything off-enum lands on UNKNOWN rather than being
 *   trusted as a reading.
 *
 * The last-check status is a DIFFERENT enum from the per-step one (LastCheckInfoDto:
 * IN_PROGRESS | COMPLETED | FAILED | SUCCESS), and the view types it as the loose string,
 * so it is bucketed here into the 3-value UI shape. FAIL is folded in with FAILED because
 * the IDC wire has been seen using the step vocabulary in that slot.
 */

const toCell = (step: IdcInstallStepView | undefined): InstallStepCell => ({
  status: normalizeInstallStepValue(step?.status),
  guide: step?.guide ?? null,
});

const toLastCheck = (lastCheck: IdcInstallationView['lastCheck']): InstallLastCheck => ({
  status:
    lastCheck?.status === 'FAIL' || lastCheck?.status === 'FAILED'
      ? 'FAILED'
      : lastCheck?.status === 'COMPLETED' || lastCheck?.status === 'SUCCESS'
        ? 'SUCCESS'
        : 'IN_PROGRESS',
  ...(lastCheck?.checkedAt && { checkedAt: lastCheck.checkedAt }),
  ...(lastCheck?.failReason && { failReason: lastCheck.failReason }),
  ...(lastCheck?.unavailable && { unavailable: true }),
});

export interface IdcInstallDetail {
  lastCheck: InstallLastCheck;
  resources: InstallDetailResource[];
}

export const buildIdcInstallDetail = (view: IdcInstallationView): IdcInstallDetail => ({
  lastCheck: toLastCheck(view.lastCheck),
  // 키는 IDC Step 4 가 세우는 그 셋 그대로다 — 같은 단계가 두 화면에서 다른 이름을 가지면
  // 단계 이름 매핑이 한쪽에서만 맞는다.
  resources: (view.resources ?? []).map((r) => ({
    resourceId: r.resourceId,
    resourceName: null,
    rollup: { status: normalizeInstallStepValue(r.installationStatus), guide: null },
    cells: {
      cx: toCell(r.cxTerraform),
      bdp: toCell(r.bdpTerraform),
      firewall: toCell(r.firewallCheck),
    },
  })),
});
