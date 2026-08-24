// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { ApprovalSelectionInput } from '@/lib/approval-selection';
import { toIdcApprovalRequestInput } from '@/app/target-sources/[targetSourceId]/_components/idc/steps/IdcStep1TargetInput';
import type { IdcStep1Row } from '@/app/target-sources/[targetSourceId]/_components/idc/IdcTargetListTable';

const row = (o: Partial<IdcStep1Row> = {}): IdcStep1Row => ({
  resourceId: 'idc-1',
  persisted: false,
  kind: 'SINGLE',
  hosts: ['10.0.0.5'],
  port: 3306,
  databaseTypeLabel: 'MySQL',
  databaseTypeWire: 'MYSQL',
  sourceIps: [],
  firewallOpen: false,
  connection: 'PENDING',
  health: null,
  done: null,
  excluded: false,
  exclusionCustom: false,
  ...o,
});

describe('toIdcApprovalRequestInput', () => {
  it('IP 행은 수기 접속 정보를 idc 로 싣는다 (LIN-52)', () => {
    const input = toIdcApprovalRequestInput([row({ oracleSid: 'ORCL', credentialId: 'cred-1' })]);
    const [item] = input.resources;

    expect(item.selected).toBe(true);
    expect(item.idc).toMatchObject({
      host_format: 'IP',
      hosts: ['10.0.0.5'],
      port: 3306,
      // 요청은 database_type 을 소문자로 보낸다 (IDC wire enum 은 'MYSQL').
      database_type: 'mysql',
      oracle_service_id: 'ORCL',
      credential_id: 'cred-1',
    });
    // Step2 가 붙이는 필드는 Step1 에서 보내지 않는다 — 스키마가 아예 받지 않는다.
    expect(item.idc).not.toHaveProperty('idc_source_ips');
    expect(() => ApprovalSelectionInput.parse(input)).not.toThrow();
  });

  it('정체성 서술은 더 이상 보내지 않는다 — 라우트가 idc 로 metadata 를 짓는다', () => {
    const input = toIdcApprovalRequestInput([row()]);
    const [item] = input.resources;

    expect(item).not.toHaveProperty('metadata');
    expect(item).not.toHaveProperty('resource_name');
  });

  it('enum 밖 DB 타입도 raw 라벨로 왕복한다 (databaseTypeWire undefined)', () => {
    // 이전 요청에서 불러온 행의 DB 타입이 프론트 enum 밖일 수 있다: toIdcResourceView 가
    // databaseTypeWire 를 비우고 raw 값을 databaseTypeLabel 에 남긴다. 그래도 재제출돼야 한다.
    const input = toIdcApprovalRequestInput([
      row({ databaseTypeWire: undefined, databaseTypeLabel: 'COCKROACHDB' }),
    ]);

    expect(input.resources[0].idc?.database_type).toBe('cockroachdb');
  });

  it('DOMAIN 행은 host_format 을 HOST 로 보낸다', () => {
    const input = toIdcApprovalRequestInput([row({ kind: 'DOMAIN', hosts: ['db.example.com'] })]);

    expect(input.resources[0].idc).toMatchObject({
      host_format: 'HOST',
      hosts: ['db.example.com'],
    });
    expect(() => ApprovalSelectionInput.parse(input)).not.toThrow();
  });

  it('제외 행도 접속 정보를 싣는다 — resource_id 만으로는 그 행이 무엇이었는지 못 읽는다', () => {
    const input = toIdcApprovalRequestInput([row({ excluded: true, exclusionReason: '미사용 인스턴스' })]);
    const [item] = input.resources;

    expect(item.selected).toBe(false);
    expect(item.exclusion_reason).toBe('미사용 인스턴스');
    expect(item.idc).toMatchObject({
      host_format: 'IP',
      hosts: ['10.0.0.5'],
      port: 3306,
      database_type: 'mysql',
    });
    expect(() => ApprovalSelectionInput.parse(input)).not.toThrow();
  });
});
