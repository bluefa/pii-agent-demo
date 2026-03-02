import type {
  AthenaRegionResourceSummary,
  AthenaSelectionRule,
  Resource,
} from '@/lib/types';

export interface AthenaTableRecord {
  accountId: string;
  athenaRegion: string;
  database: string;
  table: string;
  tableResourceId: string;
  sourceResourceId: string;
}

export interface AthenaResolvedSnapshot {
  tables: AthenaTableRecord[];
}

export interface AthenaDatabaseNode {
  resource_id: string;
  athena_region: string;
  database: string;
}

export interface AthenaTableNode {
  resource_id: string;
  athena_region: string;
  database: string;
  table: string;
}

export interface PageInfo {
  totalElements: number;
  totalPages: number;
  number: number;
  size: number;
}

export interface AthenaPageResponse<T> {
  content: T[];
  page: PageInfo;
}

interface ParsedAthenaResourceId {
  accountId: string;
  region: string;
  database?: string;
  table?: string;
}

const DEFAULT_ATHENA_DATABASE = 'default';
const DEFAULT_ATHENA_REGION = 'us-east-1';
const DEFAULT_PAGE_SIZE = 20;

const sanitizeSegment = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '_')
    .replace(/^_+|_+$/g, '') || 'unknown';

export const isAthenaResource = (resource: Resource): boolean =>
  resource.awsType === 'ATHENA' ||
  resource.type === 'ATHENA' ||
  resource.databaseType === 'ATHENA';

export const parseAthenaResourceId = (resourceId: string): ParsedAthenaResourceId | null => {
  const matched = /^athena:([^/]+)\/([^/]+)(?:\/([^/]+)(?:\/([^/]+))?)?$/.exec(resourceId);
  if (!matched) return null;
  return {
    accountId: matched[1],
    region: matched[2],
    database: matched[3],
    table: matched[4],
  };
};

export const toAthenaRegionResourceId = (accountId: string, region: string): string =>
  `athena:${accountId}/${region}`;

export const toAthenaDatabaseResourceId = (
  accountId: string,
  region: string,
  database: string,
): string => `athena:${accountId}/${region}/${database}`;

export const toAthenaTableResourceId = (
  accountId: string,
  region: string,
  database: string,
  table: string,
): string => `athena:${accountId}/${region}/${database}/${table}`;

const parseAthenaArn = (resourceId: string): { region: string; accountId: string } | null => {
  const matched = /^arn:aws:athena:([^:]+):([^:]+):/.exec(resourceId);
  if (!matched) return null;
  return {
    region: matched[1],
    accountId: matched[2],
  };
};

export const extractAthenaTables = (
  resources: Resource[],
  defaultAccountId?: string,
): AthenaTableRecord[] => {
  const dedup = new Map<string, AthenaTableRecord>();

  for (const resource of resources) {
    if (!isAthenaResource(resource)) continue;

    const parsed = parseAthenaResourceId(resource.resourceId);
    if (parsed?.database && parsed.table) {
      dedup.set(resource.resourceId, {
        accountId: parsed.accountId,
        athenaRegion: parsed.region,
        database: parsed.database,
        table: parsed.table,
        tableResourceId: resource.resourceId,
        sourceResourceId: resource.id,
      });
      continue;
    }

    const fromArn = parseAthenaArn(resource.resourceId);
    const accountId = parsed?.accountId ??
      fromArn?.accountId ??
      defaultAccountId ??
      '000000000000';
    const athenaRegion = parsed?.region ??
      fromArn?.region ??
      resource.region ??
      DEFAULT_ATHENA_REGION;
    const database = sanitizeSegment(parsed?.database ?? DEFAULT_ATHENA_DATABASE);
    const table = sanitizeSegment(resource.id);
    const tableResourceId = toAthenaTableResourceId(accountId, athenaRegion, database, table);

    dedup.set(tableResourceId, {
      accountId,
      athenaRegion,
      database,
      table,
      tableResourceId,
      sourceResourceId: resource.id,
    });
  }

  return Array.from(dedup.values()).sort((a, b) => {
    const keyA = `${a.athenaRegion}/${a.database}/${a.table}`;
    const keyB = `${b.athenaRegion}/${b.database}/${b.table}`;
    return keyA.localeCompare(keyB);
  });
};

