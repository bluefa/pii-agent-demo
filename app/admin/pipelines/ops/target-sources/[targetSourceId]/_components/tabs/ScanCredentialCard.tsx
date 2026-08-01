'use client';

/**
 * 스캔 권한(자격) 검증 카드 — 스캔 실패의 최빈 원인이 자격이라, 검증 결과와
 * 원인(fail_reason/fail_message)을 스캔 탭 안에서 그 자리에 보여준다(조회 전용).
 * 3사 검증 응답은 같은 형태를 공유한다: { status, fail_reason, fail_message,
 * last_verified_at } + 프로바이더별 identity(role_arn/app_id/gcp_project_id).
 */
import { useEffect, useState, type ReactElement } from 'react';
import { getAwsRoleVerification } from '@/app/lib/api/aws';
import { getAzureScanApp } from '@/app/lib/api/azure';
import { getGcpScanServiceAccount } from '@/app/lib/api/gcp';
import { SCAN_CREDENTIAL_LABELS } from '@/app/components/features/scan/scan-labels';
import { cn, pipelineStyles } from '@/lib/theme';
import { fmtDateTimeSec } from '@/lib/pipeline/format';
import type { CloudProvider } from '@/lib/types';
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

type JsonTokenKind = 'key' | 'string' | 'number' | 'bool' | 'null';

/**
 * JSON.stringify(…, 2) 출력용 미니 토크나이저 — 키/문자열/숫자/불리언/null만
 * 구분하고 구두점·공백은 사이사이 plain으로 남긴다. 토큰 text를 이어붙이면
 * 입력과 동일(라운드트립)해야 한다.
 */
export const tokenizeJson = (
  text: string,
): Array<{ kind: JsonTokenKind | 'plain'; text: string }> => {
  const tokens: Array<{ kind: JsonTokenKind | 'plain'; text: string }> = [];
  const re = /("(?:[^"\\]|\\.)*")(\s*:)?|\btrue\b|\bfalse\b|\bnull\b|-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/g;
  let last = 0;
  for (let match = re.exec(text); match !== null; match = re.exec(text)) {
    if (match.index > last) tokens.push({ kind: 'plain', text: text.slice(last, match.index) });
    const [raw, str, colon] = match;
    if (str !== undefined) {
      // 콜론이 따라오는 문자열 = 키 (유효한 JSON에서 값 뒤에 콜론은 못 온다).
      tokens.push({ kind: colon ? 'key' : 'string', text: str });
      if (colon) tokens.push({ kind: 'plain', text: colon });
    } else if (raw === 'true' || raw === 'false') {
      tokens.push({ kind: 'bool', text: raw });
    } else if (raw === 'null') {
      tokens.push({ kind: 'null', text: raw });
    } else {
      tokens.push({ kind: 'number', text: raw });
    }
    last = re.lastIndex;
  }
  if (last < text.length) tokens.push({ kind: 'plain', text: text.slice(last) });
  return tokens;
};

/** JSON 토큰 색 — 시맨틱 토큰만: 키 primary, 문자열 ok, 숫자·불리언 warn, null은 italic으로만 물러남. */
const JSON_TOKEN_CLASS: Record<JsonTokenKind, string> = {
  key: 'text-[var(--pl-primary)]',
  string: 'text-[var(--pl-ok-text)]',
  number: 'text-[var(--pl-warn-text)]',
  bool: 'text-[var(--pl-warn-text)]',
  null: 'italic text-[var(--pl-text-weak)]',
};

export interface ScanCredentialCardProps {
  provider: CloudProvider;
  targetSourceId: number;
}

