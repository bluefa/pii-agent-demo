/**
 * 서비스 측 작업 게이트 — 이 대상에서 **서비스가 직접 해야 하는 설치 단계**가 있는가, 그
 * 단계가 끝났는가.
 *
 * 설치 상태 계약은 프로바이더마다 여러 단계를 준다(AWS 셋, Azure 넷, GCP 셋, IDC 셋).
 * 운영 콘솔이 그 전부를 옮겨 적을 이유는 없다 — 운영자가 이 화면에서 답해야 하는 질문은
 * 하나이고, 그 답이 걸린 단계도 **하나**다 (오너 2026-08-31):
 *
 *   AWS 수동 설치   `service_terraform` — 서비스가 스크립트를 제 계정에 직접 적용한다.
 *   GCP            `service_side_subnet_creation` — PSC용 Subnet 을 서비스가 만든다.
 *
 * 그 외에는 **아무것도 없다**. AWS 자동 설치·Azure·IDC 는 서비스가 손댈 단계가 없으므로
 * 조회도 하지 않고 아무것도 그리지 않는다. 「없음」을 말하는 빈 상태조차 두지 않는다:
 * 할 일이 없다는 문장이 상시로 자리를 차지하면 있는 경우의 무게가 깎인다.
 *
 * 판정을 읽는 곳은 한 군데다 — 인프라 작업 탭의 `현재 작업` 카드, 그러니까 `작업 시작` 을
 * 가진 그 카드다. 경고가 필요한 순간은 **설치 작업을 시작하려는 순간** 하나뿐이라
 * (오너 2026-08-31), 문장은 그 동작 바로 위에 선다. 막지는 않는다: 주의이지 게이트가 아니다.
 *
 * ⛔ `unknown` 은 경고하지 않는다. 조회 실패·FAILED last_check·
 * `installation_status_unavailable`·리소스 0건은 전부 「읽지 못했다」이지 「끝났다」도
 * 「안 끝났다」도 아니다.
 */
import {
  isSettledInstallStatus,
  type InstallDetailResource,
  type InstallLastCheck,
  type InstallStepValue,
} from '@/app/components/features/process-status/install-status-detail/model';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';
import { IDC_COPY } from '@/app/target-sources/[targetSourceId]/_components/idc/copy';

/** Admin ops is Korean-only (the language toggle does not reach this console). */
const t = INSTALL_COPY.ko;

/**
 * This console's name for the AWS manual-install step. The user-facing Step 4 calls it
 * `Terraform 직접 적용`; the operator needs to read WHO applies, and both admin tabs
 * (인프라 작업 · 연결 테스트) must name the same cell with the same words.
 */
const AWS_SERVICE_MANUAL_TITLE = '서비스 측 Terraform 적용';

/** 서비스가 직접 하는 그 한 단계. */
export interface ServiceWorkStep {
  /**
   * Cell key inside `InstallDetailResource.cells` — the ADAPTER's key, not the wire field.
   * `service` is AWS `service_terraform`; `subnet` is GCP `service_side_subnet_creation`.
   * The cells are what this module reads, so the id has to be the key that indexes them.
   */
  id: string;
  title: string;
}

/**
 * 이 대상에 서비스 측 작업 단계가 있는가. 없으면 `null` 이고, 부르는 쪽은 조회조차 하지
 * 않는다 — 그릴 것이 없는 화면을 위해 요청을 보내지 않는다.
 *
 * 이름은 서비스 화면 Step 4 가 쓰는 그 문자열이다(`install-copy`) — GCP 는 그대로 쓴다.
 * AWS 수동 설치만 이 콘솔의 이름을 갖는다(오너 2026-08-31): Step 4 는 제 화면을 보는
 * 사람에게 「Terraform 직접 적용」이라고 말하지만, 운영자가 읽어야 하는 것은 **누가**
 * 적용하는가다. `install-copy` 는 그 화면의 것이므로 여기서 건드리지 않는다.
 */
export const serviceWorkStep = (
  /** Already normalized by the screen (`pipelineProviderKey`). */
  provider: string,
  /** AWS only — 자동 설치는 BDC 가 적용하므로 서비스가 할 일이 없다. */
  manualInstall: boolean,
): ServiceWorkStep | null => {
  if (provider === 'aws') {
    return manualInstall ? { id: 'service', title: AWS_SERVICE_MANUAL_TITLE } : null;
  }
  if (provider === 'gcp') return { id: 'subnet', title: t.gcp.subnetTitle };
  return null;
};

