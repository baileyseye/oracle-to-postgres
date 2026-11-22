import { API_SERVICES } from '../data/api';
import { SITE } from '../data/site';
import { ApiEndpoints } from '../components/api/ApiEndpoints';
import { LiveConsole } from '../components/api/LiveConsole';
import { Reveal } from '../components/ui/Reveal';

export function Api() {
  const endpointCount = API_SERVICES.reduce(
    (total, service) => total + service.endpoints.length,
    0,
  );

  return (
    <section className="relative py-24 sm:py-28" id="api">
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <h2 className="font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                API миграции
              </h2>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted sm:text-base">
                Read-only health, status, schema diff и tables для LIVE-панели.
                Опасные операции остаются за armed-режимом и подтверждением
                MIGRATE. Здесь же — полный контракт эндпоинтов 8083 и 8084.
              </p>
            </div>
            <div className="flex flex-col gap-2 font-mono text-[9px] text-muted/65 lg:items-end">
              <span>
                {API_SERVICES.length} сервиса · {endpointCount} endpoints
              </span>
              <a
                className="text-muted transition-colors hover:text-text"
                href={SITE.readmeUrl}
                rel="noreferrer"
                target="_blank"
              >
                README: API и коды ответов →
              </a>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="mt-10">
            <LiveConsole />
          </div>
        </Reveal>

        <Reveal delay={0.12}>
          <div className="mt-6 space-y-4">
            {API_SERVICES.map((service) => (
              <ApiEndpoints key={service.id} service={service} />
            ))}
          </div>
        </Reveal>

        <Reveal delay={0.16}>
          <div className="mt-4 flex flex-col gap-2 rounded-lg border border-line bg-surface/35 px-4 py-3 font-mono text-[8.5px] leading-relaxed text-muted/50 sm:flex-row sm:items-center sm:justify-between">
            <span>
              UI base URL: VITE_ORACLE_BASE / VITE_POSTGRES_BASE /
              VITE_MIGRATION_BASE / VITE_SCHEMA_BASE
            </span>
            <span className="text-muted/35">
              dev: Vite proxy /api/* → 8081–8084 · prod: nginx
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
