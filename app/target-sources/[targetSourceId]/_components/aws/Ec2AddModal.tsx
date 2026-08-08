'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { ChevronDownIcon, CloseIcon, LockIcon, PlusIcon, SearchIcon } from '@/app/components/ui/icons';
import { EC2_SEARCH_LIMIT, searchEc2Instances, type Ec2Instance } from '@/app/lib/api/ec2';
import { VM_DATABASE_TYPES, vmDatabaseTypeByValue } from '@/lib/constants/vm-database';
import { cn, ec2Styles, idcStyles, primaryColors, statusColors } from '@/lib/theme';
import { SectionLabel } from '@/app/target-sources/[targetSourceId]/_components/idc/modals/IdcTargetFormModal';
import type { Ec2ConnectionConfig } from '@/app/target-sources/[targetSourceId]/_components/candidate/manual-ec2';

/** Idle time after the last keystroke before the search fires. */
const SEARCH_DEBOUNCE_MS = 500;

/** 검색어 길이 상한. */
const EC2_QUERY_MAXLEN = 50;

/** Oracle SID 길이 상한 — 실제 SID 는 훨씬 짧고, 이 값은 사고 방지용 상한이다. */
const ORACLE_SID_MAXLEN = 100;

type SearchStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SearchState {
  status: SearchStatus;
  results: Ec2Instance[];
  message?: string;
}

const IDLE: SearchState = { status: 'idle', results: [] };

/** 왜 안 보이는지 — 이 검색이 뒤지는 것은 최근 스캔 결과뿐이다. */
const NO_RESULT_HINT = '최근 스캔에서 발견된 인스턴스만 검색돼요';

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
    // 담는 일은 여기서 끝난다 — 추가하고 검색 화면으로 되돌아오면 방금 담은 결과가
    // 그대로 남아, 끝난 것인지 더 해야 하는 것인지 화면이 말해주지 못한다.
    onClose();
  };

  const onConfigStep = picked !== null;

  return (
    <Modal
      isOpen
      onClose={onClose}
      size="2xl"
      chrome="toss"
      // 닫는 길은 푸터 버튼(닫기·이전·취소)이 이미 갖고 있다 — 헤더 ✕ 는 같은 말을 두 번.
      closeButton={false}
      // 부제가 무엇을 하는 화면인지 한 줄로만 말하므로 제목에 붙여 둔다.
      subtitleGap="tight"
      // 결과가 5건으로 묶여 있어 본문이 푸터 아래로 흐르지 않는다 — 구분선이 표시할
      // 경계 자체가 없다.
      footerDivider={false}
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
      <div className={ec2Styles.stepFrame}>
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
            {/* 잠금이 주 정보, 이유는 보조 — 별도 배너 카드 없이 텍스트 위계로만 말한다. */}
            <p className={ec2Styles.lockNote}>
              <LockIcon className="h-3.5 w-3.5" aria-hidden="true" />
              수정 불가
            </p>
            <p className={ec2Styles.lockDesc}>
              Private IP는 스캔에서 확인된 값으로 직접 수정할 수 없어요. Load Balancer를 구성해
              접속하고 계시다면 담당자에게 연락 부탁드립니다.
            </p>
          </section>

          <section>
            <SectionLabel num={2}>Database Type</SectionLabel>
            <div className="relative">
              <select
                value={dbType}
                onChange={(event) => handleDbTypeChange(event.target.value)}
                aria-label="Database Type"
                className={cn(idcStyles.input, ec2Styles.selectField)}
              >
                <option value="">Database Type 선택…</option>
                {VM_DATABASE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className={ec2Styles.selectChevron} aria-hidden="true" />
            </div>

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
                  maxLength={ORACLE_SID_MAXLEN}
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
        // h-full + flex: 결과 영역이 남은 높이를 전부 가져가 안내 블록도 바닥까지 선다.
        <div className="flex h-full flex-col">
          <div className="relative">
            <SearchIcon className={ec2Styles.searchIcon} aria-hidden="true" />
            <input
              autoFocus
              value={query}
              aria-label="Instance ID 검색"
              // instance id 는 `i-` + 17 hex = 19자다. 50 은 그 위로 넉넉히 둔 상한 —
              // 붙여넣기 사고로 긴 문자열이 그대로 질의에 실려 나가는 것만 막는다.
              maxLength={EC2_QUERY_MAXLEN}
              placeholder="i-0a1b2c3d4e5f67890 형식의 Instance ID로 검색"
              onChange={(event) => handleQueryChange(event.target.value)}
              className={cn(ec2Styles.searchField, ec2Styles.searchPlaceholder)}
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
          <p className={ec2Styles.helper}>최대 {EC2_SEARCH_LIMIT}건 표시</p>

          <div className="mt-4 min-h-0 flex-1">
            <Ec2SearchResults
              query={query.trim()}
              search={search}
              addedInstanceIds={addedInstanceIds}
              onPick={pickInstance}
            />
          </div>
        </div>
      )}
      </div>
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
  // 입력 전과 0건은 화면에 같은 사실이다 — 보여줄 결과가 없다. 입력을 재촉하는
  // 문구는 방금 입력하고 0건을 받은 사람에게는 틀린 말이 되므로 한 문장으로 합친다.
  if (search.status === 'idle') {
    return (
      <StateBlock title="검색 결과가 없어요" description={NO_RESULT_HINT} />
    );
  }
  if (search.status === 'loading') {
    return (
      <div className={ec2Styles.stateBox} aria-busy="true" aria-live="polite">
        {/* 스캔 러닝 화면(ScanRunningState)과 같은 휠 — 같은 앱에서 "기다리는 중"은
            한 가지 모양이어야 한다. 트랙 + 아크, 같은 색의 투명도. */}
        <div className={cn('animate-spin motion-reduce:animate-none', primaryColors.text)}>
          <svg
            className="h-8 w-8"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.2}
            strokeLinecap="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" className="opacity-20" />
            <path d="M12 3a9 9 0 0 1 9 9" />
          </svg>
        </div>
        <p className={cn(ec2Styles.stateTitle, 'mt-3')}>검색하고 있어요</p>
      </div>
    );
  }
  if (search.status === 'error') {
    return (
      <StateBlock title="검색하지 못했어요" description={search.message ?? '잠시 후 다시 시도해주세요'} />
    );
  }
  if (search.results.length === 0) {
    return <StateBlock title="검색 결과가 없어요" description={NO_RESULT_HINT} />;
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
        {/* EC2 태그는 여기 없다 — 검색 결과는 전부 EC2라 다섯 줄에 같은 배지를 붙여도
            구분되는 것이 없고, 줄만 한 칸씩 늘어난다. 태그가 일하는 자리는 다른 리소스와
            섞이는 Step1 표다. */}
        <p className={cn(ec2Styles.resultId, 'truncate')}>
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
