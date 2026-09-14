'use client';

import { CopyButton } from '@/app/components/ui/CopyButton';
import { ChevronDownIcon } from '@/app/components/ui/icons';
import { useLocale } from '@/app/components/LocaleProvider';
import { INSTALL_COPY } from '@/app/components/features/process-status/install-copy';
import {
  bgColors,
  borderColors,
  cn,
  stackGap,
  statusColors,
  textColors,
  textStyles,
} from '@/lib/theme';
import {
  CIDR_PLACEHOLDER,
  type PscSubnetTarget,
} from '@/app/components/features/process-status/gcp/psc-subnet';

interface PscSubnetGuideProps {
  targets: PscSubnetTarget[];
  /**
   * The operator's reading of the same block (admin 인프라 작업 head, 오너 2026-09-14):
   * every Region starts folded (the owner runs the command, the operator only hands
   * it over), the lead asks the operator to REQUEST the subnet from the service owner
   * rather than to create it, and the copy is Korean whatever the root locale says —
   * the admin console is Korean-only.
   */
  admin?: boolean;
}

/**
 * The PSC proxy-subnet commands, one accordion per Region (오너 2026-09-14).
 *
 * The head row (Region · subnet name · how many Cloud SQL it serves · copy) stays
 * visible folded; only the command folds. Copy works folded too, so a reader with
 * many Regions can take each command without opening it. The first Region starts
 * open — the shape of the command is what a first-time reader needs to see once.
 *
 * Spacing is deliberately asymmetric: an open command sits 8px under its head and
 * leaves 16px under itself (오너: 위 좁게, 아래 넓게). The block is a `CommandBlock`
 * in shape (SDU upload) — same border, same head row, same panel-grey `<pre>`.
 */
export const PscSubnetGuide = ({ targets, admin = false }: PscSubnetGuideProps) => {
  const { locale } = useLocale();
  const t = INSTALL_COPY[admin ? 'ko' : locale].gcp;

  return (
    <div className={cn('flex flex-col', stackGap.group)}>
      <p className={cn(textStyles.body, textColors.secondary)}>{admin ? t.pscLeadAdmin : t.pscLead}</p>
      <div className={cn('flex flex-col', stackGap.related)}>
        {targets.map((target, index) => {
          // The comment rides the command: it is copied with it, and prints one tint down.
          const comment = t.pscCommandComment(target.hostProject, target.hostNetwork, target.region);
          const command = `${comment}\n${target.command}`;
          return (
          <details
            key={`${target.hostNetwork}|${target.region}`}
            open={!admin && index === 0}
            className={cn('group/psc overflow-hidden rounded-xl border bg-white', borderColors.default)}
          >
            <summary
              className={cn(
                'flex cursor-pointer select-none items-center gap-2 px-4 py-2.5 list-none [&::-webkit-details-marker]:hidden',
                bgColors.mutedHover,
              )}
            >
              <ChevronDownIcon
                className="h-3.5 w-3.5 flex-shrink-0 transition-transform group-open/psc:rotate-180 motion-reduce:transition-none"
                aria-hidden="true"
              />
              <span className={cn(textStyles.bodyStrong, textColors.primary)}>{target.region}</span>
              <span className={cn('font-mono', textStyles.caption, textColors.secondary)}>
                {target.subnetName}
              </span>
              <span className={cn(textStyles.caption, textColors.tertiary)}>
                {t.pscCovers(target.resourceCount)}
              </span>
              {/* Inside <summary>, a click would also toggle the fold — stop it here. */}
              <span className="ml-auto" onClick={(e) => e.preventDefault()}>
                <CopyButton
                  value={command}
                  label={t.pscCopy(target.region)}
                  className={cn('border bg-white', borderColors.default)}
                />
              </span>
            </summary>
            <div className={cn('border-t', borderColors.light)}>
              <pre
                className={cn(
                  'overflow-x-auto px-4 pt-2 pb-4 font-mono text-[12px] leading-[1.8]',
                  bgColors.panel,
                  textColors.secondary,
                )}
              >
                <span className={textColors.tertiary}>{comment}</span>
                {'\n'}
                {target.command.split(CIDR_PLACEHOLDER).map((part, i, parts) => (
                  <span key={i}>
                    {part}
                    {i < parts.length - 1 && (
                      <mark
                        className={cn(
                          'rounded px-1 font-bold',
                          statusColors.warning.bgSoft,
                          statusColors.warning.textDark,
                        )}
                      >
                        {CIDR_PLACEHOLDER}
                      </mark>
                    )}
                  </span>
                ))}
              </pre>
            </div>
          </details>
          );
        })}
      </div>
      <p className={cn(textStyles.caption, textColors.tertiary)}>{admin ? t.pscCidrNoteAdmin : t.pscCidrNote}</p>
    </div>
  );
};
