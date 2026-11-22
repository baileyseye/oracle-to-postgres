import { useId } from 'react';
import { useReducedMotion } from 'framer-motion';
import { TrafficDots } from '../ui/TrafficDots';

const FLOW_PATH = 'M 72 2 C 72 58, 348 46, 348 102';

function SourceCard() {
  return (
    <article
      aria-label="Источник Oracle"
      className="terminal border-oracle/25"
    >
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-oracle/80 via-oracle/20 to-transparent"
      />
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
        <TrafficDots />
        <span className="min-w-0 flex-1 truncate text-center font-mono text-caption text-muted/80">
          oracle / FREEPDB1
        </span>
        <span className="border border-oracle/30 bg-oracle/10 px-1.5 py-0.5 font-mono text-micro leading-none text-oracle">
          source
        </span>
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-base font-medium leading-none">
            Oracle
          </p>
          <p className="font-mono text-micro leading-none text-oracle">
            :1521
          </p>
        </div>
        <dl className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="truncate font-mono text-micro text-text/85">
              users
            </dt>
            <dd className="shrink-0 font-mono text-micro text-muted/80">
              keyset
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="truncate font-mono text-micro text-text/85">
              orders
            </dt>
            <dd className="shrink-0 font-mono text-micro text-muted/80">
              copy
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="truncate font-mono text-micro text-text/85">
              insurance_program_users
            </dt>
            <dd className="shrink-0 font-mono text-micro text-muted/80">
              generic
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2 font-mono text-micro text-muted/80">
          <span className="truncate">v$session idle guard</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-ok">
            <span aria-hidden="true" className="status-led" />
            scn
          </span>
        </div>
      </div>
    </article>
  );
}

function TargetCard() {
  return (
    <article
      aria-label="Приёмник PostgreSQL"
      className="terminal border-pg/35"
    >
      <div
        aria-hidden="true"
        className="h-px bg-gradient-to-r from-pg via-electric/40 to-transparent"
      />
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
        <TrafficDots />
        <span className="min-w-0 flex-1 truncate text-center font-mono text-caption text-muted/80">
          postgres / oracletopostgres
        </span>
        <span className="border border-electric/25 bg-electric/10 px-1.5 py-0.5 font-mono text-micro leading-none text-electric">
          target
        </span>
      </div>
      <div className="px-4 pb-4 pt-3">
        <div className="flex items-baseline justify-between gap-3">
          <p className="font-display text-base font-medium leading-none">
            PostgreSQL
          </p>
          <p className="font-mono text-micro leading-none text-electric">
            :5432
          </p>
        </div>
        <dl className="mt-3 space-y-1.5">
          <div className="flex items-center justify-between gap-3">
            <dt className="truncate font-mono text-micro text-text/85">
              public
            </dt>
            <dd className="shrink-0 font-mono text-micro text-muted/80">
              liquibase
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="truncate font-mono text-micro text-text/85">
              auto_migration
            </dt>
            <dd className="shrink-0 font-mono text-micro text-muted/80">
              schema migrator
            </dd>
          </div>
          <div className="flex items-center justify-between gap-3">
            <dt className="truncate font-mono text-micro text-text/85">
              migration_entity_map
            </dt>
            <dd className="shrink-0 font-mono text-micro text-muted/80">
              mapping
            </dd>
          </div>
        </dl>
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-line pt-2 font-mono text-micro text-muted/80">
          <span className="truncate">identity restart</span>
          <span className="inline-flex shrink-0 items-center gap-1.5 text-warn">
            <span aria-hidden="true" className="status-led" />
            validation
          </span>
        </div>
      </div>
    </article>
  );
}

export function SchemaFlow() {
  const gradientId = `flow-${useId().replace(/:/g, '')}`;
  const reduceMotion = useReducedMotion();

  return (
    <div className="relative mx-auto w-full max-w-[440px] 2xl:max-w-[480px]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -inset-8 bg-[radial-gradient(circle_at_25%_18%,rgba(199,70,52,0.13),transparent_55%),radial-gradient(circle_at_78%_82%,rgba(56,189,248,0.11),transparent_55%)]"
      />
      <SourceCard />
      <div className="relative mx-auto aspect-[420/104] w-full">
        <svg
          aria-hidden="true"
          className="absolute inset-0 h-full w-full overflow-visible"
          fill="none"
          preserveAspectRatio="xMidYMid meet"
          viewBox="0 0 420 104"
        >
          <defs>
            <linearGradient
              id={gradientId}
              x1="0"
              x2="1"
              y1="0"
              y2="1"
            >
              <stop offset="0" stopColor="var(--color-oracle)" />
              <stop offset="0.38" stopColor="var(--color-magenta)" />
              <stop offset="0.72" stopColor="var(--color-electric)" />
              <stop offset="1" stopColor="var(--color-pg)" />
            </linearGradient>
          </defs>
          <path
            d={FLOW_PATH}
            stroke={`url(#${gradientId})`}
            strokeOpacity="0.12"
            strokeWidth="7"
          />
          <path
            className="flow-dash"
            d={FLOW_PATH}
            stroke={`url(#${gradientId})`}
            strokeDasharray="3 8"
            strokeWidth="1.4"
          />
          {reduceMotion ? null : (
            <>
              <circle
                className="flow-particle text-electric"
                fill="currentColor"
                r="2.4"
              >
                <animateMotion
                  begin="0s"
                  dur="5.4s"
                  path={FLOW_PATH}
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                className="flow-particle text-magenta"
                fill="currentColor"
                r="2"
              >
                <animateMotion
                  begin="1.8s"
                  dur="5.4s"
                  path={FLOW_PATH}
                  repeatCount="indefinite"
                />
              </circle>
              <circle
                className="flow-particle text-oracle"
                fill="currentColor"
                r="2.2"
              >
                <animateMotion
                  begin="3.6s"
                  dur="5.4s"
                  path={FLOW_PATH}
                  repeatCount="indefinite"
                />
              </circle>
            </>
          )}
        </svg>
        <div className="absolute left-1/2 top-1/2 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-md border border-line bg-bg/95 px-2.5 py-1 font-mono text-micro text-muted shadow-[0_12px_30px_-14px_rgba(0,0,0,0.9)] backdrop-blur">
          <span aria-hidden="true" className="status-led text-electric" />
          COPY
        </div>
      </div>
      <TargetCard />
    </div>
  );
}
