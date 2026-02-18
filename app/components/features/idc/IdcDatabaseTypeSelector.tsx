'use client';

import { IdcDatabaseType } from '@/lib/types/idc';
import { IDC_DATABASE_TYPE_LABELS } from '@/lib/constants/idc';
import { cn, primaryColors, statusColors } from '@/lib/theme';

const DATABASE_TYPES: IdcDatabaseType[] = ['MYSQL', 'POSTGRESQL', 'MSSQL', 'ORACLE'];

interface IdcDatabaseTypeSelectorProps {
  value: IdcDatabaseType;
  onChange: (type: IdcDatabaseType) => void;
}

export const IdcDatabaseTypeSelector = ({ value, onChange }: IdcDatabaseTypeSelectorProps) => (
  <div className="grid grid-cols-4 gap-2">
    {DATABASE_TYPES.map((type) => (
      <button
        key={type}
        type="button"
        onClick={() => onChange(type)}
        className={cn(
          'py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all',
          value === type
            ? `${primaryColors.border} ${statusColors.info.bgLight} ${statusColors.info.textDark}`
            : 'border-gray-200 text-gray-600 hover:border-gray-300'
        )}
      >
        {IDC_DATABASE_TYPE_LABELS[type]}
      </button>
    ))}
  </div>
);
