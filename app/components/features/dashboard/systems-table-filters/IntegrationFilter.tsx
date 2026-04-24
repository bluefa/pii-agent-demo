'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDownIcon } from '@/app/components/ui/icons';
import { INTEGRATION_OPTIONS } from './constants';

interface IntegrationFilterProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export const IntegrationFilter = ({ value, onChange }: IntegrationFilterProps) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggle = (method: string) => {
    onChange(
      value.includes(method)
        ? value.filter((m) => m !== method)
        : [...value, method],
    );
  };

  const label =
    value.length === 0
      ? '연동방식'
      : value.length === 1
        ? value[0]
        : `연동방식 (${value.length})`;

  const active = value.length > 0;

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3.5 py-2.5 text-sm rounded-xl transition-all duration-200"
        style={{
          border: open || active ? '1.5px solid #0064FF' : '1.5px solid #e5e7eb',
          color: active ? '#0064FF' : '#374151',
          backgroundColor: active ? '#eff6ff' : '#ffffff',
          boxShadow: open ? '0 0 0 3px rgba(0, 100, 255, 0.1)' : 'none',
        }}
      >
        <span>{label}</span>
        <span
          className="transition-transform duration-200"
          style={{
            transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
            color: '#9ca3af',
          }}
        >
          <ChevronDownIcon />
        </span>
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-52 rounded-xl z-20 py-1.5 overflow-hidden"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #e5e7eb',
            boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)',
          }}
        >
          {INTEGRATION_OPTIONS.map((option) => {
            const isChecked = value.includes(option);
            return (
              <label
                key={option}
                className="flex items-center gap-3 px-4 py-2.5 text-sm cursor-pointer transition-colors duration-150"
                style={{ color: '#374151' }}
                onClick={() => toggle(option)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#f9fafb';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div
                  className="w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all duration-150"
                  style={{
                    backgroundColor: isChecked ? '#0064FF' : '#ffffff',
                    border: isChecked ? '2px solid #0064FF' : '2px solid #d1d5db',
                  }}
                >
                  {isChecked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                {option}
              </label>
            );
          })}
        </div>
      )}
    </div>
  );
};
