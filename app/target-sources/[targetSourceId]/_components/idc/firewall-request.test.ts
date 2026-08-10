import { describe, expect, it } from 'vitest';
import type { IdcResourceView } from '@/app/lib/api/idc';
import {
  DOMAIN_NOTE,
  toFirewallRequestCsv,
  toFirewallRequestRows,
} from '@/app/target-sources/[targetSourceId]/_components/idc/firewall-request';

const resource = (over: Partial<IdcResourceView>): IdcResourceView => ({
  resourceId: 'idc-res-1',
  persisted: true,
  kind: 'SINGLE',
  hosts: ['10.20.30.40'],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: 'MYSQL',
  sourceIps: ['10.10.0.21'],
  firewallOpen: false,
  connection: 'PENDING',
  health: null,
  done: null,
  excluded: false,
  ...over,
});

describe('toFirewallRequestRows', () => {
  it('expands source IPs × hosts so one row is one firewall policy', () => {
    const rows = toFirewallRequestRows([
      resource({
        kind: 'MULTIPLE_IP',
        hosts: ['10.20.31.10', '10.20.31.11'],
        sourceIps: ['10.10.0.22', '10.10.0.23'],
        port: 1521,
      }),
    ]);

    expect(rows).toHaveLength(4);
    expect(rows.map((row) => `${row.sourceIp}>${row.host}`)).toEqual([
      '10.10.0.22>10.20.31.10',
      '10.10.0.22>10.20.31.11',
      '10.10.0.23>10.20.31.10',
      '10.10.0.23>10.20.31.11',
    ]);
  });

  it('drops excluded rows — an unopened path must not reach the request', () => {
    const rows = toFirewallRequestRows([
      resource({ resourceId: 'keep' }),
      resource({ resourceId: 'drop', excluded: true, hosts: ['10.20.32.8'] }),
    ]);

    expect(rows.map((row) => row.host)).toEqual(['10.20.30.40']);
  });

  it('notes domain targets, whose address is not an IP the firewall can take', () => {
    const rows = toFirewallRequestRows([
      resource({ kind: 'DOMAIN', hosts: ['db-mysql.ivt.prod.internal'] }),
      resource({ resourceId: 'idc-res-2' }),
    ]);

    expect(rows[0]?.note).toBe(DOMAIN_NOTE);
    expect(rows[1]?.note).toBe('');
  });

  it('yields nothing when a resource carries no source IP', () => {
    expect(toFirewallRequestRows([resource({ sourceIps: [] })])).toEqual([]);
  });
});

describe('toFirewallRequestCsv', () => {
  it('writes a header plus one CRLF-separated line per policy', () => {
    const csv = toFirewallRequestCsv(
      toFirewallRequestRows([resource({ kind: 'DOMAIN', hosts: ['db.internal'] })]),
    );

    expect(csv.split('\r\n')).toEqual([
      'Source IP,접속 주소,Port,Database Type,비고',
      `10.10.0.21,db.internal,3306,MySQL,${DOMAIN_NOTE}`,
    ]);
  });

  it('quotes values holding a comma so Excel keeps the columns', () => {
    const csv = toFirewallRequestCsv(
      toFirewallRequestRows([resource({ databaseTypeLabel: 'Oracle, SID ORCL' })]),
    );

    expect(csv).toContain('"Oracle, SID ORCL"');
  });

  it('leaves Port blank when the payload had none (0 is absence, not a port)', () => {
    const csv = toFirewallRequestCsv(toFirewallRequestRows([resource({ port: 0 })]));

    expect(csv.split('\r\n')[1]).toBe('10.10.0.21,10.20.30.40,,MySQL,');
  });
});
