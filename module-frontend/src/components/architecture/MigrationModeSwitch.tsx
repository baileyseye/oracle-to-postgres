import { MIGRATION_MODE_OPTIONS } from '../../data/architecture';
import { useMigrationMode } from '../../hooks/useMigrationMode';
import { cn } from '../../lib/cn';

interface MigrationModeSwitchProps {
  readonly label?: string;
}

export function MigrationModeSwitch({ label }: MigrationModeSwitchProps) {
  const { mode, setMode } = useMigrationMode();

  return (
    <div className="flex w-full flex-col gap-1 rounded-xl border border-line bg-surface/55 p-1 sm:flex-row sm:items-center">
      {label ? (
        <span className="shrink-0 px-2 font-mono text-micro text-muted/80">
          {label}
        </span>
      ) : null}
      <div
        aria-label="Режим миграции"
        className="flex flex-1 flex-col gap-1 sm:flex-row"
        role="group"
      >
        {MIGRATION_MODE_OPTIONS.map((option) => {
          const active = option.id === mode;

          return (
            <button
              aria-label={`${option.label}, ${option.shortDescription}`}
              aria-pressed={active}
              className={cn(
                'relative flex flex-1 items-center justify-between gap-2 rounded-lg px-2.5 py-2.5 text-left transition-colors',
                active
                  ? 'bg-surface-2 text-text'
                  : 'text-muted hover:bg-surface/80 hover:text-text',
              )}
              key={option.id}
              onClick={() => setMode(option.id)}
              type="button"
            >
              <span className="inline-flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className={cn(
                    'status-led',
                    active ? 'text-electric' : 'text-muted/70',
                  )}
                />
                <span className="font-mono text-micro whitespace-nowrap">
                  {option.label}
                </span>
              </span>
              <span
                className={cn(
                  'whitespace-nowrap text-caption',
                  active ? 'text-text/70' : 'text-muted/70',
                )}
              >
                {option.shortDescription}
              </span>
              {active ? (
                <span
                  aria-hidden="true"
                  className="migration-line absolute inset-x-3 bottom-0"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
