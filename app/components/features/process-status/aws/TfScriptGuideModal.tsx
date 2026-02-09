'use client';

import { statusColors, cn, getButtonClass } from '@/lib/theme';

interface TfScriptGuideModalProps {
  onClose: () => void;
}

export const TfScriptGuideModal = ({ onClose }: TfScriptGuideModalProps) => {
  const commands = `cd install-script/
./install.sh init
./install.sh plan
./install.sh apply`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">설치 스크립트 실행 가이드</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600">
            수동 설치 모드에서는 설치 스크립트를 직접 실행해야 합니다.
          </p>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Step 1. 설치 스크립트 다운로드</h4>
            <p className="text-sm text-gray-600">
              설치 단계에서 설치 스크립트를 다운로드합니다.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Step 2. 실행 환경 준비</h4>
            <p className="text-sm text-gray-600 mb-2">
              다운로드한 파일의 압축을 해제하고 실행 환경을 준비합니다.
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
              <li>AWS CLI 인증 필요</li>
              <li>스크립트 실행 권한 필요</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Step 3. 스크립트 실행</h4>
            <p className="text-sm text-gray-600 mb-2">다음 명령어를 순서대로 실행합니다:</p>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                {commands}
              </pre>
              <button
                onClick={() => copyToClipboard(commands)}
                className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                title="복사"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Step 4. 설치 완료 확인</h4>
            <p className="text-sm text-gray-600">
              스크립트 실행 완료 후, 시스템에서 자동으로 설치 상태를 확인합니다.
              <br />
              설치가 반영되기까지 최대 5분이 소요될 수 있습니다.
            </p>
          </div>

          <div className={cn('p-3 rounded-lg border', statusColors.warning.bg, statusColors.warning.border)}>
            <div className="flex items-start gap-2">
              <svg className={cn('w-5 h-5 flex-shrink-0 mt-0.5', statusColors.warning.text)} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className={cn('text-sm', statusColors.warning.textDark)}>
                <strong>주의:</strong> 스크립트 실행 전 반드시 AWS 계정 인증이 완료되어 있어야 합니다.
                잘못된 계정으로 실행 시 리소스가 다른 계정에 생성될 수 있습니다.
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-gray-200">
          <button onClick={onClose} className={getButtonClass('secondary', 'md')}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
};
