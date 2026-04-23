import { textColors } from '@/lib/theme';

interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: string;
  action?: React.ReactNode;
}

export const PageHeader = ({ title, subtitle, action }: PageHeaderProps) => {
  return (
    <div className="flex justify-between items-start">
      <div>
        <h1 className={`text-2xl font-bold tracking-tight ${textColors.primary}`}>{title}</h1>
        {subtitle && <p className={`mt-1 text-sm ${textColors.tertiary}`}>{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2">{action}</div>}
    </div>
  );
};
