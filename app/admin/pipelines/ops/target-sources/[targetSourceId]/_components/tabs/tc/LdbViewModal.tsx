'use client';

/**
 * 논리 DB 목록 (읽기 전용) — 검토 절반.
 *
 * 관리자 승인 탭의 검토 표에서 개수를 클릭하면 열린다. 승인 탭은 읽고 결정하는
 * 화면이라 쓰기 표면(제외 정책 편집·추가 폼·저장)은 들이지 않는다 — 고칠 게 보이면
 * 연결 테스트 탭의 논리 DB 관리(LogicalDbModalLoader)로 간다(푸터가 그 경로를 말한다).
 * 데이터는 그 모달과 같은 두 GET 이라 두 화면이 같은 목록을 읽는다.
 */
import { useEffect, useState, type ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { getDatabaseShortLabel } from '@/app/components/ui/DatabaseIcon';
import { ModalShell } from '@/app/admin/pipelines/_components/ModalShell';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { tqStyles } from '@/app/admin/pipelines/queue/_components/tqStyles';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';
import {
  getTestedLogicalDatabases,
  getExcludedLogicalDatabases,
  type ExcludedLogicalDatabase,
  type TestedLogicalDatabase,
} from '@/app/lib/api/logical-db';

const TITLE_ID = 'ops-ldb-view-title';

/**
 * 목록 패널의 옷. 편집 절반(LdbManageModal)이 5단계의 논리 DB 관리 모달로 대체되면서 이
 * 문법을 쓰는 화면은 여기 하나만 남았다 — 그래서 값도 여기 산다.
 */
const panel = {
  wrap: 'flex min-h-[280px] flex-col rounded-lg border border-[var(--pl-border)]',
  head: 'flex items-center justify-between gap-2 border-b border-[var(--pl-border)] px-3.5 py-2.5',
  title: 'text-[14px] font-semibold text-[var(--pl-text-strong)]',
  count: 'text-[12px] text-[var(--pl-text-weak)] tabular-nums',
  body: 'max-h-[260px] flex-1 overflow-y-auto px-3.5 py-1',
  row: 'flex items-center justify-between gap-2 border-b border-[var(--pl-gray-100)] py-2 last:border-b-0',
  name: 'text-[12px] text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)] break-all',
  placeholder: 'py-6 text-center text-[14px] text-[var(--pl-text-faint)]',
} as const;

/** Row identity = database[.schema] — 편집 모달과 같은 표기. */
const itemKey = (database: string, schema?: string): string =>
  schema ? `${database}.${schema}` : database;

/** 정착본 목록이 도착할 때까지 그 자리에 서는 줄 수 — 패널의 min-h 안에 드는 수다. */
const SKELETON_ROWS = 5;

/**
 * 대기 프레임 한 패널분. 패널의 제목·틀은 이 모달이 이미 아는 고정 문자열이라 실물로
 * 서 있고, 기다리는 건 목록과 그 개수뿐이다 — 그래서 그 둘만 바다
 * (`StatusCardSkeleton` 의 규칙). 두 패널이 같은 마크업을 두 번 내므로 여기 한 번만
 * 적는다: 다른 건 이름 뒤 표지의 높이뿐이다(연동 대상은 12px 맨 글자 14px, 제외는
 * `tag.base` 칩 22px).
 *
 * 높이는 실측이다(브라우저): 정착본 행이 두 패널 모두 **41px** 이고, `panel.row` 가
 * py-2(16) + 밑줄(1) 을 쓰므로 안쪽 줄 상자가 24px 이다 — 그래서 감싼 칸이 h-6 이고,
 * 바는 그 안에서 제 실물 높이로 선다. 다섯 줄은 머리 42 + 5×41 = 247 로 패널의
 * min-h-[280px] 안에 들어가는 수라, 목록이 도착해도 패널이 그 바닥에서 안 움직인다.
 */
function LdbSkeletonRows({ markClass }: { markClass: string }): ReactElement {
  return (
    <>
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <div key={index} className={panel.row} aria-hidden>
          <span className="flex h-6 min-w-0 items-center">
            <span className={cn(opsStyles.skeletonBar, 'block h-[14px] w-[172px]')} />
            <span className={cn(opsStyles.skeletonBar, 'ml-2 block', markClass)} />
          </span>
        </div>
      ))}
    </>
  );
}

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
        getTestedLogicalDatabases(targetSourceId, resourceId, 'latest'),
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
            {/* 빈 문자열이던 자리 — 개수는 지금 오는 값이라 다른 값들처럼 바로 선다. */}
            {loading ? (
              <span className={cn(opsStyles.skeletonBar, 'block h-[14px] w-[30px]')} aria-hidden />
            ) : (
              <span className={panel.count}>{`${tested.length}개`}</span>
            )}
          </div>
          <div className={panel.body} aria-busy={loading || undefined}>
            {loading ? (
              <>
                <span className="sr-only">불러오는 중</span>
                <LdbSkeletonRows markClass="h-[14px] w-[56px]" />
              </>
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
            {loading ? (
              <span className={cn(opsStyles.skeletonBar, 'block h-[14px] w-[30px]')} aria-hidden />
            ) : (
              <span className={panel.count}>{`${excluded.length}개`}</span>
            )}
          </div>
          <div className={panel.body} aria-busy={loading || undefined}>
            {loading ? (
              /* 제외 행의 표지는 `tag.base` 칩이다 — 실측 22px. */
              <LdbSkeletonRows markClass="h-[22px] w-[72px] rounded-md" />
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
