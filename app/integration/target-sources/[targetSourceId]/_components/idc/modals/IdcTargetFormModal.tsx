'use client';

import { useMemo, useRef, useState } from 'react';
import { Modal } from '@/app/components/ui/Modal';
import { CloseIcon, PlusIcon, StatusWarningIcon } from '@/app/components/ui/icons';
import {
  IDC_DB_TYPES,
  IDC_DOMAIN_MAXLEN,
  IDC_DOMAIN_RE,
  IDC_MAX_IPS,
  IDC_TRAILING_WS_RE,
  idcDbTypeByLabel,
  isValidIdcIp,
} from '@/lib/constants/idc';
import {
  bgColors,
  borderColors,
  cn,
  idcStyles,
  primaryColors,
  statusColors,
  textColors,
} from '@/lib/theme';
import type { IdcKind } from '@/app/lib/api/idc';

type IdcInputMode = 'ip' | 'domain';

/** Editable IP row with a stable client id so input focus survives add/remove. */
interface IpRow {
  id: number;
  value: string;
}

/** Prefill for edit mode (from an existing working-list row). */
export interface IdcTargetFormInitial {
  kind: IdcKind;
  hosts: string[];
  port: number;
  databaseTypeLabel: string;
  oracleSid?: string;
}

/**
 * Validated form output handed back to the parent to build/merge a row.
 * Domain-only: the DB type is the display label; the container derives the wire
 * enum at the boundary (ADR-017 §2) so no wire type leaks into this ⑧ file.
 */
export interface IdcTargetFormResult {
  kind: IdcKind;
  hosts: string[];
  port: number;
  databaseTypeLabel: string;
  oracleSid?: string;
}

interface IdcTargetFormModalProps {
  isOpen: boolean;
  /** Present → edit mode (title/CTA switch, prefill, no auto-port on open). */
  initial?: IdcTargetFormInitial;
  onSubmit: (result: IdcTargetFormResult) => void;
  onClose: () => void;
}

const modeFromKind = (kind: IdcKind): IdcInputMode => (kind === 'DOMAIN' ? 'domain' : 'ip');

const SectionLabel = ({ num, children }: { num: number; children: React.ReactNode }) => (
  <div className={cn('mb-2 flex items-center gap-2 text-[13px] font-semibold', textColors.secondary)}>
    <span
      className={cn(
        'inline-flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-bold',
        primaryColors.bgLight,
        primaryColors.text,
      )}
    >
      {num}
    </span>
    {children}
  </div>
);

const FieldError = ({ children }: { children: React.ReactNode }) => (
  <p className={idcStyles.fieldError}>{children}</p>
);

const FieldWarn = ({ children }: { children: React.ReactNode }) => (
  <p className={idcStyles.fieldWarn}>{children}</p>
);

/**
 * 연동 대상 추가/수정 — input mode (IP/Domain radio cards), multi-IP (≤6 with
 * warning), domain (≤100 + guidance), DB Type select, Oracle SID (conditional),
 * Port (auto-filled on DB Type change, except when prefilling an edit).
 * Inline errors only; 추가/저장 disabled until valid (v15 validateIdcTargetForm).
 */
