import type { CSSProperties } from 'react';
import type { TargetSource } from '@/lib/types';
import { PageHeader } from '@/app/components/ui/PageHeader';
import { IdentityBar, type IdentityBarField } from '@/app/components/ui/IdentityBar';
import { InstallationProcessProgressBar } from '@/app/components/features/process-status';
import {
  borderColors,
  cardStyles,
  cn,
  identityBarStyles,
  pageHeaderTitleMutedStyle,
  primaryColors,
  providerAccent,
  providerAccentDefault,
} from '@/lib/theme';
import type { ProjectIdentity } from '@/app/target-sources/[targetSourceId]/_components/common/project-identity';
import { TcHeaderTag } from '@/app/target-sources/[targetSourceId]/_components/common/TcHeaderTag';

interface ProjectPageMetaProps {
  project: TargetSource;
  /**
   * '{Provider} Infrastructure'. 브레드크럼이 제거되면서 이 컴포넌트는 더 이상
   * 읽지 않지만, 상위 스텝 컴포넌트들이 ConnectionTestCard 등과 공유하는
   * prop 이라 시그니처는 유지한다.
   */
  providerLabel: string;
  identity: ProjectIdentity;
  action?: React.ReactNode;
}

const JIRA_KEY_PATTERN = /\/browse\/([A-Z][A-Z0-9]+-\d+)/;

const extractJiraLabel = (url: string): string => {
  const match = url.match(JIRA_KEY_PATTERN);
  return match ? match[1] : 'Jira';
};

const PROVIDER_ICON = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 18a4 4 0 0 1-.5-7.97 5.5 5.5 0 0 1 10.62-1.46A4.5 4.5 0 0 1 17.5 18H7Z" />
  </svg>
);

const buildIdentityFields = (identity: ProjectIdentity): IdentityBarField[] => {
  const fields: IdentityBarField[] = identity.identifiers.map((id) => ({
    label: id.label,
    value: id.value ?? '-',
    mono: id.mono,
    copyText: id.value ?? undefined,
  }));

  if (identity.jiraLink) {
    const jiraLink = identity.jiraLink;
    fields.push({
      label: 'Jira',
      value: (
        <a
          href={jiraLink}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(primaryColors.text, 'font-semibold hover:underline')}
        >
          {extractJiraLabel(jiraLink)}
        </a>
      ),
    });
  }

  return fields;
};

export const ProjectPageMeta = ({ project, identity, action }: ProjectPageMetaProps) => {
  const provider = String(identity.cloudProvider).toLowerCase();
  const accent = providerAccent[provider] ?? providerAccentDefault;
  // v16 hides the "Cloud Provider" sub-line for IDC — it has no cloud account (HTML 9439).
  const isIdc = provider === 'idc';

  // v16 `.page-title` = service NAME + a gray, weight-500 service code in parens
  // (e.g. "Big Data Platform (BDP)"). Both come from swagger TargetSourceDetail
  // (service_name / service_code); the normalizer falls serviceName back to the
  // code, so the parens are never empty.
  const serviceTitle = project.serviceName || project.serviceCode;

  return (
    <>
      {/* Unified project header — the page title/actions, identity facts and the
          process stepper are one hierarchical info cluster (what › context ›
          progress), so they share a single card. The provider accent stripe
          marks the whole header; the stepper sits as a border-t footer. */}
      <section
        className={cn(cardStyles.base, 'relative overflow-hidden', identityBarStyles.hostStripe)}
        style={{ ['--ib-accent']: accent } as CSSProperties}
      >
        <div className="px-[28px] pt-[22px]">
          <PageHeader
            title={
              <>
                {serviceTitle}{' '}
                <span className={pageHeaderTitleMutedStyle}>({project.serviceCode})</span>
                {/* P5: TC 요약(latest_version)이 헤더 태그를 만든다 — Step 5 에 들어가기
                    전에 마지막 실행의 판정·시점이 보인다. 실행 기록이 없으면 무표시. */}
                <span className="ml-3 align-middle">
                  <TcHeaderTag targetSourceId={project.targetSourceId} />
                </span>
              </>
            }
            action={action}
          />
        </div>
        <IdentityBar
          bare
          accent={accent}
          // v16 identity bar shows the BARE provider token ('GCP'/'Azure'/'AWS'/'IDC',
          // HTML 9426-9429), not the '{Provider} Infrastructure' string used for the
          // breadcrumb crumb above. `cloudProvider` already carries v16's exact casing.
          providerName={identity.cloudProvider}
          providerSub={isIdc ? undefined : 'Cloud Provider'}
          icon={PROVIDER_ICON}
          fields={buildIdentityFields(identity)}
        />
        <div className={cn('border-t px-[28px] py-[16px]', borderColors.light)}>
          <InstallationProcessProgressBar currentStep={project.processStatus} />
        </div>
      </section>
    </>
  );
};
