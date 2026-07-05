/**
 * IdentityBar — the provider/recipe identity strip (design-inventory §2.3/§2.4
 * `.idbar`). Shared by the target page (provider variant: i-cloud + provider
 * label + TargetSourceId + CSP metadata groups) and the pipeline page (flow
 * variant: i-flow + recipe name + type/생성/마지막 활동 + 대상 link + recipe note).
 *
 * 4px left accent stripe = the provider brand var, injected as `--ib-accent`
 * (inline style) so the stripe + picon color-mix recolor per provider.
 */
import type { CSSProperties, ReactElement, ReactNode } from 'react';
import { cn } from '@/lib/theme';
import { Icon, type IconName } from '@/app/integration/admin/pipelines/_components/icons';
import { detailStyles } from '@/app/integration/admin/pipelines/_detail/detailStyles';

export interface IdentityField {
  key: ReactNode;
  value: ReactNode;
}

export interface IdentityBarProps {
  /** CSS var NAME of the provider accent, e.g. '--pl-pv-aws' (providerAccentVar). */
  accentVar: string;
  icon: IconName;
  pname: ReactNode;
  psub?: ReactNode;
  psubMono?: boolean;
  /** Inline fields; each is preceded by a hairline divider. */
  fields?: IdentityField[];
  /** Rendered after a flex spacer (e.g. the 대상 field + drill-down link). */
  trailing?: ReactNode;
  /** idbar-meta content (CSP groups or recipe note); omitted when absent. */
  meta?: ReactNode;
  className?: string;
}

export function IdentityBar({
  accentVar,
  icon,
  pname,
  psub,
  psubMono,
  fields = [],
  trailing,
  meta,
  className,
}: IdentityBarProps): ReactElement {
  const s = detailStyles.idbar;
  const style = { '--ib-accent': `var(${accentVar})` } as CSSProperties;
  return (
    <div className={cn(s.bar, className)} style={style}>
      <span className={s.stripe} aria-hidden="true" />
      <div className={s.row}>
        <div className={s.prov}>
          <span className={s.picon}>
            <Icon name={icon} size="lg" />
          </span>
          <div>
            <div className={s.pname}>{pname}</div>
            {psub != null && <div className={psubMono ? s.psubMono : s.psub}>{psub}</div>}
          </div>
        </div>
        {fields.map((field, index) => (
          <span key={index} className="contents">
            <span className={s.div} aria-hidden="true" />
            <div className={s.fld}>
              <span className={s.fldKey}>{field.key}</span>
              <span className={s.fldValue}>{field.value}</span>
            </div>
          </span>
        ))}
        {trailing != null && (
          <>
            <span className={s.spacer} aria-hidden="true" />
            {trailing}
          </>
        )}
      </div>
      {meta != null && <div className={s.meta}>{meta}</div>}
    </div>
  );
}

/** A single idbar field (used inside `trailing`). */
export function IdentityFieldBlock({ label, value }: { label: ReactNode; value: ReactNode }): ReactElement {
  const s = detailStyles.idbar;
  return (
    <div className={s.fld}>
      <span className={s.fldKey}>{label}</span>
      <span className={s.fldValue}>{value}</span>
    </div>
  );
}
