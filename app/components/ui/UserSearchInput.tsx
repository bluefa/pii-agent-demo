'use client';

import { useState, useEffect, useRef } from 'react';
import { searchUsers, UserSearchResult } from '@/app/lib/api';
import { primaryColors, statusColors, cn } from '@/lib/theme';

interface UserSearchInputProps {
  excludeIds: string[];
  onSelect: (user: UserSearchResult) => void;
  placeholder?: string;
}

export const UserSearchInput = ({
  excludeIds,
  onSelect,
  placeholder = '사용자 검색...',
}: UserSearchInputProps) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length === 0) {
        setLoading(true);
        try {
          const users = await searchUsers('', excludeIds);
          setResults(users);
        } catch {
          setResults([]);
        }
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const users = await searchUsers(query, excludeIds);
        setResults(users);
      } catch {
        setResults([]);
      }
      setLoading(false);
    }, 150);

    return () => clearTimeout(timer);
  }, [query, excludeIds]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (user: UserSearchResult) => {
    onSelect(user);
    setQuery('');
    setIsOpen(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : prev));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          handleSelect(results[selectedIndex]);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        break;
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={cn('w-full px-3 py-2 pl-9 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:border-transparent', primaryColors.focusRing)}
        />
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        {loading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className={cn('w-4 h-4 border-2 border-t-transparent rounded-full animate-spin', primaryColors.border)} />
          </div>
        )}
      </div>

      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-auto">
          {results.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-500 text-center">
              {loading ? '검색 중...' : '검색 결과가 없습니다'}
            </div>
          ) : (
            <ul>
              {results.map((user, index) => (
                <li
                  key={user.id}
                  onClick={() => handleSelect(user)}
                  className={cn(
                    'px-4 py-2.5 cursor-pointer flex items-center gap-3 transition-colors',
                    index === selectedIndex ? statusColors.info.bgLight : 'hover:bg-gray-50'
                  )}
                >
                  <div className={cn('w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0', statusColors.info.bg)}>
                    <svg
                      className={cn('w-4 h-4', primaryColors.text)}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium text-gray-900 truncate">{user.name}</div>
                    <div className="text-xs text-gray-500 truncate">{user.email}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
