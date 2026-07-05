import { pageHeaderTitleStyle, textColors, cn } from '@/lib/theme';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}

export const PageHeader = ({ title, subtitle, action }: PageHeaderProps) => {
  return (
    // v15 `.page-header` — flex space-between, align flex-start, gap 16, mb 8.
    <div className="mb-2 flex items-start justify-between gap-4">
      <div>
        {/* v15 `.page-title` — geometry + toss strong color, owner-mandated 24px scale (lib/theme.ts). */}
        <h1 className={pageHeaderTitleStyle}>{title}</h1>
        {subtitle && <p className={cn('mt-1 text-sm', textColors.tertiary)}>{subtitle}</p>}
      </div>
      {/* v15 `.page-header .actions` — flex, gap 8, align center, wrap, justify flex-end. */}
      {action && <div className="flex flex-wrap items-center justify-end gap-2">{action}</div>}
    </div>
  );
};
