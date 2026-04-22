'use client';

import { cn, getInputClass, tagStyles, textColors } from '@/lib/theme';
import { DB_TYPES, DB_TYPE_LABEL, type DbType } from '@/lib/constants/db-types';

interface DbTypeMultiSelectProps {
  values: DbType[];
  onChange: (next: DbType[]) => void;
}

export const DbTypeMultiSelect = ({ values, onChange }: DbTypeMultiSelectProps) => {
  const available = DB_TYPES.filter((t) => !values.includes(t.value));

  return (
    <div className="space-y-2">
      <select
        className={getInputClass()}
        value=""
        onChange={(e) => {
          const next = e.target.value as DbType;
          if (next && !values.includes(next)) onChange([...values, next]);
        }}
      >
        <option value="">DB Type 선택…</option>
        {available.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {values.length === 0 ? (
        <p className={cn('text-xs', textColors.tertiary)}>선택된 DB Type이 없습니다</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v) => {
            const label = DB_TYPE_LABEL[v] ?? v;
            return (
              <span
                key={v}
                className={cn(
                  'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium',
                  tagStyles.blue,
                )}
              >
                {label}
                <button
                  type="button"
                  aria-label={`${label} 제거`}
                  onClick={() => onChange(values.filter((x) => x !== v))}
                  className="ml-0.5 text-current/70 hover:text-current"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
};
