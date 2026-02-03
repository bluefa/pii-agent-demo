'use client';

import { useState } from 'react';
import { Button } from '@/app/components/ui/Button';
import { CloudProvider } from '@/lib/types';
import { createProject } from '@/app/lib/api';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { AwsIcon, IdcIcon } from '@/app/components/ui/CloudProviderIcon';

interface ProjectCreateModalProps {
  selectedServiceCode: string;
  serviceName: string;
  onClose: () => void;
  onCreated: () => void;
}

export const ProjectCreateModal = ({ selectedServiceCode, serviceName, onClose, onCreated }: ProjectCreateModalProps) => {
  const [projectCode, setProjectCode] = useState('');
  const [description, setDescription] = useState('');
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
      await createProject({ projectCode, serviceCode: selectedServiceCode, cloudProvider, description });
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
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl w-[480px] shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">새 과제 등록</h2>
              <p className="text-sm text-gray-500">PII Agent 설치 과제를 생성합니다</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* 서비스 코드 (읽기 전용) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">서비스 코드</label>
            <div className="flex items-center gap-3 px-4 py-3 bg-gray-50 rounded-lg border border-gray-200">
              <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center">
                <span className="text-white text-xs font-bold">{selectedServiceCode.charAt(0)}</span>
              </div>
              <div>
                <div className="font-medium text-gray-900">{selectedServiceCode}</div>
                <div className="text-sm text-gray-500">{serviceName}</div>
              </div>
            </div>
          </div>

          {/* 과제 코드 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">과제 코드</label>
            <input
              type="text"
              value={projectCode}
              onChange={(e) => setProjectCode(e.target.value)}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
              placeholder="예: N-IRP-001"
            />
          </div>

          {/* 설명 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              설명 <span className="text-gray-400 font-normal">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 border border-gray-200 rounded-lg text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow resize-none"
              placeholder="과제에 대한 간단한 설명을 입력하세요"
            />
          </div>

          {/* Cloud Provider 선택 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Cloud Provider</label>
            <div className="grid grid-cols-2 gap-3">
              {/* AWS */}
              <button
                type="button"
                onClick={() => setCloudProvider('AWS')}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  cloudProvider === 'AWS'
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cloudProvider === 'AWS' && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    cloudProvider === 'AWS' ? 'bg-[#FF9900]/10' : 'bg-gray-100'
                  }`}>
                    <AwsIcon className={`w-7 h-7 ${cloudProvider === 'AWS' ? 'text-[#FF9900]' : 'text-gray-500'}`} />
                  </div>
                  <span className={`font-medium ${cloudProvider === 'AWS' ? 'text-orange-700' : 'text-gray-700'}`}>AWS</span>
                  <span className="text-xs text-gray-500">자동 스캔 지원</span>
                </div>
              </button>

              {/* IDC */}
              <button
                type="button"
                onClick={() => setCloudProvider('IDC')}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  cloudProvider === 'IDC'
                    ? 'border-gray-700 bg-gray-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                {cloudProvider === 'IDC' && (
                  <div className="absolute top-2 right-2">
                    <svg className="w-5 h-5 text-gray-700" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col items-center gap-2">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    cloudProvider === 'IDC' ? 'bg-gray-200' : 'bg-gray-100'
                  }`}>
                    <IdcIcon className={`w-7 h-7 ${cloudProvider === 'IDC' ? 'text-gray-700' : 'text-gray-500'}`} />
                  </div>
                  <span className={`font-medium ${cloudProvider === 'IDC' ? 'text-gray-900' : 'text-gray-700'}`}>IDC</span>
                  <span className="text-xs text-gray-500">수동 등록</span>
                </div>
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
              <svg className="w-5 h-5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="text-sm text-red-700">{error}</span>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={onClose} type="button">
              취소
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? (
                <span className="flex items-center gap-2">
                  <LoadingSpinner />
                  등록 중...
                </span>
              ) : '과제 등록'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
