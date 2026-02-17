'use client';

import { useState } from 'react';
import { cn, statusColors, primaryColors, textColors, bgColors, borderColors, buttonStyles } from '@/lib/theme';
import { Badge } from '@/app/components/ui/Badge';
import { VM_DATABASE_TYPES, DEFAULT_PORTS, validatePort as validatePortValue } from '@/lib/constants/vm-database';
import type { VmDatabaseType, VmDatabaseConfig } from '@/lib/types';
import type { AzureVmNic } from '@/lib/types/azure';

interface VmDatabaseConfigPanelProps {
  resourceId: string;
  initialConfig?: VmDatabaseConfig;
  nics?: AzureVmNic[];
  onSave: (resourceId: string, config: VmDatabaseConfig) => void;
  onCancel: () => void;
}

export const VmDatabaseConfigPanel = ({
  resourceId,
  initialConfig,
  nics,
  onSave,
  onCancel,
}: VmDatabaseConfigPanelProps) => {
  const nicList = nics ?? [];
  const hasNics = nicList.length > 0;

  const getInitialNicId = (): string | undefined => {
    if (!hasNics) return undefined;
    if (initialConfig?.selectedNicId && nicList.some(n => n.nicId === initialConfig.selectedNicId)) {
      return initialConfig.selectedNicId;
    }
    return nicList[0].nicId;
  };

  const getInitialHost = (): string => {
    if (initialConfig?.host) return initialConfig.host;
    if (hasNics) {
      const initialNicId = getInitialNicId();
      const nic = nicList.find(n => n.nicId === initialNicId);
      return nic?.privateIp ?? '';
    }
    return '';
  };

  // initialConfig가 있으면 그 값 유지, 없으면 null (미설정 상태)
  const [databaseType, setDatabaseType] = useState<VmDatabaseType | null>(
    initialConfig?.databaseType ?? null
  );
  const [port, setPort] = useState<string>(
    initialConfig?.port?.toString() ?? ''
  );
  const [host, setHost] = useState<string>(getInitialHost);
  const [oracleServiceId, setOracleServiceId] = useState<string>(
    initialConfig?.oracleServiceId ?? ''
  );
  const [selectedNicId, setSelectedNicId] = useState<string | undefined>(getInitialNicId);
  const [portError, setPortError] = useState<string | null>(null);

  const handleDatabaseTypeChange = (newType: VmDatabaseType) => {
    const prevType = databaseType;
    setDatabaseType(newType);

    // 타입이 변경되면 기본 포트 설정 (기존 설정이 없거나 이전 기본 포트였던 경우)
    const prevDefaultPort = prevType ? DEFAULT_PORTS[prevType].toString() : '';
    if (!port || port === prevDefaultPort) {
      setPort(DEFAULT_PORTS[newType].toString());
    }
  };

  const validatePort = (value: string): boolean => {
    const error = validatePortValue(value);
    setPortError(error);
    return error === null;
  };

  const handlePortChange = (value: string) => {
    setPort(value);
    if (value) validatePort(value);
  };

  const handleNicChange = (nicId: string) => {
    setSelectedNicId(nicId);
    const nic = nics?.find(n => n.nicId === nicId);
    if (nic) setHost(nic.privateIp);
  };

  const handleSave = () => {
    if (!databaseType || !validatePort(port)) return;

    const config: VmDatabaseConfig = {
      databaseType,
      port: parseInt(port, 10),
      ...(host ? { host } : {}),
      ...(databaseType === 'ORACLE' && oracleServiceId ? { oracleServiceId } : {}),
      ...(selectedNicId ? { selectedNicId } : {}),
    };

    onSave(resourceId, config);
  };

  const isOracleSelected = databaseType === 'ORACLE';
  const isNotConfigured = !databaseType;
  const isValid = databaseType && !portError && port !== '' && host.trim() !== '' && (!isOracleSelected || oracleServiceId !== '');

  return (
    <tr>
      <td colSpan={7} className="px-0 py-0">
        <div className="mx-6 my-3">
          {/* 미설정 경고 */}
          {isNotConfigured && (
            <div className="mb-3 flex items-center gap-2 px-4 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
              <svg className="w-5 h-5 text-amber-500 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-amber-800">
                VM 데이터베이스 설정이 필요합니다
              </span>
            </div>
          )}

          {/* 설정 카드 */}
          {/* TODO: to-blue-50 gradient -- no gradient token in theme.ts */}
          <div className="bg-gradient-to-r from-slate-50 to-blue-50 border border-slate-200 rounded-xl shadow-sm overflow-hidden">
            {/* 헤더 */}
            <div className="px-5 py-3 bg-white/60 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center', statusColors.info.bg)}>
                  <svg className={cn('w-4 h-4', primaryColors.text)} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                  </svg>
                </div>
                <span className={cn('text-sm font-semibold', textColors.primary)}>
                  {hasNics ? '네트워크 및 데이터베이스 설정' : '데이터베이스 연결 설정'}
                </span>
              </div>
            </div>

            {/* 본문 */}
            <div className="p-5">
              {/* NIC 선택 영역 */}
              {hasNics && (
                <div className="mb-4">
                  <label className={cn('block text-xs font-semibold uppercase tracking-wide mb-2', textColors.tertiary)}>
                    Network Interface 선택
                  </label>
                  <div className={cn('border rounded-lg overflow-hidden divide-y', statusColors.pending.border, borderColors.default.replace('border-', 'divide-'))}>
                    {nicList.map((nic, idx) => (
                      <label
                        key={nic.nicId}
                        className={cn(
                          'flex items-center gap-3 px-4 py-2.5 cursor-pointer transition-colors',
                          selectedNicId === nic.nicId ? statusColors.info.bg : `hover:${bgColors.muted}`
                        )}
                      >
                        <input
                          type="radio"
                          name={`nic-${resourceId}`}
                          value={nic.nicId}
                          checked={selectedNicId === nic.nicId}
                          onChange={() => handleNicChange(nic.nicId)}
                          className="w-4 h-4"
                        />
                        <span className={cn('font-mono text-sm', textColors.primary)}>{nic.name}</span>
                        <span className={cn('text-sm', textColors.tertiary)}>{nic.privateIp}</span>
                        {nicList.length > 1 && idx === 0 && (
                          <Badge variant="info" size="sm">추천</Badge>
                        )}
                      </label>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-start gap-4">
                {/* Database Type - Dropdown */}
                <div className="w-44">
                  <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                    데이터베이스 타입 <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={databaseType ?? ''}
                    onChange={(e) => e.target.value && handleDatabaseTypeChange(e.target.value as VmDatabaseType)}
                    // TODO: focus:border-[#0064FF] — no focus:border token in theme.ts
                    className={`w-full px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all focus:outline-none focus:ring-0 ${
                      databaseType
                        ? 'border-slate-200 bg-white text-slate-900 focus:border-[#0064FF]'
                        : 'border-amber-300 bg-amber-50 text-slate-900 focus:border-amber-500'
                    }`}
                  >
                    <option value="">선택하세요</option>
                    {VM_DATABASE_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>

                {/* Host, Port & Oracle SID */}
                <div className="flex gap-4">
                  {/* Host (EC2 전용: Private DNS Name) */}
                  <div className="w-52">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      Host <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={host}
                      onChange={(e) => setHost(e.target.value)}
                      disabled={!databaseType}
                      // TODO: focus:border-[#0064FF] — no focus:border token in theme.ts
                      className={`w-full px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all focus:outline-none focus:ring-0 disabled:bg-slate-100 disabled:text-slate-400 ${
                        databaseType && !host.trim()
                          ? 'border-amber-300 bg-amber-50 text-slate-900 focus:border-amber-500'
                          : 'border-slate-200 bg-white text-slate-900 focus:border-[#0064FF]'
                      }`}
                      placeholder={hasNics ? 'NIC에서 자동 설정됨' : 'ip-10-0-1-100.ec2.internal'}
                    />
                    <p className="mt-1 text-xs text-slate-400">{hasNics ? '선택한 NIC의 Private IP' : 'Private DNS Name 또는 IP'}</p>
                  </div>

                  {/* Port */}
                  <div className="w-28">
                    <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                      포트
                    </label>
                    <div className="relative">
                      <input
                        type="number"
                        min={1}
                        max={65535}
                        value={port}
                        onChange={(e) => handlePortChange(e.target.value)}
                        disabled={!databaseType}
                        // TODO: focus:border-[#0064FF] — no focus:border token in theme.ts
                        className={`w-full px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all focus:outline-none focus:ring-0 disabled:bg-slate-100 disabled:text-slate-400 ${
                          portError
                            ? 'border-red-300 bg-red-50 text-red-900 focus:border-red-500'
                            : 'border-slate-200 bg-white text-slate-900 focus:border-[#0064FF]'
                        }`}
                        placeholder="포트"
                      />
                      {portError && (
                        <p className="absolute -bottom-5 left-0 text-xs font-medium text-red-600">{portError}</p>
                      )}
                    </div>
                  </div>

                  {/* Oracle Service ID */}
                  {isOracleSelected && (
                    <div className="w-36">
                      <label className="block text-xs font-semibold text-slate-600 uppercase tracking-wide mb-2">
                        Service ID
                      </label>
                      <input
                        type="text"
                        value={oracleServiceId}
                        onChange={(e) => setOracleServiceId(e.target.value)}
                        className={`w-full px-3 py-2.5 text-sm font-medium rounded-lg border-2 transition-all focus:outline-none focus:ring-0 ${
                          !oracleServiceId
                            ? 'border-amber-300 bg-amber-50 text-slate-900 focus:border-amber-500'
                            : 'border-slate-200 bg-white text-slate-900 focus:border-[#0064FF]'
                        }`}
                        placeholder="예: ORCL"
                      />
                      {!oracleServiceId && (
                        <p className="mt-1 text-xs font-medium text-amber-600">필수 입력</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 푸터 - 액션 버튼 */}
            <div className="px-5 py-3 bg-white/60 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-800 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!isValid}
                className={cn(buttonStyles.base, buttonStyles.variants.primary, 'text-sm disabled:bg-slate-300')}
              >
                설정 저장
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};
