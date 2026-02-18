'use client';

import { IDC_VALIDATION } from '@/lib/constants/idc';
import { cn, inputStyles, primaryColors } from '@/lib/theme';

interface IdcIpListInputProps {
  ips: string[];
  errors: Record<string, string>;
  onChange: (index: number, value: string) => void;
  onAdd: () => void;
  onRemove: (index: number) => void;
}

export const IdcIpListInput = ({ ips, errors, onChange, onAdd, onRemove }: IdcIpListInputProps) => {
  const showClusterWarning = ips.filter(ip => ip.trim()).length >= 2;

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        IP 주소 <span className="text-gray-400 font-normal">(최대 {IDC_VALIDATION.MAX_IPS}개)</span>
      </label>
      <div className="space-y-2">
        {ips.map((ip, index) => (
          <div key={index} className="flex items-center gap-2">
            <input
              type="text"
              value={ip}
              onChange={(e) => onChange(index, e.target.value)}
              className={cn(inputStyles.base, errors[`ip_${index}`] && inputStyles.error)}
              placeholder="예: 192.168.1.100"
            />
            {ips.length > 1 && (
              <button
                type="button"
                onClick={() => onRemove(index)}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        ))}
        {errors.ips && <p className="text-sm text-red-600">{errors.ips}</p>}
        {ips.map((_, index) =>
          errors[`ip_${index}`] && <p key={`err_${index}`} className="text-sm text-red-600">{errors[`ip_${index}`]}</p>
        )}
      </div>
      {ips.length < IDC_VALIDATION.MAX_IPS && (
        <button
          type="button"
          onClick={onAdd}
          className={cn('mt-2 flex items-center gap-1 text-sm font-medium', primaryColors.text, primaryColors.textHover)}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          IP 추가
        </button>
      )}

      {showClusterWarning && (
        <div className="mt-3 flex items-start gap-2 px-4 py-3 bg-orange-50 border border-orange-200 rounded-lg">
          <svg className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <div className="text-sm text-orange-700">
            <p className="font-medium">여러 IP를 입력하셨습니다.</p>
            <p className="mt-1">서로 다른 DB가 아닌, 동일 DB의 Cluster IP 목록이 맞는지 확인해주세요.</p>
            <p>서로 다른 DB는 별도의 리소스로 등록해야 합니다.</p>
          </div>
        </div>
      )}
    </div>
  );
};