const getRuleTargets = (
  tables: AthenaTableRecord[],
  rule: AthenaSelectionRule,
): AthenaTableRecord[] => {
  const parsed = parseAthenaResourceId(rule.resource_id);
  if (!parsed) return [];

  if (rule.scope === 'REGION') {
    return tables.filter((table) => table.athenaRegion === parsed.region);
  }

  if (rule.scope === 'DATABASE') {
    if (!parsed.database) return [];
    return tables.filter(
      (table) => table.athenaRegion === parsed.region && table.database === parsed.database,
    );
  }

  if (!parsed.database || !parsed.table) return [];
  return tables.filter(
    (table) =>
      table.athenaRegion === parsed.region &&
      table.database === parsed.database &&
      table.table === parsed.table,
  );
};

export const resolveAthenaSelection = (
  allTables: AthenaTableRecord[],
  rules: AthenaSelectionRule[] | undefined,
): AthenaResolvedSnapshot => {
  if (!rules || rules.length === 0) {
    return { tables: [] };
  }

  const selectedIds = new Set<string>();

  for (const rule of rules) {
    const targets = getRuleTargets(allTables, rule);
    if (targets.length === 0) continue;

    if (rule.selected) {
      if (rule.scope === 'TABLE' || rule.include_all_tables === true) {
        targets.forEach((target) => selectedIds.add(target.tableResourceId));
      }
      continue;
    }

    targets.forEach((target) => selectedIds.delete(target.tableResourceId));
  }

  const selectedTables = allTables.filter((table) => selectedIds.has(table.tableResourceId));
  return { tables: selectedTables };
};

export const buildAthenaRegionSummaries = (
  tables: AthenaTableRecord[],
): AthenaRegionResourceSummary[] => {
  const grouped = new Map<string, { accountId: string; count: number }>();

  for (const table of tables) {
    const existing = grouped.get(table.athenaRegion);
    if (existing) {
      existing.count += 1;
      continue;
    }
    grouped.set(table.athenaRegion, { accountId: table.accountId, count: 1 });
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([athenaRegion, value]) => ({
      resource_id: toAthenaRegionResourceId(value.accountId, athenaRegion),
      resource_type: 'ATHENA_REGION',
      athena_region: athenaRegion,
      selected_table_count: value.count,
    }));
};

export const buildAthenaDatabaseNodes = (
  tables: AthenaTableRecord[],
  region: string,
): AthenaDatabaseNode[] => {
  const grouped = new Map<string, string>();
  tables
    .filter((table) => table.athenaRegion === region)
    .forEach((table) => {
      if (!grouped.has(table.database)) {
        grouped.set(table.database, table.accountId);
      }
    });

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([database, accountId]) => ({
      resource_id: toAthenaDatabaseResourceId(accountId, region, database),
      athena_region: region,
      database,
    }));
};

export const buildAthenaTableNodes = (
  tables: AthenaTableRecord[],
  region: string,
  database: string,
): AthenaTableNode[] =>
  tables
    .filter((table) => table.athenaRegion === region && table.database === database)
    .sort((a, b) => a.table.localeCompare(b.table))
    .map((table) => ({
      resource_id: table.tableResourceId,
      athena_region: region,
      database,
      table: table.table,
    }));

export const paginate = <T>(
  rows: T[],
  page: number,
  size: number,
): AthenaPageResponse<T> => {
  const safePage = Number.isFinite(page) && page >= 0 ? Math.floor(page) : 0;
  const safeSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : DEFAULT_PAGE_SIZE;
  const totalElements = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalElements / safeSize));
  const offset = safePage * safeSize;

  return {
    content: rows.slice(offset, offset + safeSize),
    page: {
      totalElements,
      totalPages,
      number: safePage,
      size: safeSize,
    },
  };
};
