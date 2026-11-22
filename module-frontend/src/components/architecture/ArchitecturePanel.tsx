import {
  ArrowUpRight,
  Database,
  Server,
  Table2,
} from 'lucide-react';
import { useMigrationMode } from '../../hooks/useMigrationMode';
import { useLiveMode } from '../../hooks/useLiveMode';
import { NODE_HEALTH_SERVICE } from '../../data/live';
import { isArchitectureNodeActive } from '../../lib/architecture';
import { cn } from '../../lib/cn';
import {
  HEALTH_LABEL,
  healthDotClass,
  healthTextClass,
} from '../../lib/live-format';
import type {
  ArchitectureAccent,
  ArchitectureNode,
  SchemaOwnerId,
} from '../../types/architecture';

const ACCENT_COLOR: Record<ArchitectureAccent, string> = {
  oracle: 'var(--color-oracle)',
  pg: 'var(--color-pg)',
  electric: 'var(--color-electric)',
  magenta: 'var(--color-magenta)',
};

const ACCENT_TINT: Record<ArchitectureAccent, string> = {
  oracle: 'rgba(199, 70, 52, 0.12)',
  pg: 'rgba(51, 103, 145, 0.18)',
  electric: 'rgba(56, 189, 248, 0.12)',
  magenta: 'rgba(217, 70, 239, 0.12)',
};

const ACCENT_BORDER: Record<ArchitectureAccent, string> = {
  oracle: 'rgba(199, 70, 52, 0.45)',
  pg: 'rgba(51, 103, 145, 0.55)',
  electric: 'rgba(56, 189, 248, 0.42)',
  magenta: 'rgba(217, 70, 239, 0.45)',
};

interface ArchitecturePanelProps {
  readonly node: ArchitectureNode;
  readonly schemaOwner: SchemaOwnerId;
}

function NodeIcon({ node }: { readonly node: ArchitectureNode }) {
  const className = 'h-[18px] w-[18px]';

  if (node.kind === 'database') {
    return <Database aria-hidden="true" className={className} />;
  }

  if (node.kind === 'table') {
    return <Table2 aria-hidden="true" className={className} />;
  }

  return <Server aria-hidden="true" className={className} />;
}

