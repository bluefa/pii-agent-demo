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
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/types';
import { PlButton } from '@/app/admin/pipelines/_components/PlButton';
import { Icon } from '@/app/admin/pipelines/_components/icons';
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

/**
 * 계약상 status enum은 GCP만 열거(VALID/INVALID/UNVERIFIED) — AWS·Azure는 자유
 * 문자열이라 열린 집합으로 매핑한다. 어휘·톤은 RoleVerifyModal verdictMeta와
 * 정렬(검증 완료/검증 중/검증 실패), UNVERIFIED는 오류가 아니라 미검증(off).
 */
const pillSpec = (status: string | null | undefined): { cls: string; label: string } => {
  switch (status) {
    case 'VALID':
    case 'COMPLETED':
      return { cls: 'bg-[var(--pl-ok-bg)] text-[var(--pl-ok-text)]', label: '검증 완료' };
    case 'IN_PROGRESS':
      return { cls: 'bg-[var(--pl-warn-bg)] text-[var(--pl-warn-text)]', label: '검증 중' };
    case 'UNVERIFIED':
      return { cls: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', label: '미검증' };
    case 'FAIL':
    case 'INVALID':
      return { cls: 'bg-[var(--pl-err-bg)] text-[var(--pl-err-text)]', label: '검증 실패' };
    default:
      return { cls: 'bg-[var(--pl-off-bg)] text-[var(--pl-off-text)]', label: status ?? '미확인' };
  }
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
  // 판정은 타이틀 옆 — 최근 스캔 카드의 상태 pill과 같은 자리(운영 피드백).
  const pill = state.phase === 'done' ? pillSpec(state.data.status) : null;

  return (
    <section className={pipelineStyles.card.base} aria-label="스캔 권한">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
            <Icon name="check-circle" size="md" className="text-[var(--pl-primary)]" />
            스캔 권한
            {pill && (
              <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, pill.cls)}>
                {pill.label}
              </span>
            )}
          </h2>
          <p className={opsStyles.cardDesc}>{credentialLabel} 권한을 검증합니다.</p>
        </div>
        {/* 보조 행동이라 버튼 크롬 없이 텍스트 버튼(ghost)으로 물러난다. */}
        <PlButton
          variant="ghost"
          className="flex-none"
          disabled={state.phase === 'loading'}
          onClick={verify}
        >
          <Icon
            name={state.phase === 'loading' ? 'loader' : 'check-circle'}
            size="sm"
            className={state.phase === 'loading' ? 'animate-spin' : undefined}
          />
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
        <CredentialResult data={state.data} />
      )}
    </section>
  );
}

function CredentialResult({ data }: { data: CredentialVerification }): ReactElement {
  // 오류 박스는 실패(FAIL/INVALID)거나 서버가 원인을 보냈을 때만 — 미검증은 오류가 아니다.
  const failed =
    data.status === 'FAIL'
    || data.status === 'INVALID'
    || data.fail_reason != null
    || data.fail_message != null;

  return (
    <>
      {/* 검증 응답 원문 — identity 포함 전체 payload를 그대로. 판정(pill)은 타이틀
          옆이 담당하고, 원문은 진단·백엔드 대조용이다 (카드 공백 해소 겸). */}
      <div className="mt-4">
        <p className="text-[11px] font-semibold tracking-[0.04em] text-[var(--pl-text-faint)]">
          응답 원문
        </p>
        <pre className="mt-1.5 max-h-[200px] overflow-auto rounded-lg border border-[var(--pl-gray-100)] bg-[var(--pl-bg-inner)] px-3.5 py-3 text-[12px] leading-[1.7] text-[var(--pl-text-medium)] [font-family:var(--pl-font-mono)]">
          {JSON.stringify(data, null, 2)}
        </pre>
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

      {/* 하단 시각행 — 최근 스캔 카드와 같은 문법(라벨 위/값 아래). 값 없으면 행 생략. */}
      {data.last_verified_at && (
        <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-[var(--pl-text-faint)]">마지막 검증</p>
            <p className="mt-0.5 whitespace-nowrap text-[13px] font-medium tabular-nums text-[var(--pl-text-medium)]">
              {fmtDateTimeSec(data.last_verified_at)}
            </p>
          </div>
        </div>
      )}
    </>
  );
}
