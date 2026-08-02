/**
 * Grouped-resource rows — Cloudscape "table with nested resources" shape.
 *
 * Athena is a family, not a row: one catalog/workgroup per region carries many
 * databases, and a flat table hides that a dozen rows all belong to the same
 * region's Athena. The parent row is a REAL table row (same columns, aggregate
 * values), so sorting, pagination and selection stay row-based — see
 * `docs/ux/athena-group-samples.html` §04 for the chosen 시안.
 *
 * Nothing here invents data: a group is derived from fields the rows already
 * carry (resource type + region). No wire field is read that the contract does
 * not declare.
 *
 * The contract does carry an explicit parent key for the confirmed rows —
 * `athena_region_resource_id` (`athena:<acct>:<region>/AwsDataCatalog`). It is not
 * plumbed here because within one target source the account and catalog are fixed,
 * so region alone yields the identical partition; the pre-approval rows have no such
 * key at all. If a target source ever spans accounts or catalogs, switch the key to
 * that field rather than adding a second region-ish input.
 */
import { normalizeResourceType } from '@/lib/types';

/**
 * Resource types read as one parent unit per region. Athena only — everything else is
 * 1 row = 1 resource.
 *
 * Both spellings are real: the demo seeds say `ATHENA`, the captured BFF response says
 * `AWS_ATHENA_DATABASE` (see `lib/bff/mock/aws-wire-sample.ts`), and
 * `RESOURCE_TYPE_ALIASES` maps only the third spelling `AWS_ATHENA`. Matching one of
 * them would leave the grouping silently dead on real data.
 */
const GROUPED_TYPES: ReadonlySet<string> = new Set(['ATHENA', 'AWS_ATHENA_DATABASE']);

/** Label/key the parent row is rendered under, whichever spelling arrived. */
export const GROUPED_TYPE_LABEL_KEY = 'ATHENA';

/**
 * What one child row IS, said in the Database Type column.
 *
 * Read down the tree the column says `Athena` → `Database`: the parent is the service in a
 * region, each child is one database inside it. Without this a name like `test_raw` is just a
 * string — nothing on the row said which kind of thing it names. Grounded in the wire type the
 * captured response actually sends for these rows, `AWS_ATHENA_DATABASE`.
 */
export const GROUPED_CHILD_KIND_LABEL = 'Database';

export const isGroupedResourceType = (type: string | null | undefined): boolean => {
  const normalized = normalizeResourceType(type);
  return normalized != null && GROUPED_TYPES.has(normalized);
};

/** The fields grouping needs, read out of whatever row shape the caller has. */
export interface GroupKeyInput {
  /** Resource/database type — `ATHENA`, `RDS`, … */
  type: string | null | undefined;
  region: string | null | undefined;
  /** false = 제외/비대상. Drives the parent row's aggregate counts. */
  selected: boolean;
}

export interface ResourceGroup<T> {
  /** Stable React key + `aria-controls` target id. */
  key: string;
  type: string;
  region: string;
  rows: readonly T[];
  targetCount: number;
  excludedCount: number;
}

/**
 * One `<tbody>` worth of rows: either a group (parent row + its children) or a run
 * of consecutive ungrouped rows. A table with no groupable rows yields exactly one
 * `rows` section, so nothing about the flat tables changes.
 */
export type ResourceSection<T> =
  | { kind: 'group'; group: ResourceGroup<T> }
  | { kind: 'rows'; key: string; rows: readonly T[] };

const UNKNOWN_REGION = '—';

/**
 * Splits `rows` into ordered sections, preserving the order in which each group
 * first appears. Rows of a non-grouped type pass through untouched.
 */
export const groupResourceRows = <T>(
  rows: readonly T[],
  read: (row: T) => GroupKeyInput,
): ResourceSection<T>[] => {
  const sections: ResourceSection<T>[] = [];
  const groups = new Map<string, ResourceGroup<T>>();
  let plain: T[] | null = null;

  for (const row of rows) {
    const { type, region, selected } = read(row);

    if (!isGroupedResourceType(type)) {
      if (!plain) {
        plain = [];
        sections.push({ kind: 'rows', key: `rows-${sections.length}`, rows: plain });
      }
      plain.push(row);
      continue;
    }

    plain = null;
    // Both wire spellings collapse onto one label key, so a response mixing them
    // still yields one group per region rather than two.
    const normalizedType = GROUPED_TYPE_LABEL_KEY;
    const normalizedRegion = region || UNKNOWN_REGION;
    const key = `${normalizedType}|${normalizedRegion}`;
    let group = groups.get(key);

    if (!group) {
      group = {
        key,
        type: normalizedType,
        region: normalizedRegion,
        rows: [],
        targetCount: 0,
        excludedCount: 0,
      };
      groups.set(key, group);
      sections.push({ kind: 'group', group });
    }

    (group.rows as T[]).push(row);
    if (selected) group.targetCount += 1;
    else group.excludedCount += 1;
  }

  return sections;
};

/**
 * Pagination units — a grouped resource counts as ONE, carrying all of its children.
 *
 * Slicing the flat row list would cut a group across a page boundary: half its databases on
 * page 1, the rest on page 2, with the parent row rendered twice. A group is managed as one
 * resource, so it pages as one and its databases always appear together.
 *
 * This is also the Cloudscape rule for nested-resource tables — pagination applies to
 * top-level rows only, regardless of how many children they hold.
 */
export const toPaginationUnits = <T>(sections: readonly ResourceSection<T>[]): (readonly T[])[] =>
  sections.flatMap((section) =>
    section.kind === 'group' ? [section.group.rows] : section.rows.map((row) => [row]),
  );