/** 그 단계의 한 리소스 — 패널의 한 행. */
export interface ServiceWorkRow {
  resourceId: string;
  resourceName: string | null;
  status: InstallStepValue;
  guide: string | null;
}

export type ServiceWorkKind = 'needed' | 'done' | 'unknown';

export interface ServiceWorkResult {
  kind: ServiceWorkKind;
  step: ServiceWorkStep;
  /** 정착한(COMPLETED·SKIP) 셀 수와 전체 셀 수. */
  done: number;
  total: number;
  /** 아직 정착하지 않은 행이 먼저 — 열었을 때 할 일이 맨 위에 온다. */
  rows: ServiceWorkRow[];
}

export interface ServiceWorkInput {
  step: ServiceWorkStep;
  /** The adapter output. `null` = not read yet, or the fetch failed. */
  detail: {
    lastCheck: InstallLastCheck | null;
    /** `installation_status_unavailable` — the upstream said it cannot answer. */
    unavailable: boolean;
    resources: readonly InstallDetailResource[];
  } | null;
}

/**
 * 판정 + 그 단계의 모든 행.
 *
 * `done` 은 이 단계의 **모든 셀**이 COMPLETED 이거나 SKIP 이라는 뜻이다. 하나라도 남으면
 * `needed`. 읽지 못했으면 `unknown` 이고, 그때는 행도 없다 — 없는 목록을 0건이라 그리는
 * 것과 못 읽었다고 말하는 것은 다른 문장이다.
 */
export const serviceWorkGate = ({ step, detail }: ServiceWorkInput): ServiceWorkResult => {
  const unknown: ServiceWorkResult = { kind: 'unknown', step, done: 0, total: 0, rows: [] };

  if (detail === null || detail.unavailable || detail.lastCheck?.status === 'FAILED') {
    return unknown;
  }

  const rows: ServiceWorkRow[] = [];
  for (const resource of detail.resources) {
    const cell = resource.cells[step.id];
    // 이 단계의 셀이 없는 리소스는 증거가 아니다 — 분모에도 분자에도 넣지 않는다.
    if (!cell) continue;
    rows.push({
      resourceId: resource.resourceId,
      resourceName: resource.resourceName,
      status: cell.status,
      guide: cell.guide,
    });
  }

  // 셀이 하나도 없으면 셀 대상이 없다 — 빈 집합에서 「전부 끝났다」는 저절로 참이 되고,
  // 그건 확인한 사실이 아니라 확인할 것이 없었다는 뜻이다.
  if (rows.length === 0) return unknown;

  const settled = (row: ServiceWorkRow): boolean => isSettledInstallStatus(row.status);
  const done = rows.filter(settled).length;

  return {
    kind: done === rows.length ? 'done' : 'needed',
    step,
    done,
    total: rows.length,
    // 안 끝난 것이 위로. 같은 무리 안에서는 들어온 순서 그대로다(정렬은 안정 정렬).
    rows: [...rows].sort((a, b) => Number(settled(a)) - Number(settled(b))),
  };
};

// ---------------------------------------------------------------------------
// 설치 전체 게이트 — 연결 테스트 탭의 것
// ---------------------------------------------------------------------------

/**
 * 위의 `serviceWorkStep`/`serviceWorkGate` 는 **서비스가 손댈 한 단계**만 본다. 여기 아래는
 * 다른 질문이다: **이 대상의 설치가 통째로 끝났는가**.
 *
 * 연결 테스트는 설치가 세운 것에 접속하는 동작이라, 안 끝난 리소스는 이번 회차에서 반드시
 * 실패한다. 그래서 이 판정은 프로바이더를 가리지 않는다 — 누가 하는 일이냐는 여기서 상관이
 * 없고, 셀 하나라도 정착하지 않았으면 그 리소스는 연결에 실패할 리소스다.
 *
 * ⛔ 같은 세 가지를 지킨다. `unknown` 은 경고하지 않고(조회 실패·`unavailable`·FAILED
 * last_check·리소스 0건), `done` 도 아무 말도 하지 않는다. 못 읽은 것을 근거로 실행을
 * 막아설 수 없고, 끝난 일은 소식이 아니다.
 *
 * ⛔ 이것도 게이트가 아니라 예보다. 실행 버튼을 잠그는 것은 Credential 미설정 하나뿐이고,
 * 이 판정은 확인 모달 한 겹으로만 선다.
 */

