'use client';

/**
 * 스캔 권한(자격) 검증 카드 — 스캔 실패의 최빈 원인이 자격이라, 검증을 스캔 탭
 * 안에서 실행하고 결과·원인(fail_reason/fail_message)을 그 자리에서 보여준다.
 * 3사 검증 응답은 같은 형태를 공유한다: { status, fail_reason, fail_message,
 * last_verified_at } + 프로바이더별 identity(role_arn/app_id/gcp_project_id).
 */
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { getAwsRoleVerification } from '@/app/lib/api/aws';
import { getAzureScanApp } from '@/app/lib/api/azure';
import { getGcpScanServiceAccount } from '@/app/lib/api/gcp';
import { SCAN_CREDENTIAL_LABELS } from '@/app/components/features/scan/scan-labels';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTime } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/types';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

/** 3사 검증 응답의 구조적 합집합 — 스키마가 전부 partial이라 전 필드 optional. */
interface CredentialVerification {
  status?: string | null;
  fail_reason?: string | null;
  fail_message?: string | null;
  last_verified_at?: string | null;
  role_arn?: string | null;
  app_id?: string | null;
  gcp_project_id?: string | null;
}

const fetchByProvider = (
  provider: CloudProvider,
  targetSourceId: number,
): Promise<CredentialVerification> => {
  switch (provider) {
    case 'AWS':
      return getAwsRoleVerification(targetSourceId, 'scan');
    case 'Azure':
      return getAzureScanApp(targetSourceId);
    case 'GCP':
      return getGcpScanServiceAccount(targetSourceId);
    case 'IDC':
      // IDC는 클라우드 스캔이 없음 — 호출부(ScanTab)가 이 카드를 렌더하지 않는다.
      return Promise.resolve({});
  }
};

type LoadState =
  | { phase: 'loading' }
  | { phase: 'error' }
  | { phase: 'done'; data: CredentialVerification };

/** VALID/IN_PROGRESS 외의 status는 전부 실패로 취급 (사용자 화면 훅과 같은 규칙). */
const pillSpec = (status: string | null | undefined): { cls: string; dot: string; label: string } => {
  if (status === 'VALID') {
    return { cls: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', dot: 'bg-[var(--pl-ok)]', label: '유효' };
  }
  if (status === 'IN_PROGRESS') {
    return { cls: 'bg-[var(--pl-info-bg)] text-[var(--pl-info-text)]', dot: 'bg-[var(--pl-info)]', label: '검증 중' };
  }
  return { cls: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', dot: 'bg-[var(--pl-err)]', label: '실패' };
};

export interface ScanCredentialCardProps {
  provider: CloudProvider;
  targetSourceId: number;
}

export function ScanCredentialCard({ provider, targetSourceId }: ScanCredentialCardProps): ReactElement {
  // 초기 state가 loading이라 마운트 경로는 effect가 fetch만 한다. 재검증 버튼은
  // loading으로 되돌린 뒤 attempt를 올려 같은 effect를 다시 태운다 (OpsTargetView
  // reloadKey 패턴 — effect 본문 동기 setState 금지 규칙과 공존).
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await fetchByProvider(provider, targetSourceId);
        if (!cancelled) setState({ phase: 'done', data });
      } catch {
        if (!cancelled) setState({ phase: 'error' });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [provider, targetSourceId, attempt]);

  const verify = useCallback((): void => {
    setState({ phase: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const credentialLabel = SCAN_CREDENTIAL_LABELS[provider];

  return (
    <section className={pipelineStyles.card.base} aria-label="스캔 권한">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={opsStyles.cardTitle}>스캔 권한</h2>
          <p className={opsStyles.cardDesc}>
            {credentialLabel} 권한을 검증합니다. 결과는 마지막 검증 시각과 함께 표시돼요.
          </p>
        </div>
        <PlButton
          variant="secondary"
          className="flex-none"
          disabled={state.phase === 'loading'}
          onClick={verify}
        >
          {state.phase === 'loading' ? '검증 중…' : '다시 검증'}
        </PlButton>
      </div>

      {state.phase === 'loading' ? (
        <p className={cn(pipelineStyles.text.meta, 'mt-4')} aria-busy>
          검증 중…
        </p>
      ) : state.phase === 'error' ? (
        <p className={cn(pipelineStyles.text.meta, 'mt-4')}>자격 정보를 불러오지 못했습니다.</p>
      ) : (
        <CredentialResult data={state.data} credentialLabel={credentialLabel} />
      )}
    </section>
  );
}

function CredentialResult({
  data,
  credentialLabel,
}: {
  data: CredentialVerification;
  credentialLabel: string;
}): ReactElement {
  const pill = pillSpec(data.status);
  const identity = data.role_arn ?? data.app_id ?? data.gcp_project_id ?? null;
  const failed = data.status !== 'VALID' && data.status !== 'IN_PROGRESS';

  return (
    <>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, pill.cls)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', pill.dot)} aria-hidden />
          {pill.label}
        </span>
        {identity && (
          <span className="min-w-0 text-[13px] text-[var(--pl-text-weak)]">
            {credentialLabel}{' '}
            <span
              className="break-all font-semibold text-[var(--pl-text-strong)] [font-family:var(--pl-font-mono)]"
              title={identity}
            >
              {identity}
            </span>
          </span>
        )}
        {data.last_verified_at && (
          <span className="whitespace-nowrap text-[13px] text-[var(--pl-text-weak)]">
            마지막 검증{' '}
            <span className="font-semibold text-[var(--pl-text-strong)]">
              {fmtDateTime(data.last_verified_at)}
            </span>
          </span>
        )}
      </div>

      {/* 실패면 원인(코드+설명)이 그 자리에 — 계약상 자유 문자열이라 그대로 통과시킨다. */}
      {failed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[13px] text-[var(--pl-err-text)]">
          {data.fail_reason && (
            <span className="[font-family:var(--pl-font-mono)] font-semibold">{data.fail_reason}</span>
          )}
          <span className={data.fail_reason ? 'ml-2' : undefined}>
            {data.fail_message ?? '자격 검증에 실패했습니다. 권한 설정을 확인해 주세요.'}
          </span>
        </p>
      )}
    </>
  );
}
