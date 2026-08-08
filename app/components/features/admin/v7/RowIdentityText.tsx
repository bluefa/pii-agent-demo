import { cn, numericFeatures, rowLabelColor, textColors } from '@/lib/theme';

/**
 * The three text atoms of the infra-row identity block, shared by the /services list
 * (InfraRow) and the 인프라 등록 step-4 candidate cards so an account reads the same
 * way in the place it is proposed and the place it lives. Presentation only — every
 * rule about WHICH of them a provider gets belongs to the caller.
 */

/** The word naming the kind of id that follows it — "Account", "Subscription", "Project". */
export const KindWord = ({ children }: { children: React.ReactNode }) => (
  <span className={cn('text-[12px]', rowLabelColor)}>{children}</span>
);

/**
 * An account id or GUID — shown whole; a truncated id is not an id.
 *
 * `medium`, not `semibold`: the provider name is the row's subject and the id is
 * what qualifies it. At the same weight the two competed, and a 20-character GUID
 * won on sheer length.
 */
export const IdValue = ({ children }: { children: React.ReactNode }) => (
  <span
    className={cn(
      'text-[14px] font-medium tracking-[-0.01em]',
      textColors.primary,
      numericFeatures.tabular,
    )}
  >
    {children}
  </span>
);

export const MetaPair = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <span className="flex items-center gap-1.5">
    <span className={cn('text-[12px]', rowLabelColor)}>{label}</span>
    {children}
  </span>
);
