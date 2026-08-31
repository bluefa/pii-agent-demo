'use client';

import { useState } from 'react';
import { cn, textColors, textStyles } from '@/lib/theme';
import { formatDate } from '@/lib/utils/date';
import { useAbortableEffect } from '@/app/hooks/useAbortableEffect';
import { useLocale } from '@/app/components/LocaleProvider';
import { SDU_COPY } from '@/app/target-sources/[targetSourceId]/_components/sdu/copy';
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
  const { locale } = useLocale();
  const t = SDU_COPY[locale].recap;
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
      <p className={cn(textStyles.caption, textColors.tertiary)}>{t.loadFailed}</p>
    );
  }

  if (!upload) return null;

  const regionLabels = upload.regions.map((region) => SDU_REGION_LABEL[region]);
  const recipientCount = upload.accessKeyRecipients.users.length;

  return (
    <div className="flex flex-wrap gap-x-10 gap-y-4">
      {regionLabels.length > 0 && (
        <MetaField
          label={t.regionsLabel}
          value={t.regionsValue(regionLabels.length, regionLabels.join(' · '))}
        />
      )}
      {upload.submittedAt && (
        <MetaField label={t.submittedLabel} value={formatDate(upload.submittedAt, 'datetime', locale)} />
      )}
      {upload.bdc.completedAt && (
        <MetaField
          label={t.resourcesDoneLabel}
          value={formatDate(upload.bdc.completedAt, 'datetime', locale)}
        />
      )}
      {recipientCount > 0 && (
        <MetaField label={t.recipientsLabel} value={t.recipientsValue(recipientCount)} />
      )}
    </div>
  );
};
