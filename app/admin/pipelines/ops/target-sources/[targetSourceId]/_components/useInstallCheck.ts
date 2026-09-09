'use client';

/**
 * 설치 상태 조회 — 같은 GET 을 읽어 두 질문에 답한다.
 *
 *   `useInstallCheck`   서비스가 손댈 **한 단계**가 끝났는가 (인프라 작업 탭)
 *   `useInstallPending` 설치가 **통째로** 끝났는가 (연결 테스트 탭)
 *
 * 조회 한 벌(`useInstallDetail`)은 둘이 나눠 쓴다 — latest-request-wins, 실패해도 스냅샷을
 * 버리지 않기, 조회하지 않는 대상에서는 요청 자체를 내지 않기가 전부 거기 한 번 있다.
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
import { getAzureInstallationStatus } from '@/app/lib/api/azure';
import { getGcpInstallationStatus } from '@/app/lib/api/gcp';
import { getIdcInstallationStatus } from '@/app/lib/api/idc';
import { buildAzureInstallDetail } from '@/app/components/features/process-status/azure/install-detail-adapter';
import { buildGcpInstallDetail } from '@/app/components/features/process-status/gcp/install-detail-adapter';
import { buildIdcInstallDetail } from '@/app/components/features/process-status/idc/install-detail-adapter';
import type {
  InstallDetailResource,
  InstallLastCheck,
  InstallStepCell,
} from '@/app/components/features/process-status/install-status-detail/model';
import { buildInstallTasks, type InstallTask } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installTasks';
import {
  installPendingGate,
  serviceWorkGate,
  serviceWorkStep,
  type InstallPendingResult,
  type ServiceWorkResult,
} from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/installGate';

/** What the gate reads: the cells, plus the two facts that say we could not read them. */
export interface InstallCheckDetail {
  lastCheck: InstallLastCheck | null;
  unavailable: boolean;
  resources: readonly InstallDetailResource[];
  roleVerify?: InstallStepCell;
}

const awsDetail = async (targetSourceId: number): Promise<InstallCheckDetail> => {
  const status = await getAwsInstallationStatus(targetSourceId);
  return {
    lastCheck: status.lastCheck,
    unavailable: status.lastCheck.unavailable === true,
    ...(status.roleVerify && { roleVerify: { status: status.roleVerify.status, guide: null } }),
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

const azureDetail = async (targetSourceId: number): Promise<InstallCheckDetail> => {
  const detail = buildAzureInstallDetail(await getAzureInstallationStatus(targetSourceId));
  return {
    lastCheck: detail.lastCheck,
    unavailable: detail.lastCheck.unavailable === true,
    resources: detail.resources,
  };
};

const idcDetail = async (targetSourceId: number): Promise<InstallCheckDetail> => {
  const detail = buildIdcInstallDetail(await getIdcInstallationStatus(targetSourceId));
  return {
    lastCheck: detail.lastCheck,
    unavailable: detail.lastCheck.unavailable === true,
    resources: detail.resources,
  };
};

type InstallFetcher = (id: number) => Promise<InstallCheckDetail>;

/** 서비스 측 작업 단계를 가진 두 프로바이더뿐 — 나머지는 조회 자체를 하지 않는다. */
const FETCHERS: Record<string, InstallFetcher> = {
  aws: awsDetail,
  gcp: gcpDetail,
};

/**
 * 설치 전체를 묻는 쪽은 네 프로바이더 전부다 — 연결 테스트는 누가 설치했는지를 가리지 않고,
 * 안 끝난 리소스는 어느 CSP 에서든 그 회차에서 실패한다. SDU 만 없다: 그 대상은 이 콘솔에서
 * 설치 상태를 갖지 않는다.
 */
const ALL_FETCHERS: Record<string, InstallFetcher> = {
  aws: awsDetail,
  azure: azureDetail,
  gcp: gcpDetail,
  idc: idcDetail,
};

/** 조회 한 벌 — 스냅샷·로딩·실패·다시 읽기. 두 훅이 같은 것을 두 번 쓰지 않도록 여기 한 번. */
interface InstallDetailState {
  detail: InstallCheckDetail | null;
  loading: boolean;
  failed: boolean;
  reload: () => void;
}

function useInstallDetail(
  targetSourceId: number,
  /** `undefined` = 이 대상에서는 조회하지 않는다 — 요청이 아예 나가지 않는다. */
  fetcher: InstallFetcher | undefined,
): InstallDetailState {
  const [detail, setDetail] = useState<InstallCheckDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

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
    // 대상(또는 프로바이더)이 바뀌면 앞 대상의 스냅샷은 사실이 아니다 — 비우지 않으면
    // 새 대상의 게이트가 앞 대상의 설치 판정으로 정착한 것처럼 답한다.
    //
    // 초기화가 `load()` 안이 아니라 이 자리인 이유: `reload()` 도 같은 `load()` 를 부르는데,
    // 다시 읽는 동안 스냅샷을 버리면 「실패는 빈 결과가 아니다」(아래 catch)가 무너진다.
    // 여기서만 비우면 대상이 바뀐 순간에만 비워진다 — `load` 의 정체가 곧 [fetcher, id] 다.
    setDetail(null);
    setLoading(true);
    void load();
  }, [load]);

  const reload = useCallback(() => {
    void load();
  }, [load]);

  return { detail, loading, failed, reload };
}

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
  const step = serviceWorkStep(provider, manualInstall);
  const { detail, loading, failed, reload } = useInstallDetail(
    targetSourceId,
    step ? FETCHERS[provider] : undefined,
  );

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

