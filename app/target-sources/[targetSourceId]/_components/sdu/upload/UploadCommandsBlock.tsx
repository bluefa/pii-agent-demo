'use client';

import { useState } from 'react';
import { useLocale } from '@/app/components/LocaleProvider';
import { SDU_COPY } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
import { CommandBlock } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/CommandBlock';
import { YesNoAck } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/YesNoAck';
import { answerOf } from '@/app/target-sources/[targetSourceId]/_components/sdu/upload/model';
import { cn, stackGap, textColors, textStyles } from '@/lib/theme';
import type { SduCommands } from '@/lib/types/sdu';

export interface UploadCommandsBlockProps {
  commands: SduCommands;
  onAnswer: (confirmed: boolean) => Promise<void>;
}

/**
 * 4-3 데이터 업로드 확인. One command block per Region — the upload path is Region-scoped, so
 * the same path is shared by every target in that Region and Database Type never splits it.
 */
export const UploadCommandsBlock = ({ commands, onAnswer }: UploadCommandsBlockProps) => {
  const { locale } = useLocale();
  const t = SDU_COPY[locale].upload;
  const [answering, setAnswering] = useState(false);

  const answer = async (confirmed: boolean) => {
    setAnswering(true);
    try {
      await onAnswer(confirmed);
    } catch {
      // The card above says the write failed. The answer is NOT recorded here — a 아니오 note
      // under a request that never landed would be the screen agreeing with itself.
    } finally {
      setAnswering(false);
    }
  };

  return (
    <div className={cn('flex flex-col', stackGap.group)}>
      <p className={cn(textStyles.body, textColors.secondary)}>{t.commandsIntro}</p>

      <div className={cn('flex flex-col', stackGap.related)}>
        {commands.rows.map((row) => (
          <CommandBlock
            key={row.region}
            region={row.region}
            command={row.command}
            acked={commands.acked}
          />
        ))}
      </div>

      <YesNoAck
        question={t.commandsQuestion}
        value={answerOf(commands)}
        onAnswer={answer}
        busy={answering}
      />
    </div>
  );
};
