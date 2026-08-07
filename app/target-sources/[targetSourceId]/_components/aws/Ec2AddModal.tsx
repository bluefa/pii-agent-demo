'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { LoadingSpinner } from '@/app/components/ui/LoadingSpinner';
import { CloseIcon, LockIcon, PlusIcon, SearchIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import { EC2_SEARCH_LIMIT, searchEc2Instances, type Ec2Instance } from '@/app/lib/api/ec2';
import { VM_DATABASE_TYPES, vmDatabaseTypeByValue } from '@/lib/constants/vm-database';
import { cn, ec2Styles, idcStyles, statusColors } from '@/lib/theme';
import { SectionLabel } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcTargetFormModal';
import type { Ec2ConnectionConfig } from '@/app/target-sources/[targetSourceId]/_components/candidate/manual-ec2';

/** Idle time after the last keystroke before the search fires. */
const SEARCH_DEBOUNCE_MS = 500;

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SearchState {
  status: SearchStatus;
  results: Ec2Instance[];
  message?: string;
}

const IDLE: SearchState = { status: 'idle', results: [] };

export interface Ec2AddModalProps {
  targetSourceId: number;
  /** Resource ids already on the Step-1 table (scanned or added) — those rows read 추가됨. */
  addedInstanceIds: ReadonlySet<string>;
  /** Present → edit mode: opens on the config step, no search behind it, CTA 저장. */
  editing?: { instance: Ec2Instance; config: Ec2ConnectionConfig };
  onAdd: (instance: Ec2Instance, config: Ec2ConnectionConfig) => void;
  onClose: () => void;
}

/**
 * EC2 인스턴스 추가 — 2단계 한 모달.
 *
 * ① Instance ID 앞부분으로 검색해 한 건을 고르고, ② 그 인스턴스의 접속 정보를 입력한다.
 * 추가 후에는 다시 ①로 돌아온다(질의·결과 유지) — 여러 대를 이어서 담는 흐름이라
 * 매번 모달을 다시 여는 것이 아니라 검색 화면이 기본 자리다.
 *
 * 접속 주소는 스캔이 확인한 Private IP 고정 — 사용자가 고치는 값이 아니다.
 */
export const Ec2AddModal = ({
  targetSourceId,
  addedInstanceIds,
  editing,
  onAdd,
  onClose,
}: Ec2AddModalProps) => {
  const [picked, setPicked] = useState<Ec2Instance | null>(editing?.instance ?? null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState<SearchState>(IDLE);

  // Connection info lives here, not in a child, because the CTA that submits it sits in
  // the modal footer — outside the step's own markup.
  const [dbType, setDbType] = useState(editing?.config.databaseType ?? '');
  const [port, setPort] = useState(editing ? String(editing.config.port) : '');
  const [oracleServiceId, setOracleServiceId] = useState(editing?.config.oracleServiceId ?? '');

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runSearch = useCallback(async (value: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const results = await searchEc2Instances(targetSourceId, value, {
        limit: EC2_SEARCH_LIMIT,
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setSearch({ status: 'ready', results });
    } catch (error) {
      if (controller.signal.aborted) return;
      setSearch({
        status: 'error',
        results: [],
        message: error instanceof Error ? error.message : '검색에 실패했어요.',
      });
    }
  }, [targetSourceId]);

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!value.trim()) {
      // Nothing to search for — drop the in-flight request so a late answer to the
      // previous query cannot repaint the emptied field's results.
      abortRef.current?.abort();
      setSearch(IDLE);
      return;
    }
    setSearch((previous) => ({ ...previous, status: 'loading' }));
    debounceRef.current = setTimeout(() => void runSearch(value.trim()), SEARCH_DEBOUNCE_MS);
  }, [runSearch]);

  const clearQuery = useCallback(() => handleQueryChange(''), [handleQueryChange]);

  // Aborting here is safe (unlike the service rail): nothing fetches on mount, so
  // StrictMode's cleanup-between-setups has no in-flight request to kill.
  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    abortRef.current?.abort();
  }, []);

  const dbTypeDef = vmDatabaseTypeByValue(dbType);
  const needsServiceId = dbTypeDef?.requiresServiceId ?? false;
  const portNum = Number(port);
  const portOk = port !== '' && Number.isInteger(portNum) && portNum >= 1 && portNum <= 65535;
  const configValid = dbType !== '' && portOk && (!needsServiceId || oracleServiceId.trim() !== '');

  const pickInstance = (instance: Ec2Instance) => {
    setPicked(instance);
    setDbType('');
    setPort('');
    setOracleServiceId('');
  };

  const handleDbTypeChange = (value: string) => {
    setDbType(value);
    // Default port follows the engine; engines with no fixed listener (DynamoDB·Athena)
    // clear the field so the user states the port instead of inheriting the last one.
    const def = vmDatabaseTypeByValue(value);
    setPort(def?.defaultPort === undefined ? '' : String(def.defaultPort));
    if (!def?.requiresServiceId) setOracleServiceId('');
  };

  const handleSubmitConfig = () => {
    if (!picked || !configValid) return;
    onAdd(picked, {
      databaseType: dbType,
      port: portNum,
      ...(needsServiceId ? { oracleServiceId: oracleServiceId.trim() } : {}),
    });
    if (editing) {
      onClose();
      return;
    }
    // Continuous adding: back to the search step with the query and results still up.
    setPicked(null);
  };

  const onConfigStep = picked !== null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      chrome="toss"
      title={
        onConfigStep ? (editing ? '접속 정보 수정' : '접속 정보 설정') : 'EC2 인스턴스 추가'
      }
      subtitle={
        onConfigStep && picked
          ? `${picked.instanceId} · 데이터베이스 접속 정보를 입력해주세요.`
          : '스캔에서 발견된 EC2 인스턴스를 Instance ID로 검색해 연동 대상으로 추가해주세요.'
      }
      footer={
        onConfigStep ? (
          <>
            {/* Edit mode has no search behind it, so there is nothing to go back to. */}
            <button
              type="button"
              className={idcStyles.modalBtn.outline}
              onClick={editing ? onClose : () => setPicked(null)}
            >
              {editing ? '취소' : '이전'}
            </button>
            <button
              type="button"
              className={idcStyles.modalBtn.primary}
              disabled={!configValid}
              onClick={handleSubmitConfig}
            >
              {editing ? '저장' : '추가 완료'}
            </button>
          </>
        ) : (
          <button type="button" className={idcStyles.modalBtn.outline} onClick={onClose}>
            닫기
          </button>
        )
      }
    >
      {onConfigStep && picked ? (
        <div className="space-y-5">
          <section>
            <SectionLabel num={1}>접속 주소</SectionLabel>
            <input
              readOnly
              value={picked.privateIpAddress}
              aria-label="접속 주소 (Private IP)"
              className={cn(idcStyles.input, ec2Styles.lockedInput)}
            />
            <span className={ec2Styles.lockNote}>
              <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
              수정 불가
            </span>
            <div className={cn(idcStyles.warnBanner, 'mt-2.5')}>
              <StatusWarningIcon className="mt-px h-4 w-4 flex-shrink-0" />
              <span>
                Private IP는 스캔에서 확인된 값으로 직접 수정할 수 없어요. Load Balancer를 구성해
                접속하고 계시다면 담당자에게 연락 부탁드립니다.
              </span>
            </div>
          </section>

          <section>
            <SectionLabel num={2}>Database Type</SectionLabel>
            <select
              value={dbType}
              onChange={(event) => handleDbTypeChange(event.target.value)}
              aria-label="Database Type"
              className={idcStyles.input}
            >
              <option value="">Database Type 선택…</option>
              {VM_DATABASE_TYPES.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>

            {/* The SID sits under the select that summoned it, inside the same section —
                a field that appears elsewhere on the form reads as unrelated to its cause. */}
            {needsServiceId && (
              <div className="mt-3">
                <label htmlFor="ec2-oracle-sid" className={ec2Styles.fieldLabel}>
                  Oracle SID <span className={statusColors.error.text}>*필수</span>
                </label>
                <input
                  id="ec2-oracle-sid"
                  value={oracleServiceId}
                  placeholder="예: ORCL"
                  onChange={(event) => setOracleServiceId(event.target.value)}
                  className={cn(idcStyles.input, ec2Styles.revealedField)}
                />
              </div>
            )}
          </section>

          <section>
            <SectionLabel num={3}>Port</SectionLabel>
            <input
              type="number"
              min={1}
              max={65535}
              value={port}
              placeholder="예: 3306"
              aria-label="Port"
              onChange={(event) => setPort(event.target.value)}
              className={idcStyles.input}
            />
            {port !== '' && !portOk && (
              <p className={idcStyles.fieldError}>1–65535 범위의 포트를 입력해주세요</p>
            )}
          </section>
        </div>
      ) : (
        <div>
          <div className="relative">
            <SearchIcon className={ec2Styles.searchIcon} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              aria-label="Instance ID 검색"
              onChange={(event) => handleQueryChange(event.target.value)}
              className={cn(idcStyles.input, ec2Styles.searchInput)}
            />
            {query !== '' && (
              <button
                type="button"
                aria-label="검색어 지우기"
                onClick={clearQuery}
                className={ec2Styles.searchClear}
              >
                <CloseIcon className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <p className={ec2Styles.helper}>
            <span className={ec2Styles.helperCode}>i-0a1b2c3d4e5f67890</span> 형식의 Instance ID로
            검색해요 · 입력을 멈추면 0.5초 후 자동 검색 · 최대 {EC2_SEARCH_LIMIT}건 표시
          </p>

          <div className="mt-4">
            <Ec2SearchResults
              query={query.trim()}
              search={search}
              addedInstanceIds={addedInstanceIds}
              onPick={pickInstance}
            />
          </div>
        </div>
      )}
    </Modal>
  );
};

const StateBlock = ({ title, description }: { title: string; description: string }) => (
  <div className={ec2Styles.stateBox}>
    <p className={ec2Styles.stateTitle}>{title}</p>
    <p className={ec2Styles.stateDesc}>{description}</p>
  </div>
);

const Ec2SearchResults = ({
  query,
  search,
  addedInstanceIds,
  onPick,
}: {
  query: string;
  search: SearchState;
  addedInstanceIds: ReadonlySet<string>;
  onPick: (instance: Ec2Instance) => void;
}) => {
  if (search.status === 'idle') {
    return (
      <StateBlock
        title="Instance ID를 입력해주세요"
        description="i- 로 시작하는 ID의 앞부분만 입력해도 검색돼요"
      />
    );
  }
  if (search.status === 'loading') {
    return (
      <div className={ec2Styles.stateBox} aria-busy="true" aria-live="polite">
        <LoadingSpinner />
        <p className={ec2Styles.stateTitle}>검색하고 있어요</p>
      </div>
    );
  }
  if (search.status === 'error') {
    return (
      <StateBlock title="검색하지 못했어요" description={search.message ?? '잠시 후 다시 시도해주세요'} />
    );
  }
  if (search.results.length === 0) {
    return (
      <StateBlock
        title="검색 결과가 없어요"
        description="최근 스캔에서 발견된 인스턴스만 검색됩니다"
      />
    );
  }

  return (
    <ul className="space-y-2">
      {search.results.map((instance) => (
        <li key={instance.instanceId}>
          <Ec2ResultRow
            instance={instance}
            query={query}
            added={addedInstanceIds.has(instance.instanceId)}
            onPick={() => onPick(instance)}
          />
        </li>
      ))}
    </ul>
  );
};

const Ec2ResultRow = ({
  instance,
  query,
  added,
  onPick,
}: {
  instance: Ec2Instance;
  query: string;
  added: boolean;
  onPick: () => void;
}) => {
  // The matched head is highlighted so the user can see how far their input carried.
  // Length, not indexOf: the endpoint matches on a prefix, and a case-insensitive one.
  const matchLength = instance.instanceId.toLowerCase().startsWith(query.toLowerCase())
    ? query.length
    : 0;

  return (
    <div className={ec2Styles.resultRow}>
      <div className="min-w-0">
        <span className={cn(idcStyles.kindBadge.base, idcStyles.kindBadge.ec2)}>EC2</span>
        <p className={cn(ec2Styles.resultId, 'mt-1 truncate')}>
          {matchLength > 0 && (
            <span className={ec2Styles.resultMatch}>{instance.instanceId.slice(0, matchLength)}</span>
          )}
          {instance.instanceId.slice(matchLength)}
        </p>
        <p className={cn(ec2Styles.resultSub, 'truncate')}>
          Private IP {instance.privateIpAddress || '—'}
          {instance.privateDnsName ? ` · ${instance.privateDnsName}` : ''}
        </p>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {instance.scanVersion !== null && (
          <span className={cn(idcStyles.tag.base, idcStyles.tag.gray)}>
            scan v{instance.scanVersion}
          </span>
        )}
        {added ? (
          <span className={ec2Styles.addedBtn}>✓ 추가됨</span>
        ) : (
          <button type="button" onClick={onPick} className={idcStyles.triggerBtn.ghostSm}>
            <PlusIcon className="h-3 w-3" />
            추가
          </button>
        )}
      </div>
    </div>
  );
};
