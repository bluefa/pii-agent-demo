'use client';

import { useState, useRef } from 'react';
import { VmDatabaseType, VmDatabaseConfig } from '@/lib/types';

interface VmDatabaseConfigPanelProps {
  resourceId: string;
  initialConfig?: VmDatabaseConfig;
  onSave: (resourceId: string, config: VmDatabaseConfig) => void;
  onCancel: () => void;
}

const VM_DATABASE_TYPES: { value: VmDatabaseType; label: string }[] = [
  { value: 'MYSQL', label: 'MySQL' },
  { value: 'POSTGRESQL', label: 'PostgreSQL' },
  { value: 'MSSQL', label: 'Microsoft SQL Server' },
  { value: 'MONGODB', label: 'MongoDB' },
  { value: 'ORACLE', label: 'Oracle' },
];

const DEFAULT_PORTS: Record<VmDatabaseType, number> = {
  MYSQL: 3306,
  POSTGRESQL: 5432,
  MSSQL: 1433,
  MONGODB: 27017,
  ORACLE: 1521,
};

export const VmDatabaseConfigPanel = ({
  resourceId,
  initialConfig,
  onSave,
  onCancel,
}: VmDatabaseConfigPanelProps) => {
  const [databaseType, setDatabaseType] = useState<VmDatabaseType>(
    initialConfig?.databaseType ?? 'MYSQL'
  );
  const [port, setPort] = useState<string>(
    initialConfig?.port?.toString() ?? DEFAULT_PORTS['MYSQL'].toString()
  );
  const [oracleServiceId, setOracleServiceId] = useState<string>(
    initialConfig?.oracleServiceId ?? ''
  );
  const [portError, setPortError] = useState<string | null>(null);

  // 이전 DB 타입을 추적하여 변경 시 기본 포트 설정
  const prevDbTypeRef = useRef<VmDatabaseType>(databaseType);

  const handleDatabaseTypeChange = (newType: VmDatabaseType) => {
    setDatabaseType(newType);
    // 타입이 변경되고 initialConfig가 없는 경우에만 기본 포트 설정
    if (!initialConfig && newType !== prevDbTypeRef.current) {
      setPort(DEFAULT_PORTS[newType].toString());
      prevDbTypeRef.current = newType;
    }
  };

  const validatePort = (value: string): boolean => {
    const portNum = parseInt(value, 10);
    if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
      setPortError('포트는 1-65535 범위여야 합니다');
      return false;
    }
    setPortError(null);
    return true;
  };

  const handlePortChange = (value: string) => {
    setPort(value);
    if (value) {
      validatePort(value);
    } else {
      setPortError('포트를 입력해주세요');
    }
  };

  const handleSave = () => {
    if (!validatePort(port)) return;

    const config: VmDatabaseConfig = {
      databaseType,
      port: parseInt(port, 10),
      ...(databaseType === 'ORACLE' && oracleServiceId ? { oracleServiceId } : {}),
    };

    onSave(resourceId, config);
  };

  const isOracleSelected = databaseType === 'ORACLE';
  const isValid = !portError && port !== '' && (!isOracleSelected || oracleServiceId !== '');

  return (
    <tr>
      <td colSpan={7} className="px-0 py-0">
        <div className="ml-12 mr-6 my-2 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-start gap-6">
            {/* Database Type */}
            <div className="flex-1 max-w-[200px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                데이터베이스 타입
              </label>
              <select
                value={databaseType}
                onChange={(e) => handleDatabaseTypeChange(e.target.value as VmDatabaseType)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {VM_DATABASE_TYPES.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Port */}
            <div className="w-[120px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                포트
              </label>
              <input
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(e) => handlePortChange(e.target.value)}
                className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                  portError ? 'border-red-300 bg-red-50' : 'border-gray-300 bg-white'
                }`}
                placeholder="포트 번호"
              />
              {portError && (
                <p className="mt-1 text-xs text-red-600">{portError}</p>
              )}
            </div>

            {/* Oracle Service ID */}
            {isOracleSelected && (
              <div className="flex-1 max-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service ID (SID)
                </label>
                <input
                  type="text"
                  value={oracleServiceId}
                  onChange={(e) => setOracleServiceId(e.target.value)}
                  className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    isOracleSelected && !oracleServiceId
                      ? 'border-red-300 bg-red-50'
                      : 'border-gray-300 bg-white'
                  }`}
                  placeholder="예: ORCL"
                />
                {isOracleSelected && !oracleServiceId && (
                  <p className="mt-1 text-xs text-red-600">Oracle은 SID가 필요합니다</p>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex items-end gap-2 pb-0.5">
              <button
                onClick={onCancel}
                className="px-3 py-2 text-sm text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={!isValid}
                className="px-3 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                저장
              </button>
            </div>
          </div>
        </div>
      </td>
    </tr>
  );
};
