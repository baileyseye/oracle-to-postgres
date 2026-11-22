import type { HeroStat } from '../../types/site';
import { useCountUp } from '../../hooks/useCountUp';
import { formatCount } from '../../lib/format';

interface HeroStatCellProps {
  readonly stat: HeroStat;
}

function HeroStatCell({ stat }: HeroStatCellProps) {
  const displayedValue = useCountUp(stat.value);

  return (
    <div className="bg-bg/85 px-4 py-6 sm:px-6 sm:py-7">
      <div className="flex items-baseline gap-2">
        <span
          aria-hidden="true"
          className="font-display text-[2.1rem] font-medium leading-none tracking-[-0.045em] text-text tabular-nums sm:text-[2.65rem]"
        >
          {formatCount(displayedValue)}
        </span>
        <span className="sr-only">{formatCount(stat.value)}</span>
      </div>
      <p className="mt-2 text-[13px] leading-snug text-text/80">
        {stat.label}
      </p>
      <p className="mt-1 break-words font-mono text-[10px] leading-relaxed text-muted/80">
        {stat.detail}
      </p>
    </div>
  );
}

interface TelemetryRailProps {
  readonly stats: readonly HeroStat[];
}

export function TelemetryRail({ stats }: TelemetryRailProps) {
  return (
    <div className="mt-16 sm:mt-20">
      <div aria-hidden="true" className="migration-line opacity-50" />
      <section
        aria-label="Ключевые параметры миграции"
        className="border-b border-line bg-surface/20"
      >
        <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
          <div className="grid grid-cols-2 gap-px bg-line lg:grid-cols-4">
            {stats.map((stat) => (
              <HeroStatCell key={stat.detail} stat={stat} />
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
