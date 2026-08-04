'use client';

import { useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { formatDate } from '@/lib/utils/date';
import type { SecretKey } from '@/lib/types';
import {
  bgColors,
  borderColors,
  cn,
  getButtonClass,
  getInputClass,
  numericFeatures,
  primaryColors,
  textColors,
} from '@/lib/theme';

interface CredentialPickModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** 무엇을 바꾸는지 — 리소스 이름을 제목 아래에 그대로 적는다. */
  resourceLabel: string;
  /** 현재 배정값 ('' = 미설정). */
  value: string;
  /** GET …/secrets 레코드 — 이름과 생성 시각. */
  options: readonly SecretKey[];
  saving: boolean;
  onSubmit: (next: string) => void;
}

/**
 * 한 리소스의 DB Credential 을 고르는 모달 — 관리자 화면의 Credential 배정과 같은 모양이다
 * (값은 표에서 밑줄 텍스트로 읽고, 수정은 여기서 한 번에 커밋).
 *
 * 라디오인 이유: 답이 하나뿐이고, 현재 값이 아무것도 hover 하지 않아도 보이며, 위/아래 키
 * 이동을 플랫폼이 준다. 저장 전에는 아무것도 쓰지 않으므로 열어서 보기만 하는 것은 공짜다.
 */
export const CredentialPickModal = ({
  isOpen,
  onClose,
  resourceLabel,
  value,
  options,
  saving,
  onSubmit,
}: CredentialPickModalProps) => {
  const [picked, setPicked] = useState(value);
  const [query, setQuery] = useState('');
  // 열릴 때마다 현재 값에서 다시 시작한다 — 다른 행을 열었는데 앞 행의 선택이 남아 있으면
  // 저장 버튼이 이미 활성인 채로 뜬다.
  const [seededFrom, setSeededFrom] = useState({ isOpen, value });
  if (seededFrom.isOpen !== isOpen || seededFrom.value !== value) {
    setSeededFrom({ isOpen, value });
    setPicked(value);
    setQuery('');
  }

  const needle = query.trim().toLowerCase();
  const hits = needle
    ? options.filter((secret) => secret.name.toLowerCase().includes(needle))
    : options;
  // 검색어에 걸리지 않아도 현재 값은 남는다 — 검색했더니 아무것도 배정 안 된 것처럼 보이면 안 된다.
  const current = options.find((secret) => secret.name === picked);
  const shown =
    current && !hits.some((secret) => secret.name === picked) ? [current, ...hits] : hits;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DB Credential 설정"
      subtitle={`${resourceLabel}에 사용할 DB 접속 자격 증명을 선택하세요.`}
      size="md"
      footer={
        <>
          <button onClick={onClose} className={getButtonClass('secondary')}>
            취소
          </button>
          <button
            onClick={() => onSubmit(picked)}
            disabled={!picked || picked === value || saving}
            className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
          >
            {saving && <LoadingSpinner />}
            저장
          </button>
        </>
      }
    >
      {options.length === 0 ? (
        <p className={cn('py-6 text-center text-[14px]', textColors.tertiary)}>
          등록된 Credential이 없어요. 관리자에게 등록을 요청해 주세요.
        </p>
      ) : (
        <div className="flex flex-col gap-2" role="radiogroup" aria-label="DB Credential 선택">
          {/* 목록이 20~30개까지 가는 계약이라 검색이 있어야 이름이 비슷한 후보를 좁힐 수 있다. */}
          <input
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={`Credential 검색 (${options.length}개)`}
            aria-label="Credential 검색"
            className={cn(getInputClass(), 'mb-1')}
          />
          {shown.length === 0 && (
            <p className={cn('py-6 text-center text-[14px]', textColors.tertiary)}>
              검색 결과가 없어요.
            </p>
          )}
          {shown.map((secret) => {
            const checked = picked === secret.name;
            return (
              <label
                key={secret.name}
                className={cn(
                  'flex cursor-pointer items-center gap-2.5 rounded-xl border px-4 py-3 transition-colors',
                  checked
                    ? cn(primaryColors.border, primaryColors.bgLight)
                    : cn(borderColors.default, bgColors.mutedHover),
                )}
              >
                <input
                  type="radio"
                  name="db-credential"
                  value={secret.name}
                  checked={checked}
                  onChange={() => setPicked(secret.name)}
                  className="h-4 w-4 accent-[#0064FF]"
                />
                {/* Credential 이름은 표의 셀과 같은 mono — 같은 값이 두 화면에서 같게 읽힌다. */}
                <span
                  className={cn(
                    'font-mono text-[14px]',
                    textColors.primary,
                    checked ? 'font-semibold' : 'font-medium',
                  )}
                >
                  {secret.name}
                </span>
                {/* 생성 시각(계약이 주는 유일한 시각 — 수정 시각은 없다). 이름이 비슷한 후보를
                    가르는 값이지만 고르는 대상은 아니므로, 오른쪽 끝에서 한 단계 낮은 계층으로
                    읽힌다. */}
                {secret.createTimeStr && (
                  <span
                    className={cn(
                      'ml-auto shrink-0 text-[12px] font-normal',
                      numericFeatures.tabular,
                      textColors.tertiary,
                    )}
                  >
                    {formatDate(secret.createTimeStr, 'datetime')} 생성
                  </span>
                )}
              </label>
            );
          })}
        </div>
      )}
    </Modal>
  );
};
