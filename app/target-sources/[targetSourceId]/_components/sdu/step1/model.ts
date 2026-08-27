/**
 * Step 1 「연동 대상 정의」 — the working list's shape and every rule the screen has to
 * state out loud.
 *
 * The mock BFF enforces the same three rules (lib/bff/mock/sdu.ts): a region belongs to
 * exactly one scope, a target holds at most SDU_DB_TYPE_MAX types of at most
 * SDU_DB_TYPE_MAXLEN characters, and the upload IP is an IPv4 address. They are mirrored
 * here so the screen can SAY them — a client that only trusts the server turns each of
 * them into a 400 carrying a wire sentence, and a client that silently truncates turns
 * them into data the user never agreed to.
 *
 * 권역(scope)은 규칙이 아니라 대상소스가 가진 사실이다 — `project.isChinaRegion` 하나로
 * 정해지고, 화면은 그것을 고르는 자리를 두지 않는다.
 */
import { isValidIdcIp } from '@/lib/constants/idc';
import {
  SDU_DB_TYPE_MAX,
  SDU_DB_TYPE_MAXLEN,
  SDU_REGION_LABEL,
  SDU_REGIONS_BY_SCOPE,
  sortSduRegions,
  type SduCloud,
  type SduRegion,
  type SduRegionScope,
  type SduTarget,
} from '@/lib/types/sdu';

/**
 * A row in the working list. `targetId` is empty for a row the server has never seen —
 * `toSduDefinitionRequest` omits the field for those, and the server's "did this row's
 * upload IP change" verdict depends on that omission.
 *
 * `removed` is a MARK, not a deletion: on the trip back from 2단계 the user has to be able
 * to undo a removal before saving, so the row stays in the list wearing 삭제함.
 */
export interface SduTargetDraft {
  /** Stable list key. A saved row uses its `targetId`; a new one gets a local key. */
  key: string;
  targetId: string;
  cloud: SduCloud;
  region: SduRegion;
  uploadIp: string;
  databaseTypes: string[];
  removed: boolean;
}

/** 화면에서 부르는 이름. 계약의 `OTHER` 는 사용자에게 '기타'다. */
export const SDU_CLOUD_LABEL: Record<SduCloud, string> = {
  AWS: 'AWS',
  GCP: 'GCP',
  AZURE: 'Azure',
  IDC: 'IDC',
  OTHER: '기타',
};

/**
 * 한 번 눌러 넣는 흔한 이름들. 목록에서 '고른' 값이 아니라 입력을 대신 쳐 주는 것이므로
 * 들어간 뒤에는 직접 친 값과 구별되지 않는다 — Database Type 은 전부 자유 입력이다.
 */
export const SDU_QUICK_DB_TYPES = [
  'MySQL',
  'PostgreSQL',
  'Oracle',
  'MSSQL',
  'MongoDB',
  'Redis',
] as const;

export const SDU_IP_INVALID_MESSAGE = '올바른 IPv4 주소가 아니에요';
export const SDU_DB_TYPE_MAX_MESSAGE = `대상당 ${SDU_DB_TYPE_MAX}개까지 등록할 수 있어요`;
export const SDU_DB_TYPE_LEN_MESSAGE = `Database Type은 ${SDU_DB_TYPE_MAXLEN}자까지 입력할 수 있어요`;
export const SDU_DB_TYPE_DUPLICATE_MESSAGE = '이미 추가한 타입이에요';
export const SDU_DB_TYPE_REQUIRED_MESSAGE = 'Database Type을 하나 이상 추가해 주세요';
/**
 * 목록 위 한 줄. 고를 수 없는 값이므로 컨트롤이 아니라 문장이고, 이미 정해진 권역과
 * 그 권역에서 Region 이 어떻게 되는지 두 가지만 말한다.
 */
export const SDU_SCOPE_NOTE: Record<SduRegionScope, string> = {
  GLOBAL: '권역 Global · Region은 Asia · US · EU · CX 중에서 골라요',
  CHINA: '권역 China · Region은 China로 고정돼요',
};

export const toSduTargetDrafts = (targets: readonly SduTarget[]): SduTargetDraft[] =>
  targets.map((target) => ({
    key: target.targetId,
    targetId: target.targetId,
    cloud: target.cloud,
    region: target.region,
    uploadIp: target.uploadIp,
    databaseTypes: [...target.databaseTypes],
    removed: false,
  }));

/** A blank row for `scope`. The region is the scope's first — CHINA has only one. */
export const newSduTargetDraft = (key: string, scope: SduRegionScope): SduTargetDraft => ({
  key,
  targetId: '',
  cloud: 'AWS',
  region: SDU_REGIONS_BY_SCOPE[scope][0],
  uploadIp: '',
  databaseTypes: [],
  removed: false,
});

/**
 * 저장할 수 있는 행인가. 클라우드와 Region 은 언제나 값이 있으므로(빈 상태가 없는
 * 선택지다) 판정은 IP 와 타입 두 가지다.
 */
export const isSduDraftComplete = (draft: SduTargetDraft): boolean =>
  isValidIdcIp(draft.uploadIp) && draft.databaseTypes.length > 0;

export const activeSduDrafts = (rows: readonly SduTargetDraft[]): SduTargetDraft[] =>
  rows.filter((row) => !row.removed);

