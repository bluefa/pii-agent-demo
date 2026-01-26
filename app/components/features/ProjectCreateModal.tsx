'use client';

import { useState } from 'react';
import { Button } from '../ui/Button';
import { CloudProvider } from '../../../lib/types';
import { createProject } from '../../lib/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';

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
                    cloudProvider === 'AWS' ? 'bg-orange-100' : 'bg-gray-100'
                  }`}>
                    <svg className={`w-7 h-7 ${cloudProvider === 'AWS' ? 'text-orange-600' : 'text-gray-500'}`} viewBox="0 0 24 24" fill="currentColor">
                      <path d="M6.76 10.17c0 .4.03.73.09 1 .06.26.14.49.26.68.04.06.06.12.06.17 0 .07-.04.14-.13.2l-.42.28c-.06.04-.12.06-.17.06-.07 0-.14-.03-.2-.1a2.1 2.1 0 01-.31-.42c-.09-.16-.17-.33-.26-.52-.65.77-1.47 1.16-2.46 1.16-.7 0-1.26-.2-1.67-.6-.41-.4-.62-.94-.62-1.61 0-.71.25-1.29.76-1.73.51-.44 1.18-.66 2.03-.66.28 0 .57.02.87.07.3.04.61.11.93.18v-.6c0-.62-.13-1.06-.38-1.31-.26-.25-.69-.38-1.31-.38-.28 0-.57.03-.87.1-.3.07-.59.15-.87.25-.13.05-.22.08-.27.09-.05.01-.09.02-.12.02-.1 0-.15-.08-.15-.23v-.37c0-.12.02-.21.05-.27.03-.06.09-.12.18-.17.28-.15.62-.27 1.02-.37.4-.1.83-.15 1.28-.15.98 0 1.7.22 2.17.67.47.45.7 1.14.7 2.06v2.72zM3.36 11.44c.27 0 .55-.05.84-.15.29-.1.55-.28.77-.52.13-.15.23-.32.3-.52.06-.2.09-.43.09-.71v-.34a6.62 6.62 0 00-1.48-.18c-.53 0-.92.1-1.18.31-.26.21-.39.51-.39.89 0 .37.1.65.29.84.19.2.47.29.82.29l-.06.09zm6.27.85c-.13 0-.22-.02-.28-.07-.06-.05-.12-.15-.17-.29l-1.9-6.28c-.05-.14-.08-.24-.08-.29 0-.12.06-.18.18-.18h.73c.14 0 .23.02.29.07.06.05.11.15.16.29l1.36 5.38 1.26-5.38c.04-.14.09-.24.15-.29.06-.05.16-.07.29-.07h.59c.14 0 .24.02.29.07.06.05.12.15.16.29l1.27 5.45 1.4-5.45c.05-.14.1-.24.16-.29.06-.05.16-.07.29-.07h.69c.12 0 .18.06.18.18 0 .04-.01.09-.02.15-.01.06-.03.13-.06.22l-1.95 6.29c-.05.14-.1.24-.17.29-.06.05-.16.07-.28.07h-.64c-.14 0-.23-.02-.29-.07-.06-.05-.11-.15-.16-.3l-1.25-5.25-1.24 5.25c-.04.15-.09.25-.15.3-.06.05-.16.07-.29.07h-.64zm10.02.21c-.43 0-.85-.05-1.26-.14-.4-.09-.72-.19-.93-.3-.13-.07-.21-.14-.24-.22a.56.56 0 01-.05-.22v-.38c0-.15.06-.23.17-.23.04 0 .09.01.13.02.05.02.11.04.19.07.26.12.54.21.85.27.31.07.61.1.92.1.49 0 .87-.09 1.14-.26.27-.17.4-.42.4-.74 0-.22-.07-.4-.21-.55-.14-.15-.42-.28-.81-.41l-1.17-.36c-.59-.19-1.03-.46-1.3-.83-.27-.36-.41-.77-.41-1.21 0-.35.08-.66.23-.93.16-.27.36-.51.62-.7.26-.19.56-.34.9-.44.34-.1.7-.15 1.08-.15.19 0 .39.01.58.03.2.02.38.05.56.09.17.04.33.08.48.12.15.05.27.1.36.15.12.07.21.14.26.21.05.07.08.16.08.27v.35c0 .15-.06.23-.17.23a.83.83 0 01-.28-.09c-.43-.2-.91-.29-1.45-.29-.44 0-.79.07-1.04.22-.25.15-.37.38-.37.7 0 .22.08.41.24.56.16.15.46.3.88.44l1.15.36c.58.18 1 .44 1.26.77.26.33.38.71.38 1.14 0 .36-.08.68-.23.97-.15.29-.36.55-.63.76-.27.21-.6.37-.98.49-.4.11-.82.17-1.27.17z"/>
                    </svg>
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
                    <svg className={`w-7 h-7 ${cloudProvider === 'IDC' ? 'text-gray-700' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                    </svg>
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
