import {
  useCallback,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Ban,
  Check,
  Clock,
  Database,
  Play,
  RefreshCw,
  Shield,
  WifiOff,
} from 'lucide-react';
import { LIVE_SERVICES } from '../../data/live';
import { useLiveMode } from '../../hooks/useLiveMode';
import { cn } from '../../lib/cn';
import {
  DEV_SEED_AVAILABLE,
  DevSeedError,
  seedLargeOracleDataset,
} from '../../lib/dev-seed';
import { formatCount } from '../../lib/format';
import {
  formatCheckedAt,
  HEALTH_LABEL,
  healthDotClass,
  healthTextClass,
} from '../../lib/live-format';
import type { LiveResourceStatus } from '../../types/live';
import {
  DangerConfirmModal,
  type DangerousAction,
} from './DangerConfirmModal';
import { LiveJobPanel } from '../pipeline/LiveJobPanel';
import { RuntimeModeSwitch } from '../live/RuntimeModeSwitch';
import { TrafficDots } from '../ui/TrafficDots';

const RESOURCE_LABEL: Record<LiveResourceStatus, string> = {
  idle: 'idle',
  loading: 'loading',
  ready: 'live',
  offline: 'offline',
  error: 'error',
};

interface ResourceCardProps {
  readonly title: string;
  readonly service: string;
  readonly status: LiveResourceStatus;
  readonly updatedAt: string | null;
  readonly error: string | null;
  readonly onRetry: () => void;
  readonly children: ReactNode;
}

function ResourceCard({
  title,
  service,
  status,
  updatedAt,
  error,
  onRetry,
  children,
}: ResourceCardProps) {
  const offline = status === 'offline' || status === 'error';

  return (
    <article className="min-w-0 rounded-lg border border-line bg-bg/25 p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-mono text-[10px] text-text/85">{title}</h4>
          <p className="mt-0.5 font-mono text-[8px] text-muted/50">
            {service}
          </p>
        </div>
        <span
          className={cn(
            'shrink-0 rounded border px-1.5 py-0.5 font-mono text-[8px]',
            status === 'ready'
              ? 'border-ok/25 bg-ok/10 text-ok'
              : status === 'loading'
                ? 'border-electric/25 bg-electric/10 text-electric'
                : offline
                  ? 'border-warn/25 bg-warn/10 text-warn'
                  : 'border-line bg-surface/50 text-muted/55',
          )}
        >
          {RESOURCE_LABEL[status]}
        </span>
      </div>

      <div className="mt-3">
        {status === 'loading' ? (
          <p className="mb-2 font-mono text-[8.5px] text-electric/65">
            обновление…
          </p>
        ) : null}
        {offline ? (
          <div className="rounded border border-warn/20 bg-warn/5 px-2.5 py-2">
            <p className="flex items-start gap-1.5 text-[10.5px] leading-relaxed text-warn/85">
              <WifiOff
                aria-hidden="true"
                className="mt-0.5 h-3.5 w-3.5 shrink-0"
              />
              {error ?? 'Сервис недоступен'}
            </p>
            <button
              className="mt-2 inline-flex items-center gap-1 font-mono text-[8.5px] text-muted hover:text-text"
              onClick={onRetry}
              type="button"
            >
              <RefreshCw aria-hidden="true" className="h-3 w-3" />
              повторить
            </button>
          </div>
        ) : (
          children
        )}
      </div>

      {updatedAt ? (
        <p className="mt-2 border-t border-line/60 pt-1.5 font-mono text-[8px] text-muted/35">
          updated {formatCheckedAt(updatedAt)}
        </p>
      ) : null}
    </article>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly tone?: 'ok' | 'warn' | 'danger' | 'muted';
}) {
  return (
    <div>
      <dt className="font-mono text-[8px] text-muted/50">{label}</dt>
      <dd
        className={cn(
          'mt-0.5 font-mono text-[10px]',
          tone === 'ok'
            ? 'text-ok'
            : tone === 'warn'
              ? 'text-warn'
              : tone === 'danger'
                ? 'text-danger'
                : tone === 'muted'
                  ? 'text-muted/70'
                  : 'text-text/80',
        )}
      >
        {value}
      </dd>
    </div>
  );
}

