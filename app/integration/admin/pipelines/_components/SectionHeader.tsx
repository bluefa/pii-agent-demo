/**
 * SectionHeader — section-title (20/600) + optional scope description
 * (design-inventory §5: title margin 64/0/12, first mt-0; desc 4 below title).
 */
import type { ReactElement, ReactNode } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';

export interface SectionHeaderProps {
  title: ReactNode;
  desc?: ReactNode;
  /** First section under the page head — drops the 64px top margin. */
  first?: boolean;
  id?: string;
  className?: string;
}

export function SectionHeader({ title, desc, first, id, className }: SectionHeaderProps): ReactElement {
  const { section } = pipelineStyles;
  return (
    <>
      <h2 id={id} className={cn(first ? section.titleFirst : section.title, className)}>
        {title}
      </h2>
      {desc != null && <p className={section.desc}>{desc}</p>}
    </>
  );
}
