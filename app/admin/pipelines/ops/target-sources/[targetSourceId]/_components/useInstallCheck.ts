'use client';

/**
 * 설치 확인 조회 — the four per-CSP installation-status endpoints behind one call, folded
 * into the `installGate` verdict.
 *
 * The admin console reads the SAME routes the service-side Step 4 reads
 * (`/api/v1/{aws,azure,gcp,idc}/target-sources/{id}/installation-status`) through the SAME
 * CSR helpers under `@/app/lib/api/*`. Those routes carry no role gate — they dispatch
 * straight to `bff.*.getInstallationStatus` — and this screen already reaches user-side
 * reads the same way (`getTerraformStatus`, `getProcessStatus`, `getLatestScanJob`,
 * `getConfirmedIntegration`), so nothing new is added at the boundary.
 *
 * The wire→cells reshape per provider is the adapters' own, not a second copy: Azure and
 * GCP hand back `InstallDetailResource` already, and AWS/IDC are keyed here exactly as
 * `AwsInstallStatusDetail` / `IdcStep4Installing` key them, so a step id means the same
 * cell on both screens.
 *
 * 폴링은 없다. 이 탭은 설치를 지켜보는 화면이 아니라 실행 전에 한 번 확인하는 화면이라,
 * 다시 읽는 것은 `reload`(다시 확인)와 작업 변화(onRunsChanged)뿐이다 — 서비스 화면
 * Step 4 의 30초 폴은 설치가 도는 동안 그 카드를 보고 있는 사람의 것이다.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { getAzureInstallationStatus } from '@/app/lib/api/azure';
import { getGcpInstallationStatus } from '@/app/lib/api/gcp';
import { getIdcInstallationStatus } from '@/app/lib/api/idc';
import { buildAzureInstallDetail } from '@/app/components/features/process-status/azure/install-detail-adapter';
import { buildGcpInstallDetail } from '@/app/components/features/process-status/gcp/install-detail-adapter';
import {
  normalizeInstallStepValue,
  type InstallDetailResource,
  type InstallLastCheck,
} from '@/app/components/features/process-status/install-status-detail/model';
import {
  installGate,
  isInstallGateProvider,
  type InstallGateProvider,
  type InstallGateResult,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';

/** What the gate reads: the cells, plus the two facts that say we could not read them. */
export interface InstallCheckDetail {
  lastCheck: InstallLastCheck | null;
  unavailable: boolean;
  resources: readonly InstallDetailResource[];
}

const awsDetail = async (targetSourceId: number): Promise<InstallCheckDetail> => {
  const status = await getAwsInstallationStatus(targetSourceId);
  return {
    lastCheck: status.lastCheck,
    unavailable: status.lastCheck.unavailable === true,
    // 키는 AwsInstallStatusDetail 의 것 그대로 — 같은 단계가 두 화면에서 다른 이름을
    // 가지면 게이트의 단계 id 가 한쪽에서만 맞는다.
    resources: status.resources.map((resource) => ({
      resourceId: resource.resourceId,
      resourceName: resource.resourceName,
      rollup: { status: resource.installationStatus, guide: null },
      cells: {
        service: resource.serviceTerraform,
        bdcService: resource.bdcServiceTerraform,
        bdcCommon: resource.bdcCommonTerraform,
      },
    })),
  };
};

const azureDetail = async (targetSourceId: number): Promise<InstallCheckDetail> => {
  const detail = buildAzureInstallDetail(await getAzureInstallationStatus(targetSourceId));
  return {
    lastCheck: detail.lastCheck,
    unavailable: detail.lastCheck.unavailable === true,
    resources: detail.resources,
  };
};

const gcpDetail = async (targetSourceId: number): Promise<InstallCheckDetail> => {
  const detail = buildGcpInstallDetail(await getGcpInstallationStatus(targetSourceId));
  return {
    lastCheck: detail.lastCheck,
    unavailable: detail.lastCheck.unavailable === true,
    resources: detail.resources,
  };
};

