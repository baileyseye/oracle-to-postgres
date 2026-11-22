import { cn } from '../../lib/cn';
import { useLiveMode } from '../../hooks/useLiveMode';

interface RuntimeModeSwitchProps {
  readonly className?: string;
  readonly size?: 'sm' | 'md';
}

export function RuntimeModeSwitch({
  className,
  size = 'sm',
}: RuntimeModeSwitchProps) {
  const { mode, setMode, healthSummary } = useLiveMode();
  const liveStatus = healthSummary.status;
  const liveLed =
    liveStatus === 'up'
      ? 'text-ok'
      : liveStatus === 'degraded'
        ? 'text-warn'
        : liveStatus === 'checking'
          ? 'text-electric'
          : 'text-danger';

  return (
    <div
      aria-label="Режим работы"
      className={cn(
        'inline-flex items-center rounded-md border border-line bg-surface/60 p-0.5',
        className,
      )}
      role="group"
    >
      <button
        aria-label="DEMO — симуляция без бэкенда"
        aria-pressed={mode === 'demo'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded font-mono transition-colors',
          size === 'sm'
            ? 'px-1.5 py-1 text-micro'
            : 'px-3 py-2 text-caption',
          mode === 'demo'
            ? 'bg-surface-2 text-text'
            : 'text-muted hover:text-text',
        )}
        onClick={() => setMode('demo')}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            'h-1.5 w-1.5 rounded-full',
            mode === 'demo' ? 'bg-ok' : 'bg-muted/30',
          )}
        />
        demo
      </button>
      <button
        aria-label="LIVE — реальные сервисы"
        aria-pressed={mode === 'live'}
        className={cn(
          'inline-flex items-center gap-1.5 rounded font-mono transition-colors',
          size === 'sm'
            ? 'px-1.5 py-1 text-micro'
            : 'px-3 py-2 text-caption',
          mode === 'live'
            ? 'bg-surface-2 text-text'
            : 'text-muted hover:text-text',
        )}
        onClick={() => setMode('live')}
        type="button"
      >
        <span
          aria-hidden="true"
          className={cn(
            'status-led',
            mode === 'live' ? liveLed : 'text-muted/30',
          )}
        />
        live
      </button>
    </div>
  );
}
