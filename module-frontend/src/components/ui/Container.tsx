import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '../../lib/cn';

type ContainerProps = ComponentPropsWithoutRef<'div'>;

export function Container({ className, children, ...rest }: ContainerProps) {
  return (
    <div
      className={cn(
        'mx-auto w-full max-w-[var(--container-shell)] px-5 sm:px-8 xl:px-10',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
