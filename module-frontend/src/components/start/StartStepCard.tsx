import { ShieldAlert, Terminal } from 'lucide-react';
import { cn } from '../../lib/cn';
import type { StartStep } from '../../types/start';
import { CopyBlock } from '../ui/CopyBlock';

interface StartStepCardProps {
  readonly step: StartStep;
  readonly index: number;
}

export function StartStepCard({ step, index }: StartStepCardProps) {
  const warning = step.noteTone === 'warning';

  return (
    <article className="panel relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-px bg-[linear-gradient(180deg,var(--color-electric)_0%,var(--color-magenta)_55%,transparent_100%)] opacity-70"
      />
      <div className="grid gap-4 p-4 sm:grid-cols-[44px_1fr] sm:p-5">
        <div>
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-line bg-bg/45 font-mono text-caption text-electric">
            {String(index).padStart(2, '0')}
          </span>
        </div>
        <div className="min-w-0">
          <h3 className="font-display text-lg font-medium leading-snug">
            {step.title}
          </h3>
          <p className="mt-1.5 max-w-[75ch] text-[12.5px] leading-relaxed text-muted/80">
            {step.description}
          </p>

          <div className="mt-3 space-y-2">
            {step.commands.map((command) => (
              <CopyBlock
                key={`${step.id}-${command.label}`}
                label={command.label}
                maxHeightClass="max-h-[180px]"
                value={command.value}
              />
            ))}
          </div>

          {step.note ? (
            <p
              className={cn(
                'mt-3 flex items-start gap-2 rounded border px-2.5 py-2 text-caption leading-relaxed',
                warning
                  ? 'border-warn/25 bg-warn/5 text-warn/85'
                  : 'border-line bg-bg/30 text-muted/70',
              )}
            >
              {warning ? (
                <ShieldAlert
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0"
                />
              ) : (
                <Terminal
                  aria-hidden="true"
                  className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted/80"
                />
              )}
              <span>{step.note}</span>
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
