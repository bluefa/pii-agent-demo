'use client';

import { Modal } from '@/app/components/ui/Modal';
import { cn, statusColors } from '@/lib/theme';

interface SduSetupGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const GUIDE_STEPS = [
  {
    number: 1,
    title: 'S3 버킷 생성',
    description: 'SDU 데이터를 저장할 S3 버킷을 생성합니다. 버킷명은 고유해야 합니다.',
  },
  {
    number: 2,
    title: 'S3 데이터 업로드',
    description: 'SDU 데이터를 S3 버킷에 업로드합니다. 파일 형식과 경로를 확인하세요.',
  },
  {
    number: 3,
    title: 'Crawler 설정',
    description: 'AWS Glue Crawler를 설정하여 S3 데이터 스키마를 자동으로 인식하도록 구성합니다.',
  },
  {
    number: 4,
    title: 'Athena 쿼리 테스트',
    description: 'Athena 콘솔에서 생성된 테이블을 대상으로 쿼리를 실행하여 데이터를 확인합니다.',
  },
  {
    number: 5,
    title: 'IAM USER 생성',
    description: 'BDC 접근용 IAM USER를 생성하고 필요한 권한을 부여합니다.',
  },
  {
    number: 6,
    title: 'SourceIP 등록',
    description: 'BDC에서 접근할 SourceIP를 등록하고 관리자 확인을 요청합니다.',
  },
];

export const SduSetupGuideModal = ({ isOpen, onClose }: SduSetupGuideModalProps) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="SDU 환경 구성 가이드"
      subtitle="6단계로 완료하는 SDU 설치"
      size="xl"
      icon={
        <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      }
    >
      <div className="space-y-4">
        {GUIDE_STEPS.map((step, index) => (
          <div key={step.number} className="flex gap-4">
            {/* Step Number */}
            <div
              className={cn(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm',
                statusColors.info.bg,
                statusColors.info.text
              )}
            >
              {step.number}
            </div>

            {/* Content */}
            <div className="flex-1 pb-4 border-b border-gray-100 last:border-b-0">
              <h4 className="text-sm font-bold text-gray-900 mb-1">{step.title}</h4>
              <p className="text-sm text-gray-600">{step.description}</p>
            </div>
          </div>
        ))}

        {/* Footer 안내 */}
        <div className={cn('mt-6 p-4 rounded-lg', statusColors.warning.bg)}>
          <div className="flex items-start gap-3">
            <svg className={cn('w-5 h-5 flex-shrink-0', statusColors.warning.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <h5 className={cn('text-sm font-bold mb-1', statusColors.warning.textDark)}>주의사항</h5>
              <ul className={cn('text-sm space-y-1 list-disc list-inside', statusColors.warning.textDark)}>
                <li>각 단계는 순서대로 진행해야 합니다.</li>
                <li>S3 버킷과 데이터 형식은 BDC 가이드를 참고하세요.</li>
                <li>IAM USER 권한은 최소 권한 원칙을 따릅니다.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};
