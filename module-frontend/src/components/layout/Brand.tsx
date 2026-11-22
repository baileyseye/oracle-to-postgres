import { cn } from '../../lib/cn';
import { Logo } from './Logo';

interface BrandProps {
  readonly className?: string;
  readonly wordmarkClassName?: string;
  readonly onNavigate?: () => void;
}

export function Brand({
  className,
  wordmarkClassName,
  onNavigate,
}: BrandProps) {
  return (
    <a
      aria-label="oracle-to-postgres — к началу страницы"
      className={cn(
        'inline-flex min-w-0 items-center gap-2.5 rounded-md text-text',
        className,
      )}
      href="#top"
      onClick={onNavigate}
    >
      <Logo className="h-8 w-8 shrink-0" />
      <span className={cn('min-w-0', wordmarkClassName)}>
        <span className="block whitespace-nowrap font-display text-[15px] font-semibold leading-none tracking-[-0.035em]">
          oracle<span className="mx-px text-electric">→</span>postgres
        </span>
        <span className="mt-1 hidden whitespace-nowrap font-mono text-micro leading-none text-muted/80 sm:block">
          консоль миграции
        </span>
      </span>
    </a>
  );
}