export const IdcTargetFormModal = ({ isOpen, initial, onSubmit, onClose }: IdcTargetFormModalProps) => {
  // Initialised from `initial` on mount — the parent mounts this modal only
  // while open (and afresh per open), so these initializers run with the right
  // prefill instead of syncing props→state in an effect.
  const isEdit = initial !== undefined;
  const [mode, setMode] = useState<IdcInputMode>(initial ? modeFromKind(initial.kind) : 'ip');
  // Stable row ids: initial rows get index ids at mount; new rows draw from a
  // counter seeded past them. The counter only advances in event handlers
  // (addIp), never during render. The modal remounts per open, so ids reset.
  const [ips, setIps] = useState<IpRow[]>(() => {
    const initialValues =
      initial && initial.kind !== 'DOMAIN' ? (initial.hosts.length > 0 ? initial.hosts : ['']) : [''];
    return initialValues.map((value, i) => ({ id: i, value }));
  });
  const ipIdRef = useRef(ips.length);
  const nextIpId = () => ipIdRef.current++;
  const [domain, setDomain] = useState(initial && initial.kind === 'DOMAIN' ? (initial.hosts[0] ?? '') : '');
  const [dbTypeLabel, setDbTypeLabel] = useState(initial?.databaseTypeLabel ?? '');
  const [oracleSid, setOracleSid] = useState(initial?.oracleSid ?? '');
  const [sidTouched, setSidTouched] = useState(false);
  const [port, setPort] = useState(initial ? String(initial.port) : '');

  const dbDef = idcDbTypeByLabel(dbTypeLabel);
  const isOracle = dbDef?.requiresServiceId ?? false;

  // --- validation (v15 validateIdcTargetForm) ---
  const portNum = Number(port);
  const portOk = port !== '' && Number.isFinite(portNum) && portNum >= 1 && portNum <= 65535;

  const ipTrailingSpace = ips.some((ip) => IDC_TRAILING_WS_RE.test(ip.value));
  const filledIps = ips.map((s) => s.value.trim()).filter((s) => s !== '');
  const ipDup = new Set(filledIps).size !== filledIps.length;
  const ipsOk = !ipTrailingSpace && !ipDup && ips.length > 0 && ips.every((ip) => isValidIdcIp(ip.value));

  const domainTrailingSpace = IDC_TRAILING_WS_RE.test(domain);
  const domainTrimmed = domain.trim();
  const domainOk =
    !domainTrailingSpace && domainTrimmed.length <= IDC_DOMAIN_MAXLEN && IDC_DOMAIN_RE.test(domainTrimmed);

  const sidOk = !isOracle || oracleSid.trim() !== '';
  const valid = portOk && dbTypeLabel !== '' && sidOk && (mode === 'ip' ? ipsOk : domainOk);

  const showIpFormatErr = mode === 'ip' && ips.some((ip) => ip.value.trim() !== '' && !isValidIdcIp(ip.value));
  const showDomainErr = mode === 'domain' && domainTrimmed !== '' && !IDC_DOMAIN_RE.test(domainTrimmed);
  const showPortErr = port !== '' && !portOk;
  const showSidErr = isOracle && oracleSid.trim() === '' && sidTouched;
  const ipFull = ips.length >= IDC_MAX_IPS;

  const dbTypeOptions = useMemo(() => IDC_DB_TYPES.map((d) => d.label), []);

  const updateIp = (id: number, value: string) =>
    setIps((prev) => prev.map((ip) => (ip.id === id ? { ...ip, value } : ip)));
  const addIp = () => {
    if (ipFull) return;
    setIps((prev) => [...prev, { id: nextIpId(), value: '' }]);
  };
  const removeIp = (id: number) => setIps((prev) => prev.filter((ip) => ip.id !== id));

  const onDbTypeChange = (label: string) => {
    setDbTypeLabel(label);
    const def = idcDbTypeByLabel(label);
    // Auto-fill the default port on user selection (not on prefill open).
    if (def) setPort(String(def.defaultPort));
    if (!def?.requiresServiceId) setSidTouched(false);
  };

  const handleSubmit = () => {
    if (!valid) return;
    const kind: IdcKind =
      mode === 'domain' ? 'DOMAIN' : filledIps.length > 1 ? 'MULTIPLE_IP' : 'SINGLE';
    onSubmit({
      kind,
      hosts: mode === 'domain' ? [domainTrimmed] : ips.map((s) => s.value.trim()),
      port: portNum,
      databaseTypeLabel: dbTypeLabel,
      oracleSid: isOracle ? oracleSid.trim() : undefined,
    });
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={isEdit ? '연동 대상 수정' : '연동 대상 추가'}
      subtitle="PII 모니터링 모듈 연동이 필요한 IDC DB의 접속 정보를 입력해주세요."
      size="2xl"
      chrome="toss"
      footer={
        <>
          <button type="button" className={idcStyles.modalBtn.outline} onClick={onClose}>
            취소
          </button>
          <button type="button" className={idcStyles.modalBtn.primary} disabled={!valid} onClick={handleSubmit}>
            {isEdit ? '저장' : '추가'}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        {/* 1. 입력 방식 선택 */}
        <section>
          <SectionLabel num={1}>입력 방식 선택</SectionLabel>
          <div role="radiogroup" aria-label="입력 방식" className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'ip', title: 'IP', desc: '고정 IP로 DB에 접속 (권장)' },
                { value: 'domain', title: 'Domain', desc: 'DB IP가 유동적으로 변경되는 경우에만 권장' },
              ] as const
            ).map((opt) => {
              const selected = mode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setMode(opt.value)}
                  className={cn(
                    'flex flex-col items-start gap-0.5 rounded-lg border-2 px-3.5 py-3 text-left transition-colors',
                    selected
                      ? cn(statusColors.info.border, statusColors.info.bg, statusColors.info.textDark)
                      : cn(borderColors.default, bgColors.surface, textColors.secondary),
                  )}
                >
                  <span className="text-[14px] font-semibold leading-tight">{opt.title}</span>
                  <span
                    className={cn('text-[11.5px] leading-tight', selected ? textColors.tertiary : textColors.quaternary)}
                  >
                    {opt.desc}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="grid grid-cols-[1fr_220px] gap-5">
          {/* 2. 접속 정보 */}
          <section>
            <SectionLabel num={2}>접속 정보</SectionLabel>

            {mode === 'ip' ? (
              <div>
                <label className={cn('mb-1.5 block text-[12.5px] font-medium', textColors.secondary)}>IP 주소</label>
                <div className="space-y-2">
                  {ips.map((ip, index) => (
                    <div key={ip.id} className="flex items-center gap-2">
                      <input
                        value={ip.value}
                        placeholder="예: 10.20.30.40"
                        onChange={(e) => updateIp(ip.id, e.target.value)}
                        className={idcStyles.input}
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          aria-label="IP 삭제"
                          onClick={() => removeIp(ip.id)}
                          className={idcStyles.removeIp}
                        >
                          <CloseIcon className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addIp}
                  disabled={ipFull}
                  title={ipFull ? `IP는 최대 ${IDC_MAX_IPS}개까지 등록할 수 있어요` : undefined}
                  className={idcStyles.addIp}
                >
                  <PlusIcon className="h-3 w-3" />
                  IP 추가
                </button>

                {ips.length > 1 && (
                  <div className={cn(idcStyles.warnBanner, 'mt-2.5')}>
                    <StatusWarningIcon className="mt-px h-4 w-4 flex-shrink-0" />
                    <span>
                      여러 IP 등록은 멀티 노드 구성(예: Oracle RAC)에서만 권장돼요. 가능하면 <strong>단일 IP</strong>로
                      등록해주세요.
                    </span>
                  </div>
                )}
                {ipTrailingSpace && <FieldWarn>입력값 끝에 공백 문자가 포함되어 있어요. 공백을 제거해주세요.</FieldWarn>}
                {showIpFormatErr && <FieldError>올바른 IPv4 형식으로 입력해주세요 (예: 10.20.30.40)</FieldError>}
                {ipDup && <FieldError>중복된 IP가 있어요. 같은 IP는 한 번만 입력할 수 있어요</FieldError>}
              </div>
            ) : (
              <div>
                <label className={cn('mb-1.5 block text-[12.5px] font-medium', textColors.secondary)}>Domain</label>
                <input
                  value={domain}
                  maxLength={IDC_DOMAIN_MAXLEN}
                  placeholder="예: db.svc-a.io"
                  onChange={(e) => setDomain(e.target.value)}
                  className={idcStyles.input}
                />
                {domainTrailingSpace && (
                  <FieldWarn>입력값 끝에 공백 문자가 포함되어 있어요. 공백을 제거해주세요.</FieldWarn>
                )}
                {showDomainErr && <FieldError>올바른 도메인 형식으로 입력해주세요 (예: db.svc-a.io)</FieldError>}
                <div className={cn(idcStyles.warnBanner, 'mt-2.5')}>
                  <StatusWarningIcon className="mt-px h-4 w-4 flex-shrink-0" />
                  <span>
                    Web Server가 아닌 <strong>DB에 대한 주소</strong>를 입력해야 해요. DB에 Domain을 연결하는 것은{' '}
                    <strong>DB IP가 유동적으로 변경되는 경우에만</strong> 권장돼요.
                  </span>
                </div>
              </div>
            )}
          </section>

          {/* 3. DB Type */}
          <section>
            <SectionLabel num={3}>DB Type 선택</SectionLabel>
            <div className="space-y-3.5">
              <div>
                <select
                  value={dbTypeLabel}
                  onChange={(e) => onDbTypeChange(e.target.value)}
                  aria-label="Database Type"
                  className={idcStyles.input}
                >
                  <option value="">DB Type 선택…</option>
                  {dbTypeOptions.map((label) => (
                    <option key={label} value={label}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>

              {isOracle && (
                <div>
                  <label className={cn('mb-1.5 block text-[12.5px] font-medium', textColors.secondary)}>
                    Oracle SID <span className={statusColors.error.text}>*필수</span>
                  </label>
                  <input
                    value={oracleSid}
                    placeholder="예: ORCL"
                    onChange={(e) => {
                      setOracleSid(e.target.value);
                      setSidTouched(true);
                    }}
                    className={idcStyles.input}
                  />
                  {showSidErr && <FieldError>Oracle 선택 시 SID는 필수예요</FieldError>}
                </div>
              )}

              <div>
                <label className={cn('mb-1.5 block text-[12.5px] font-medium', textColors.secondary)}>Port</label>
                <input
                  type="number"
                  min={1}
                  max={65535}
                  value={port}
                  placeholder="예: 3306"
                  onChange={(e) => setPort(e.target.value)}
                  className={idcStyles.input}
                />
                {showPortErr && <FieldError>1–65535 범위의 포트를 입력해주세요</FieldError>}
              </div>
            </div>
          </section>
        </div>
      </div>
    </Modal>
  );
};
