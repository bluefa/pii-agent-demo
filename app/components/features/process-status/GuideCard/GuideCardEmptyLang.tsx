import { GuideCardChrome } from '@/app/components/features/process-status/GuideCard/GuideCardChrome';
import { cardStyles, cn } from '@/lib/theme';

interface Props {
  lang: 'ko' | 'en';
}

const MESSAGES: Record<Props['lang'], string> = {
  ko: '한국어 본문이 아직 작성되지 않았습니다.',
  en: '영어 본문이 아직 작성되지 않았습니다.',
};

export const GuideCardEmptyLang = ({ lang }: Props) => (
  <GuideCardChrome>
    <div className={cn('px-6 py-5 text-[13px] opacity-70', cardStyles.warmVariant.body)}>
      {MESSAGES[lang]}
    </div>
  </GuideCardChrome>
);
