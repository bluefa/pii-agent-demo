'use client';

import { useState } from 'react';
import { CommandBlock } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/CommandBlock';
import { YesNoAck } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/YesNoAck';
import {
  missingRegions,
  regionLabels,
} from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/model';
import { cn, stackGap, textColors, textStyles } from '@/lib/theme';
import type { SduCommands, SduRegion } from '@/lib/types/sdu';

export interface UploadCommandsBlockProps {
  regions: readonly SduRegion[];
  commands: SduCommands;
  onAnswer: (confirmed: boolean) => Promise<void>;
}

/**
 * 4-3 데이터 업로드 확인. One command block per Region — the upload path is Region-scoped, so
 * the same path is shared by every target in that Region and Database Type never splits it.
 */
export const UploadCommandsBlock = ({ regions, commands, onAnswer }: UploadCommandsBlockProps) => {
  const [answering, setAnswering] = useState(false);
  const [declined, setDeclined] = useState(false);

  const missing = missingRegions(regions, commands.ackedRegions);
  const answered = regions.filter((region) => commands.ackedRegions.includes(region));

  const answer = async (confirmed: boolean) => {
    setAnswering(true);
    try {
      await onAnswer(confirmed);
      setDeclined(!confirmed);
    } catch {
      // The card above says the write failed. The answer is NOT recorded here — a 아니오 note
      // under a request that never landed would be the screen agreeing with itself.
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div className={cn('flex flex-col', stackGap.group)}>
      <p className={cn(textStyles.body, textColors.secondary)}>
        관리자가 메일로 전달한 S3 Access Key로 데이터를 업로드해주세요. Region마다 아래 세 줄을 그대로
        실행하면 올라간 파일을 확인할 수 있어요 — 프록시 설정 두 줄과 조회 명령 한 줄이에요.
      </p>

      {missing.length > 0 && answered.length > 0 && (
        <p className={cn(textStyles.bodyStrong, textColors.secondary)}>
          {regionLabels(answered)}는 확인하셨어요. {regionLabels(missing)}가 남았어요.
        </p>
      )}

      <div className={cn('flex flex-col', stackGap.related)}>
        {commands.rows.map((row) => (
          <CommandBlock
            key={row.region}
            region={row.region}
            command={row.command}
            acked={commands.ackedRegions.includes(row.region)}
          />
        ))}
      </div>

      <YesNoAck
        question="모든 Region에 데이터를 업로드하셨습니까?"
        value={missing.length === 0 ? true : declined ? false : null}
        onAnswer={answer}
        busy={answering}
      />
    </div>
  );
};
