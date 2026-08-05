'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { useToast } from '@/app/components/ui/toast';
import { updateResourceCredential } from '@/app/lib/api';
import {
  bgColors,
  borderColors,
  cn,
  getButtonClass,
  idcStyles,
  statusColors,
  textColors,
} from '@/lib/theme';
import {
  IdcCredSelectCell,
  IdcDbTypeCell,
  IdcEndpointCell,
} from '@/app/target-sources/[targetSourceId]/_components/idc/cells';
import type { IdcResourceView } from '@/app/lib/api/idc';

/** 모달 표의 Credential 조회 필터. IDC 는 모든 행이 자격 증명을 요구한다. */
type CredFilter = 'all' | 'assigned' | 'missing';

interface IdcCredentialModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Live integration targets — every one needs a credential before Run Test. */
  resources: readonly IdcResourceView[];
  /** Target-source secrets from `GET .../secrets` (names), not a hardcoded list. */
  credOptions: readonly string[];
  targetSourceId: number;
  /** Called after every changed credential is persisted, with the full picks. */
  onComplete: (credentials: Record<string, string>) => void;
}

/**
 * IDC Step 5 DB Credential picker. The selects used to live in the resource table; the
 * table now carries the Step-5 logical-DB result instead, so the credential decision
 * moved into its own modal — the same shape the cloud connection test uses
 * (CredentialSetupModal), but over IDC rows so a target reads as its host, not its
 * opaque resource id.
 *
 * Writes happen here (PUT per changed row) and the step is told the result, so a
 * half-saved set can never reach Run Test.
 */
export const IdcCredentialModal = ({
  isOpen,
  onClose,
  resources,
  credOptions,
  targetSourceId,
  onComplete,
}: IdcCredentialModalProps) => {
  const toast = useToast();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [filter, setFilter] = useState<CredFilter>('all');

  // Seed from what is already stored on each row. `resources` is memoized by the step, so
  // this does not stamp over the user's picks on an unrelated re-render.
  useEffect(() => {
    if (!isOpen) return;
    setSelections(Object.fromEntries(resources.map((r) => [r.resourceId, r.credentialId ?? ''])));
    setFilter('all');
  }, [isOpen, resources]);

  const selectedCount = resources.filter((r) => !!selections[r.resourceId]).length;
  const allSelected = resources.length > 0 && selectedCount === resources.length;

  // IDC 는 모든 연동 대상이 자격 증명을 요구한다(클라우드의 "불필요" 엔진이 없다) —
  // 그래서 미등록은 곧 "아직 고르지 않은 행"이다.
  const missingCount = resources.length - selectedCount;
  const rows =
    filter === 'all'
      ? resources
      : resources.filter((r) => !!selections[r.resourceId] === (filter === 'assigned'));

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only the rows whose credential actually changed — re-PUTting an unchanged pick
      // would be a write with nothing to write.
      const changed = resources.filter(
        (r) => selections[r.resourceId] && selections[r.resourceId] !== r.credentialId,
      );
      for (const resource of changed) {
        await updateResourceCredential(targetSourceId, resource.resourceId, selections[resource.resourceId]);
      }
      onComplete(selections);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Credential 설정에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="DB Credential 설정"
      subtitle="연결 테스트를 실행하려면 모든 연동 대상에 자격 증명이 설정되어 있어야 해요."
      // 2xl, not lg: four columns plus a 190px select overflow the lg frame and clip the
      // select's chevron at the right edge.
      size="2xl"
      // 클라우드의 Credential 모달과 같은 chrome — 두 화면이 같은 결정을 다루는데 한쪽만
      // 16px 제목에 헤더 ✕ 를 달고 있었다. 닫는 길은 푸터의 취소(그리고 ESC / 배경)뿐이다.
      chrome="toss"
      closeButton={false}
      footer={
        <>
          <button onClick={onClose} className={getButtonClass('secondary')}>
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={!allSelected || saving}
            className={cn(getButtonClass('primary'), 'flex items-center gap-2')}
          >
            {saving && <LoadingSpinner />}
            설정 완료 후 테스트 실행
          </button>
        </>
      }
    >
      <div
        className={cn(
          'mb-4 flex items-center gap-2 rounded-lg px-3 py-2 text-sm',
          'border',
          allSelected
            ? cn(statusColors.success.bg, statusColors.success.border)
            : cn(borderColors.default, bgColors.muted),
        )}
      >
        <span
          className={cn(
            'h-2 w-2 rounded-full',
            allSelected ? statusColors.success.dot : statusColors.pending.dot,
          )}
        />
        {/* 건수와 도달 수단을 이 한 줄이 함께 진다 — 필터 카드 세 장은 0건(=정상)일 때도
            같은 말을 하려고 자리를 차지했고, 미선택 건수는 이미 이 배너가 말하고 있었다. */}
        <span className={allSelected ? statusColors.success.text : textColors.tertiary}>
          {allSelected
            ? 'DB Credential 선택 완료되었습니다'
            : `DB Credential 미선택 ${missingCount}건이 남았어요`}
        </span>
        {!allSelected && (
          <button
            type="button"
            onClick={() => setFilter(filter === 'missing' ? 'all' : 'missing')}
            className={cn('ml-auto shrink-0 font-semibold underline underline-offset-2', textColors.secondary)}
          >
            {filter === 'missing' ? '전체 보기' : '미선택만 보기'}
          </button>
        )}
      </div>

      {/* 목록만 스크롤한다 — 대상이 5개든 30개든 모달은 같은 크기로 열리고, 헤더는 sticky 라
          열 이름이 스크롤 뒤로 사라지지 않는다. */}
      <div className={cn(idcStyles.table.frame, 'max-h-[280px] overflow-y-auto')}>
        <table className="w-full">
          <thead className={cn(idcStyles.table.header, 'sticky top-0 z-10')}>
            <tr>
              <th className={idcStyles.table.headerCell}>접속 주소</th>
              <th className={cn(idcStyles.table.headerCell, 'w-[72px]')}>Port</th>
              <th className={cn(idcStyles.table.headerCell, 'w-[150px]')}>Database Type</th>
              <th className={cn(idcStyles.table.headerCell, 'w-[190px]')}>DB Credential</th>
            </tr>
          </thead>
          <tbody className={idcStyles.table.body}>
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={4}
                  className={cn(idcStyles.table.cell, 'py-8 text-center text-[12px]', textColors.tertiary)}
                >
                  조건에 맞는 결과가 없어요.
                </td>
              </tr>
            )}
            {rows.map((resource) => (
              <tr key={resource.resourceId} className={idcStyles.table.row}>
                <td className={idcStyles.table.cell}>
                  <IdcEndpointCell resource={resource} />
                </td>
                <td className={cn(idcStyles.table.cell, 'font-mono text-[12px]', textColors.secondary)}>
                  {resource.port || <span className={textColors.tertiary}>—</span>}
                </td>
                <td className={idcStyles.table.cell}>
                  <IdcDbTypeCell resource={resource} />
                </td>
                <td className={idcStyles.table.cell}>
                  <IdcCredSelectCell
                    value={selections[resource.resourceId] ?? ''}
                    onChange={(cred) =>
                      setSelections((prev) => ({ ...prev, [resource.resourceId]: cred }))
                    }
                    options={[...credOptions]}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Modal>
  );
};
