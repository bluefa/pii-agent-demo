'use client';

import { IdcInputFormat } from '@/lib/types/idc';
import { cn, primaryColors, statusColors } from '@/lib/theme';

interface IdcInputFormatToggleProps {
  value: IdcInputFormat;
  onChange: (format: IdcInputFormat) => void;
}

export const IdcInputFormatToggle = ({ value, onChange }: IdcInputFormatToggleProps) => (
  <div className="flex gap-3">
    <button
      type="button"
      onClick={() => onChange('IP')}
      className={cn(
        'flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all',
        value === 'IP'
          ? `${primaryColors.border} ${statusColors.info.bgLight} ${statusColors.info.textDark}`
          : 'border-gray-200 text-gray-600 hover:border-gray-300'
      )}
    >
      IP (복수 입력 가능)
    </button>
    <button
      type="button"
      onClick={() => onChange('HOST')}
      className={cn(
        'flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all',
        value === 'HOST'
          ? `${primaryColors.border} ${statusColors.info.bgLight} ${statusColors.info.textDark}`
          : 'border-gray-200 text-gray-600 hover:border-gray-300'
      )}
    >
      HOST (단일)
    </button>
  </div>
);
