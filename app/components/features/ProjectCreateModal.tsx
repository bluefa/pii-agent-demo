'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { CloudProvider } from '../../../lib/types';
import { createProject } from '../../lib/api';

interface ProjectCreateModalProps {
  selectedServiceCode: string;
  serviceName: string;
  onClose: () => void;
  onCreated: () => void;
}

export const ProjectCreateModal = ({ selectedServiceCode, serviceName, onClose, onCreated }: ProjectCreateModalProps) => {
  const [projectCode, setProjectCode] = useState('');
  const [cloudProvider, setCloudProvider] = useState<CloudProvider>('AWS');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectCode.trim()) {
      setError('과제 코드를 입력하세요');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await createProject({ projectCode, serviceCode: selectedServiceCode, cloudProvider });
      onCreated();
      onClose();
    } catch (err) {
      console.error('과제 생성 실패:', err);
      setError('과제 생성에 실패했습니다: ' + (err instanceof Error ? err.message : '알 수 없는 오류'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px] shadow-xl">
        <h2 className="text-lg font-bold mb-4">과제 등록</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">과제 코드</label>
            <input
              type="text"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="예: PROJ-001"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">서비스 코드</label>
            <div className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-700">
              {selectedServiceCode} - {serviceName}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cloud Provider</label>
            <select
              value={cloudProvider}
              onChange={(e) => setCloudProvider(e.target.value as CloudProvider)}
              className="w-full border rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="AWS">AWS</option>
              <option value="IDC">IDC</option>
            </select>
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={onClose}>
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? '등록 중...' : '등록'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
