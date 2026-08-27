import {
  SDU_REGION_LABEL,
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

export const SDU_GATE_TITLE: Record<SduGateId, string> = {
  firewall: '방화벽 결재 확인',
  recipients: 'S3 Access Key 수신자',
  commands: '데이터 업로드 확인',
  bdc: 'BDC 리소스 생성',
};

/** 'US · EU'. Every region list in this step reads in the canonical order the view types sort by. */
export const regionLabels = (regions: readonly SduRegion[]): string =>
  regions.map((region) => SDU_REGION_LABEL[region]).join(' · ');

/**
 * Regions of the CURRENT definition that carry no answer yet.
 *
 * Answers are stored per region, never as one boolean per block — that is what lets a trip
 * back to 1단계 keep what still applies instead of resetting the step (storyboard §03).
 */
export const missingRegions = (
  regions: readonly SduRegion[],
  acked: readonly SduRegion[],
): SduRegion[] => regions.filter((region) => !acked.includes(region));

const isRegionListDone = (regions: readonly SduRegion[], acked: readonly SduRegion[]): boolean =>
  regions.length > 0 && missingRegions(regions, acked).length === 0;

export interface SduGateStates {
  firewall: boolean;
  recipients: boolean;
  commands: boolean;
  bdc: boolean;
}

export const gateDoneStates = (upload: SduUpload): SduGateStates => ({
  firewall: isRegionListDone(upload.regions, upload.firewall.ackedRegions),
  recipients: upload.recipients.users.length >= 1,
  commands: isRegionListDone(upload.regions, upload.commands.ackedRegions),
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
 * One line for a folded region-scoped block. Which regions are still unanswered is the value
 * the folded row exists to carry — "1곳 남음" alone sends the owner back in to find out which.
 */
export const regionAckSummary = (
  regions: readonly SduRegion[],
  acked: readonly SduRegion[],
): string => {
  if (regions.length === 0) return '연동 대상이 없어요';
  const missing = missingRegions(regions, acked);
  if (missing.length === 0) return `확인함 · ${regionLabels(regions)}`;
  const answered = regions.filter((region) => acked.includes(region));
  if (answered.length === 0) return `${regionLabels(missing)} 미확인 · ${missing.length}곳 남음`;
  return `${regionLabels(answered)} 확인함 · ${regionLabels(missing)} 미확인 · ${missing.length}곳 남음`;
};

/** '3명 등록함 · 박지원 외 2명' — the name is what stops "누구 앞으로 갔더라" being asked again. */
export const recipientsSummary = (users: readonly SduRecipient[]): string => {
  if (users.length === 0) return '등록된 분이 없어요';
  const [first, ...rest] = users;
  const names = rest.length === 0 ? first.name : `${first.name} 외 ${rest.length}명`;
  return `${users.length}명 등록함 · ${names}`;
};

/**
 * What the last 1단계 edit invalidated, as sentences. Told once and only while the server
 * still reports it — this is a notice, not a state the screen keeps.
 */
export const invalidationLines = (invalidation: SduInvalidation): string[] => {
  const lines: string[] = [];
  if (invalidation.addedRegions.length > 0) {
    lines.push(
      `${regionLabels(invalidation.addedRegions)}가 추가되어 방화벽 확인과 업로드 확인이 그 Region에 대해서만 다시 필요해요`,
    );
  }
  if (invalidation.removedRegions.length > 0) {
    lines.push(`${regionLabels(invalidation.removedRegions)}의 응답은 폐기했어요`);
  }
  if (invalidation.uploadIpChanged) {
    lines.push('업로드 IP가 바뀌어 모든 Region의 방화벽 확인을 다시 해야 해요');
  }
  return lines;
};
