import { Check, Copy } from 'lucide-react';
import { useCopyFeedback } from '../../hooks/useCopyFeedback';
import { cn } from '../../lib/cn';

interface CopyBlockProps {
  readonly label: string;
  readonly value: string;
  readonly className?: string;
  readonly maxHeightClass?: string;
}

export function CopyBlock({
  label,
  value,
  className,
  maxHeightClass = 'max-h-[280px]',
}: CopyBlockProps) {
  const { copied, copy } = useCopyFeedback();

  return (
    <div className={cn('overflow-hidden rounded-md border border-line bg-bg/60', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-line bg-surface/50 px-2.5 py-1.5">
        <span className="truncate font-mono text-[8.5px] text-muted/60">
          {label}
        </span>
        <button
          aria-label={copied ? `${label} скопирован` : `Скопировать ${label}`}
          className="inline-flex h-6 items-center gap-1 rounded border border-line bg-surface/70 px-1.5 font-mono text-[8px] text-muted transition-colors hover:border-electric/40 hover:text-text"
          onClick={() => {
            void copy(value);
          }}
          type="button"
        >
          {copied ? (
            <Check aria-hidden="true" className="h-3 w-3 text-ok" />
          ) : (
            <Copy aria-hidden="true" className="h-3 w-3" />
          )}
          <span aria-live="polite">
            {copied ? 'Скопировано ✓' : 'Копировать'}
          </span>
        </button>
      </div>
      <pre
        className={cn(
          'scroll-area overflow-auto p-2.5 font-mono text-[9.5px] leading-relaxed text-text/80',
          maxHeightClass,
        )}
        tabIndex={0}
      >
        {value}
      </pre>
    </div>
  );
}
