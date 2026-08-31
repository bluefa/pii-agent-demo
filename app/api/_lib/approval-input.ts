import { z } from 'zod';
import { schemas } from '@/lib/generated/install-v1';
import { bff } from '@/lib/bff/client';
import { normalizeCloudProvider, toWireDatabaseType, type CloudProvider } from '@/lib/types';
import { VM_RESOURCE_TYPES } from '@/lib/resource-catalog';
import {
  ApprovalSelectionInput,
  type ApprovalSelection,
  type EndpointInput,
  type IdcInput,
  type ManualEc2Input,
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

// 갈래는 화면이 쓰는 바로 그 함수로 정한다. 손으로 `=== 'AWS'` 를 적으면 별칭 표를
// 건너뛰게 되고, 서버가 화면보다 좁아진다 — `normalizeCloudProvider` 는 표에 없는 값을
// 'AWS' 로 떨어뜨리므로(`SDU`, `ORACLE_CLOUD` …) 그런 대상에서도 화면은 EC2 수기 추가
// 입구를 연다(`CandidateResourceSection`: `provider === 'AWS'`). 서버만 원문을 보고
// 거부하면 새로고침해도 같은 화면이 같은 행을 다시 만들어 영원히 409 다.
const providerOf = (provider: string): CloudProvider => normalizeCloudProvider(provider);
const isIdcProvider = (provider: string): boolean => providerOf(provider) === 'IDC';
const isAwsProvider = (provider: string): boolean => providerOf(provider) === 'AWS';

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
  // 옛 매퍼와 같은 생략 규칙: 도메인은 첫 호스트만, IP 는 목록이 비면 키를 붙이지 않는다.
  ...(idc.host_format === 'HOST'
    ? (idc.hosts[0] ? { idc_host: idc.hosts[0] } : {})
    : (idc.hosts.length > 0 ? { idc_ips: idc.hosts } : {})),
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
    // 요청은 database_type 을 소문자 정규형으로 보낸다(lib/types.ts). 좁히기 전
    // 매퍼가 `toWireDatabaseType` 를 거쳤으므로 여기서도 거친다 — 스캔 값을 날것
    // 그대로 되싣으면 대문자가 올라가 조용히 모양이 바뀐다.
    ...(source.database_type
      ? { database_type: toWireDatabaseType(source.database_type) }
      : {}),
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

/**
 * 접속 정보를 사용자가 채우는 행인가. 폼은 이 집합에서만 endpoint 를 만들고
 * (`lib/resource-catalog.ts`), 서버도 같은 집합으로 판단한다 — 여기를 열어 두면 스캔이
 * 소유해야 할 속성(대표적으로 database_type)을 클라이언트가 덮어쓴다.
 */
const acceptsEndpoint = (item: ResourceItem): boolean =>
  !!item.resource_type && VM_RESOURCE_TYPES.has(item.resource_type);

const buildFromAuthoritative = (row: SelectionRow, item: ResourceItem): ResourceItem => {
  const candidates = item.metadata?.rds_instance_candidates ?? [];
  const rds = rdsSelection(row, candidates);
  const metadata: Metadata = {
    ...authoritativeMetadata(item),
    ...(acceptsEndpoint(item) ? endpointMetadata(row.endpoint) : {}),
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

/** 수기 추가 EC2 행의 wire resource_type — 이 흐름의 상수다(`manual-ec2.ts`). */
const EC2_INSTANCE_RESOURCE_TYPE = 'AWS_EC2_INSTANCE';
/**
 * EC2/VM 은 DB 말고 다른 것도 돌리므로 스캔이 언제나 같은 판정을 준다. 사용자 입력이
 * 아니라 이 흐름의 상수이고, 그래서 서버가 붙인다.
 */
const EC2_INTEGRATION_CATEGORY = 'NO_INSTALL_NEEDED';

/**
 * 수기 추가 EC2 행. 이 갈래는 서버가 되짚지 않는다 — 인스턴스가 실재하는지, 그 주소가
 * 맞는지는 BFF 가 막는다. 여기서 하는 일은 형식이 통과한 값을 계약 모양으로 옮기는 것뿐이고,
 * 그래서 이 행의 metadata 는 유일하게 클라이언트가 적어 넣는 metadata 다.
 */
const buildManualEc2 = (row: SelectionRow, manual: ManualEc2Input): ResourceItem => ({
  resource_id: row.resource_id,
  ...(manual.resource_name ? { resource_name: manual.resource_name } : {}),
  resource_type: EC2_INSTANCE_RESOURCE_TYPE,
  integration_category: EC2_INTEGRATION_CATEGORY,
  selected: row.selected,
  metadata: {
    provider: 'AWS',
    resource_type: EC2_INSTANCE_RESOURCE_TYPE,
    ...endpointMetadata(row.endpoint),
  },
  ...(!row.selected && row.exclusion_reason ? { exclusion_reason: row.exclusion_reason } : {}),
});

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
  // 한 번에 둘을 접는다.
  // ① id 없는 행은 연동 대상이 아니다 — 와이어가 resource_id 없이 준 행을 어댑터가 `''` 로
  //    싣고(`app/lib/api/index.ts`), 매퍼는 후보를 전부 보내므로 그 행이 매 제출에 딸려 온다.
  //    거부하면 새로고침해도 같은 와이어를 다시 읽어 영원히 같은 자리에서 막힌다. 떨군다 —
  //    `ec2.ts` 가 instance id 없는 검색 결과에 쓰는 것과 같은 규칙이다("the id IS the
  //    identity this flow adds").
  // ② 같은 id 가 두 번 오면 첫 행만 남긴다 — 와이어가 같은 id 를 두 번 주면 화면도 한 선택
  //    상태(선택 집합·사유·드래프트가 전부 id 키)를 두 행에 그리므로 첫 행이 곧 화면이 뜻한
  //    것이고, 거부는 새로고침으로 고칠 수 없는 막다른 길이다. 조작된 본문의 중복도 같은
  //    규칙으로 접는다.
  const byId = new Map<string, SelectionRow>();
  for (const row of input.resources) {
    if (row.resource_id !== '' && !byId.has(row.resource_id)) byId.set(row.resource_id, row);
  }
  const rows = [...byId.values()];

  // 스키마의 `.min(1)` 을 필터 뒤에 한 번 더 적용한다. 실 UI 는 여기 못 온다 — 매퍼가
  // 먼저 걸러 내므로 빈 목록은 라우트의 스키마에서 400 으로 끝난다. 남는 도달 경로는
  // 조작된 본문뿐이고, 그때 리소스 0개짜리 승인 요청(상태 전이 + 빈 큐 항목)이 상류에
  // 생기게 둘 이유가 없다.
  if (rows.length === 0) return fail('연동할 리소스가 없습니다.');

  if (isIdcProvider(cloudProvider)) {
    const resources: ResourceItem[] = [];
    for (const row of rows) {
      // IDC 는 수기 입력이라 행마다 접속 정보가 있어야 한다 — 없으면 연동 대상이 아니다.
      if (!row.idc) return fail('IDC 연동 대상에는 접속 정보가 필요합니다.');
      if (row.endpoint) return fail('IDC 행은 endpoint 를 쓰지 않습니다.');
      if (row.manual_ec2) return fail('IDC 행은 수기 추가 EC2 갈래를 쓰지 않습니다.');
      resources.push(buildIdc(row, row.idc));
    }
    return { ok: true, value: { resources } };
  }

  if (rows.some((row) => row.idc)) {
    return fail('IDC 접속 정보는 IDC 연동에서만 보낼 수 있습니다.');
  }

  const authoritative = await bff.confirm.getResources(targetSourceId);
  const known = new Map<string, ResourceItem>();
  for (const item of authoritative.resources ?? []) {
    // 생성 스키마가 느슨해 배열 원소 자체가 null 일 수 있다.
    if (item?.resource_id) known.set(item.resource_id, item);
  }

  const resources: ResourceItem[] = [];
  for (const row of rows) {
    const item = known.get(row.resource_id);
    if (item) {
      // 수기로 추가한 뒤 재스캔이 같은 인스턴스를 후보로 올리면 여기 온다.
      // 입력이 틀린 게 아니라 화면이 오래된 것이라 409 다.
      if (row.manual_ec2) return fail('연동 대상 목록이 변경되었습니다. 화면을 새로 읽고 다시 선택해 주세요.', 409);
      const candidates = item.metadata?.rds_instance_candidates ?? [];
      if (!rdsSelection(row, candidates).ok) {
        // 재스캔이 멤버 목록을 바꾸면 화면의 기본 선택이 사라진 멤버를 가리킨다 —
        // 사용자가 고른 게 틀린 게 아니라 목록이 갱신된 것이라 409 다.
        return fail('연동 대상 목록이 변경되었습니다. 화면을 새로 읽고 다시 선택해 주세요.', 409);
      }
      resources.push(buildFromAuthoritative(row, item));
      continue;
    }
    // 스캔 목록에 없는 id. 수기 추가 EC2 라고 표시된 AWS 행만 통과하고, 그 진위는 BFF 가
    // 판정한다. 표시가 없다면 화면이 오래된 것이다 — 그 둘을 서버가 구별할 방법은 표시뿐이다.
    if (row.manual_ec2 && isAwsProvider(cloudProvider)) {
      resources.push(buildManualEc2(row, row.manual_ec2));
      continue;
    }
    return fail(
      '연동 대상 목록이 변경되었습니다. 화면을 새로 읽고 다시 선택해 주세요.',
      409,
    );
  }
  return { ok: true, value: { resources } };
};