const idcDetail = async (targetSourceId: number): Promise<InstallCheckDetail> => {
  const view = await getIdcInstallationStatus(targetSourceId);
  const raw = view.lastCheck;
  // IDC 의 last_check 는 설치 단계 enum 을 그대로 쓴다 — 공용 3버킷으로 접는 규칙은
  // IdcStep4Installing 의 것과 같다.
  const lastCheck: InstallLastCheck | null = raw
    ? {
        status:
          raw.status === 'FAIL' || raw.status === 'FAILED'
            ? 'FAILED'
            : raw.status === 'COMPLETED' || raw.status === 'SUCCESS'
              ? 'SUCCESS'
              : 'IN_PROGRESS',
        ...(raw.checkedAt && { checkedAt: raw.checkedAt }),
        ...(raw.failReason && { failReason: raw.failReason }),
        ...(raw.unavailable && { unavailable: true }),
      }
    : null;
  return {
    lastCheck,
    unavailable: raw?.unavailable === true,
    resources: view.resources.map((resource) => ({
      resourceId: resource.resourceId,
      resourceName: null,
      rollup: { status: normalizeInstallStepValue(resource.installationStatus), guide: null },
      cells: {
        cx: {
          status: normalizeInstallStepValue(resource.cxTerraform.status),
          guide: resource.cxTerraform.guide ?? null,
        },
        bdp: {
          status: normalizeInstallStepValue(resource.bdpTerraform.status),
          guide: resource.bdpTerraform.guide ?? null,
        },
        firewall: {
          status: normalizeInstallStepValue(resource.firewallCheck.status),
          guide: resource.firewallCheck.guide ?? null,
        },
      },
    })),
  };
};

const FETCHERS: Record<InstallGateProvider, (id: number) => Promise<InstallCheckDetail>> = {
  aws: awsDetail,
  azure: azureDetail,
  gcp: gcpDetail,
  idc: idcDetail,
};

/** 계약이 이 대상을 말하지 않을 때의 판정 — 단계도 없고, 경고할 것도 없다. */
const EMPTY_GATE: InstallGateResult = { kind: 'unknown', steps: [] };

export interface InstallCheckState {
  /**
   * False when the contract has no installation-status for this target (SDU). The card and
   * the notice draw nothing at all — an empty verdict would be a claim we cannot make.
   */
  supported: boolean;
  /** The verdict. While loading or after a failure this is `unknown`, which never warns. */
  gate: InstallGateResult;
  lastCheck: InstallLastCheck | null;
  loading: boolean;
  /** The lookup itself failed (network / 4xx / 5xx) — distinct from a FAILED last_check. */
  failed: boolean;
  reload: () => void;
}

export function useInstallCheck(
  targetSourceId: number,
  /** Already normalized by the screen (`pipelineProviderKey`) — 'sdu' lands on unsupported. */
  provider: string,
  /** AWS only — names the 서비스 측 step after how it runs. */
  manualInstall: boolean,
): InstallCheckState {
  const [detail, setDetail] = useState<InstallCheckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const gateProvider = isInstallGateProvider(provider) ? provider : null;

  // Latest-request-wins, the pattern PipelineTab's own `load()` uses: a response for a
  // previous target source (or a superseded 다시 확인) must not commit over the current one.
  const seqRef = useRef(0);
  const load = useCallback(async (): Promise<void> => {
    const seq = ++seqRef.current;
    if (gateProvider === null) {
      setLoading(false);
      return;
    }
    setFailed(false);
    try {
      const next = await FETCHERS[gateProvider](targetSourceId);
      if (seq !== seqRef.current) return;
      setDetail(next);
    } catch {
      if (seq !== seqRef.current) return;
      // 실패는 빈 결과가 아니다 — 마지막으로 읽은 스냅샷은 그대로 두고, 판정만 unknown 이 된다.
      setFailed(true);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [gateProvider, targetSourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return {
    supported: gateProvider !== null,
    gate:
      gateProvider === null
        ? EMPTY_GATE
        : installGate({
            provider: gateProvider,
            manualInstall,
            // 읽기에 실패했으면 판정하지 않는다. 첫 조회 전에도 `detail` 이 null 이라
            // 같은 자리로 떨어진다 — 로딩 중의 판정은 unknown 이고, unknown 은 경고하지 않는다.
            detail: failed ? null : detail,
          }),
    // 실패했으면 시각도 사유도 내놓지 않는다 — 직전 성공의 `fail_reason` 을 이번 실패의
    // 사유로 찍는 것이 이 한 줄을 두는 이유다(스냅샷은 남기되 그 위에 얹어 말하지 않는다).
    lastCheck: failed ? null : (detail?.lastCheck ?? null),
    loading,
    failed,
    reload,
  };
}
