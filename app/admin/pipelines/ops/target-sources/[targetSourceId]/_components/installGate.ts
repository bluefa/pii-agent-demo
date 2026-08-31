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

/** Admin ops is Korean-only (the language toggle does not reach this console). */
const t = INSTALL_COPY.ko;

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
    return manualInstall ? { id: 'service', title: '서비스 측 Terraform 적용' } : null;
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
