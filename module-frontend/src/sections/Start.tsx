import { useState } from 'react';
import {
  ArrowUpRight,
  CircleCheck,
  Rocket,
  ShieldCheck,
} from 'lucide-react';
import { SchemaOwnerSwitch } from '../components/architecture/SchemaOwnerSwitch';
import { StartStepCard } from '../components/start/StartStepCard';
import { Reveal } from '../components/ui/Reveal';
import { getStartScenario, START_SHELL_OPTIONS } from '../data/start';
import { SITE } from '../data/site';
import { getSchemaOwnerOption } from '../lib/architecture';
import { cn } from '../lib/cn';
import { githubBlobUrl } from '../lib/github';
import type { SchemaOwnerId } from '../types/architecture';
import type { StartShell } from '../types/start';

const START_LINKS = [
  {
    label: 'README: сборка и запуск',
    href: SITE.readmeUrl,
    hint: 'runbook',
  },
  {
    label: 'Frontend README',
    href: githubBlobUrl('module-frontend/README.md'),
    hint: 'DEMO / LIVE',
  },
  {
    label: 'Postman: data migration',
    href: githubBlobUrl(
      'postman/oracle-to-postgres.postman_collection.json',
    ),
    hint: 'collection',
  },
  {
    label: 'Postman: schema migration',
    href: githubBlobUrl('postman/schema-migration.postman_collection.json'),
    hint: 'collection',
  },
] as const;

export function Start() {
  const [owner, setOwner] = useState<SchemaOwnerId>('public');
  const [shell, setShell] = useState<StartShell>('bash');
  const schemaOption = getSchemaOwnerOption(owner);
  const scenario = getStartScenario(owner, shell);

  return (
    <section className="relative py-24 sm:py-28" id="start">
      <div className="mx-auto w-full max-w-[1240px] px-5 sm:px-8">
        <Reveal>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-2 rounded-md border border-line bg-surface/55 px-2.5 py-1 font-mono text-[9px] text-muted">
                <Rocket aria-hidden="true" className="h-3.5 w-3.5 text-electric" />
                docker compose → LIVE
              </span>
              <h2 className="mt-4 font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                Старт
              </h2>
              <p className="mt-4 max-w-[64ch] text-[15px] leading-7 text-muted sm:text-base">
                Шесть шагов от пустого окружения до данных в PostgreSQL и
                работающей LIVE-панели. Выберите владельца target-схемы и
                оболочку — команды ниже останутся реальными.
              </p>
            </div>
            <div className="flex flex-wrap gap-1.5 font-mono text-[8.5px] text-muted/60 lg:justify-end">
              <span className="rounded border border-line bg-bg/30 px-2 py-1">
                6 шагов
              </span>
              <span className="rounded border border-line bg-bg/30 px-2 py-1">
                4 модуля
              </span>
              <span className="rounded border border-line bg-bg/30 px-2 py-1">
                2 сценария
              </span>
              <span className="rounded border border-line bg-bg/30 px-2 py-1">
                Java 25 · Node 20+
              </span>
            </div>
          </div>
        </Reveal>

        <div className="mt-10 grid gap-6 lg:grid-cols-12">
          <div className="min-w-0 space-y-4 lg:col-span-8">
            {scenario.steps.map((step, index) => (
              <Reveal delay={Math.min(index * 0.03, 0.15)} key={step.id}>
                <StartStepCard index={index + 1} step={step} />
              </Reveal>
            ))}
          </div>

          <aside className="space-y-4 self-start lg:sticky lg:top-24 lg:col-span-4">
            <div className="panel overflow-hidden">
              <div className="border-b border-line px-4 py-3">
                <h3 className="font-mono text-[10px] text-muted/70">
                  сценарий target
                </h3>
              </div>
              <div className="p-4">
                <SchemaOwnerSwitch onChange={setOwner} value={owner} />

                <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 border-t border-line pt-3 font-mono text-[9px]">
                  <dt className="text-muted/50">schema</dt>
                  <dd className="text-text/80">{schemaOption.label}</dd>
                  <dt className="text-muted/50">owner</dt>
                  <dd className="truncate text-text/80">
                    {schemaOption.ownerModule}
                  </dd>
                  <dt className="text-muted/50">step</dt>
                  <dd className="text-text/80">{schemaOption.schemaStep}</dd>
                </dl>

                <p className="mt-3 text-[11px] leading-relaxed text-muted/70">
                  {schemaOption.detail}
                </p>

                <div className="mt-4 border-t border-line pt-3">
                  <span className="font-mono text-[9px] text-muted/60">
                    оболочка команд
                  </span>
                  <div
                    aria-label="Оболочка команд"
                    className="mt-2 grid grid-cols-2 gap-1 rounded-lg border border-line bg-surface/45 p-1"
                    role="group"
                  >
                    {START_SHELL_OPTIONS.map((option) => {
                      const active = option.id === shell;

                      return (
                        <button
                          aria-pressed={active}
                          className={cn(
                            'rounded-md px-2 py-1.5 text-left transition-colors',
                            active
                              ? 'bg-surface-2 text-text'
                              : 'text-muted hover:bg-surface/80 hover:text-text',
                          )}
                          key={option.id}
                          onClick={() => setShell(option.id)}
                          type="button"
                        >
                          <span className="block font-mono text-[9.5px]">
                            {option.label}
                          </span>
                          <span
                            className={cn(
                              'mt-0.5 block font-mono text-[8px]',
                              active ? 'text-text/55' : 'text-muted/45',
                            )}
                          >
                            {option.hint}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>

            <div className="panel p-4">
              <h3 className="inline-flex items-center gap-2 font-mono text-[10px] text-muted/70">
                <ShieldCheck
                  aria-hidden="true"
                  className="h-3.5 w-3.5 text-ok"
                />
                перед запуском
              </h3>
              <ul className="mt-3 space-y-2">
                {scenario.checklist.map((item) => (
                  <li
                    className="flex items-start gap-2 text-[10.5px] leading-relaxed text-muted/75"
                    key={item}
                  >
                    <CircleCheck
                      aria-hidden="true"
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-ok/80"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="panel p-4">
              <h3 className="font-mono text-[10px] text-muted/70">
                материалы
              </h3>
              <ul className="mt-3 space-y-1">
                {START_LINKS.map((link) => (
                  <li key={link.label}>
                    <a
                      className="group flex items-center justify-between gap-3 border-b border-line/60 py-2 text-[11.5px] text-muted transition-colors hover:text-text"
                      href={link.href}
                      rel="noreferrer"
                      target="_blank"
                    >
                      <span className="inline-flex min-w-0 items-center gap-1.5">
                        <span className="truncate">{link.label}</span>
                        <ArrowUpRight
                          aria-hidden="true"
                          className="h-3 w-3 shrink-0 text-muted/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                        />
                      </span>
                      <span className="shrink-0 font-mono text-[8px] text-muted/40">
                        {link.hint}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
              <a
                className="mt-3 inline-flex items-center gap-1.5 font-mono text-[9px] text-electric/80 transition-colors hover:text-electric"
                href="#api"
              >
                LIVE-консоль и контракт API →
              </a>
            </div>
          </aside>
        </div>

        <Reveal delay={0.1}>
          <div className="mt-4 flex flex-col gap-1 rounded-lg border border-line bg-surface/35 px-4 py-3 font-mono text-[8.5px] leading-relaxed text-muted/50 sm:flex-row sm:items-center sm:justify-between">
            <span>
              Минимальный путь: docker compose → build → выбранная схема →
              async run → LIVE
            </span>
            <span className="text-muted/35">
              pre/post SQL, resume и validation — в README
            </span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
