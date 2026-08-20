'use client';

/**
 * Meta rail (design-benchmark `ops-detail-ia-redesign.md`, R1 + R1′ V-b; owner
 * adjustment 08-20) — the service axis only: name, code, Jira ticket, and the
 * service-ops screen. The target's own facts (account · region · 설치모드 ·
 * 실데이터 · roles) moved back to the masthead's meta line, so the rail answers
 * one question from any tab: which service does this target belong to, and
 * where do I talk about it.
 *
 * Surface rule (R1′): the rail is NOT a card. It stands bare on the canvas;
 * white faces stay reserved for interactive values — 흰 섬 = 터치 대상.
 *
 * 오너 08-20 여섯째 조정: the target's free-text 설명 joins the rail as its own
 * group — display folds at 100 chars (full text in title); the write goes
 * through the existing DescriptionEditModal (assumed §8 PUT …/description).
 */
import Link from 'next/link';
import type { ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { passRoutes } from '@/lib/routes';
import type { RawTargetSourceDetail } from '@/app/lib/api/pipeline-target';
import type { TargetJiraTicket } from '@/app/lib/api/ops';
import { opsStyles } from '@/app/admin/pipelines/ops/target-sources/[targetSourceId]/_components/opsStyles';

export interface OpsMetaRailProps {
  detail: RawTargetSourceDetail;
  jiraTicket: TargetJiraTicket | null;
  /** false = 아직 조회 중 — null 을 "티켓 없음" 으로 단정하지 않는다. */
  ticketLoaded: boolean;
  onEditDescription: () => void;
}

/** 표시 접기 — 100자 넘는 설명은 자르고 말줄임표로 알린다. 전문은 title 로. */
const DESCRIPTION_FOLD = 100;

function Row({ label, children }: { label: string; children: ReactNode }): ReactElement {
  return (
    <div className={opsStyles.railRow}>
      <span className={opsStyles.railKey}>{label}</span>
      {children}
    </div>
  );
}

export function OpsMetaRail({
  detail,
  jiraTicket,
  ticketLoaded,
  onEditDescription,
}: OpsMetaRailProps): ReactElement {
  const description = (detail.description ?? '').trim();
  const folded =
    description.length > DESCRIPTION_FOLD
      ? `${description.slice(0, DESCRIPTION_FOLD)}…`
      : description;
  return (
    <aside className={opsStyles.rail} aria-label="서비스 · 설명">
      <section className={opsStyles.railGroup}>
        <h2 className={opsStyles.railLabel}>서비스</h2>
        <Row label="이름">
          <span className={opsStyles.railValue} title={detail.service_name ?? undefined}>
            {detail.service_name ?? '-'}
          </span>
        </Row>
        {detail.service_code && (
          <Row label="코드">
            <span className={cn(opsStyles.railValue, opsStyles.railMono)}>{detail.service_code}</span>
          </Row>
        )}
        {/* 티켓은 detail 과 따로 도착한다 — 도착 전에 "없음"을 그리면 곧바로 티켓으로
            뒤집히므로, 그 사이는 자리만 비워 둔다. 열 주소가 없으면 키는 값일 뿐이라
            링크로 그리지 않는다 (URL 조립 금지). */}
        <Row label="Jira">
          {!ticketLoaded ? (
            <span className={cn(opsStyles.skeletonBar, 'h-4 w-[84px]')} aria-hidden />
          ) : !jiraTicket ? (
            <span className={opsStyles.railNone}>없음</span>
          ) : jiraTicket.browseUrl ? (
            <a
              href={jiraTicket.browseUrl}
              target="_blank"
              rel="noreferrer"
              className={opsStyles.railLink}
              title="협업 채널 — Jira에서 논의하기"
            >
              {jiraTicket.issueKey} ↗
            </a>
          ) : (
            <span className={opsStyles.railValue}>{jiraTicket.issueKey}</span>
          )}
        </Row>
        {/* 서비스가 없으면 갈 운영 화면도 없다 — 없는 목적지는 말하지 않고 빠진다. */}
        {detail.service_code && (
          <Row label="운영">
            <Link
              href={passRoutes.pipelines.ops.service(detail.service_code)}
              className={opsStyles.railLink}
              title={`서비스 ${detail.service_code} 운영 — 티켓 연결·해제`}
            >
              서비스 관리 ↗
            </Link>
          </Row>
        )}
      </section>
      <section className={opsStyles.railGroup}>
        <div className="flex items-baseline justify-between gap-2">
          <h2 className={opsStyles.railLabel}>설명</h2>
          <button
            type="button"
            className={opsStyles.railLink}
            onClick={onEditDescription}
            title={description ? '설명 수정' : '설명 등록'}
          >
            {description ? '수정' : '등록하기'}
          </button>
        </div>
        {description ? (
          <p
            className={opsStyles.railProse}
            title={description.length > DESCRIPTION_FOLD ? description : undefined}
          >
            {folded}
          </p>
        ) : (
          <p className={cn('mt-1.5', opsStyles.railNone)}>없음</p>
        )}
      </section>
    </aside>
  );
}
