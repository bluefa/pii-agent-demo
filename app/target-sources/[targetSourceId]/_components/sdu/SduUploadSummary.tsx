'use client';

import { useState } from 'react';
import { cn, textColors, textStyles } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { getSduUpload } from '@/app/lib/api/sdu';
import { SDU_REGION_LABEL, type SduUpload } from '@/lib/types/sdu';
import { MetaField } from '@/app/target-sources/[targetSourceId]/_components/shared/MetaField';

/**
 * 무엇이 끝났는지 — the recap steps 6 and 7 both close with.
 *
 * Steps 6 and 7 are the two screens on which the owner has nothing left to do, and a
 * screen with nothing to do reads as a screen that has stopped. These four values are
 * what the reader would otherwise have to go back and look up: which Regions they opened,
 * when they submitted, when BDC finished, and who the S3 Access Key went to.
 *
 * A row with no value is DROPPED, not printed as '-'. At step 6 the BDC completion time
 * genuinely does not exist yet, and an em-dash beside 「리소스 생성 완료」 says the work
 * failed rather than that it is still running.
 */
export const SduUploadSummary = ({ targetSourceId }: { targetSourceId: number }) => {
  const [upload, setUpload] = useState<SduUpload | null>(null);
  const [failed, setFailed] = useState(false);

  useAbortableEffect(
    (signal) => {
      setFailed(false);
      return getSduUpload(targetSourceId, { signal })
        .then((data) => {
          if (signal.aborted) return;
          setUpload(data);
        })
        .catch(() => {
          // An abort is a cancellation, not a failure — painting the error copy for it
          // would flash 「불러오지 못했어요」 every time the target source changes.
          if (signal.aborted) return;
          setFailed(true);
        });
    },
    [targetSourceId],
  );

  if (failed) {
    // ⛔ Not silence. A failed read is not an empty target source: saying nothing here
    // would let the screen claim there were no Regions and no recipients.
    return (
      <p className={cn(textStyles.caption, textColors.tertiary)}>
        업로드 요약 정보를 불러오지 못했어요.
      </p>
    );
  }

  if (!upload) return null;

  const regionLabels = upload.regions.map((region) => SDU_REGION_LABEL[region]);
  const recipientCount = upload.accessKeyRecipients.users.length;

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      {regionLabels.length > 0 && (
        <MetaField
          label="업로드 Region"
          value={`${regionLabels.length}곳 · ${regionLabels.join(' · ')}`}
        />
      )}
      {upload.submittedAt && (
        <MetaField label="제출" value={formatDate(upload.submittedAt, 'datetime')} />
      )}
      {upload.bdc.completedAt && (
        <MetaField label="리소스 생성 완료" value={formatDate(upload.bdc.completedAt, 'datetime')} />
      )}
      {recipientCount > 0 && (
        <MetaField label="S3 Access Key 수신자" value={`${recipientCount}명`} />
      )}
    </div>
  );
};
