import { Play } from 'lucide-react';
import { MODE_CARDS, MODE_COMPARISON } from '../data/modes';
import { useMigrationMode } from '../hooks/useMigrationMode';
import { cn } from '../lib/cn';
import { MigrationModeSwitch } from '../components/architecture/MigrationModeSwitch';
import { Container } from '../components/ui/Container';
import { Reveal } from '../components/ui/Reveal';
import { ScrollFade } from '../components/ui/ScrollFade';

export function Modes() {
  const { mode } = useMigrationMode();

  return (
    <section className="relative py-24 sm:py-28" id="modes">
      <Container>
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between 2xl:gap-8">
            <div className="max-w-2xl">
              <h2 className="font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                Два режима переноса
              </h2>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted sm:text-base">
                initial-load — контролируемый cutover с остановкой. mirror —
                работа без простоя через staging и migration_entity_map.
                Переключатель синхронизирован с архитектурой.
              </p>
            </div>
            <div className="w-full lg:max-w-[400px]">
              <MigrationModeSwitch label="режим" />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10 grid gap-4 md:grid-cols-2 2xl:gap-5">
            {MODE_CARDS.map((card) => {
              const active = card.id === mode;

              return (
                <article
                  className={cn(
                    'panel relative overflow-hidden p-5 transition-colors sm:p-6',
                    active
                      ? 'border-electric/35 bg-surface/55'
                      : 'bg-surface/25',
                  )}
                  key={card.id}
                >
                  {active ? (
                    <span
                      aria-hidden="true"
                      className="migration-line absolute inset-x-0 top-0"
                    />
                  ) : null}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn(
                          'status-led',
                          active ? 'text-electric' : 'text-muted/70',
                        )}
                      />
                      <span className="font-mono text-caption text-text">
                        {card.title}
                      </span>
                    </div>
                    <span
                      className={cn(
                        'rounded border px-1.5 py-0.5 font-mono text-micro',
                        active
                          ? 'border-electric/30 bg-electric/10 text-electric'
                          : 'border-line bg-surface/50 text-muted/70',
                      )}
                    >
                      {card.badge}
                    </span>
                  </div>
                  <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
                    {card.summary}
                  </p>
                  <ul className="mt-4 grid gap-1.5 sm:grid-cols-2">
                    {card.facts.map((fact) => (
                      <li
                        className="flex items-start gap-2 font-mono text-micro leading-relaxed text-muted/75"
                        key={fact}
                      >
                        <span
                          aria-hidden="true"
                          className={cn(
                            'mt-[6px] h-1 w-1 shrink-0 rounded-full',
                            active ? 'bg-electric/80' : 'bg-muted/40',
                          )}
                        />
                        {fact}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>

          <div className="panel mt-4 overflow-hidden">
            <ScrollFade
              aria-label="Сравнение режимов"
              className="overflow-x-auto"
            >
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    <th
                      className="w-[26%] px-4 py-3 font-mono text-micro font-normal text-muted"
                      scope="col"
                    >
                      критерий
                    </th>
                    <th
                      className={cn(
                        'w-[37%] border-l border-line px-4 py-3 font-mono text-caption font-normal',
                        mode === 'initial-load'
                          ? 'bg-surface/50 text-text'
                          : 'text-muted',
                      )}
                      scope="col"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-oracle"
                        />
                        initial-load
                      </span>
                    </th>
                    <th
                      className={cn(
                        'w-[37%] border-l border-line px-4 py-3 font-mono text-caption font-normal',
                        mode === 'mirror'
                          ? 'bg-surface/50 text-text'
                          : 'text-muted',
                      )}
                      scope="col"
                    >
                      <span className="inline-flex items-center gap-2">
                        <span
                          aria-hidden="true"
                          className="h-1.5 w-1.5 rounded-full bg-electric"
                        />
                        mirror
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {MODE_COMPARISON.map((row) => (
                    <tr
                      className="border-b border-line/60 last:border-b-0"
                      key={row.criterion}
                    >
                      <th
                        className="px-4 py-3 text-left font-mono text-micro font-normal text-muted/75"
                        scope="row"
                      >
                        {row.criterion}
                      </th>
                      <td
                        className={cn(
                          'border-l border-line/60 px-4 py-3 text-caption leading-relaxed',
                          mode === 'initial-load'
                            ? 'bg-surface/35 text-text/85'
                            : 'text-muted/70',
                        )}
                      >
                        {row.initialLoad}
                      </td>
                      <td
                        className={cn(
                          'border-l border-line/60 px-4 py-3 text-caption leading-relaxed',
                          mode === 'mirror'
                            ? 'bg-surface/35 text-text/85'
                            : 'text-muted/70',
                        )}
                      >
                        {row.mirror}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </ScrollFade>
          </div>

          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-line bg-surface/35 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="max-w-[70ch]">
              <p className="font-mono text-micro text-electric">
                почему initial-load — дефолт
              </p>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted/85">
                Один проход COPY без upsert/adoption/stale, коммит на чанк,
                resume с MAX(id) и validation, которая блокирует запуск
                приложения при расхождении. mirror оправдан, когда простой
                недопустим.
              </p>
            </div>
            <a
              className="inline-flex shrink-0 items-center gap-2 rounded-md border border-line bg-surface/60 px-3 py-2 font-mono text-micro text-muted transition-colors hover:border-electric/40 hover:text-text"
              href="#pipeline"
            >
              <Play aria-hidden="true" className="h-3 w-3" />
              к симуляции
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
