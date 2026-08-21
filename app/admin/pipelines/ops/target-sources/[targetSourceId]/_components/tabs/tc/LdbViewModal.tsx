'use client';

/**
 * 논리 DB 목록 (읽기 전용) — LdbManageModal 의 검토 절반.
 *
 * 관리자 승인 탭의 검토 표에서 개수를 클릭하면 열린다. 승인 탭은 읽고 결정하는
 * 화면이라 쓰기 표면(제외 정책 편집·추가 폼·저장)은 들이지 않는다 — 고칠 게 보이면
 * 연결 테스트 탭의 논리 DB 관리로 간다(푸터가 그 경로를 말한다). 데이터는 편집
 * 모달과 같은 두 GET 이라 두 화면이 같은 목록을 읽는다.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { ldbPanel as panel } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/tabs/tc/LdbManageModal';
import {
  getTestedLogicalDatabases,
  getExcludedLogicalDatabases,
  type ExcludedLogicalDatabase,
  type TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';

const TITLE_ID = 'ops-ldb-view-title';

/** Row identity = database[.schema] — 편집 모달과 같은 표기. */
const itemKey = (database: string, schema?: string): string =>
  schema ? `${database}.${schema}` : database;

export interface LdbViewModalProps {
  targetSourceId: number;
  resourceId: string;
  /** Header meta — 연동 대상 label (host/uri) and the DB type tag. */
  resourceLabel: string;
  databaseType: string | null;
  onClose: () => void;
}

export function LdbViewModal({
  targetSourceId,
  resourceId,
  resourceLabel,
  databaseType,
  onClose,
}: LdbViewModalProps): ReactElement {
  const [tested, setTested] = useState<TestedLogicalDatabase[]>([]);
  const [testedFailed, setTestedFailed] = useState(false);
  const [excluded, setExcluded] = useState<ExcludedLogicalDatabase[]>([]);
  const [excludedFailed, setExcludedFailed] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== resourceId;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [testedList, excludedList] = await Promise.allSettled([
        getTestedLogicalDatabases(targetSourceId, resourceId),
        getExcludedLogicalDatabases(targetSourceId, resourceId),
      ]);
      if (cancelled) return;
      setTested(testedList.status === 'fulfilled' ? testedList.value : []);
      setTestedFailed(testedList.status === 'rejected');
      setExcluded(excludedList.status === 'fulfilled' ? excludedList.value : []);
      setExcludedFailed(excludedList.status === 'rejected');
      setLoadedKey(resourceId);
    })();
    return () => {
      cancelled = true;
    };
  }, [targetSourceId, resourceId]);

  return (
    <ModalShell open onClose={onClose} variant="wide" labelledBy={TITLE_ID}>
      <h3 id={TITLE_ID} className={pipelineStyles.modal.title}>
        논리 DB 목록
      </h3>
      <div className="mb-2 flex items-center gap-2">
        {databaseType && (
          <span className={cn(tqStyles.tag.base, tqStyles.tag.blue)}>
            {getDatabaseShortLabel(databaseType)}
          </span>
        )}
        <span className={tqStyles.appTable.tdMono}>{resourceLabel}</span>
      </div>
      <p className={pipelineStyles.modal.desc}>
        최근 성공한 연결 테스트가 확인한 목록입니다. 제외 대상은 관리자가 설정한 정책이라, 이번
        테스트에서 발견되지 않은 이름이 포함될 수 있습니다.
      </p>

      <div className="grid grid-cols-2 gap-4">
        <div className={panel.wrap}>
          <div className={panel.head}>
            <span className={panel.title}>연동 대상 논리 DB</span>
            <span className={panel.count}>{loading ? '' : `${tested.length}개`}</span>
          </div>
          <div className={panel.body}>
            {loading ? (
              <p className={panel.placeholder} aria-busy>
                불러오는 중…
              </p>
            ) : testedFailed ? (
              <p className={panel.placeholder}>연동 대상 목록을 불러오지 못했습니다.</p>
            ) : tested.length === 0 ? (
              <p className={panel.placeholder}>조회된 논리 DB가 없습니다.</p>
            ) : (
              tested.map((item, index) => {
                const key = itemKey(item.databaseName ?? '', item.schemaName);
                return (
                  <div key={`${key}-${index}`} className={panel.row}>
                    <span className="min-w-0">
                      <span className={panel.name}>{key || '—'}</span>
                      <span className="ml-2 text-[12px] text-[var(--pl-text-weak)]">
                        {item.type ?? (item.schemaName ? 'SCHEMA' : 'DATABASE')}
                      </span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className={panel.wrap}>
          <div className={panel.head}>
            <span className={panel.title}>연동 제외 논리 DB</span>
            <span className={panel.count}>{loading ? '' : `${excluded.length}개`}</span>
          </div>
          <div className={panel.body}>
            {loading ? (
              <p className={panel.placeholder} aria-busy>
                불러오는 중…
              </p>
            ) : excludedFailed ? (
              <p className={panel.placeholder}>제외 목록을 불러오지 못했습니다.</p>
            ) : excluded.length === 0 ? (
              <p className={panel.placeholder}>제외된 논리 DB가 없습니다.</p>
            ) : (
              excluded.map((item) => {
                const key = itemKey(item.databaseName, item.schemaName);
                return (
                  <div key={key} className={panel.row}>
                    <span className="min-w-0">
                      <span className={panel.name}>{key}</span>
                      <span className={cn(tqStyles.tag.base, tqStyles.tag.gray, 'ml-2')}>
                        {item.skipReason}
                      </span>
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className={pipelineStyles.modal.foot}>
        {/* 읽기와 쓰기의 경계 — 수정 경로는 문장이 말하고, 이 모달은 열지 않는다. */}
        <span className={cn(pipelineStyles.text.meta, 'mr-auto self-center')}>
          제외 정책 수정은 연결 테스트 탭의 논리 DB 관리에서 합니다.
        </span>
        <PlButton variant="secondary" onClick={onClose}>
          닫기
        </PlButton>
      </div>
    </ModalShell>
  );
}