function ActionSummary() {
  const { action } = useLiveMode();

  if (action.running) {
    return (
      <div className="mt-3 flex items-center gap-2 rounded border border-electric/20 bg-electric/5 px-3 py-2">
        <span className="status-led text-electric" />
        <p className="font-mono text-[9.5px] text-electric">
          выполняется {action.kind ?? 'операция'}…
        </p>
      </div>
    );
  }

  if (action.error) {
    return (
      <div
        className="mt-3 rounded border border-danger/25 bg-danger/5 px-3 py-2"
        role="alert"
      >
        <p className="text-[11px] leading-relaxed text-danger/85">
          {action.error}
        </p>
      </div>
    );
  }

  if (action.report) {
    const report = action.report;

    return (
      <div className="mt-3 rounded border border-ok/20 bg-ok/5 px-3 py-2.5">
        <p className="font-mono text-[9px] text-ok">
          migration report · {report.mode}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
          <Metric label="users read" value={report.usersRead} />
          <Metric
            label="users inserted / updated"
            value={`${report.usersInserted} / ${report.usersUpdated}`}
          />
          <Metric label="orders read" value={report.ordersRead} />
          <Metric
            label="orders inserted / updated"
            value={`${report.ordersInserted} / ${report.ordersUpdated}`}
          />
          <Metric
            label="validation"
            tone={
              report.validation
                ? report.validation.valid
                  ? 'ok'
                  : 'danger'
                : 'muted'
            }
            value={
              report.validation
                ? report.validation.valid
                  ? 'passed'
                  : 'failed'
                : 'n/a'
            }
          />
          <Metric
            label="source scn"
            tone="muted"
            value={report.sourceScn ?? '—'}
          />
        </dl>
      </div>
    );
  }

  if (action.schemaReport) {
    const report = action.schemaReport;

    return (
      <div
        className={cn(
          'mt-3 rounded border px-3 py-2.5',
          report.success
            ? 'border-ok/20 bg-ok/5'
            : 'border-warn/20 bg-warn/5',
        )}
      >
        <p
          className={cn(
            'font-mono text-[9px]',
            report.success ? 'text-ok' : 'text-warn',
          )}
        >
          schema migration report · {report.targetSchema}
        </p>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
          <Metric label="applied statements" value={report.appliedStatements} />
          <Metric label="total statements" value={report.totalStatements} />
          <Metric
            label="success"
            tone={report.success ? 'ok' : 'danger'}
            value={String(report.success)}
          />
          <Metric label="warnings" value={report.warnings.length} />
        </dl>
        {report.warnings.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {report.warnings.slice(0, 3).map((warning) => (
              <li
                className="font-mono text-[8.5px] leading-relaxed text-warn/75"
                key={warning}
              >
                {warning}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    );
  }

  return null;
}

export function LiveConsole() {
  const { mode } = useLiveMode();

  return <LiveConsoleContent key={mode} />;
}

function LiveConsoleContent() {
  const {
    mode,
    health,
    healthSummary,
    lastHealthCheckedAt,
    refreshHealth,
    data,
    refreshData,
    armed,
    setArmed,
    action,
    startSync,
    startAsync,
    applySchema,
    job,
  } = useLiveMode();
  const [pendingAction, setPendingAction] =
    useState<DangerousAction | null>(null);
  const [seedState, setSeedState] = useState<{
    readonly running: boolean;
    readonly error: string | null;
    readonly output: string | null;
    readonly completedAt: string | null;
  }>({
    running: false,
    error: null,
    output: null,
    completedAt: null,
  });
  const seedInFlight = useRef(false);
  const closeModal = useCallback(() => setPendingAction(null), []);

  const healthItems = useMemo(
    () => LIVE_SERVICES.map((service) => health[service.id]),
    [health],
  );
  const migrationStatus = data.migrationStatus.data;
  const schemaDiff = data.schemaDiff.data;
  const schemaStatus = data.schemaStatus.data;
  const tables = data.tables.data;
  const migrationUp = health.migration.status === 'up';
  const schemaUp = health.schema.status === 'up';
  const jobRunning = job.data?.status === 'RUNNING';
  const actionsBlocked = action.running;

  const runDevSeed = async () => {
    if (
      !DEV_SEED_AVAILABLE ||
      seedInFlight.current ||
      seedState.running ||
      actionsBlocked ||
      jobRunning
    ) {
      return;
    }

    seedInFlight.current = true;
    setSeedState({
      running: true,
      error: null,
      output: null,
      completedAt: null,
    });

    try {
      const result = await seedLargeOracleDataset();

      setSeedState({
        running: false,
        error: null,
        output: result.output ?? null,
        completedAt: new Date().toISOString(),
      });
      refreshData();
    } catch (error) {
      setSeedState({
        running: false,
        error:
          error instanceof Error
            ? error.message
            : 'Не удалось загрузить большой датасет',
        output: error instanceof DevSeedError ? error.output : null,
        completedAt: new Date().toISOString(),
      });
    } finally {
      seedInFlight.current = false;
    }
  };

  const confirm = () => {
    const next = pendingAction;
    closeModal();

    if (next === 'sync') {
      void startSync();
    } else if (next === 'async') {
      void startAsync();
    } else if (next === 'apply') {
      void applySchema();
    } else if (next === 'seed') {
      void runDevSeed();
    }
  };

  return (
    <>
      <div className="panel overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
          <div className="flex min-w-0 items-center gap-3">
            <TrafficDots />
            <span className="truncate font-mono text-[10px] text-muted">
              LIVE-консоль
            </span>
          </div>
          <RuntimeModeSwitch size="md" />
        </div>

        {mode === 'demo' ? (
          <div className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-medium">
                  LIVE выключен
                </h3>
                <p className="mt-1.5 max-w-[75ch] text-[12.5px] leading-relaxed text-muted/80">
                  Включите LIVE, чтобы читать реальные health, migration status,
                  schema diff и source tables. Если ни один модуль не ответит,
                  интерфейс автоматически вернётся в DEMO.
                </p>
              </div>
              <span className="rounded border border-line bg-bg/30 px-2 py-1 font-mono text-[8.5px] text-muted/55">
                Vite proxy · /api/*
              </span>
            </div>
            <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
              {LIVE_SERVICES.map((service) => (
                <div className="bg-bg/65 px-3 py-2.5" key={service.id}>
                  <div className="flex items-center gap-1.5 font-mono text-[8.5px] text-text/70">
                    <span
                      aria-hidden="true"
                      className="h-1.5 w-1.5 rounded-full bg-muted/30"
                    />
                    {service.name}
                  </div>
                  <p className="mt-1 font-mono text-[8px] text-muted/45">
                    :{service.port} · не проверен
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-4 font-mono text-[9px] leading-relaxed text-muted/45">
              Base URL: VITE_ORACLE_BASE, VITE_POSTGRES_BASE,
              VITE_MIGRATION_BASE, VITE_SCHEMA_BASE. По умолчанию — alias
              /api/oracle, /api/postgres, /api/migration, /api/schema.
            </p>
          </div>
        ) : (
          <div className="space-y-4 p-4 sm:p-5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-[10px] text-muted/70">
                  health · 4 сервиса
                </h3>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[8px] text-muted/40">
                    checked {formatCheckedAt(lastHealthCheckedAt)}
                  </span>
                  <button
                    className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-1 font-mono text-[8px] text-muted hover:text-text"
                    onClick={refreshHealth}
                    type="button"
                  >
                    <RefreshCw aria-hidden="true" className="h-3 w-3" />
                    health
                  </button>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5 lg:grid-cols-4">
                {healthItems.map((service) => (
                  <div
                    className="rounded-md border border-line bg-bg/30 px-2.5 py-2"
                    key={service.id}
                    title={service.error ?? undefined}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-mono text-[8.5px] text-text/70">
                        {service.name}
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          'h-1.5 w-1.5 shrink-0 rounded-full',
                          healthDotClass(service.status),
                        )}
                      />
                    </div>
                    <div className="mt-1 flex items-center justify-between gap-2 font-mono text-[8px]">
                      <span className="text-muted/45">:{service.port}</span>
                      <span className={healthTextClass(service.status)}>
                        {HEALTH_LABEL[service.status]}
                        {service.latencyMs !== null
                          ? ` · ${service.latencyMs}ms`
                          : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1.5 font-mono text-[8px] text-muted/35">
                health: {healthSummary.status} · {healthSummary.up}/
                {healthSummary.total}
              </p>
            </div>

            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-mono text-[10px] text-muted/70">
                  read-only статус
                </h3>
                <button
                  className="inline-flex items-center gap-1 rounded border border-line px-1.5 py-1 font-mono text-[8px] text-muted hover:text-text"
                  onClick={refreshData}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" className="h-3 w-3" />
                  data
                </button>
              </div>
              <div className="mt-2 grid gap-1.5 lg:grid-cols-2">
                <ResourceCard
                  error={data.migrationStatus.error}
                  onRetry={refreshData}
                  service="module-migration :8083"
                  status={data.migrationStatus.status}
                  title="migration status"
                  updatedAt={data.migrationStatus.updatedAt}
                >
                  {migrationStatus ? (
                    <dl className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <Metric
                        label="source users / orders"
                        value={`${migrationStatus.sourceUsers} / ${migrationStatus.sourceOrders}`}
                      />
                      <Metric
                        label="target users / orders"
                        value={`${migrationStatus.targetUsers} / ${migrationStatus.targetOrders}`}
                      />
                      <Metric
                        label="managed users"
                        value={migrationStatus.targetManagedUsers}
                      />
                      <Metric
                        label="managed orders"
                        value={migrationStatus.targetManagedOrders}
                      />
                    </dl>
                  ) : null}
                </ResourceCard>

                <ResourceCard
                  error={data.schemaDiff.error}
                  onRetry={refreshData}
                  service="module-migration :8083"
                  status={data.schemaDiff.status}
                  title="schema diff"
                  updatedAt={data.schemaDiff.updatedAt}
                >
                  {schemaDiff ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded border px-1.5 py-0.5 font-mono text-[8.5px]',
                            schemaDiff.valid
                              ? 'border-ok/25 bg-ok/10 text-ok'
                              : 'border-danger/25 bg-danger/10 text-danger',
                          )}
                        >
                          {schemaDiff.valid ? 'valid' : 'invalid'}
                        </span>
                        <span className="font-mono text-[8px] text-muted/50">
                          {schemaDiff.sourceSchema} → {schemaDiff.targetSchema}
                        </span>
                      </div>
                      <dl className="mt-2 grid grid-cols-3 gap-x-3 gap-y-2">
                        <Metric
                          label="errors / warnings"
                          tone={schemaDiff.errors > 0 ? 'danger' : 'muted'}
                          value={`${schemaDiff.errors} / ${schemaDiff.warnings}`}
                        />
                        <Metric label="infos" value={schemaDiff.infos} />
                        <Metric
                          label="checked tables"
                          value={schemaDiff.checkedTables}
                        />
                        <Metric
                          label="missing tables / cols / idx"
                          tone={
                            schemaDiff.missingTables +
                              schemaDiff.missingColumns +
                              schemaDiff.missingIndexes >
                            0
                              ? 'warn'
                              : 'muted'
                          }
                          value={`${schemaDiff.missingTables} / ${schemaDiff.missingColumns} / ${schemaDiff.missingIndexes}`}
                        />
                      </dl>
                    </>
                  ) : null}
                </ResourceCard>

                <ResourceCard
                  error={data.schemaStatus.error}
                  onRetry={refreshData}
                  service="module-schema-migration :8084"
                  status={data.schemaStatus.status}
                  title="schema migration status"
                  updatedAt={data.schemaStatus.updatedAt}
                >
                  {schemaStatus ? (
                    <>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={cn(
                            'rounded border px-1.5 py-0.5 font-mono text-[8.5px]',
                            schemaStatus.valid
                              ? 'border-ok/25 bg-ok/10 text-ok'
                              : 'border-warn/25 bg-warn/10 text-warn',
                          )}
                        >
                          {schemaStatus.valid ? 'valid' : 'review'}
                        </span>
                        <span className="font-mono text-[8px] text-muted/50">
                          {schemaStatus.targetExists ? 'target exists' : 'no target'}
                        </span>
                      </div>
                      <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
                        <Metric
                          label="source / target tables"
                          value={`${schemaStatus.sourceTables} / ${schemaStatus.targetTables}`}
                        />
                        <Metric
                          label="missing tables / columns"
                          tone={
                            schemaStatus.missingTables +
                              schemaStatus.missingColumns >
                            0
                              ? 'warn'
                              : 'muted'
                          }
                          value={`${schemaStatus.missingTables} / ${schemaStatus.missingColumns}`}
                        />
                      </dl>
                    </>
                  ) : null}
                </ResourceCard>

                <ResourceCard
                  error={data.tables.error}
                  onRetry={refreshData}
                  service="module-migration :8083"
                  status={data.tables.status}
                  title="source tables"
                  updatedAt={data.tables.updatedAt}
                >
                  {tables ? (
                    <div className="flex flex-wrap gap-1">
                      {tables.slice(0, 12).map((table) => (
                        <code
                          className="rounded border border-line bg-surface/50 px-1.5 py-0.5 font-mono text-[8.5px] text-text/70"
                          key={table}
                        >
                          {table}
                        </code>
                      ))}
                      {tables.length > 12 ? (
                        <span className="font-mono text-[8.5px] text-muted/50">
                          +{tables.length - 12}
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </ResourceCard>
              </div>
            </div>

            {DEV_SEED_AVAILABLE ? (
              <div className="rounded-lg border border-electric/25 bg-electric/[0.035] p-3.5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="inline-flex items-center gap-2 font-mono text-[10px] text-electric/90">
                      <Database aria-hidden="true" className="h-3.5 w-3.5" />
                      demo dataset
                      <span className="rounded border border-electric/25 bg-electric/10 px-1.5 py-0.5 text-[8px]">
                        dev only
                      </span>
                    </h3>
                    <p className="mt-1 max-w-[75ch] text-[11px] leading-relaxed text-muted/75">
                      Заполняет Oracle до 2 000 000 users и 4 000 000 orders.
                      Target-схема не меняется; данные нужны для проверки
                      миграции.
                    </p>
                    <p className="mt-2 font-mono text-[9px] text-muted/50">
                      source сейчас:{' '}
                      {migrationStatus
                        ? `${formatCount(migrationStatus.sourceUsers)} users / ${formatCount(migrationStatus.sourceOrders)} orders`
                        : '—'}
                    </p>
                  </div>
                  <button
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded border border-electric/30 bg-electric/10 px-2.5 font-mono text-[9px] text-electric transition-colors hover:bg-electric/15 disabled:cursor-not-allowed disabled:opacity-35"
                    disabled={
                      seedState.running || actionsBlocked || jobRunning
                    }
                    onClick={() => setPendingAction('seed')}
                    title={
                      jobRunning
                        ? 'Дождитесь завершения async job'
                        : actionsBlocked
                          ? 'Дождитесь завершения текущей операции'
                          : 'Заполнить Oracle большим датасетом'
                    }
                    type="button"
                  >
                    {seedState.running ? (
                      <RefreshCw
                        aria-hidden="true"
                        className="h-3 w-3 animate-spin"
                      />
                    ) : (
                      <Database aria-hidden="true" className="h-3 w-3" />
                    )}
                    {seedState.running
                      ? 'Загрузка…'
                      : 'Загрузить 2M / 4M'}
                  </button>
                </div>

                {seedState.running ? (
                  <p className="mt-2 font-mono text-[8.5px] text-electric/70">
                    выполняется локальный seed-скрипт; это может занять до
                    нескольких минут
                  </p>
                ) : null}

                {seedState.error ? (
                  <div
                    className="mt-3 rounded border border-danger/25 bg-danger/5 px-3 py-2"
                    role="alert"
                  >
                    <p className="text-[11px] leading-relaxed text-danger/85">
                      {seedState.error}
                    </p>
                    {seedState.output ? (
                      <pre className="scroll-area mt-2 max-h-40 overflow-auto whitespace-pre-wrap font-mono text-[8.5px] leading-relaxed text-danger/75">
                        {seedState.output.slice(-1600)}
                      </pre>
                    ) : null}
                  </div>
                ) : null}

                {seedState.completedAt &&
                !seedState.running &&
                !seedState.error ? (
                  <p className="mt-2 inline-flex items-center gap-1.5 font-mono text-[8.5px] text-ok">
                    <Check aria-hidden="true" className="h-3 w-3" />
                    seed завершён · counts обновятся автоматически
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="rounded-lg border border-danger/25 bg-danger/[0.035] p-3.5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h3 className="inline-flex items-center gap-2 font-mono text-[10px] text-danger/90">
                    <Shield aria-hidden="true" className="h-3.5 w-3.5" />
                    изменяющие операции
                  </h3>
                  <p className="mt-1 max-w-[75ch] text-[11px] leading-relaxed text-muted/75">
                    По умолчанию заблокированы. Включите armed-режим и
                    подтвердите каждую операцию словом MIGRATE. Это реально
                    меняет PostgreSQL.
                  </p>
                </div>
                <label className="inline-flex w-full shrink-0 cursor-pointer items-start gap-2 rounded-md border border-line bg-bg/40 px-2.5 py-2 font-mono text-[9px] text-muted sm:w-auto">
                  <input
                    checked={armed}
                    className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[#f87171]"
                    onChange={(event) => setArmed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>
                    <span className="block text-text/75">
                      Разрешить изменяющие операции
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block text-[8px]',
                        armed ? 'text-danger' : 'text-muted/45',
                      )}
                    >
                      {armed ? 'armed · кнопки активны' : 'locked · кнопки заблокированы'}
                    </span>
                  </span>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-danger/30 bg-danger/10 px-2.5 font-mono text-[9px] text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={
                    !armed || actionsBlocked || !migrationUp || jobRunning
                  }
                  onClick={() => setPendingAction('sync')}
                  title={
                    !armed
                      ? 'Сначала включите armed-режим'
                      : !migrationUp
                        ? 'module-migration недоступен'
                        : jobRunning
                          ? 'Уже выполняется async job'
                          : undefined
                  }
                  type="button"
                >
                  <Play aria-hidden="true" className="h-3 w-3" />
                  initial-load sync
                </button>
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-danger/30 bg-danger/10 px-2.5 font-mono text-[9px] text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={
                    !armed ||
                    actionsBlocked ||
                    !migrationUp ||
                    jobRunning
                  }
                  onClick={() => setPendingAction('async')}
                  title={
                    !armed
                      ? 'Сначала включите armed-режим'
                      : !migrationUp
                        ? 'module-migration недоступен'
                        : jobRunning
                          ? 'Уже выполняется async job'
                          : undefined
                  }
                  type="button"
                >
                  <Clock aria-hidden="true" className="h-3 w-3" />
                  initial-load async
                </button>
                <button
                  className="inline-flex h-8 items-center gap-1.5 rounded border border-danger/30 bg-danger/10 px-2.5 font-mono text-[9px] text-danger transition-colors hover:bg-danger/15 disabled:cursor-not-allowed disabled:opacity-35"
                  disabled={!armed || actionsBlocked || !schemaUp}
                  onClick={() => setPendingAction('apply')}
                  title={
                    !armed
                      ? 'Сначала включите armed-режим'
                      : !schemaUp
                        ? 'module-schema-migration недоступен'
                        : 'Применит DDL к auto_migration'
                  }
                  type="button"
                >
                  <Shield aria-hidden="true" className="h-3 w-3" />
                  apply schema DDL
                </button>
              </div>

              {!armed ? (
                <p className="mt-2 flex items-center gap-1.5 font-mono text-[8.5px] text-muted/45">
                  <Ban aria-hidden="true" className="h-3 w-3" />
                  кнопки заблокированы до изменения armed-режима
                </p>
              ) : null}
              {!migrationUp || !schemaUp ? (
                <p className="mt-2 font-mono text-[8.5px] text-warn/65">
                  Часть операций недоступна: {!migrationUp ? '8083 down. ' : ''}
                  {!schemaUp ? '8084 down.' : ''}
                </p>
              ) : null}
              {jobRunning ? (
                <p className="mt-2 font-mono text-[8.5px] text-warn/65">
                  Активный async job уже выполняется; второй запуск получит 409.
                </p>
              ) : null}

              <ActionSummary />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-[8px] text-muted/35">
              <span>
                <Check aria-hidden="true" className="mr-1 inline h-3 w-3 text-ok" />
                polling: health 15s · status 20s
              </span>
              {action.completedAt ? (
                <span>
                  last action {formatCheckedAt(action.completedAt)}
                </span>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {mode === 'live' ? (
        <div className="mt-4">
          <LiveJobPanel />
        </div>
      ) : null}

      <DangerConfirmModal
        action={mode === 'live' ? pendingAction : null}
        onClose={closeModal}
        onConfirm={confirm}
      />
    </>
  );
}
