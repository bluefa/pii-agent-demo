'use client';

import { User } from '../../../../lib/types';
import { UserSearchInput } from '../../ui/UserSearchInput';
import { UserSearchResult } from '../../../lib/api';

interface PermissionsPanelProps {
  permissions: User[];
  onAddUser: (user: UserSearchResult) => void;
  onRemoveUser: (userId: string) => void;
}

export const PermissionsPanel = ({ permissions, onAddUser, onRemoveUser }: PermissionsPanelProps) => {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6">
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">권한 유저</h3>
      <div className="space-y-4">
        {/* User List */}
        <div className="space-y-2">
          {permissions.map((user) => (
            <div
              key={user.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-100 hover:border-gray-200 transition-colors"
            >
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <span className="font-medium text-gray-900 flex-1">{user.name}</span>
              <button
                onClick={() => onRemoveUser(user.id)}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                title="삭제"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))}
          {permissions.length === 0 && (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <svg className="w-6 h-6 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                </svg>
              </div>
              <p className="text-gray-500 text-sm">권한을 가진 유저가 없습니다</p>
            </div>
          )}
        </div>

        {/* Add User */}
        <div className="pt-3 border-t border-gray-100">
          <UserSearchInput
            excludeIds={permissions.map((u) => u.id)}
            onSelect={onAddUser}
            placeholder="사용자 검색 (이름, 이메일)"
          />
        </div>
      </div>
    </div>
  );
};
