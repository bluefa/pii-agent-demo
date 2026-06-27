import { describe, it, expect } from 'vitest';
import { toIdcResourceView } from '@/app/lib/api/idc';

// `toDbTypeWire` (via the IDC mappers) narrows swagger `database_type` to the
// known wire union. Requests now send DB types lowercase while seed/response
// data stays uppercase, so recognition must be case-insensitive. A genuinely
// unknown type must surface its REAL value to the UI — never be masked as MySQL.
describe('toIdcResourceView — database_type recognition', () => {
  const base = { input_format: 'IP' as const, ips: ['10.0.0.1'], port: 3306 };

  it('lowercase "mysql" is recognized → pretty MySQL label, not the raw string', () => {
    const view = toIdcResourceView({ ...base, database_type: 'mysql' });
    expect(view.databaseTypeLabel).toBe('MySQL');
    expect(view.databaseTypeWire).toBe('MYSQL');
  });

  it('uppercase "MYSQL" stays recognized → pretty MySQL label', () => {
    const view = toIdcResourceView({ ...base, database_type: 'MYSQL' });
    expect(view.databaseTypeLabel).toBe('MySQL');
    expect(view.databaseTypeWire).toBe('MYSQL');
  });

  it('unknown "CASSANDRA" shows its real value (not MySQL) and has no wire enum', () => {
    const view = toIdcResourceView({ ...base, database_type: 'CASSANDRA' });
    expect(view.databaseTypeLabel).toBe('CASSANDRA');
    expect(view.databaseTypeWire).toBeUndefined();
  });
});
