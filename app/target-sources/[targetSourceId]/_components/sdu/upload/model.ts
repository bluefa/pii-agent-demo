import type { SduUploadCopy } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import {
  SDU_REGION_LABEL,
  sduAckAnswer,
  type SduInvalidation,
  type SduRecipient,
  type SduRegion,
  type SduUpload,
} from '@/lib/types/sdu';

/**
 * Step 4's four gates, in causal order — the chain is real, not a preference: the firewall
 * has to be open before an S3 Access Key can be used, the key has to arrive before data can
 * be uploaded, and the upload has to finish before BDC builds anything.
 */
export const SDU_GATE_IDS = ['firewall', 'recipients', 'commands', 'bdc'] as const;
export type SduGateId = (typeof SDU_GATE_IDS)[number];

export const sduGateTitles = (t: SduUploadCopy): Record<SduGateId, string> => ({
  firewall: t.gateFirewall,
  recipients: t.gateRecipients,
  commands: t.gateCommands,
  bdc: t.gateBdc,
});

/** 'US · EU'. Every region list in this step reads in the canonical order the view types sort by. */
export const regionLabels = (regions: readonly SduRegion[]): string =>
  regions.map((region) => SDU_REGION_LABEL[region]).join(' · ');

export interface SduGateStates {
  firewall: boolean;
  recipients: boolean;
  commands: boolean;
  bdc: boolean;
}

export const gateDoneStates = (upload: SduUpload): SduGateStates => ({
  // A block with no region to answer for is not finished — an empty definition would
  // otherwise walk every gate open on an answer about nothing.
  firewall: upload.regions.length > 0 && upload.firewall.acked,
  recipients: upload.accessKeyRecipients.users.length >= 1,
  commands: upload.regions.length > 0 && upload.commands.acked,
  bdc: upload.bdc.status === 'COMPLETED',
});

/**
 * The block the owner is on — the first one that is not done.
 *
 * `bdc` is the exception: it becomes current only once it is actually running. While the
 * earlier gates are open it has not started, and an open "리소스를 만들고 있습니다" hero
 * would be saying something untrue about the server.
 */
export const currentGate = (upload: SduUpload, done: SduGateStates): SduGateId | null => {
  if (!done.firewall) return 'firewall';
  if (!done.recipients) return 'recipients';
  if (!done.commands) return 'commands';
  return upload.bdc.status === 'IN_PROGRESS' ? 'bdc' : null;
};

export const doneCount = (done: SduGateStates): number =>
  SDU_GATE_IDS.filter((id) => done[id]).length;

/**
 * One line for a folded ack block. The answer covers every Region at once, so the line names
 * the regions it was given for rather than splitting them into answered and not.
 */
export const regionAckSummary = (
  t: SduUploadCopy,
  regions: readonly SduRegion[],
  acked: boolean,
): string => {
  if (regions.length === 0) return t.ackNoTargets;
  return acked ? t.ackChecked(regionLabels(regions)) : t.ackUnchecked(regionLabels(regions));
};

/** '3명 등록함 · 박지원 외 2명' — the name is what stops "누구 앞으로 갔더라" being asked again. */
export const recipientsSummary = (t: SduUploadCopy, users: readonly SduRecipient[]): string => {
  if (users.length === 0) return t.recipientsNone;
  const [first, ...rest] = users;
  return t.recipientsSummary(users.length, first.name, rest.length);
};

/**
 * What the last 1단계 edit invalidated, as sentences. Told once and only while the server
 * still reports it — this is a notice, not a state the screen keeps.
 */
export const invalidationLines = (
  t: SduUploadCopy,
  invalidation: SduInvalidation,
): string[] => {
  const lines: string[] = [];
  if (invalidation.addedRegions.length > 0) {
    lines.push(t.invalidatedByRegions(regionLabels(invalidation.addedRegions)));
  }
  if (invalidation.uploadIpChanged) {
    lines.push(t.invalidatedByIp);
  }
  return lines;
};

/**
 * 그 블록의 답 — 판정은 `sduAckAnswer` 하나뿐이다(`@/lib/types/sdu`, 계약 §5).
 *
 * 이 이름은 이 화면의 호출부들이 부르던 것이라 그대로 두고, 규칙만 공유본을 가리킨다.
 * 규칙이 여기 한 벌 더 있으면 관리자 쪽(승인 조건 ①·「담당자 입력 정보」)과 갈라지고,
 * 갈라지는 지점이 정확히 §5 가 막으려는 버그다.
 */
export const answerOf = sduAckAnswer;
