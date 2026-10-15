import type { ComponentPropsWithoutRef } from 'react';

type SectionProps = ComponentPropsWithoutRef<'section'>;

export function Section({ className, ...props }: SectionProps) {
  return (
    <section
      className={className ? `section ${className}` : 'section'}
      {...props}
    />
  );
}
