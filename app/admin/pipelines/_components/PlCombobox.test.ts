import { describe, expect, it } from 'vitest';
import { COMBOBOX_CLEAR, comboboxRows } from '@/app/admin/pipelines/_components/PlCombobox';

const OPTIONS = [
  { value: 'svc-mysql-prod', label: 'svc-mysql-prod' },
  { value: 'svc-mysql-stg', label: 'svc-mysql-stg' },
  { value: 'ORDER-Oracle-01', label: 'ORDER-Oracle-01' },
];

describe('comboboxRows', () => {
  it('offers the clear row first while the query is empty', () => {
    const rows = comboboxRows(OPTIONS, '', '연결 안 함');
    expect(rows[0]).toEqual({ value: COMBOBOX_CLEAR, label: '연결 안 함' });
    expect(rows).toHaveLength(OPTIONS.length + 1);
  });

  it('drops the clear row once the operator searches', () => {
    const rows = comboboxRows(OPTIONS, 'mysql', '연결 안 함');
    expect(rows.map((row) => row.value)).toEqual(['svc-mysql-prod', 'svc-mysql-stg']);
  });

  it('matches case-insensitively and ignores surrounding whitespace', () => {
    expect(comboboxRows(OPTIONS, '  oracle  ').map((row) => row.value)).toEqual(['ORDER-Oracle-01']);
  });

  it('returns no rows when nothing matches — not the full list', () => {
    expect(comboboxRows(OPTIONS, 'postgres', '연결 안 함')).toEqual([]);
  });

  it('omits the clear row entirely when no emptyLabel is given', () => {
    expect(comboboxRows(OPTIONS, '')).toHaveLength(OPTIONS.length);
  });
});
