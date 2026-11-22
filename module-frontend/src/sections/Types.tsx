import { TYPE_MAPPINGS, UNSUPPORTED_OBJECTS } from '../data/type-mappings';
import { TypeFidelity as TypeFidelityView } from '../components/types/TypeFidelity';
import { Reveal } from '../components/ui/Reveal';

export function Types() {
  const warningCount = TYPE_MAPPINGS.filter(
    (row) => row.level === 'warning',
  ).length;

  return (
    <section className="relative py-24 sm:py-28" id="types">
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                Типы и fidelity
              </h2>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted sm:text-base">
                Маппинг Oracle → PostgreSQL из PostgresTypeMapper.{' '}
                <code className="font-mono text-[0.9em] text-warn/90">
                  warning
                </code>{' '}
                не прячется: такие колонки нужно проверить до production.
                Unsupported-объекты не генерируются автоматически.
              </p>
            </div>
            <dl className="grid grid-cols-3 gap-x-6 gap-y-2 font-mono text-[9px] text-muted/65 lg:text-right">
              <div>
                <dt className="text-muted/45">строк</dt>
                <dd className="mt-0.5 text-text/80">{TYPE_MAPPINGS.length}</dd>
              </div>
              <div>
                <dt className="text-muted/45">warning</dt>
                <dd className="mt-0.5 text-warn/90">{warningCount}</dd>
              </div>
              <div>
                <dt className="text-muted/45">unsupported</dt>
                <dd className="mt-0.5 text-muted/80">
                  {UNSUPPORTED_OBJECTS.length}
                </dd>
              </div>
            </dl>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10">
            <TypeFidelityView />
          </div>
        </Reveal>
      </div>
    </section>
  );
}
