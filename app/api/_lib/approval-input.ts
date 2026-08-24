import { z } from 'zod';
import { schemas } from '@/lib/generated/install-v1';
import { bff } from '@/lib/bff/client';
import {
  ApprovalSelectionInput,
  type ApprovalSelection,
  type EndpointInput,
  type IdcInput,
} from '@/lib/approval-selection';

/**
 * 승인 요청 본문의 신뢰 경계.
 *
 * 브라우저는 "무엇을 골랐는가"를 보낸다(`lib/approval-selection.ts`). 리소스가 무엇인지 —
 * 이름·타입·리전·DB 타입·RDS 멤버 목록 — 는 서버가 상류에서 다시 읽어 조립한다. 그 사실을
 * 클라이언트가 주장하게 두면, 스캔이 찾은 적 없는 리소스를 스캔이 본 적 없는 속성으로 연동
 * 대상에 밀어 넣을 수 있다. 재조회는 사용자 세션 쿠키를 달고 나가므로
 * (`lib/bff/auth-headers`) 인가 판정은 상류가 그대로 수행한다 — 여기서 권한을 따로
 * 계산하지 않는다.
 *
 * 세 갈래이고, 갈래마다 막을 수 있는 깊이가 다르다.
 *
 *  - 선택형(스캔이 찾은 클라우드 리소스): `confirm.getResources` 집합과 교집합.
 *    정체성도 속성도 서버 것이다.
 *  - VM(EC2 검색 추가): 검색이 "스캔이 찾은 인스턴스" 안에서만 도므로 정확한
 *    instance-id 재검색으로 정체성이 확정되고, 주소도 그 결과에서 읽는다. 사용자가 실제로
 *    친 것은 DB 종류·포트·SID 뿐이다.
 *  - IDC(수기 입력): 대조할 집합이 서버에 아예 없다. 형식·범위만 강제한다.
 *
 * 형식 검증이 걸러내지 못하는 것 — "그 주소가 이 서비스 것인가" — 은 승인 단계와
 * 상류의 몫이다. 여기서 그것까지 판정하는 척하면 안 된다.
 */

type Metadata = z.infer<typeof schemas.TargetSourceResourceMetadataDto>;
type ResourceItem = z.infer<typeof schemas.TargetSourceResourceItemDto>;
type ApprovalInput = z.infer<typeof schemas.ApprovalRequestInputDto>;
type RdsCandidate = z.infer<typeof schemas.RdsClusterInstanceCandidateDto>;
type SelectionRow = ApprovalSelection['resources'][number];

/** 정확한 instance-id 로 거는 prefix 검색 — 일치 항목은 많아야 하나다. */
const EC2_EXACT_LOOKUP_LIMIT = 1;

export { ApprovalSelectionInput };
export type { ApprovalSelection };

export interface ResolveFailure {
  /** 사용자에게 보일 한 줄. 위조 시도와 스캔 변경을 구분해 말하지 않는다. */
  message: string;
  /** 409 는 "다시 읽으면 달라진다", 400 은 "이 본문으로는 안 된다". */
  status: 400 | 409;
}

type ResolveResult =
  | { ok: true; value: ApprovalInput }
  | { ok: false; failure: ResolveFailure };

const isIdcProvider = (provider: string): boolean => provider.trim().toUpperCase() === 'IDC';
const isAwsProvider = (provider: string): boolean => provider.trim().toUpperCase() === 'AWS';

const endpointMetadata = (endpoint: EndpointInput | undefined): Metadata =>
  endpoint
    ? {
        ...(endpoint.host ? { host: endpoint.host } : {}),
        ...(endpoint.port !== undefined ? { port: endpoint.port } : {}),
        ...(endpoint.database_type ? { database_type: endpoint.database_type } : {}),
        ...(endpoint.oracle_service_id ? { oracle_service_id: endpoint.oracle_service_id } : {}),
        ...(endpoint.network_interface_id
          ? { network_interface_id: endpoint.network_interface_id }
          : {}),
      }
    : {};

const idcMetadata = (idc: IdcInput): Metadata => ({
  provider: 'IDC',
  idc_host_format: idc.host_format,
  ...(idc.database_type ? { database_type: idc.database_type } : {}),
  ...(idc.host_format === 'HOST' ? { idc_host: idc.hosts[0] } : { idc_ips: idc.hosts }),
  ...(idc.port !== undefined ? { port: idc.port } : {}),
  ...(idc.oracle_service_id ? { oracle_service_id: idc.oracle_service_id } : {}),
  ...(idc.credential_id ? { credential_id: idc.credential_id } : {}),
});

