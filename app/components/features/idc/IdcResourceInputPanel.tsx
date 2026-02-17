'use client';

import { useState, useCallback } from 'react';
import { Button } from '@/app/components/ui/Button';
import { SecretKey } from '@/lib/types';
import { IdcResourceInput, IdcInputFormat, IdcDatabaseType } from '@/lib/types/idc';
import { IDC_VALIDATION, IDC_DEFAULT_PORTS, IDC_DATABASE_TYPE_LABELS } from '@/lib/constants/idc';
import { cn, inputStyles, primaryColors, statusColors } from '@/lib/theme';

interface IdcResourceInputPanelProps {
  initialData?: IdcResourceInput;
  credentials?: SecretKey[];
  onSave: (data: IdcResourceInput) => void;
  onCancel: () => void;
  /** 'modal': 헤더/푸터/외부스타일 제거 */
  variant?: 'card' | 'modal';
}

const DATABASE_TYPES: IdcDatabaseType[] = ['MYSQL', 'POSTGRESQL', 'MSSQL', 'ORACLE'];

const validateIp = (ip: string): boolean => {
  return IDC_VALIDATION.IP_REGEX.test(ip);
};

export const IdcResourceInputPanel = ({
  initialData,
  credentials = [],
  onSave,
  onCancel,
  variant = 'card',
}: IdcResourceInputPanelProps) => {
  const isModal = variant === 'modal';
  const [name, setName] = useState(initialData?.name ?? '');
  const [inputFormat, setInputFormat] = useState<IdcInputFormat>(initialData?.inputFormat ?? 'IP');
  const [ips, setIps] = useState<string[]>(initialData?.ips ?? ['']);
  const [host, setHost] = useState(initialData?.host ?? '');
  const [databaseType, setDatabaseType] = useState<IdcDatabaseType>(initialData?.databaseType ?? 'MYSQL');
  const [port, setPort] = useState<number>(initialData?.port ?? IDC_DEFAULT_PORTS.MYSQL);
  const [serviceId, setServiceId] = useState(initialData?.serviceId ?? '');
  const [credentialId, setCredentialId] = useState(initialData?.credentialId ?? '');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // IP 추가
  const handleAddIp = useCallback(() => {
    if (ips.length < IDC_VALIDATION.MAX_IPS) {
      setIps([...ips, '']);
    }
  }, [ips]);

  // IP 제거
  const handleRemoveIp = useCallback((index: number) => {
    if (ips.length > 1) {
      setIps(ips.filter((_, i) => i !== index));
    }
  }, [ips]);

  // IP 변경
  const handleIpChange = useCallback((index: number, value: string) => {
    const newIps = [...ips];
    newIps[index] = value;
    setIps(newIps);

    // IP 에러 클리어
    if (errors[`ip_${index}`]) {
      const newErrors = { ...errors };
      delete newErrors[`ip_${index}`];
      setErrors(newErrors);
    }
  }, [ips, errors]);

  // Database Type 변경 시 기본 포트 설정
  const handleDatabaseTypeChange = useCallback((type: IdcDatabaseType) => {
    setDatabaseType(type);
    setPort(IDC_DEFAULT_PORTS[type]);

    // Oracle이 아니면 serviceId 초기화
    if (type !== 'ORACLE') {
      setServiceId('');
      if (errors.serviceId) {
        const newErrors = { ...errors };
        delete newErrors.serviceId;
        setErrors(newErrors);
      }
    }
  }, [errors]);

  // 유효성 검증
  const validate = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    // 이름 검증
    if (!name.trim()) {
      newErrors.name = '리소스 이름을 입력하세요';
    }

    // IP/HOST 검증
    if (inputFormat === 'IP') {
      const validIps = ips.filter(ip => ip.trim());
      if (validIps.length === 0) {
        newErrors.ips = 'IP를 최소 1개 입력하세요';
      } else {
        validIps.forEach((ip, index) => {
          if (!validateIp(ip.trim())) {
            newErrors[`ip_${index}`] = '유효한 IPv4 형식이 아닙니다';
          }
        });
      }
    } else {
      if (!host.trim()) {
        newErrors.host = 'HOST를 입력하세요';
      } else if (host.length > IDC_VALIDATION.MAX_HOST_LENGTH) {
        newErrors.host = `HOST는 ${IDC_VALIDATION.MAX_HOST_LENGTH}자 이내로 입력하세요`;
      }
    }

    // 포트 검증
    if (port < 1 || port > 65535) {
      newErrors.port = '포트는 1-65535 범위여야 합니다';
    }

    // Oracle ServiceId 검증
    if (databaseType === 'ORACLE' && !serviceId.trim()) {
      newErrors.serviceId = 'Oracle DB는 Service ID가 필수입니다';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [name, inputFormat, ips, host, port, databaseType, serviceId]);

  // 저장
  const handleSave = useCallback(() => {
    if (!validate()) return;

    const data: IdcResourceInput = {
      name: name.trim(),
      inputFormat,
      port,
      databaseType,
    };

    if (inputFormat === 'IP') {
      data.ips = ips.filter(ip => ip.trim()).map(ip => ip.trim());
    } else {
      data.host = host.trim();
    }

    if (databaseType === 'ORACLE') {
      data.serviceId = serviceId.trim();
    }

    // Credential ID (Optional)
    if (credentialId) {
      data.credentialId = credentialId;
    }

    onSave(data);
  }, [name, inputFormat, ips, host, port, databaseType, serviceId, credentialId, validate, onSave]);

  // IP 2개 이상 경고
  const showClusterWarning = inputFormat === 'IP' && ips.filter(ip => ip.trim()).length >= 2;

  return (
    <div className={isModal ? '' : 'bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden'}>
      {/* Header - Modal 모드에서는 숨김 */}
      {!isModal && (
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">IDC 리소스 등록</h2>
              <p className="text-sm text-gray-500">데이터베이스 연결 정보를 입력하세요</p>
            </div>
          </div>
        </div>
      )}

      {/* Body */}
      <div className={isModal ? 'space-y-5' : 'p-6 space-y-5'}>
        {/* 리소스 이름 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">리소스 이름</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (errors.name) {
                const newErrors = { ...errors };
                delete newErrors.name;
                setErrors(newErrors);
              }
            }}
            className={cn(inputStyles.base, errors.name && inputStyles.error)}
            placeholder="예: 주문 DB"
          />
          {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name}</p>}
        </div>

        {/* 입력 포맷 토글 */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">입력 방식</label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setInputFormat('IP')}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all',
                inputFormat === 'IP'
                  ? `${primaryColors.border} ${statusColors.info.bgLight} ${statusColors.info.textDark}`
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              IP (복수 입력 가능)
            </button>
            <button
              type="button"
              onClick={() => setInputFormat('HOST')}
              className={cn(
                'flex-1 py-2.5 px-4 rounded-lg border-2 font-medium transition-all',
                inputFormat === 'HOST'
                  ? `${primaryColors.border} ${statusColors.info.bgLight} ${statusColors.info.textDark}`
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              )}
            >
              HOST (단일)
            </button>
          </div>
        </div>

        {/* IP 입력 */}
        {inputFormat === 'IP' && (
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
                    onChange={(e) => handleIpChange(index, e.target.value)}
                    className={cn(inputStyles.base, errors[`ip_${index}`] && inputStyles.error)}
                    placeholder="예: 192.168.1.100"
                  />
                  {ips.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveIp(index)}
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
                onClick={handleAddIp}
                className={cn('mt-2 flex items-center gap-1 text-sm font-medium', primaryColors.text, primaryColors.textHover)}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                IP 추가
              </button>
            )}

            {/* Cluster IP 경고 */}
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
        )}

        {/* HOST 입력 */}
        {inputFormat === 'HOST' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              HOST <span className="text-gray-400 font-normal">({IDC_VALIDATION.MAX_HOST_LENGTH}자 이내)</span>
            </label>
            <input
              type="text"
              value={host}
              onChange={(e) => {
                setHost(e.target.value);
                if (errors.host) {
                  const newErrors = { ...errors };
                  delete newErrors.host;
                  setErrors(newErrors);
                }
              }}
              className={cn(inputStyles.base, errors.host && inputStyles.error)}
              placeholder="예: db.example.com"
              maxLength={IDC_VALIDATION.MAX_HOST_LENGTH}
            />
            {errors.host && <p className="mt-1 text-sm text-red-600">{errors.host}</p>}
            <p className="mt-1 text-xs text-gray-400">{host.length}/{IDC_VALIDATION.MAX_HOST_LENGTH}</p>
          </div>
        )}

        {/* Database Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Database Type</label>
          <div className="grid grid-cols-4 gap-2">
            {DATABASE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => handleDatabaseTypeChange(type)}
                className={cn(
                  'py-2.5 px-3 rounded-lg border-2 text-sm font-medium transition-all',
                  databaseType === type
                    ? `${primaryColors.border} ${statusColors.info.bgLight} ${statusColors.info.textDark}`
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                )}
              >
                {IDC_DATABASE_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </div>

        {/* Port */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Port</label>
          <input
            type="number"
            value={port}
            onChange={(e) => {
              setPort(parseInt(e.target.value) || 0);
              if (errors.port) {
                const newErrors = { ...errors };
                delete newErrors.port;
                setErrors(newErrors);
              }
            }}
            min={1}
            max={65535}
            className={cn(inputStyles.base, 'w-32', errors.port && inputStyles.error)}
          />
          {errors.port && <p className="mt-1 text-sm text-red-600">{errors.port}</p>}
          <p className="mt-1 text-xs text-gray-400">1-65535 범위</p>
        </div>

        {/* Oracle Service ID */}
        {databaseType === 'ORACLE' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={serviceId}
              onChange={(e) => {
                setServiceId(e.target.value);
                if (errors.serviceId) {
                  const newErrors = { ...errors };
                  delete newErrors.serviceId;
                  setErrors(newErrors);
                }
              }}
              className={cn(inputStyles.base, errors.serviceId && inputStyles.error)}
              placeholder="예: ORCL"
            />
            {errors.serviceId && <p className="mt-1 text-sm text-red-600">{errors.serviceId}</p>}
          </div>
        )}

        {/* DB Credential (Optional) */}
        <div className="border-t border-gray-200 pt-5">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <label className="text-sm font-medium text-gray-700">
              DB Credential <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
          </div>
          <select
            value={credentialId}
            onChange={(e) => setCredentialId(e.target.value)}
            className={cn(
              inputStyles.base,
              credentialId ? 'border-green-300 bg-green-50' : ''
            )}
          >
            <option value="">선택 안 함</option>
            {credentials.map((cred) => (
              <option key={cred.name} value={cred.name}>
                {cred.name}
              </option>
            ))}
          </select>
          {credentials.length === 0 && (
            <p className="mt-2 text-xs text-orange-600">
              등록된 Credential이 없습니다.
            </p>
          )}
          <p className="mt-2 text-xs text-gray-400">
            연결 테스트에 사용됩니다. 선택하지 않으면 테스트 시 별도 선택이 필요합니다.
          </p>
        </div>
      </div>

      {/* Footer */}
      <div className={isModal
        ? 'pt-5 flex justify-end gap-3'
        : 'px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3'
      }>
        <Button variant="secondary" onClick={onCancel}>
          취소
        </Button>
        <Button onClick={handleSave}>
          저장
        </Button>
      </div>
    </div>
  );
};
