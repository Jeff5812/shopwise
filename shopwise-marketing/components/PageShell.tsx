import type { ComponentPropsWithoutRef } from 'react';

type PageShellProps = ComponentPropsWithoutRef<'div'>;

export function PageShell({ className, ...props }: PageShellProps) {
  return (
    <div
      className={className ? `page-shell ${className}` : 'page-shell'}
      {...props}
    />
  );
}
