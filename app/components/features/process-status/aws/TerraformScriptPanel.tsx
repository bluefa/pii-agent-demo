'use client';

import { useCallback, useState } from 'react';
import { getAwsTerraformScript } from '@/app/lib/api/aws';
import { cn, getButtonClass, stackGap, statusColors, textColors, textStyles } from '@/lib/theme';

/**
 * Step-4 레일의 '참고 · Terraform Script' 패널.
 *
 * 자동/수동 설치 어느 쪽에서도 항상 제공되는 보조 기능이라(오너 요구),
 * 단계 목록 밖의 참고 항목으로 서고 다운로드 상태도 이 패널이 직접 갖는다.
 *
 * CTA 는 outline — 채운 버튼은 카드에 하나뿐이어야 하고, 그 하나는 실제
 * 진행을 바꾸는 액션의 몫이다. 테두리와 글자만으로 CTA 무게를 낸다.
 */
export const TerraformScriptPanel = ({ targetSourceId }: { targetSourceId: number }) => {
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDownload = useCallback(async () => {
    setDownloading(true);
    setError(null);
    try {
      const blob = await getAwsTerraformScript(targetSourceId);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `terraform-${targetSourceId}.zip`;
      anchor.click();
      URL.revokeObjectURL(url);
    } catch {
      setError('Terraform Script 다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDownloading(false);
    }
  }, [targetSourceId]);

  return (
    // 블록 경계 = group 16px
    <div className={cn('flex flex-col items-start', stackGap.group)}>
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className={cn(getButtonClass('outline'), 'whitespace-nowrap')}
      >
        {downloading ? '다운로드 중...' : 'Terraform Script 다운로드'}
      </button>

      {/* 라벨↔보충 설명 = tight 4px */}
      <div className={cn('flex flex-col', stackGap.tight, textStyles.caption, textColors.tertiary)}>
        <span>설치 방식(자동·수동)과 관계없이 언제든 받을 수 있습니다.</span>
        <span>
          저장 파일 <span className="font-mono">terraform-{targetSourceId}.zip</span>
        </span>
      </div>

      {error && (
        <div
          className={cn(
            'px-4 py-2 rounded-lg border',
            textStyles.body,
            statusColors.error.bg,
            statusColors.error.border,
            statusColors.error.textDark,
          )}
        >
          {error}
        </div>
      )}
    </div>
  );
};
