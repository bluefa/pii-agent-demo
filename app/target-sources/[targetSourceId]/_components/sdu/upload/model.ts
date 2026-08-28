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
export const regionAckSummary = (regions: readonly SduRegion[], acked: boolean): string => {
  if (regions.length === 0) return '연동 대상이 없어요';
  return acked ? `확인함 · ${regionLabels(regions)}` : `미확인 · ${regionLabels(regions)}`;
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
      `${regionLabels(invalidation.addedRegions)}가 추가되어 방화벽 확인과 업로드 확인을 다시 해야 해요`,
    );
  }
  if (invalidation.uploadIpChanged) {
    lines.push('업로드 IP가 바뀌어 방화벽 확인을 다시 해야 해요');
  }
  return lines;
};

/**
 * 그 블록의 답. 서버가 지고 있는 값 하나로만 읽는다 — `acked` 는 예/아니오를, `ackedAt` 은
 * **답이 있었는지**를 말한다. 둘을 합치지 않으면 저장된 「아니오」가 새로고침 뒤 미답으로
 * 보이고, 담당자는 자기가 답한 적 없다고 읽는다. 무효화는 도장까지 지우므로 그때는 null 이
 * 맞다.
 */
export const answerOf = (block: { acked: boolean; ackedAt: string | null }): boolean | null => {
  if (block.acked) return true;
  return block.ackedAt === null ? null : false;
};