export function ScanCredentialCard({ provider, targetSourceId }: ScanCredentialCardProps): ReactElement {
  // 조회 전용 — '다시 검증' 버튼은 제거(운영 피드백: 화면 갱신이면 충분).
  const [state, setState] = useState<LoadState>({ phase: 'loading' });

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
  }, [provider, targetSourceId]);

  const credentialLabel = SCAN_CREDENTIAL_LABELS[provider];
  // 판정은 타이틀 옆 — 최근 스캔 카드의 상태 pill과 같은 자리(운영 피드백).
  const pill = state.phase === 'done' ? pillSpec(state.data.status) : null;

  return (
    // flex-col — 하단 시각행(마지막 검증)을 mt-auto로 밑바닥에 깔아 짝 카드와 바닥선을 맞춘다.
    <section className={cn(pipelineStyles.card.base, 'flex flex-col')} aria-label="스캔 권한">
      <h2 className={cn(opsStyles.cardTitle, 'flex items-center gap-2')}>
        <Icon name="shield" size={18} className="text-[var(--pl-primary)]" />
        스캔 권한
        {pill && (
          <span className={cn(pipelineStyles.pill.base, pipelineStyles.pill.md, pill.cls)}>
            {pill.label}
          </span>
        )}
      </h2>
      <p className={opsStyles.cardDesc}>{credentialLabel} 권한을 검증합니다.</p>

      {state.phase === 'loading' ? (
        // 응답 원문 박스 + 하단 시각행 자리를 그리는 스켈레톤 — 점프 방지.
        // 박스 스켈레톤도 flex-1로 실물과 같은 자리(남는 높이 흡수)를 차지한다.
        <div className="mt-4 flex min-h-0 flex-1 flex-col" aria-busy>
          <div className={cn(opsStyles.skeleton, 'min-h-[176px] flex-1')} aria-hidden="true" />
          <div className={cn(opsStyles.skeleton, 'mt-4 h-4 w-44 flex-none')} aria-hidden="true" />
        </div>
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
      {/* 검증 응답 원문 — identity 포함 전체 payload. 라벨은 박스 안 헤더로,
          본문은 토큰 하이라이트(진짜 JSON 뷰어 문법) — 진단·백엔드 대조용.
          flex-1 — 짝 카드(최근 스캔)가 더 길 때 남는 높이를 회색 면이 흡수해
          박스 아래 흰 여백이 휑하게 남지 않는다(운영 피드백). */}
      <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border border-[var(--pl-gray-100)] bg-[var(--pl-bg-inner)]">
        {/* 12/500 — 시각행 라벨·모달 th와 같은 라벨 문법(600+tracking은 혼자 이질). */}
        <p className="px-3.5 pt-2.5 text-[12px] font-medium text-[var(--pl-text-faint)]">
          응답 원문
        </p>
        {/* 구두점은 pre 기본색(weak)으로 물러나고 값 토큰만 색을 갖는다 —
            faint는 12px에서 대비 ≈2.6:1로 AA 미달이라 본문에는 못 쓴다. */}
        <pre className="min-h-0 flex-1 overflow-auto px-3.5 pb-3 pt-1 text-[12px] leading-[1.7] text-[var(--pl-text-weak)] [font-family:var(--pl-font-mono)]">
          {tokenizeJson(JSON.stringify(data, null, 2)).map((token, index) =>
            token.kind === 'plain' ? (
              token.text
            ) : (
              <span key={index} className={JSON_TOKEN_CLASS[token.kind]}>
                {token.text}
              </span>
            ),
          )}
        </pre>
      </div>

      {/* 실패면 원인(코드+설명)이 그 자리에 — 계약상 자유 문자열이라 그대로 통과시킨다. */}
      {failed && (
        <p className="mt-4 rounded-lg bg-[var(--pl-err-bg)] px-3 py-2.5 text-[14px] text-[var(--pl-err-text)]">
          {data.fail_reason && (
            <span className="[font-family:var(--pl-font-mono)] font-semibold">{data.fail_reason}</span>
          )}
          <span className={data.fail_reason ? 'ml-2' : undefined}>
            {data.fail_message ?? '자격 검증에 실패했습니다. 권한 설정을 확인해 주세요.'}
          </span>
        </p>
      )}

      {/* 하단 시각행 — 최근 스캔 카드와 같은 문법(라벨 위/값 아래), mt-auto로 밑바닥 고정.
          값 없으면 행 생략. */}
      {data.last_verified_at && (
        <div className="mt-auto">
          <div className="mt-4 flex flex-wrap gap-x-10 gap-y-3 border-t border-[var(--pl-gray-100)] pt-3.5">
            <div className="min-w-0">
              <p className="text-[12px] font-medium text-[var(--pl-text-faint)]">마지막 검증</p>
              <p className="mt-0.5 whitespace-nowrap text-[14px] font-medium tabular-nums text-[var(--pl-text-medium)]">
                {fmtDateTimeSec(data.last_verified_at)}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
