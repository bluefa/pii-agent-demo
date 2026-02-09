'use client';

import { useState } from 'react';
import { statusColors, cn, getButtonClass } from '@/lib/theme';

interface TfRoleGuideModalProps {
  onClose: () => void;
  onVerify?: () => Promise<boolean>;
}

export const TfRoleGuideModal = ({ onClose, onVerify }: TfRoleGuideModalProps) => {
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<'success' | 'failed' | null>(null);

  const handleVerify = async () => {
    if (!onVerify) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const result = await onVerify();
      setVerifyResult(result ? 'success' : 'failed');
    } catch {
      setVerifyResult('failed');
    } finally {
      setVerifying(false);
    }
  };

  const policyJson = `{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ec2:*",
        "rds:*",
        "s3:*",
        "iam:PassRole"
      ],
      "Resource": "*"
    }
  ]
}`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">권한 설정 가이드</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600">
            자동 설치를 위해 AWS 계정에 자동 설치 권한(Role)을 등록해야 합니다.
          </p>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Step 1. AWS Console 접속</h4>
            <p className="text-sm text-gray-600">
              AWS Management Console {'>'} IAM {'>'} Roles로 이동합니다.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Step 2. Role 생성</h4>
            <p className="text-sm text-gray-600 mb-2">
              &quot;Create Role&quot; 버튼을 클릭하고 다음 설정을 적용합니다:
            </p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
              <li>Trusted entity type: AWS account</li>
              <li>Role name: <code className="bg-gray-100 px-1 rounded">자동 설치 권한(Role)</code></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Step 3. Policy 연결</h4>
            <p className="text-sm text-gray-600 mb-2">다음 정책을 연결합니다:</p>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-xs overflow-x-auto">
                {policyJson}
              </pre>
              <button
                onClick={() => copyToClipboard(policyJson)}
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
            <h4 className="text-sm font-semibold text-gray-900 mb-2">Step 4. 권한 등록 확인</h4>
            <p className="text-sm text-gray-600 mb-3">
              Role 생성 완료 후 아래 버튼을 클릭하여 등록 상태를 확인하세요.
            </p>

            {onVerify && (
              <div className="flex items-center gap-3">
                <button
                  onClick={handleVerify}
                  disabled={verifying}
                  className={getButtonClass('primary', 'md')}
                >
                  {verifying ? '확인 중...' : '권한 등록 확인'}
                </button>

                {verifyResult === 'success' && (
                  <span className={cn('text-sm flex items-center gap-1', statusColors.success.text)}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    등록 확인됨
                  </span>
                )}
                {verifyResult === 'failed' && (
                  <span className={cn('text-sm flex items-center gap-1', statusColors.error.text)}>
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                    등록되지 않음
                  </span>
                )}
              </div>
            )}
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
