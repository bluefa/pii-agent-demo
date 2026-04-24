'use client';

import { SearchIcon } from '@/app/components/ui/icons';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
}

export const SearchField = ({ value, onChange }: SearchFieldProps) => (
  <div className="relative w-80">
    <div className="absolute left-3.5 top-1/2 -translate-y-1/2" style={{ color: '#9ca3af' }}>
      <SearchIcon />
    </div>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="검색..."
      className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl transition-all duration-200 outline-none"
      style={{
        border: '1.5px solid #e5e7eb',
        color: '#111827',
        backgroundColor: '#f9fafb',
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = '#0064FF';
        e.currentTarget.style.backgroundColor = '#ffffff';
        e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0, 100, 255, 0.1)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = '#e5e7eb';
        e.currentTarget.style.backgroundColor = '#f9fafb';
        e.currentTarget.style.boxShadow = 'none';
      }}
    />
  </div>
);
