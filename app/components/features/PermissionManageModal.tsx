'use client';

import { useState, useEffect } from 'react';
import { Button } from '../ui/Button';
import { ServiceCode, User } from '../../../lib/types';
import { getPermissions, addPermission, deletePermission } from '../../lib/api';

interface PermissionManageModalProps {
  services: ServiceCode[];
  onClose: () => void;
}

export const PermissionManageModal = ({ services, onClose }: PermissionManageModalProps) => {
  const [selectedService, setSelectedService] = useState(services[0]?.code || '');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [newUserId, setNewUserId] = useState('');
  const [error, setError] = useState('');

  const fetchUsers = async () => {
    if (!selectedService) return;
    setLoading(true);
    setError('');
    try {
      const data = await getPermissions(selectedService);
      setUsers(data);
    } catch {
      setError('권한 목록을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [selectedService]);

  const handleAdd = async () => {
    if (!newUserId.trim()) return;
    try {
      await addPermission(selectedService, newUserId.trim());
      setNewUserId('');
      fetchUsers();
    } catch {
      setError('권한 추가에 실패했습니다');
    }
  };

  const handleDelete = async (userId: string) => {
    try {
      await deletePermission(selectedService, userId);
      fetchUsers();
    } catch {
      setError('권한 삭제에 실패했습니다');
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[500px] shadow-xl max-h-[80vh] overflow-hidden flex flex-col">
        <h2 className="text-lg font-bold mb-4">권한 관리</h2>

        <div className="mb-4">
          <label className="block text-sm font-medium mb-1">서비스 코드</label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {services.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} - {s.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={newUserId}
            onChange={(e) => setNewUserId(e.target.value)}
            placeholder="사용자 ID 입력"
            className="flex-1 border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button onClick={handleAdd}>추가</Button>
        </div>

        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}

        <div className="flex-1 overflow-auto border rounded">
          {loading ? (
            <p className="p-4 text-gray-500">로딩 중...</p>
          ) : users.length === 0 ? (
            <p className="p-4 text-gray-500">권한 보유 사용자가 없습니다</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-3">이름</th>
                  <th className="text-left p-3">이메일</th>
                  <th className="text-left p-3">역할</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-t">
                    <td className="p-3">{user.name}</td>
                    <td className="p-3">{user.email}</td>
                    <td className="p-3">{user.role}</td>
                    <td className="p-3 text-right">
                      <Button variant="danger" onClick={() => handleDelete(user.id)}>
                        삭제
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="flex justify-end pt-4">
          <Button variant="secondary" onClick={onClose}>
            닫기
          </Button>
        </div>
      </div>
    </div>
  );
};
