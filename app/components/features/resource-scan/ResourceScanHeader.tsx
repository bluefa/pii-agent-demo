'use client';

import { useState, useCallback } from 'react';
import { CloudProvider, ScanResult, ScanStatus } from '@/lib/types';
import { FilterTab } from '@/app/components/features/resource-table/FilterTab';
import { ScanButton } from './ScanButton';
import { ScanProgress } from './ScanProgress';
import { ScanResultSummary } from './ScanResultSummary';

export type ResourceFilter = 'selected' | 'all';

interface ResourceScanHeaderProps {
  /** 클라우드 프로바이더 */
  cloudProvider: CloudProvider;
  /** 현재 필터 */
  filter: ResourceFilter;
  /** 필터 변경 핸들러 */
  onFilterChange: (filter: ResourceFilter) => void;
  /** 연동 대상 리소스 수 */
  selectedCount: number;
  /** 전체 리소스 수 */
  totalCount: number;
  /** 스캔 가능 여부 */
  canScan: boolean;
  /** 스캔 진행 중 여부 */
  isScanning: boolean;
  /** 스캔 상태 */
  scanStatus: ScanStatus | null;
  /** 스캔 진행률 */
  scanProgress: number;
  /** 쿨다운 종료 시각 */
  cooldownEndsAt: Date | null;
  /** 스캔 불가 사유 */
  cannotScanReason?: 'SCAN_IN_PROGRESS' | 'COOLDOWN_ACTIVE' | 'UNSUPPORTED_PROVIDER' | null;
  /** 마지막 스캔 결과 (표시용) */
  lastResult?: ScanResult | null;
  /** 스캔 에러 */
  scanError?: string | null;
  /** 스캔 시작 핸들러 */
  onScan: () => void;
  /** 결과 배너 숨김 핸들러 */
  onDismissResult?: () => void;
  /** 결과 표시 여부 */
  showResult?: boolean;
}

/**
 * 리소스 테이블 헤더 (필터 탭 + 스캔 버튼 + 진행 상태)
 *
 * @example
 * <ResourceScanHeader
 *   cloudProvider="AWS"
 *   filter={filter}
 *   onFilterChange={setFilter}
 *   selectedCount={5}
 *   totalCount={10}
 *   {...scanState}
 *   onScan={handleScan}
 * />
 */
export const ResourceScanHeader = ({
  cloudProvider,
  filter,
  onFilterChange,
  selectedCount,
  totalCount,
  canScan,
  isScanning,
  scanStatus,
  scanProgress,
  cooldownEndsAt,
  cannotScanReason,
  lastResult,
  scanError,
  onScan,
  onDismissResult,
  showResult = false,
}: ResourceScanHeaderProps) => {
  const showProgress = isScanning && scanStatus && scanStatus !== 'COMPLETED';
  const showResultBanner = showResult && lastResult && !isScanning;

  return (
    <div className="space-y-3">
      {/* 필터 탭 + 스캔 버튼 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <FilterTab
            label="연동 대상"
            count={selectedCount}
            active={filter === 'selected'}
            onClick={() => onFilterChange('selected')}
          />
          <FilterTab
            label="전체"
            count={totalCount}
            active={filter === 'all'}
            onClick={() => onFilterChange('all')}
          />
        </div>

        <ScanButton
          canScan={canScan}
          isScanning={isScanning}
          cooldownEndsAt={cooldownEndsAt}
          cannotScanReason={cannotScanReason}
          onScan={onScan}
        />
      </div>

      {/* 스캔 진행 상태 */}
      {showProgress && (
        <ScanProgress
          status={scanStatus}
          progress={scanProgress}
          error={scanError}
        />
      )}

      {/* 스캔 결과 배너 */}
      {showResultBanner && (
        <ScanResultSummary
          result={lastResult}
          onDismiss={onDismissResult}
        />
      )}
    </div>
  );
};

export default ResourceScanHeader;
