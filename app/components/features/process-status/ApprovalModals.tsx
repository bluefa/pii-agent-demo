'use client';

import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useLocale } from '@/app/components/LocaleProvider';
import { STATUS_COPY } from '@/app/components/features/process-status/status-copy';

interface ApprovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: () => void;
  loading: boolean;
  value: string;
  onChange: (value: string) => void;
}

export const ApproveModal = ({ isOpen, onClose, onSubmit, loading, value, onChange }: ApprovalModalProps) => {
  const { locale } = useLocale();
  const t = STATUS_COPY[locale];
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t.approve.title}</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.approve.commentLabel}
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t.approve.commentPlaceholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none text-gray-900"
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && <LoadingSpinner />}
            {t.approve.submit}
          </button>
        </div>
      </div>
    </div>
  );
};

export const RejectModal = ({ isOpen, onClose, onSubmit, loading, value, onChange }: ApprovalModalProps) => {
  const { locale } = useLocale();
  const t = STATUS_COPY[locale];
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-4">{t.reject.title}</h3>
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {t.reject.reasonLabel}
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={t.reject.reasonPlaceholder}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none text-gray-900"
            rows={3}
          />
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            onClick={onSubmit}
            disabled={loading}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {loading && <LoadingSpinner />}
            {t.reject.submit}
          </button>
        </div>
      </div>
    </div>
  );
};
