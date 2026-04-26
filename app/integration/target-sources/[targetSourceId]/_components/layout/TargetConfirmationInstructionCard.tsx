import type { CloudTargetSource } from '@/lib/types';
import { cn, statusColors } from '@/lib/theme';

interface TargetConfirmationInstructionCardProps {
  project: CloudTargetSource;
}

export const TargetConfirmationInstructionCard = ({
  project,
}: TargetConfirmationInstructionCardProps) => (
  <div className={cn('w-full p-4 rounded-lg space-y-2', statusColors.info.bg, statusColors.info.border, 'border')}>
    <p className={cn('text-sm font-medium', statusColors.info.textDark)}>
      {project.cloudProvider === 'AWS' ? '수행 절차' : '안내'}
    </p>
    <ol className={cn('text-sm list-decimal list-inside space-y-1', statusColors.info.textDark)}>
      {project.cloudProvider === 'AWS' ? (
        <>
          <li>[리소스 스캔] 버튼을 클릭하여 AWS 계정의 RDS, S3 등 리소스를 조회하세요</li>
          <li>스캔 결과에서 PII Agent를 연동할 리소스를 선택하세요</li>
          <li>EC2(VM) 포함이 필요한 경우 필터에서 VM 포함을 선택하세요</li>
          <li>선택 완료 후 [연동 대상 확정] 버튼을 클릭하세요</li>
        </>
      ) : (
        <li>리소스를 스캔하고 연동할 대상을 선택한 뒤 확정해주세요</li>
      )}
    </ol>
    {project.cloudProvider === 'AWS' && (
      <p className={cn('text-xs mt-2', statusColors.info.text)}>
        리소스가 조회되지 않으면 AWS Console &gt; IAM에서 스캔 Role이 등록되어 있는지 확인해주세요
      </p>
    )}
  </div>
);
