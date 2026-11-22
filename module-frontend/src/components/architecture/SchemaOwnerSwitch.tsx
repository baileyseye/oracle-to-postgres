import { SCHEMA_OWNER_OPTIONS } from '../../data/architecture';
import { cn } from '../../lib/cn';
import type { SchemaOwnerId } from '../../types/architecture';

interface SchemaOwnerSwitchProps {
  readonly value: SchemaOwnerId;
  readonly onChange: (value: SchemaOwnerId) => void;
}

export function SchemaOwnerSwitch({ value, onChange }: SchemaOwnerSwitchProps) {
  return (
    <div className="mt-2 flex flex-col gap-1 rounded-xl border border-line bg-surface/45 p-1 sm:flex-row sm:items-center">
      <span className="shrink-0 px-2 font-mono text-[9px] text-muted/80">
        схема
      </span>
      <div
        aria-label="Владелец target-схемы"
        className="flex flex-1 flex-col gap-1 sm:flex-row"
        role="group"
      >
        {SCHEMA_OWNER_OPTIONS.map((option) => {
          const active = option.id === value;

          return (
            <button
              aria-label={`${option.label}, ${option.shortDescription}`}
              aria-pressed={active}
              className={cn(
                'relative flex flex-1 items-center justify-between gap-2 rounded-md px-2.5 py-2 text-left transition-colors',
                active
                  ? 'bg-surface-2 text-text'
                  : 'text-muted hover:bg-surface/80 hover:text-text',
              )}
              key={option.id}
              onClick={() => onChange(option.id)}
              title={option.ownerModule}
              type="button"
            >
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    'status-led',
                    active ? 'text-electric' : 'text-muted/50',
                  )}
                />
                <span className="font-mono text-[10px]">{option.label}</span>
              </span>
              <span
                className={cn(
                  'whitespace-nowrap font-mono text-[9px]',
                  active ? 'text-text/65' : 'text-muted/65',
                )}
              >
                {option.shortDescription}
              </span>
              {active ? (
                <span
                  aria-hidden="true"
                  className="migration-line absolute inset-x-2 bottom-0"
                />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