// ---------------------------------------------------------------------------
// 설치 전체 조회 — 연결 테스트 탭의 것
// ---------------------------------------------------------------------------

export interface InstallPendingState {
  /**
   * `null` when this target has no install status to read at all (SDU). 부르는 쪽은
   * 아무것도 그리지 않는다 — 판정이 없는 것과 「끝났다」는 다른 문장이다.
   */
  pending: InstallPendingResult | null;
  tasks: InstallTask[];
  lastCheck: InstallLastCheck | null;
  loading: boolean;
  /** The lookup itself failed (network / 4xx / 5xx) — distinct from a FAILED last_check. */
  failed: boolean;
  reload: () => void;
}

/**
 * 설치가 통째로 끝났는가 — 연결 테스트를 누르기 전에 한 번 묻는 그 질문.
 *
 * `useInstallCheck` 과 조회는 같고(같은 CSR 헬퍼·같은 어댑터·같은 latest-request-wins),
 * 다른 것은 **무엇을 세는가**뿐이다: 저쪽은 서비스가 손댈 한 단계, 이쪽은 모든 단계.
 * 그래서 프로바이더도 넷 전부다.
 *
 * Read on entry and after a TC run settles, without installation polling.
 * These GETs read the latest stored check; they do not trigger an installation check.
 */
export function useInstallPending(
  targetSourceId: number,
  /** Already normalized by the screen (`pipelineProviderKey`) — 'sdu' fetches nothing. */
  provider: string,
  /** AWS only — 단계 이름이 설치 모드로 갈린다. */
  manualInstall: boolean,
): InstallPendingState {
  const fetcher = ALL_FETCHERS[provider];
  const { detail, loading, failed, reload } = useInstallDetail(targetSourceId, fetcher);

  const tasks = useMemo(
    () => buildInstallTasks({ provider, manualInstall, detail: failed ? null : detail }),
    [provider, manualInstall, detail, failed],
  );

  // 판정은 스냅샷이 바뀔 때만 새로 난다 — `installPendingGate` 은 매번 새 객체를 내므로,
  // 메모 없이는 이 값을 내려받는 카드가 렌더마다 새 prop 을 받는다.
  const pending = useMemo(
    () =>
      fetcher === undefined
        ? null
        : installPendingGate({
            provider,
            manualInstall,
            // 읽기에 실패했으면 판정하지 않는다. 첫 조회 전에도 `detail` 이 null 이라
            // 같은 자리로 떨어진다 — 로딩 중의 판정은 unknown 이고, unknown 은 말이 없다.
            detail: failed ? null : detail,
          }),
    [fetcher, provider, manualInstall, detail, failed],
  );

  return {
    pending,
    tasks,
    // 실패했으면 시각도 사유도 내놓지 않는다 — 직전 성공의 시각을 이번 조회의 시각으로
    // 찍지 않는다(`useInstallCheck` 과 같은 규칙).
    lastCheck: failed ? null : (detail?.lastCheck ?? null),
    loading,
    failed,
    reload,
  };
}
