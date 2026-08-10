'use client';

import { useCallback, useState } from 'react';
import { getAwsTerraformScript } from '@/app/lib/api/aws';
import { cn, getButtonClass, statusColors, textStyles } from '@/lib/theme';

/**
 * Terraform Script 다운로드 컨트롤.
 *
 * 두 자리에 선다. 자동/수동 어느 쪽에서도 레일 '참고' 항목의 히어로 액션이고,
 * 수동 설치에서는 그 단계가 곧 이 다운로드이므로(`docs/cloud-provider-states.md`
 * 수동 INSTALLING = 안내 문구 + [TF Script 다운로드]) 단계 헤더의 액션이기도 하다.
 *
 * 그래서 정렬을 스스로 정하지 않는다 — inline-flex 로 제 폭만 차지하고 배치는 부모가 준다.
 * CTA 는 outline — 채운 버튼은 카드에 하나뿐이어야 하고, 그 하나는 실제 진행을
 * 바꾸는 액션의 몫이다. 테두리와 글자만으로 CTA 무게를 낸다.
 */
export const TerraformScriptDownload = ({ targetSourceId }: { targetSourceId: number }) => {
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
      setError('다운로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    } finally {
      setDownloading(false);
    }
  }, [targetSourceId]);

  return (
    <span className="inline-flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={handleDownload}
        disabled={downloading}
        className={cn(getButtonClass('outline'), 'whitespace-nowrap')}
      >
        {downloading ? '다운로드 중...' : 'Terraform Script 다운로드'}
      </button>

      {/* 실패는 박스가 아니라 캡션이다 — 단계 헤더의 좁은 슬롯에서도 레이아웃을 밀지 않는다. */}
      {error && (
        <span
          role="alert"
          className={cn(textStyles.caption, statusColors.error.textDark, 'max-w-[26ch] break-keep text-center')}
        >
          {error}
        </span>
      )}
    </span>
  );
};
