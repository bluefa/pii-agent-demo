import Link from 'next/link';

import { buttonStyles, textColors } from '@/lib/theme';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
  backHref?: string;
}

const chevronLeftIcon = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const PageHeader = ({ title, subtitle, action, backHref }: PageHeaderProps) => {
  return (
    <div className="flex justify-between items-start">
      <div className="flex items-start gap-3">
        {backHref && (
          <Link
            href={backHref}
            className={`${buttonStyles.variants.ghost} inline-flex items-center gap-1 px-2 py-1 rounded-md text-sm font-medium transition-colors mt-1`}
          >
            {chevronLeftIcon}
            목록으로
          </Link>
        )}
        <div>
          <h1 className={`text-2xl font-bold tracking-tight ${textColors.primary}`}>{title}</h1>
          {subtitle && <p className={`mt-1 text-sm ${textColors.tertiary}`}>{subtitle}</p>}
        </div>
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
};
