import { useEffect } from 'react';
import { useMigrationSimulation } from '../hooks/useMigrationSimulation';
import { useLiveMode } from '../hooks/useLiveMode';
import { PipelineStepper } from '../components/pipeline/PipelineStepper';
import { SimulationPanel } from '../components/pipeline/SimulationPanel';
import { Reveal } from '../components/ui/Reveal';
import { Container } from '../components/ui/Container';

export function Pipeline() {
  const simulation = useMigrationSimulation();
  const { reset } = simulation;
  const { mode: runtimeMode } = useLiveMode();

  useEffect(() => {
    if (runtimeMode === 'live') {
      reset();
    }
  }, [runtimeMode, reset]);

  return (
    <section
      className="relative py-24 sm:py-28"
      id="pipeline"
    >
      <Container>
        <Reveal>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between 2xl:gap-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                Пайплайн initial-load
              </h2>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted sm:text-base">
                Десять фаз от плана таблиц до validation gate. Схема должна быть
                готова заранее — её создаёт{' '}
                <code className="font-mono text-[0.9em] text-text/90">
                  module-postgres
                </code>{' '}
                или{' '}
                <code className="font-mono text-[0.9em] text-text/90">
                  module-schema-migration
                </code>{' '}
                (см. архитектуру).
              </p>
            </div>
            <div className="flex flex-col gap-2 font-mono text-micro text-muted/70 lg:items-end">
              <span>
                {runtimeMode === 'live'
                  ? 'LIVE: реальный async job'
                  : 'детерминированная симуляция'}
              </span>
              <a
                className="inline-flex items-center gap-1.5 text-muted transition-colors hover:text-text"
                href="#modes"
              >
                сравнить с mirror →
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 grid min-w-0 gap-6 xl:grid-cols-12 xl:items-start 2xl:gap-8">
            <div className="order-1 min-w-0 xl:order-2 xl:col-span-5 xl:sticky xl:top-[var(--sticky-top)]">
              <SimulationPanel simulation={simulation} />
            </div>
            <div className="order-2 min-w-0 xl:order-1 xl:col-span-7">
              <PipelineStepper snapshot={simulation.snapshot} />
              <p className="mt-4 pl-10 font-mono text-micro leading-relaxed text-muted/70">
                Все сниппеты взяты из реальных файлов module-migration;
                симуляция не запускает API и не меняет БД.
              </p>
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
