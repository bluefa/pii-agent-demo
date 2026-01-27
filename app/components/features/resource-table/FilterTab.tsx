'use client';

interface FilterTabProps {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
}

export const FilterTab = ({ label, count, active, onClick }: FilterTabProps) => (
  <button
    onClick={onClick}
    className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
      active ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
    }`}
  >
    {label}
    <span
      className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
        active ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-600'
      }`}
    >
      {count}
    </span>
  </button>
);
