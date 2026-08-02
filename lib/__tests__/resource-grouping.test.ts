import { describe, expect, it } from 'vitest';
import { groupResourceRows, isGroupedResourceType } from '@/lib/resource-grouping';

interface Row {
  id: string;
  type: string;
  region: string | null;
  selected: boolean;
}

const row = (id: string, type: string, region: string | null, selected = true): Row => ({
  id,
  type,
  region,
  selected,
});

const read = (r: Row) => ({ type: r.type, region: r.region, selected: r.selected });

describe('isGroupedResourceType', () => {
  it('groups every Athena spelling the wire uses, and nothing else', () => {
    expect(isGroupedResourceType('ATHENA')).toBe(true);
    expect(isGroupedResourceType('athena')).toBe(true);
    // The captured BFF response spelling — the one real data actually arrives with.
    expect(isGroupedResourceType('AWS_ATHENA_DATABASE')).toBe(true);
    // Routed through RESOURCE_TYPE_ALIASES → 'ATHENA'.
    expect(isGroupedResourceType('AWS_ATHENA')).toBe(true);
    expect(isGroupedResourceType('RDS')).toBe(false);
    expect(isGroupedResourceType('AWS_DB_CLUSTER')).toBe(false);
    expect(isGroupedResourceType(null)).toBe(false);
  });
});

describe('groupResourceRows', () => {
  it('leaves a flat list as a single rows section', () => {
    const rows = [row('a', 'RDS', 'ap-northeast-2'), row('b', 'DYNAMODB', 'us-east-1')];
    const sections = groupResourceRows(rows, read);

    expect(sections).toHaveLength(1);
    expect(sections[0]).toMatchObject({ kind: 'rows', rows });
  });

  it('groups Athena rows by region and counts target vs excluded', () => {
    const sections = groupResourceRows(
      [
        row('a1', 'ATHENA', 'ap-northeast-2'),
        row('a2', 'ATHENA', 'ap-northeast-2', false),
        row('a3', 'ATHENA', 'us-east-1'),
      ],
      read,
    );

    expect(sections).toHaveLength(2);
    expect(sections[0]).toMatchObject({
      kind: 'group',
      group: { key: 'ATHENA|ap-northeast-2', region: 'ap-northeast-2', targetCount: 1, excludedCount: 1 },
    });
    expect(sections[1]).toMatchObject({
      kind: 'group',
      group: { key: 'ATHENA|us-east-1', targetCount: 1, excludedCount: 0 },
    });
  });

  it('collects a group even when its rows are not adjacent', () => {
    const sections = groupResourceRows(
      [
        row('a1', 'ATHENA', 'ap-northeast-2'),
        row('r1', 'RDS', 'ap-northeast-2'),
        row('a2', 'ATHENA', 'ap-northeast-2'),
      ],
      read,
    );

    // One group (both Athena rows) + one rows section for the RDS row in between.
    expect(sections.map((s) => s.kind)).toEqual(['group', 'rows']);
    const [group] = sections;
    if (group.kind !== 'group') throw new Error('expected a group section');
    expect(group.group.rows.map((r) => r.id)).toEqual(['a1', 'a2']);
  });

  it('keeps consecutive plain rows in one section but starts a new one after a group', () => {
    const sections = groupResourceRows(
      [
        row('r1', 'RDS', 'ap-northeast-2'),
        row('r2', 'RDS', 'ap-northeast-2'),
        row('a1', 'ATHENA', 'ap-northeast-2'),
        row('r3', 'RDS', 'ap-northeast-2'),
      ],
      read,
    );

    expect(sections.map((s) => s.kind)).toEqual(['rows', 'group', 'rows']);
    const [first, , last] = sections;
    if (first.kind !== 'rows' || last.kind !== 'rows') throw new Error('expected rows sections');
    expect(first.rows.map((r) => r.id)).toEqual(['r1', 'r2']);
    expect(last.rows.map((r) => r.id)).toEqual(['r3']);
    expect(first.key).not.toBe(last.key);
  });

  it('falls back to a placeholder region when the row has none', () => {
    const sections = groupResourceRows([row('a1', 'ATHENA', null)], read);
    const [section] = sections;
    if (section.kind !== 'group') throw new Error('expected a group section');
    expect(section.group.region).toBe('—');
  });
});