/** 셀 키 → 이 단계의 이름. 이름은 서비스 화면 Step 4 가 쓰는 그 문자열이다. */
const STEP_TITLES: Record<string, Record<string, string>> = {
  gcp: { subnet: t.gcp.subnetTitle, service: t.gcp.serviceTitle, bdc: t.gcp.bdcTitle },
  azure: {
    pe: t.azure.peTitle,
    vmSubnet: t.azure.vmSubnetTitle,
    vmApply: t.azure.vmApplyTitle,
    bdc: t.azure.bdcTitle,
  },
  // IDC 의 이름은 `install-copy` 가 아니라 IDC 화면 자신의 카피에 있다 — 그 화면이 쓰는 낱말
  // 그대로다(BDC CX 영역 · BDC BDP 영역 · 접근 허용).
  idc: {
    cx: IDC_COPY.ko.step4CxTitle,
    bdp: IDC_COPY.ko.step4BdpTitle,
    firewall: IDC_COPY.ko.step4FirewallTitle,
  },
};

/**
 * AWS 만 설치 모드로 이름이 갈린다(자동/수동) — 나머지는 모드가 없다.
 *
 * 매핑에 없는 키는 **원문 그대로** 남긴다. 계약이 단계를 하나 더 늘리면 이 화면은 그 단계를
 * 모르는 채로도 「무언가 안 끝났다」는 사실만은 옳게 말해야 하고, 모르는 것을 아는 이름으로
 * 바꿔 부르는 것보다 키를 그대로 보이는 편이 정직하다.
 */
export const installStepTitle = (
  provider: string,
  manualInstall: boolean,
  cellKey: string,
): string => {
  if (provider === 'aws') {
    const aws: Record<string, string> = {
      service: manualInstall ? AWS_SERVICE_MANUAL_TITLE : t.aws.serviceTitleAuto,
      bdcService: t.aws.bdcServiceTitle,
      bdcCommon: t.aws.bdcCommonTitle,
    };
    return aws[cellKey] ?? cellKey;
  }
  return STEP_TITLES[provider]?.[cellKey] ?? cellKey;
};

/** 안 끝난 셀 하나 — 목록의 한 행. 한 리소스에 둘이 남으면 행도 둘이다. */
export interface InstallPendingRow {
  resourceId: string;
  resourceName: string | null;
  stepTitle: string;
  status: InstallStepValue;
  guide: string | null;
}

export type InstallPendingKind = 'needed' | 'done' | 'unknown';

export interface InstallPendingResult {
  kind: InstallPendingKind;
  /** 안 끝난 **리소스** 수 — 행 수가 아니다(한 리소스가 여러 행을 낼 수 있다). */
  open: number;
  /** 이번 조회가 읽은 전체 리소스 수. */
  total: number;
  rows: InstallPendingRow[];
}

export interface InstallPendingInput {
  /** Already normalized by the screen (`pipelineProviderKey`). */
  provider: string;
  /** AWS only — 단계 이름이 설치 모드로 갈린다. */
  manualInstall: boolean;
  /** The adapter output. `null` = not read yet, or the fetch failed. */
  detail: {
    lastCheck: InstallLastCheck | null;
    unavailable: boolean;
    resources: readonly InstallDetailResource[];
  } | null;
}

export const installPendingGate = ({
  provider,
  manualInstall,
  detail,
}: InstallPendingInput): InstallPendingResult => {
  const unknown: InstallPendingResult = { kind: 'unknown', open: 0, total: 0, rows: [] };

  if (detail === null || detail.unavailable || detail.lastCheck?.status === 'FAILED') {
    return unknown;
  }
  // 리소스가 0건이면 확인한 것이 없다 — 빈 집합에서 「전부 끝났다」는 저절로 참이 되고,
  // 그건 사실이 아니라 확인할 것이 없었다는 뜻이다(위 게이트와 같은 규칙).
  if (detail.resources.length === 0) return unknown;

  const rows: InstallPendingRow[] = [];
  const openIds = new Set<string>();
  for (const resource of detail.resources) {
    // 셀의 순서는 어댑터가 내놓은 순서 그대로다 — 그것이 곧 Step 4 레일의 단계 순서다.
    for (const [key, cell] of Object.entries(resource.cells)) {
      if (isSettledInstallStatus(cell.status)) continue;
      openIds.add(resource.resourceId);
      rows.push({
        resourceId: resource.resourceId,
        resourceName: resource.resourceName,
        stepTitle: installStepTitle(provider, manualInstall, key),
        status: cell.status,
        guide: cell.guide,
      });
    }
  }

  return {
    kind: rows.length === 0 ? 'done' : 'needed',
    open: openIds.size,
    total: detail.resources.length,
    rows,
  };
};
