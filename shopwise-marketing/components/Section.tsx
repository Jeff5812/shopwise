import type { ComponentPropsWithoutRef } from 'react';

export type SectionTone = 'cream' | 'paper' | 'sand' | 'ink' | 'brand';

type SectionProps = ComponentPropsWithoutRef<'section'> & {
  /** Full-width background band. Alternate tones to give the page rhythm. */
  tone?: SectionTone;
};

const tones: Record<SectionTone, string> = {
  cream: '',
  paper: 'border-y border-border-soft bg-card',
  sand: 'bg-sand/50',
  ink: 'on-dark bg-ink text-cream',
  brand: 'bg-brand text-on-brand',
};

export function Section({ tone = 'cream', className, children, ...props }: SectionProps) {
  const classes = ['section', tones[tone], className].filter(Boolean).join(' ');
  return (
    <section className={classes} {...props}>
      <div className="page-shell">{children}</div>
    </section>
  );
}
