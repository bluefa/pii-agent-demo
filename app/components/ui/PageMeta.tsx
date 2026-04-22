import { textColors } from '@/lib/theme';

interface PageMetaItem {
  label: string;
  value: React.ReactNode;
}

interface PageMetaProps {
  items: PageMetaItem[];
}

export const PageMeta = ({ items }: PageMetaProps) => {
  return (
    <dl className="flex flex-wrap gap-7">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex flex-col gap-0.5">
          <dt className={`text-[11px] uppercase tracking-wide font-medium ${textColors.tertiary} whitespace-nowrap`}>
            {item.label}
          </dt>
          <dd className={`text-sm font-medium ${textColors.primary}`}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
};
