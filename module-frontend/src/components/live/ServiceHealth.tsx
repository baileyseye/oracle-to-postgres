import { LIVE_SERVICES } from '../../data/live';
import { useLiveMode } from '../../hooks/useLiveMode';
import {
  HEALTH_LABEL,
  formatCheckedAt,
  healthDescription,
  healthDotClass,
  healthTextClass,
} from '../../lib/live-format';
import { cn } from '../../lib/cn';

interface ServiceHealthStripProps {
  readonly className?: string;
}

export function ServiceHealthStrip({ className }: ServiceHealthStripProps) {
  const { mode, health, healthSummary } = useLiveMode();

  if (mode !== 'live') {
    return null;
  }

  const services = LIVE_SERVICES.map((service) => health[service.id]);

  return (
    <div
      aria-label="Доступность сервисов"
      className={cn(
        'inline-flex items-center gap-2 rounded-md border border-line bg-surface/45 px-2 py-1',
        className,
      )}
      role="group"
    >
      <span
        className={cn(
          'hidden font-mono text-[8px] sm:inline',
          healthSummary.status === 'up'
            ? 'text-ok'
            : healthSummary.status === 'degraded'
              ? 'text-warn'
              : healthSummary.status === 'down'
                ? 'text-danger'
                : 'text-muted/60',
        )}
      >
        {healthSummary.up}/{healthSummary.total}
      </span>
      <span
        aria-hidden="true"
        className="hidden h-3 w-px bg-line sm:block"
      />
      <span className="flex items-center gap-1.5">
        {services.map((service) => (
          <span
            aria-label={`${service.name}, порт ${service.port}: ${healthDescription(service.status)}`}
            className={cn(
              'h-1.5 w-1.5 rounded-full',
              healthDotClass(service.status),
            )}
            key={service.id}
            role="img"
            title={`${service.name} :${service.port} — ${HEALTH_LABEL[service.status]}`}
          />
        ))}
      </span>
    </div>
  );
}

interface ServiceHealthListProps {
  readonly compact?: boolean;
}

export function ServiceHealthList({
  compact = false,
}: ServiceHealthListProps) {
  const { mode, health, lastHealthCheckedAt } = useLiveMode();

  if (mode !== 'live') {
    return (
      <p className="font-mono text-[9px] leading-relaxed text-muted/55">
        DEMO работает без бэкенда. LIVE подключается к 8081–8084.
      </p>
    );
  }

  const services = LIVE_SERVICES.map((service) => health[service.id]);

  return (
    <div className={cn('space-y-1.5', compact && 'space-y-1')}>
      {services.map((service) => (
        <div
          className="flex items-center justify-between gap-3"
          key={service.id}
        >
          <span className="flex min-w-0 items-center gap-2">
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                healthDotClass(service.status),
              )}
            />
            <span className="truncate font-mono text-[9px] text-text/75">
              {service.name}
            </span>
          </span>
          <span
            className={cn(
              'shrink-0 font-mono text-[8px]',
              healthTextClass(service.status),
            )}
          >
            {HEALTH_LABEL[service.status]}
            {service.latencyMs !== null ? ` · ${service.latencyMs}ms` : ''}
          </span>
        </div>
      ))}
      <p className="pt-1 font-mono text-[8px] text-muted/45">
        checked {formatCheckedAt(lastHealthCheckedAt)}
      </p>
    </div>
  );
}