export function ArchitecturePanel({
  node,
  schemaOwner,
}: ArchitecturePanelProps) {
  const { mode } = useMigrationMode();
  const { mode: runtimeMode, health } = useLiveMode();
  const accent = ACCENT_COLOR[node.accent];
  const modeNote = node.modeNotes?.[mode];
  const serviceId = NODE_HEALTH_SERVICE[node.id];
  const serviceHealth =
    runtimeMode === 'live' && serviceId ? health[serviceId] : null;
  const disabled = !isArchitectureNodeActive(node, schemaOwner);
  const modeBadge = disabled
    ? 'не участвует'
    : node.id === 'postgres-db'
      ? schemaOwner
      : node.modeBadges?.[mode];

  const schemaNote =
    disabled && node.id === 'module-postgres'
      ? 'В варианте auto_migration этот модуль не участвует: схему создаёт module-schema-migration.'
      : disabled && node.id === 'module-schema-migration'
        ? 'В варианте public этот модуль не участвует: схему создаёт Liquibase module-postgres.'
        : node.id === 'module-migration'
          ? `Схема ${schemaOwner} должна быть готова до запуска /run: таблицы создаёт не module-migration.${schemaOwner === 'auto_migration' ? ' Target задаётся через TARGET_POSTGRES_SCHEMA.' : ''}`
          : node.id === 'postgres-db'
            ? `Активная схема — ${schemaOwner}. Второй владелец в этом варианте не используется.`
            : null;
  const schemaNoteLabel = disabled ? 'в этом варианте' : 'target-схема';

  return (
    <aside
      aria-label="Детали узла архитектуры"
      className="panel scroll-area relative min-w-0 overflow-hidden"
      id="architecture-panel"
    >
      <p aria-live="polite" className="sr-only">
        {node.title}, {node.role}
      </p>
      <div aria-hidden="true" className="migration-line opacity-80" />
      <div className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border"
            style={{
              backgroundColor: ACCENT_TINT[node.accent],
              borderColor: ACCENT_BORDER[node.accent],
              color: accent,
            }}
          >
            <NodeIcon node={node} />
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {modeBadge ? (
              <span
                className="rounded border px-1.5 py-0.5 font-mono text-[9px]"
                style={{
                  borderColor: ACCENT_BORDER[node.accent],
                  color: accent,
                }}
              >
                {modeBadge}
              </span>
            ) : null}
            {node.port ? (
              <span className="rounded border border-line bg-bg/40 px-1.5 py-0.5 font-mono text-[9px] text-muted">
                :{node.port}
              </span>
            ) : null}
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 font-mono text-[9.5px] text-muted">
          <span
            aria-hidden="true"
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: accent }}
          />
          {node.role}
        </div>
        <h3 className="mt-1.5 break-words font-mono text-[17px] leading-snug text-text">
          {node.title}
        </h3>
        <p className="mt-1 font-mono text-[11px] text-muted">{node.subtitle}</p>

        {serviceHealth ? (
          <div
            className="mt-3 flex items-center justify-between gap-3 rounded-md border border-line bg-bg/30 px-2.5 py-1.5 font-mono text-[9px]"
            title={serviceHealth.error ?? undefined}
          >
            <span className="inline-flex items-center gap-2 text-muted/65">
              <span
                aria-hidden="true"
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  healthDotClass(serviceHealth.status),
                )}
              />
              health
            </span>
            <span className={healthTextClass(serviceHealth.status)}>
              {HEALTH_LABEL[serviceHealth.status]}
              {serviceHealth.latencyMs !== null
                ? ` · ${serviceHealth.latencyMs}ms`
                : ''}
            </span>
          </div>
        ) : null}

        <p className="mt-4 text-[13px] leading-relaxed text-muted">
          {node.description}
        </p>

        {schemaNote ? (
          <div className="mt-4 rounded-md border border-electric/20 bg-electric/5 p-3">
            <p className="font-mono text-[9.5px] text-electric/80">
              {schemaNoteLabel}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text/80">
              {schemaNote}
            </p>
          </div>
        ) : null}

        {node.apiPrefix ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-md border border-line bg-bg/35 px-3 py-2 font-mono text-[10px]">
            <span className="text-muted/80">API</span>
            <span className="truncate text-text/90">{node.apiPrefix}</span>
          </div>
        ) : null}

        {modeNote ? (
          <div className="mt-4 rounded-md border border-line bg-surface/45 p-3">
            <p className="font-mono text-[9.5px] text-muted/80">
              в режиме {mode}
            </p>
            <p className="mt-1.5 text-[12.5px] leading-relaxed text-text/80">
              {modeNote}
            </p>
          </div>
        ) : null}

        <div className="mt-5 border-t border-line pt-4">
          <p className="font-mono text-[9.5px] text-muted/80">
            {node.keyItemsLabel}
          </p>
          <ul className="mt-2 space-y-1">
            {node.keyItems.map((item) => (
              <li key={item.name}>
                <a
                  className="group flex max-w-full items-start gap-1.5 py-0.5 font-mono text-[11px] text-muted transition-colors hover:text-text"
                  href={item.href}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="min-w-0 break-words">{item.name}</span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="mt-0.5 h-3 w-3 shrink-0 text-muted/60 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                  />
                </a>
              </li>
            ))}
          </ul>
        </div>

        <a
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-md border border-line bg-surface/60 px-3 text-xs text-text transition-colors hover:border-electric/40 hover:bg-surface-2"
          href={node.githubUrl}
          rel="noreferrer"
          target="_blank"
        >
          Открыть на GitHub
          <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
        </a>
      </div>
    </aside>
  );
}
