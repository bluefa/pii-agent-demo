import type { AzureSettingsResponse } from '@/app/api/_lib/v1-types';

type ScanAppStatus = AzureSettingsResponse['scanApp']['status'] | string;
type NormalizedScanAppStatus = AzureSettingsResponse['scanApp']['status'];

export interface LegacyScanApp {
  registered?: boolean;
  appId?: string;
  app_id?: string;
  status?: ScanAppStatus;
  lastVerifiedAt?: string;
  last_verified_at?: string;
  failReason?: string;
  fail_reason?: string;
  failMessage?: string;
  fail_message?: string;
}

export interface LegacyAzureSettings {
  scanApp?: LegacyScanApp;
  scan_app?: LegacyScanApp;
  tenantId?: string;
  tenant_id?: string;
  subscriptionId?: string;
  subscription_id?: string;
}

const normalizeScanAppStatus = (status?: ScanAppStatus): NormalizedScanAppStatus => {
  if (status === 'VALID' || status === 'INVALID' || status === 'UNVERIFIED') {
    return status;
  }
  return 'UNVERIFIED';
};

const getLegacyScanApp = (legacy: LegacyAzureSettings): LegacyScanApp | undefined =>
  legacy.scanApp ?? legacy.scan_app;

export const mapScanApp = (legacy: LegacyAzureSettings): AzureSettingsResponse['scanApp'] => {
  const scanApp = getLegacyScanApp(legacy);
  const appId = scanApp?.appId ?? scanApp?.app_id ?? '';
  const registered = scanApp?.registered ?? appId.length > 0;
  const lastVerifiedAt = scanApp?.lastVerifiedAt ?? scanApp?.last_verified_at;

  return {
    appId: registered ? appId : '',
    status: registered ? normalizeScanAppStatus(scanApp?.status) : 'UNVERIFIED',
    ...(lastVerifiedAt && { lastVerifiedAt }),
  };
};

export interface AzureScanAppResponse {
  app_id: string;
  status: string;
  fail_reason?: string;
  fail_message?: string;
  last_verified_at?: string;
}

export const mapBffAzureScanApp = (legacy: LegacyAzureSettings): AzureScanAppResponse => {
  const scanApp = getLegacyScanApp(legacy);
  const normalized = mapScanApp(legacy);
  const failReason = scanApp?.failReason ?? scanApp?.fail_reason;
  const failMessage = scanApp?.failMessage ?? scanApp?.fail_message;

  return {
    app_id: normalized.appId,
    status: normalized.status,
    ...(failReason && { fail_reason: failReason }),
    ...(failMessage && { fail_message: failMessage }),
    ...(normalized.lastVerifiedAt && { last_verified_at: normalized.lastVerifiedAt }),
  };
};
