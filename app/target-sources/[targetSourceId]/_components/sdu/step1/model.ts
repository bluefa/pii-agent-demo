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
import { DB_TYPES_BY_PROVIDER } from '@/lib/constants/db-types';
import { isValidIdcIp } from '@/lib/constants/idc';
import type { ProviderChipKey } from '@/lib/constants/provider-mapping';
import type { SduDefineCopy } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import {
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

/** 화면에서 부르는 이름. 계약의 `OTHER` 만 번역되는 이름이고 나머지 넷은 고유명사다. */
export const sduCloudLabels = (t: SduDefineCopy): Record<SduCloud, string> => ({
  AWS: 'AWS',
  GCP: 'GCP',
  AZURE: 'Azure',
  IDC: 'IDC',
  OTHER: t.cloudOther,
});

/**
 * SDU 의 클라우드는 「인프라 등록」의 프로바이더와 같은 것을 가리킨다. 표로 적는 이유는
 * `cloud.toLowerCase()` 로 만들면 SduCloud 에 값이 하나 늘 때 조용히 빈 목록이 나오기
 * 때문이다 — 표는 그때 타입 검사에서 걸린다.
 */
const SDU_CLOUD_PROVIDER_KEY: Record<SduCloud, ProviderChipKey> = {
  AWS: 'aws',
  GCP: 'gcp',
  AZURE: 'azure',
  IDC: 'idc',
  OTHER: 'other',
};

/**
 * 한 번 눌러 넣는 이름들. 목록은 지어내지 않는다 — 「인프라 등록」이 묻는 것과 같은
 * 백엔드 열거형(`DB_TYPES_BY_PROVIDER`)에서, 그 클라우드가 실제로 갖는 것만 온다.
 *
 * 계약의 wire 값(`mysql`)이 아니라 **이름**(`MySQL`)을 넣는다: SDU 의 `database_types` 는
 * 자유 입력이라 담당자가 직접 칠 때도 이 이름을 치고, 판에서 고른 값과 친 값이 구별되면
 * 안 된다. 같은 이유로 `OTHERS_DB_TYPE` 은 쓰지 않는다 — 그것은 열거형을 보내는 쪽의
 * 계약 값이고, 여기서는 직접 입력이 그 자리를 대신한다.
 */
export const sduDbTypeChoices = (cloud: SduCloud): readonly string[] =>
  DB_TYPES_BY_PROVIDER[SDU_CLOUD_PROVIDER_KEY[cloud]].map((db) => db.label);

/**
 * 목록 위 한 줄. 고를 수 없는 값이므로 컨트롤이 아니라 문장이고, 이미 정해진 권역과
 * 그 권역에서 Region 이 어떻게 되는지 두 가지만 말한다.
 */
export const sduScopeNotes = (t: SduDefineCopy): Record<SduRegionScope, string> => ({
  GLOBAL: t.scopeGlobal,
  CHINA: t.scopeChina,
});

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
const dbTypeSpecies = (types: readonly string[]): number =>
  new Set(types.map((type) => type.toLowerCase())).size;

export const sduDraftDbTypeCount = (rows: readonly SduTargetDraft[]): number =>
  dbTypeSpecies(activeSduDrafts(rows).flatMap((row) => row.databaseTypes));

/**
 * 편집기 밖에서 Database Type 을 말하는 유일한 문장. 이름을 늘어놓지 않는다 — 한 대상이
 * 20종까지 가질 수 있고, 그때 행은 읽는 자리가 아니라 벽이 된다. 세는 규칙은 머리줄의
 * 「n종」과 같은 것을 쓴다: 두 자리가 같은 목록을 두고 다른 수를 말하면 안 된다.
 */
export const sduDbTypeSummary = (t: SduDefineCopy, types: readonly string[]): string =>
  t.dbTypeSummary(dbTypeSpecies(types));

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

export const sduRowDiffLabels = (t: SduDefineCopy): Record<SduRowDiff, string> => ({
  same: t.diffSame,
  changed: t.diffChanged,
  added: t.diffAdded,
  removed: t.diffRemoved,
});

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

const regionNames = (regions: readonly SduRegion[]): string[] =>
  regions.map((region) => SDU_REGION_LABEL[region]);

/**
 * 2단계로 돌아가기 직전의 한 줄 — 이 저장이 2단계의 무엇을 다시 묻게 만드는지.
 *
 * This file computes the FACTS; the sentence built from them lives in the dictionary,
 * because Korean links its clauses with an ending English does not have.
 */
export const sduReturnHint = (
  t: SduDefineCopy,
  baseline: readonly SduTarget[],
  rows: readonly SduTargetDraft[],
): string => {
  const { added, removed, beforeCount, afterCount } = sduRegionDelta(baseline, rows);
  return t.returnHint({
    added: regionNames(added),
    removed: regionNames(removed),
    beforeCount,
    afterCount,
    uploadIpChanged: sduUploadIpChanged(baseline, rows),
  });
};
