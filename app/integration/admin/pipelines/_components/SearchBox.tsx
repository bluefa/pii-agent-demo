/**
 * SearchBox — h32 text input with an inset i-search icon (design-inventory §5,
 * input pl-30). Width comes from `wrapClassName` (e.g. 'w-[240px]' or 'block').
 */
import type { InputHTMLAttributes, ReactElement } from 'react';
import { cn, pipelineStyles } from '@/lib/theme';
import { Icon } from '@/app/integration/admin/pipelines/_components/icons';

export interface SearchBoxProps extends InputHTMLAttributes<HTMLInputElement> {
  wrapClassName?: string;
}

export function SearchBox({ wrapClassName, className, type = 'text', ...rest }: SearchBoxProps): ReactElement {
  const { searchBox } = pipelineStyles;
  return (
    <span className={cn(searchBox.wrap, wrapClassName)}>
      <span className={searchBox.icon}>
        <Icon name="search" size="sm" />
      </span>
      <input type={type} className={cn(searchBox.input, className)} {...rest} />
    </span>
  );
}