/**
 * 상류가 돌려준 행에서 되싣을 속성만 뽑는다. 클라이언트가 보낸 같은 이름의 값은
 * 여기 오지 않는다 — 그게 이 파일의 요점이다.
 */
const authoritativeMetadata = (item: ResourceItem): Metadata => {
  const source = item.metadata ?? {};
  return {
    ...(source.provider ? { provider: source.provider } : {}),
    ...(source.region ? { region: source.region } : {}),
    ...(source.database_type ? { database_type: source.database_type } : {}),
    ...(source.resource_type ? { resource_type: source.resource_type } : {}),
    ...(source.rds_instance_candidates
      ? { rds_instance_candidates: source.rds_instance_candidates }
      : {}),
  };
};

/**
 * RDS 멤버 선택을 후보 목록에 대고 확인한다. 역할(`selected_rds_instance_role`)은
 * 클라이언트가 보내지 않는다 — 고른 멤버에서 서버가 읽는다.
 */
const rdsSelection = (
  row: SelectionRow,
  candidates: readonly RdsCandidate[],
): { ok: true; fields: Metadata } | { ok: false } => {
  if (!row.selected_rds_instance_resource_id) return { ok: true, fields: {} };
  const chosen = candidates.find(
    (candidate) => candidate.resource_id === row.selected_rds_instance_resource_id,
  );
  if (!chosen) return { ok: false };
  return {
    ok: true,
    fields: {
      selected_rds_instance_resource_id: row.selected_rds_instance_resource_id,
      ...(chosen.cluster_member_role
        ? { selected_rds_instance_role: chosen.cluster_member_role }
        : {}),
    },
  };
};

const buildFromAuthoritative = (row: SelectionRow, item: ResourceItem): ResourceItem => {
  const candidates = item.metadata?.rds_instance_candidates ?? [];
  const rds = rdsSelection(row, candidates);
  const metadata: Metadata = {
    ...authoritativeMetadata(item),
    ...endpointMetadata(row.endpoint),
    ...(rds.ok ? rds.fields : {}),
  };
  const base = {
    resource_id: row.resource_id,
    ...(item.resource_name ? { resource_name: item.resource_name } : {}),
    ...(item.resource_type ? { resource_type: item.resource_type } : {}),
    ...(item.integration_category ? { integration_category: item.integration_category } : {}),
    metadata,
  };
  if (row.selected) return { ...base, selected: true };
  // 스캔 판정은 서버 것이고, 사용자가 적은 사유는 사용자 것이다. 둘 다 실어 보낸다:
  // 화면이 사유 칸을 비워 두면 "사유를 안 적었다"와 구별되지 않는다.
  const reason = row.exclusion_reason || item.recommend_fail_reason || undefined;
  return {
    ...base,
    selected: false,
    ...(reason ? { exclusion_reason: reason } : {}),
    ...(item.recommend_fail_reason
      ? { recommend_fail_reason: item.recommend_fail_reason }
      : {}),
  };
};

const ec2Hit = z
  .object({
    resource_id: z.string().nullable().optional(),
    resource_name: z.string().nullable().optional(),
    metadata: z
      .object({
        private_ip_address: z.string().nullable().optional(),
        private_dns_name: z.string().nullable().optional(),
      })
      .passthrough()
      .nullable()
      .optional(),
  })
  .passthrough();
const ec2Wire = z
  .object({ resources: z.array(ec2Hit).nullable().optional() })
  .passthrough();
type Ec2Hit = z.infer<typeof ec2Hit>;

/** 수기 추가 EC2 행의 wire resource_type — 이 흐름의 상수다(`manual-ec2.ts`). */
const EC2_INSTANCE_RESOURCE_TYPE = 'AWS_EC2_INSTANCE';
/**
 * EC2/VM 은 DB 말고 다른 것도 돌리므로 스캔이 언제나 같은 판정을 준다. 사용자 입력이
 * 아니라 이 흐름의 상수이고, 그래서 서버가 붙인다.
 */
const EC2_INTEGRATION_CATEGORY = 'NO_INSTALL_NEEDED';

/**
 * 스캔이 찾은 EC2 안에서 이 instance-id 를 집어 온다. 검색은 prefix 매칭이므로 정확한
 * id 로 걸고 정확히 일치하는 행만 받는다 — prefix 가 겹치는 다른 인스턴스가 통과하면 안 된다.
 */
const findEc2Instance = async (
  targetSourceId: number,
  instanceId: string,
): Promise<Ec2Hit | undefined> => {
  const raw = await bff.aws.searchEc2Resources(
    targetSourceId,
    instanceId,
    EC2_EXACT_LOOKUP_LIMIT,
  );
  const parsed = ec2Wire.safeParse(raw);
  if (!parsed.success) return undefined;
  return (parsed.data.resources ?? []).find((item) => item.resource_id === instanceId);
};

