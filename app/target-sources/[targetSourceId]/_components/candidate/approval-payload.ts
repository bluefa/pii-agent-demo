import type { ApprovalRequestResource } from '@/app/components/features/process-status/ApprovalRequestModal';
import type {
  CandidateDraftState,
  CandidateResource,
} from '@/lib/types/resources';
import type { ApprovalSelection } from '@/lib/approval-selection';
import { toWireDatabaseType } from '@/lib/types';
import { getCandidateBehavior } from '@/app/target-sources/[targetSourceId]/_components/candidate/candidate-resource-behavior';
import { isManualEc2Candidate } from '@/app/target-sources/[targetSourceId]/_components/candidate/manual-ec2';

type SelectionRow = ApprovalSelection['resources'][number];

export const toModalResources = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
): ApprovalRequestResource[] =>
  candidates.map((candidate) => {
    const endpoint = drafts.endpointDrafts[candidate.id] ?? candidate.endpointConfig;
    return {
      id: candidate.id,
      resourceId: candidate.resourceId,
      type: candidate.type,
      isSelected: selectedIds.has(candidate.id),
      integrationCategory: candidate.integrationCategory,
      // Show the effective DB type in the confirm modal (draft/endpoint wins for VMs).
      databaseType: endpoint?.databaseType ?? candidate.databaseType,
      ...(endpoint
        ? {
            endpoint: {
              databaseType: endpoint.databaseType,
              port: endpoint.port,
              ...(endpoint.host ? { host: endpoint.host } : {}),
            },
          }
        : {}),
    };
  });

/**
 * Unselected TARGET resources must carry an exclusion reason before the approval
 * request goes out (docs/cloud-provider-states.md: reason is required). Non-TARGET
 * categories (no-install-needed / install-ineligible) are not user exclusions and
 * need no reason. An empty or whitespace-only string counts as missing — this list
 * DISABLES the approval CTA, so a blank that slipped in server-side must not pass.
 */
export const listMissingExclusionReasons = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  exclusionReasons: Readonly<Record<string, string>>,
): CandidateResource[] =>
  candidates.filter(
    (candidate) =>
      candidate.integrationCategory === 'TARGET'
      && !selectedIds.has(candidate.id)
      && !exclusionReasons[candidate.id]?.trim(),
  );

/**
 * 수기 추가 EC2 행이 싣는 전부. 이름은 검색 와이어가 private DNS 없이 돌아오면 빈 문자열이라
 * (`app/lib/api/ec2.ts`), 없는 값을 보내는 대신 키를 생략한다.
 *
 * 접속 정보는 **고른 행에만** 붙인다. 제외된 행은 표시만 남기면 되고(갈래를 고르는 것이
 * 그 키의 일이다), 좁히기 전 본문도 제외된 행에는 host·port 를 싣지 않았다.
 */
const manualEc2Input = (
  candidate: CandidateResource,
  selected: boolean,
): SelectionRow['manual_ec2'] => {
  const endpoint = selected ? candidate.endpointConfig : undefined;
  return {
    ...(candidate.resourceName ? { resource_name: candidate.resourceName } : {}),
    ...(endpoint?.host ? { host: endpoint.host } : {}),
    ...(endpoint ? { port: endpoint.port } : {}),
    // 요청은 소문자 정규형으로 나간다(lib/types.ts) — 옛 behavior 경로와 같은 변환이다.
    ...(endpoint?.databaseType
      ? { database_type: toWireDatabaseType(endpoint.databaseType) }
      : {}),
    ...(endpoint?.oracleServiceId ? { oracle_service_id: endpoint.oracleServiceId } : {}),
  };
};

/**
 * Input adapter: UI selection → the route's `ApprovalSelectionInput`.
 *
 * Sends the CHOICES only — which resource, selected or not, the reason the user typed, and
 * the RDS member they picked. Identity and intrinsic metadata (resource_name/resource_type/
 * integration_category/provider/region/database_type/rds_instance_candidates) are NO LONGER
 * sent: the route re-reads them from the scan and assembles the contract body itself, so a
 * crafted payload cannot describe a resource the scan never saw. See
 * `app/api/_lib/approval-input.ts`.
 *
 * A scanned row sends no connection info — the shape has no key for it. Connection info
 * rides only inside `manual_ec2`, filled by the add modal. The `endpoint` behavior's draft
 * is no longer sent: that editor opens only for rows spelled `EC2`/`AZURE_VM`, which the
 * wire enum (`AWS_EC2_INSTANCE`/`AZURE_VIRTUAL_MACHINE`) never produces (#342).
 */
export const toApprovalRequestInput = (
  candidates: readonly CandidateResource[],
  selectedIds: ReadonlySet<string>,
  drafts: CandidateDraftState,
  exclusionReasons: Readonly<Record<string, string>>,
): ApprovalSelection => ({
  // id 없는 후보는 연동 대상이 될 수 없다(`ec2.ts` 와 같은 규칙). 실어 보내 봐야 라우트가
  // 교집합에서 못 찾아 요청 전체가 막힌다.
  resources: candidates.filter((candidate) => candidate.id !== '').map((candidate): SelectionRow => {
    if (!selectedIds.has(candidate.id)) {
      // The scan's own verdict is NOT sent: the route reads `recommend_fail_reason` from
      // the authoritative row and falls back to it when the user typed nothing.
      const userReason = exclusionReasons[candidate.id]?.trim();
      return {
        resource_id: candidate.id,
        selected: false,
        ...(userReason ? { exclusion_reason: userReason } : {}),
        // 제외된 행도 스캔 목록에는 없다. 표시가 빠지면 오래된 화면으로 읽혀 409 가 된다.
        ...(isManualEc2Candidate(candidate)
          ? { manual_ec2: manualEc2Input(candidate, false) }
          : {}),
      };
    }
    const fields = getCandidateBehavior(candidate).buildMetadataFields(candidate, drafts);
    return {
      resource_id: candidate.id,
      selected: true,
      // 스캔 목록에 없는 id 가 "방금 추가한 인스턴스"인지 "오래된 화면"인지는 서버가
      // 구별할 수 없다 — 이 표시가 그 갈래를 고른다.
      ...(isManualEc2Candidate(candidate)
        ? { manual_ec2: manualEc2Input(candidate, true) }
        : {}),
      ...(fields.selected_rds_instance_resource_id
        ? { selected_rds_instance_resource_id: fields.selected_rds_instance_resource_id }
        : {}),
    };
  }),
});
