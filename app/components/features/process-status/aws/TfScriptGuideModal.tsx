'use client';

import { statusColors, cn, getButtonClass } from '@/lib/theme';
import { useLocale } from '@/app/components/LocaleProvider';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';

interface TfScriptGuideModalProps {
  onClose: () => void;
}

export const TfScriptGuideModal = ({ onClose }: TfScriptGuideModalProps) => {
  const { locale } = useLocale();
  const t = INSTALL_COPY[locale].tfScriptGuide;
  const commands = `cd install-script/
./install.sh init
./install.sh plan
./install.sh apply`;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{t.title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 space-y-6">
          <p className="text-sm text-gray-600">{t.intro}</p>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{t.step1Title}</h4>
            <p className="text-sm text-gray-600">{t.step1Body}</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{t.step2Title}</h4>
            <p className="text-sm text-gray-600 mb-2">{t.step2Body}</p>
            <ul className="text-sm text-gray-600 list-disc list-inside space-y-1 ml-2">
              <li>{t.step2Cli}</li>
              <li>{t.step2Exec}</li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{t.step3Title}</h4>
            <p className="text-sm text-gray-600 mb-2">{t.step3Body}</p>
            <div className="relative">
              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg text-sm overflow-x-auto">
                {commands}
              </pre>
              <button
                onClick={() => copyToClipboard(commands)}
                className="absolute top-2 right-2 p-1.5 bg-gray-700 hover:bg-gray-600 rounded text-gray-300"
                title={t.copy}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </button>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-2">{t.step4Title}</h4>
            <p className="text-sm text-gray-600">
              {t.step4Body}
              <br />
              {t.step4Delay}
            </p>
          </div>

          <div className={cn('p-3 rounded-lg border', statusColors.warning.bg, statusColors.warning.border)}>
            <div className="flex items-start gap-2">
              <svg className={cn('w-5 h-5 flex-shrink-0 mt-0.5', statusColors.warning.text)} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className={cn('text-sm', statusColors.warning.textDark)}>
                <strong>{t.warningLabel}</strong> {t.warningBody}
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end p-4 border-t border-gray-200">
          <button onClick={onClose} className={getButtonClass('secondary', 'md')}>
            {t.close}
          </button>
        </div>
      </div>
    </div>
  );
};