export const sduDraftRegions = (rows: readonly SduTargetDraft[]): SduRegion[] =>
  sortSduRegions(activeSduDrafts(rows).map((row) => row.region));

/** 몇 종인가 — 대소문자만 다른 같은 이름은 한 종으로 센다. */
export const sduDraftDbTypeCount = (rows: readonly SduTargetDraft[]): number =>
  new Set(
    activeSduDrafts(rows).flatMap((row) => row.databaseTypes.map((type) => type.toLowerCase())),
  ).size;

/** PUT 본문에 실리는 대상 — 삭제 표시된 행은 여기서 빠지면서 실제로 사라진다. */
export const toSduPutTargets = (rows: readonly SduTargetDraft[]): SduTarget[] =>
  activeSduDrafts(rows).map((row) => ({
    targetId: row.targetId,
    cloud: row.cloud,
    region: row.region,
    uploadIp: row.uploadIp,
    databaseTypes: [...row.databaseTypes],
  }));

const sameTypes = (a: readonly string[], b: readonly string[]): boolean =>
  a.length === b.length && [...a].sort().join(' ') === [...b].sort().join(' ');

export type SduRowDiff = 'same' | 'changed' | 'added' | 'removed';

export const SDU_ROW_DIFF_LABEL: Record<SduRowDiff, string> = {
  same: '변경 없음',
  changed: '수정함',
  added: '추가함',
  removed: '삭제함',
};

/**
 * 2단계에서 돌아온 화면의 행 상태. 기준은 **불러온 정의**다 — 저장 전까지 서버는
 * 아무것도 모르므로, 이 판정만이 "무엇이 무효가 되는지"를 미리 말해 줄 수 있다.
 */
export const sduRowDiff = (baseline: readonly SduTarget[], row: SduTargetDraft): SduRowDiff => {
  if (row.removed) return 'removed';
  const before = baseline.find((target) => target.targetId === row.targetId);
  if (!before) return 'added';
  const untouched =
    before.cloud === row.cloud &&
    before.region === row.region &&
    before.uploadIp === row.uploadIp &&
    sameTypes(before.databaseTypes, row.databaseTypes);
  return untouched ? 'same' : 'changed';
};

export interface SduRegionDelta {
  added: SduRegion[];
  removed: SduRegion[];
  beforeCount: number;
  afterCount: number;
}

export const sduRegionDelta = (
  baseline: readonly SduTarget[],
  rows: readonly SduTargetDraft[],
): SduRegionDelta => {
  const before = sortSduRegions(baseline.map((target) => target.region));
  const after = sduDraftRegions(rows);
  return {
    added: after.filter((region) => !before.includes(region)),
    removed: before.filter((region) => !after.includes(region)),
    beforeCount: before.length,
    afterCount: after.length,
  };
};

/** 저장하면 업로드 IP 때문에 전 Region 을 다시 확인하게 되는가. */
export const sduUploadIpChanged = (
  baseline: readonly SduTarget[],
  rows: readonly SduTargetDraft[],
): boolean =>
  activeSduDrafts(rows).some((row) => {
    const before = baseline.find((target) => target.targetId === row.targetId);
    return !!before && before.uploadIp !== row.uploadIp;
  });

/*
 * 조사는 '가' 하나면 된다. 이 화면이 부르는 Region 이름은 다섯뿐이고
 * (Asia · US · EU · CX · China) 다섯 다 읽으면 받침 없이 끝난다 —
 * 아시아 · 유에스 · 이유 · 씨엑스 · 차이나. 이름이 늘면 여기부터 다시 볼 것.
 */
const regionNames = (regions: readonly SduRegion[]): string =>
  regions.map((region) => SDU_REGION_LABEL[region]).join(' · ');

/**
 * 2단계로 돌아가기 직전의 한 줄 — 이 저장이 2단계의 무엇을 다시 묻게 만드는지.
 *
 * 경로 수가 같아도 "2개 → 2개"라고 굳이 말한다: 수가 같다고 같은 경로가 아니다.
 */
export const sduReturnHint = (
  baseline: readonly SduTarget[],
  rows: readonly SduTargetDraft[],
): string => {
  const { added, removed, beforeCount, afterCount } = sduRegionDelta(baseline, rows);
  const path =
    added.length || removed.length
      ? `업로드 경로 ${beforeCount}개 → ${afterCount}개`
      : `업로드 경로 ${afterCount}개`;

  // 이어지는 절과 끝나는 절의 어미가 다르다 ('없어지고' / '없어져요'). 어간에 어미를
  // 붙여 만들면 '없어지어요' 가 나오므로, 두 형태를 각각 적어 둔다.
  const clauses: { linked: string; final: string }[] = [];
  if (added.length) {
    clauses.push({
      linked: `${regionNames(added)}가 새로 생기고`,
      final: `${regionNames(added)}가 새로 생겨요`,
    });
  }
  if (removed.length) {
    clauses.push({
      linked: `${regionNames(removed)}가 없어지고`,
      final: `${regionNames(removed)}가 없어져요`,
    });
  }
  const head = clauses.length
    ? clauses
        .map((clause, index) => (index === clauses.length - 1 ? clause.final : clause.linked))
        .join(' ')
    : 'Region 구성은 그대로예요';

  const ip = sduUploadIpChanged(baseline, rows)
    ? ' 업로드 IP가 바뀌어 모든 Region을 다시 확인해요.'
    : '';
  return `${head} — ${path}.${ip}`;
};
