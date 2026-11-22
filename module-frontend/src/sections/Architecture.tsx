import { useCallback, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { ARCHITECTURE_NODES } from '../data/architecture';
import { useLiveMode } from '../hooks/useLiveMode';
import { useMigrationMode } from '../hooks/useMigrationMode';
import { cn } from '../lib/cn';
import {
  getMigrationModeOption,
  getSchemaOwnerOption,
} from '../lib/architecture';
import type {
  ArchitectureNodeId,
  SchemaOwnerId,
} from '../types/architecture';
import { ArchitectureDiagram } from '../components/architecture/ArchitectureDiagram';
import { ArchitecturePanel } from '../components/architecture/ArchitecturePanel';
import { MigrationModeSwitch } from '../components/architecture/MigrationModeSwitch';
import { SchemaOwnerSwitch } from '../components/architecture/SchemaOwnerSwitch';
import { Reveal } from '../components/ui/Reveal';
import { Container } from '../components/ui/Container';
import { TrafficDots } from '../components/ui/TrafficDots';

const DEFAULT_NODE: ArchitectureNodeId = 'module-migration';

export function Architecture() {
  const [selectedId, setSelectedId] =
    useState<ArchitectureNodeId>(DEFAULT_NODE);
  const [schemaOwner, setSchemaOwner] =
    useState<SchemaOwnerId>('public');
  const { mode } = useMigrationMode();
  const { mode: runtimeMode, healthSummary } = useLiveMode();
  const modeOption = getMigrationModeOption(mode);
  const schemaOption = getSchemaOwnerOption(schemaOwner);
  const reduceMotion = useReducedMotion();

  const selectedNode =
    ARCHITECTURE_NODES.find((node) => node.id === selectedId) ??
    ARCHITECTURE_NODES[0];

  const handleSelect = useCallback(
    (id: ArchitectureNodeId) => {
      setSelectedId(id);

      if (window.matchMedia('(max-width: 1023px)').matches) {
        window.requestAnimationFrame(() => {
          document.getElementById('architecture-panel')?.scrollIntoView({
            behavior: reduceMotion ? 'auto' : 'smooth',
            block: 'nearest',
          });
        });
      }
    },
    [reduceMotion],
  );

  return (
    <section
      className="relative py-24 sm:py-28"
      id="architecture"
    >
      <Container>
        <Reveal>
          <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between 2xl:gap-12">
            <div className="max-w-2xl">
              <h2 className="font-display text-[clamp(2.1rem,4.6vw,3.9rem)] font-semibold leading-[1.02] tracking-[-0.045em]">
                Архитектура миграции
              </h2>
              <p className="mt-4 max-w-[62ch] text-[15px] leading-7 text-muted sm:text-base">
                Схему создаёт либо Liquibase{' '}
                <code className="font-mono text-[0.9em] text-text/90">
                  module-postgres
                </code>{' '}
                для public, либо{' '}
                <code className="font-mono text-[0.9em] text-text/90">
                  module-schema-migration
                </code>{' '}
                для auto_migration.{' '}
                <code className="font-mono text-[0.9em] text-text/90">
                  module-migration
                </code>{' '}
                всегда запускается после и только загружает данные.
              </p>
            </div>
            <div className="w-full lg:max-w-[400px]">
              <SchemaOwnerSwitch
                onChange={setSchemaOwner}
                value={schemaOwner}
              />
              <div className="mt-2">
                <MigrationModeSwitch label="данные" />
              </div>
              <div
                aria-atomic="true"
                aria-live="polite"
                className="mt-2.5 rounded-lg border border-line bg-surface/40 px-3 py-2.5 font-mono text-micro leading-relaxed"
              >
                <p className="flex items-start gap-2 text-text/85">
                  <span className="shrink-0 text-muted/70">1 · схема</span>{' '}
                  <span className="break-words">
                    {schemaOption.schemaStep}
                  </span>
                </p>
                <p className="mt-1 flex items-start gap-2 text-text/85">
                  <span className="shrink-0 text-muted/70">2 · данные</span>{' '}
                  <span className="break-words">{modeOption.route}</span>
                </p>
                <p className="mt-1.5 text-muted/75">{schemaOption.detail}</p>
                <p className="mt-0.5 text-muted/75">{modeOption.routeDetail}</p>
              </div>
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.1}>
          <div className="mt-10 grid gap-6 lg:grid-cols-12 lg:items-start 2xl:gap-8">
            <div className="min-w-0 lg:col-span-8">
              <div className="panel min-w-0 overflow-hidden">
                <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-3">
                    <TrafficDots />
                    <span className="truncate font-mono text-caption text-muted">
                      топология / модули и схемы
                    </span>
                  </div>
                  <span className="inline-flex shrink-0 items-center gap-2 font-mono text-micro text-muted">
                    <span
                      aria-hidden="true"
                      className="status-led text-electric"
                    />
                    {mode} · {schemaOwner}
                  </span>
                  {runtimeMode === 'live' ? (
                    <span
                      className="inline-flex shrink-0 items-center gap-1.5 rounded border border-line bg-bg/30 px-1.5 py-0.5 font-mono text-micro text-muted/70"
                      title="Состояние health модулей обновляется каждые 15 секунд"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          'h-1.5 w-1.5 rounded-full',
                          healthSummary.status === 'up'
                            ? 'bg-ok'
                            : healthSummary.status === 'degraded'
                              ? 'bg-warn'
                              : 'bg-danger',
                        )}
                      />
                      health {healthSummary.up}/{healthSummary.total}
                    </span>
                  ) : null}
                </div>

                <div className="p-3 sm:p-4">
                  <div className="min-w-0 pb-1">
                    <div className="mx-auto w-full max-w-[720px]">
                      <ArchitectureDiagram
                        onSelect={handleSelect}
                        schemaOwner={schemaOwner}
                        selectedId={selectedId}
                      />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-1.5 px-1 font-mono text-micro text-muted/75 sm:flex-row sm:items-center sm:justify-between">
                    <span>Клик по узлу — детали</span>
                  </div>
                </div>

                <div className="border-t border-line px-4 py-3">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-micro text-muted/80">
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-oracle"
                      />
                      источник
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-1.5 rounded-full bg-pg"
                      />
                      приёмник
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-px w-5 bg-[image:var(--gradient-migration)]"
                      />
                      активный маршрут данных
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className="h-px w-5 border-t border-dashed border-muted/50"
                      />
                      схемы / владение
                    </span>
                  </div>
                  <p className="mt-2.5 text-micro leading-relaxed text-muted/80">
                    <code className="font-mono text-text/80">public</code>{' '}
                    принадлежит Liquibase{' '}
                    <code className="font-mono text-text/80">
                      module-postgres
                    </code>
                    ; <code className="font-mono text-text/80">auto_migration</code>{' '}
                    создаёт{' '}
                    <code className="font-mono text-text/80">
                      module-schema-migration
                    </code>
                    . Модуль данных пишет только в готовую схему; сначала schema step, затем data step.
                  </p>
                </div>
              </div>
            </div>

            <div className="min-w-0 lg:col-span-4 lg:sticky lg:top-[var(--sticky-top)]">
              <ArchitecturePanel node={selectedNode} schemaOwner={schemaOwner} />
            </div>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
