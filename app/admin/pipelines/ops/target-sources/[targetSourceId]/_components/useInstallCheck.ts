'use client';

/**
 * 서비스 측 작업 조회 — 설치 상태를 읽어 `serviceWorkGate` 의 판정으로 접는다.
 *
 * 조회는 **서비스 측 작업 단계를 가진 대상에서만** 일어난다(AWS 수동 설치·GCP). 그 밖의
 * 대상은 그릴 것이 없으므로 요청도 보내지 않는다 — `serviceWorkStep` 이 null 이면 훅은
 * 시작하지 않는다.
 *
 * The admin console reads the SAME routes the service-side Step 4 reads
 * (`/api/v1/{aws,gcp}/target-sources/{id}/installation-status`) through the SAME CSR
 * helpers under `@/app/lib/api/*`. Those routes carry no role gate — they dispatch
 * straight to `bff.*.getInstallationStatus` — and this screen already reaches user-side
 * reads the same way (`getTerraformStatus`, `getProcessStatus`, `getLatestScanJob`,
 * `getConfirmedIntegration`), so nothing new is added at the boundary.
 *
 * The wire→cells reshape is the adapters' own, not a second copy: GCP hands back
 * `InstallDetailResource` already, and AWS is keyed here exactly as
 * `AwsInstallStatusDetail` keys it, so a step id means the same cell on both screens.
 *
 * 폴링은 없다. 이 탭은 설치를 지켜보는 화면이 아니라 실행 전에 한 번 확인하는 화면이라,
 * 다시 읽는 것은 작업 변화(onRunsChanged)뿐이다 — 서비스 화면
 * Step 4 의 30초 폴은 설치가 도는 동안 그 카드를 보고 있는 사람의 것이다.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getAwsInstallationStatus } from '@/app/lib/api/aws';
import { getGcpInstallationStatus } from '@/app/lib/api/gcp';
import { buildGcpInstallDetail } from '@/app/components/features/process-status/gcp/install-detail-adapter';
import type {
  InstallDetailResource,
  InstallLastCheck,
} from '@/app/components/features/process-status/install-status-detail/model';
import {
  serviceWorkGate,
  serviceWorkStep,
  type ServiceWorkResult,
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

const gcpDetail = async (targetSourceId: number): Promise<InstallCheckDetail> => {
  const detail = buildGcpInstallDetail(await getGcpInstallationStatus(targetSourceId));
  return {
    lastCheck: detail.lastCheck,
    unavailable: detail.lastCheck.unavailable === true,
    resources: detail.resources,
  };
};

/** 서비스 측 작업 단계를 가진 두 프로바이더뿐 — 나머지는 조회 자체를 하지 않는다. */
const FETCHERS: Record<string, (id: number) => Promise<InstallCheckDetail>> = {
  aws: awsDetail,
  gcp: gcpDetail,
};

export interface InstallCheckState {
  /**
   * `null` when this target has no service-side step at all (AWS 자동 설치·Azure·IDC·SDU).
   * 부르는 쪽은 아무것도 그리지 않는다 — 「할 일 없음」이라는 문장조차 두지 않는다.
   */
  gate: ServiceWorkResult | null;
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
  const step = serviceWorkStep(provider, manualInstall);
  const fetcher = step ? FETCHERS[provider] : undefined;

  // Latest-request-wins, the pattern PipelineTab's own `load()` uses: a response for a
  // previous target source (or a superseded reload) must not commit over the current one.
  const seqRef = useRef(0);
  const load = useCallback(async (): Promise<void> => {
    const seq = ++seqRef.current;
    if (!fetcher) {
      setLoading(false);
      return;
    }
    setFailed(false);
    try {
      const next = await fetcher(targetSourceId);
      if (seq !== seqRef.current) return;
      setDetail(next);
    } catch {
      if (seq !== seqRef.current) return;
      // 실패는 빈 결과가 아니다 — 마지막으로 읽은 스냅샷은 그대로 두고, 판정만 unknown 이 된다.
      setFailed(true);
    } finally {
      if (seq === seqRef.current) setLoading(false);
    }
  }, [fetcher, targetSourceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  // 판정은 스냅샷이 바뀔 때만 새로 난다 — `serviceWorkGate` 은 매번 새 객체를 내므로,
  // 메모 없이는 이 값을 내려받는 카드가 렌더마다 새 prop 을 받는다.
  const gate = useMemo(
    () =>
      step === null
        ? null
        : serviceWorkGate({
            step,
            // 읽기에 실패했으면 판정하지 않는다. 첫 조회 전에도 `detail` 이 null 이라
            // 같은 자리로 떨어진다 — 로딩 중의 판정은 unknown 이고, unknown 은 경고하지 않는다.
            detail: failed ? null : detail,
          }),
    // `step` 은 렌더마다 새로 만들어지는 리터럴이라 그 자체는 의존이 될 수 없다 — 그 안의
    // 두 값이 곧 그 단계의 정체다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step?.id, step?.title, detail, failed],
  );

  return {
    gate,
    // 실패했으면 시각도 사유도 내놓지 않는다 — 직전 성공의 `fail_reason` 을 이번 실패의
    // 사유로 찍는 것이 이 한 줄을 두는 이유다(스냅샷은 남기되 그 위에 얹어 말하지 않는다).
    lastCheck: failed ? null : (detail?.lastCheck ?? null),
    loading,
    failed,
    reload,
  };
}
