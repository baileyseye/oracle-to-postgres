import { STRATEGY_CARDS } from '../data/modes';
import { SITE } from '../data/site';
import { cn } from '../lib/cn';
import type { StrategyStatus } from '../types/modes';
import { Reveal } from '../components/ui/Reveal';
import { Container } from '../components/ui/Container';

const STATUS_STYLE: Record<StrategyStatus, string> = {
  implemented: 'border-ok/30 bg-ok/10 text-ok',
  supported: 'border-warn/30 bg-warn/10 text-warn',
  external: 'border-line bg-surface/60 text-muted',
};

const ACCENT: Record<string, string> = {
  stop: 'from-oracle/80 via-oracle/20 to-transparent',
  hybrid: 'from-magenta/70 via-magenta/20 to-transparent',
  cdc: 'from-electric/60 via-electric/15 to-transparent',
};

export function Why() {
  return (
    <section className="relative py-24 sm:py-28" id="why">
      <Container>
        <Reveal>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                Зачем так
              </h2>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted sm:text-base">
                Три стратегии перехода и цена каждой. В репозитории реализованы
                initial-load и mirror; CDC — внешняя альтернатива, а не
                обещание проекта.
              </p>
            </div>
            <a
              className="inline-flex shrink-0 items-center gap-1.5 font-mono text-micro text-muted transition-colors hover:text-text"
              href={SITE.readmeUrl}
              rel="noreferrer"
              target="_blank"
            >
              README: режимы переноса →
            </a>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="panel mt-10 grid overflow-hidden lg:grid-cols-3 lg:divide-x lg:divide-line">
            {STRATEGY_CARDS.map((strategy) => (
              <article
                className="relative flex flex-col border-b border-line p-5 last:border-b-0 sm:p-6 lg:border-b-0"
                key={strategy.id}
              >
                <div
                  aria-hidden="true"
                  className={cn(
                    'absolute inset-x-0 top-0 h-px bg-gradient-to-r',
                    ACCENT[strategy.id],
                  )}
                />
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={cn(
                      'rounded border px-1.5 py-0.5 font-mono text-micro',
                      STATUS_STYLE[strategy.status],
                    )}
                  >
                    {strategy.statusLabel}
                  </span>
                  <span className="font-mono text-micro text-muted/70">
                    {strategy.status === 'external' ? 'вручную' : 'в репо'}
                  </span>
                </div>
                <h3 className="mt-4 font-display text-xl font-medium">
                  {strategy.title}
                </h3>
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  {strategy.summary}
                </p>

                <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line/70 pt-4">
                  {strategy.metrics.map((metric) => (
                    <div key={metric.label}>
                      <dt className="font-mono text-micro text-muted/80">
                        {metric.label}
                      </dt>
                      <dd className="mt-0.5 text-micro leading-snug text-text/80">
                        {metric.value}
                      </dd>
                    </div>
                  ))}
                </dl>

                <p className="mt-auto pt-5 text-caption leading-relaxed text-muted/80">
                  {strategy.note}
                </p>
              </article>
            ))}
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-surface/35 px-4 py-3.5 sm:flex-row sm:items-start">
            <span className="shrink-0 font-mono text-micro text-electric">
              вывод
            </span>
            <p className="text-[12.5px] leading-relaxed text-muted/85">
              <span className="text-text/85">initial-load — дефолт</span> не
              потому, что он модный, а потому что он короче: один проход,
              сохранённые source id, коммит на чанк и validation, которая
              блокирует cutover при расхождении. mirror нужен, когда простой
              недопустим; цена — mapping, stale и одна большая target-транзакция.
            </p>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