/**
 * VM 수기 추가 행. 주소는 사용자가 고르지 않는다 — 스캔이 보고한 Private IP 이고, 추가
 * 모달에서도 읽기 전용이다. 사용자가 실제로 친 것은 DB 종류·포트·SID 뿐이라 그 셋만
 * 클라이언트에서 받는다.
 */
const buildManualEc2 = (row: SelectionRow, hit: Ec2Hit): ResourceItem => {
  const host = hit.metadata?.private_ip_address ?? undefined;
  const name = hit.resource_name ?? hit.metadata?.private_dns_name ?? undefined;
  const typed = endpointMetadata(row.endpoint);
  return {
    resource_id: row.resource_id,
    ...(name ? { resource_name: name } : {}),
    resource_type: EC2_INSTANCE_RESOURCE_TYPE,
    integration_category: EC2_INTEGRATION_CATEGORY,
    selected: row.selected,
    metadata: {
      provider: 'AWS',
      resource_type: EC2_INSTANCE_RESOURCE_TYPE,
      ...(typed.database_type ? { database_type: typed.database_type } : {}),
      ...(typed.port !== undefined ? { port: typed.port } : {}),
      ...(typed.oracle_service_id ? { oracle_service_id: typed.oracle_service_id } : {}),
      ...(host ? { host } : {}),
    },
    ...(!row.selected && row.exclusion_reason ? { exclusion_reason: row.exclusion_reason } : {}),
  };
};

const buildIdc = (row: SelectionRow, idc: IdcInput): ResourceItem => ({
  resource_id: row.resource_id,
  selected: row.selected,
  metadata: idcMetadata(idc),
  ...(!row.selected && row.exclusion_reason ? { exclusion_reason: row.exclusion_reason } : {}),
});

const fail = (message: string, status: 400 | 409 = 400): ResolveResult => ({
  ok: false,
  failure: { message, status },
});

/**
 * 선택을 계약 본문으로 바꾼다. 상류로 나가는 모양은 `ApprovalRequestInputDto` 그대로다 —
 * 좁아진 것은 브라우저↔프론트 서버 경계뿐이고, 계약은 건드리지 않는다.
 */
export const resolveApprovalInput = async (
  targetSourceId: number,
  cloudProvider: string,
  input: ApprovalSelection,
): Promise<ResolveResult> => {
  const ids = input.resources.map((row) => row.resource_id);
  if (new Set(ids).size !== ids.length) return fail('같은 리소스가 두 번 담겼습니다.');

  if (isIdcProvider(cloudProvider)) {
    const resources: ResourceItem[] = [];
    for (const row of input.resources) {
      // IDC 는 수기 입력이라 행마다 접속 정보가 있어야 한다 — 없으면 연동 대상이 아니다.
      if (!row.idc) return fail('IDC 연동 대상에는 접속 정보가 필요합니다.');
      if (row.endpoint) return fail('IDC 행은 endpoint 를 쓰지 않습니다.');
      resources.push(buildIdc(row, row.idc));
    }
    return { ok: true, value: { resources } };
  }

  if (input.resources.some((row) => row.idc)) {
    return fail('IDC 접속 정보는 IDC 연동에서만 보낼 수 있습니다.');
  }

  const authoritative = await bff.confirm.getResources(targetSourceId);
  const known = new Map<string, ResourceItem>();
  for (const item of authoritative.resources ?? []) {
    if (item.resource_id) known.set(item.resource_id, item);
  }

  const resources: ResourceItem[] = [];
  for (const row of input.resources) {
    const item = known.get(row.resource_id);
    if (item) {
      const candidates = item.metadata?.rds_instance_candidates ?? [];
      if (!rdsSelection(row, candidates).ok) {
        return fail('선택한 RDS 인스턴스가 이 클러스터의 멤버가 아닙니다.');
      }
      resources.push(buildFromAuthoritative(row, item));
      continue;
    }
    // 스캔 목록에 없는 id — AWS 라면 사용자가 검색해 추가한 EC2 일 수 있다.
    if (isAwsProvider(cloudProvider)) {
      const hit = await findEc2Instance(targetSourceId, row.resource_id);
      if (hit) {
        resources.push(buildManualEc2(row, hit));
        continue;
      }
    }
    return fail(
      '연동 대상 목록이 변경되었습니다. 화면을 새로 읽고 다시 선택해 주세요.',
      409,
    );
  }
  return { ok: true, value: { resources } };
};
