import { useEffect, useRef } from 'react';
import {
  Check,
  Gauge,
  Pause,
  Play,
  RotateCcw,
  Terminal,
  Timer,
} from 'lucide-react';
import { DEMO_TABLES } from '../../data/simulation';
import { useMigrationMode } from '../../hooks/useMigrationMode';
import type { MigrationSimulationController } from '../../hooks/useMigrationSimulation';
import { useLiveMode } from '../../hooks/useLiveMode';
import { cn } from '../../lib/cn';
import {
  formatCount,
  formatElapsed,
  formatEta,
  formatRate,
} from '../../lib/format';
import type {
  SimulationLogLevel,
  SimulationSpeed,
  SimulationStatus,
} from '../../types/simulation';
import { LiveJobPanel } from './LiveJobPanel';
import { TrafficDots } from '../ui/TrafficDots';

const SPEEDS: readonly SimulationSpeed[] = [1, 2, 4];

const LOG_COLOR: Record<SimulationLogLevel, string> = {
  info: 'text-text/75',
  ok: 'text-ok',
  warn: 'text-warn',
  error: 'text-danger',
};

const STATUS_LABEL: Record<SimulationStatus, string> = {
  idle: 'ждёт запуска',
  running: 'running',
  paused: 'пауза',
  completed: 'passed',
};

const STATUS_COLOR: Record<SimulationStatus, string> = {
  idle: 'text-muted',
  running: 'text-electric',
  paused: 'text-warn',
  completed: 'text-ok',
};

interface TableTickerProps {
  readonly completedTables: readonly string[];
  readonly currentTable: string | null;
}

function TableTicker({ completedTables, currentTable }: TableTickerProps) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-3">
      {DEMO_TABLES.map((table) => {
        const completed = completedTables.includes(table.name);
        const active = currentTable === table.name;
        const statusLabel = completed
          ? 'загружено'
          : active
            ? 'загружается'
            : 'ожидает';

        return (
          <div
            className={cn(
              'flex min-w-0 items-center justify-between gap-2 rounded-md border px-2.5 py-2 transition-colors',
              completed
                ? 'border-ok/25 bg-ok/5'
                : active
                  ? 'border-electric/35 bg-electric/5'
                  : 'border-line bg-bg/25',
            )}
            key={table.name}
          >
            <span className="min-w-0">
              <span className="block truncate font-mono text-micro text-text/75">
                {table.name}
              </span>
              <span className="mt-0.5 block font-mono text-micro text-muted/80">
                {formatCount(table.rows)} строк
              </span>
            </span>
            <span className="sr-only">{statusLabel}</span>
            <span
              aria-hidden="true"
              className={cn(
                'h-1.5 w-1.5 shrink-0 rounded-full',
                completed
                  ? 'bg-ok'
                  : active
                    ? 'status-led text-electric'
                    : 'bg-muted/25',
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

export function SimulationPanel({
  simulation,
}: {
  readonly simulation: MigrationSimulationController;
}) {
  const {
    snapshot,
    start,
    pause,
    reset,
    restart,
    setSpeed,
  } = simulation;
  const { mode } = useMigrationMode();
  const { mode: runtimeMode } = useLiveMode();
  const consoleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = consoleRef.current;

    if (element) {
      element.scrollTop = element.scrollHeight;
    }
  }, [snapshot.logs.length, snapshot.status]);

  if (runtimeMode === 'live') {
    return <LiveJobPanel />;
  }

  const running = snapshot.status === 'running';
  const completed = snapshot.status === 'completed';

  const handlePrimary = () => {
    if (running) {
      pause();
      return;
    }

    if (completed) {
      restart();
      return;
    }

    start();
  };

  const primaryLabel = running
    ? 'Пауза'
    : completed
      ? 'Запустить заново'
      : snapshot.status === 'paused'
        ? 'Продолжить'
        : 'Запустить симуляцию';

  return (
    <div className="panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-2.5">
        <div className="flex min-w-0 items-center gap-3">
          <TrafficDots />
          <span className="truncate font-mono text-caption text-muted">
            async-job / simulation
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded border border-magenta/25 bg-magenta/10 px-1.5 py-0.5 font-mono text-micro text-magenta">
            демо
          </span>
          <span
            className={cn(
              'inline-flex items-center gap-1.5 font-mono text-micro',
              STATUS_COLOR[snapshot.status],
            )}
          >
            <span aria-hidden="true" className="status-led" />
            {STATUS_LABEL[snapshot.status]}
          </span>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="inline-flex items-center gap-2 font-mono text-micro text-muted">
            <Terminal aria-hidden="true" className="h-3.5 w-3.5" />
            initial-load
          </span>
          <span className="rounded border border-line bg-bg/30 px-2 py-1 font-mono text-micro text-muted/80">
            демо-симуляция фаз реального API
          </span>
        </div>

        {mode === 'mirror' ? (
          <p className="mt-3 rounded-md border border-warn/20 bg-warn/5 px-3 py-2 text-micro leading-relaxed text-warn/85">
            В разделе режимов выбран mirror. Эта симуляция фиксирована на
            initial-load — режиме по умолчанию.
          </p>
        ) : null}

        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
            <div className="flex items-center gap-1.5 font-mono text-micro text-muted/70">
              <Gauge aria-hidden="true" className="h-3 w-3" />
              rows
            </div>
            <div className="mt-1 font-mono text-[13px] text-text">
              {formatCount(snapshot.rowsLoaded)}
              <span className="text-muted/80">
                {' '}
                / {formatCount(snapshot.totalRows)}
              </span>
            </div>
          </div>
          <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
            <div className="flex items-center gap-1.5 font-mono text-micro text-muted/70">
              <Gauge aria-hidden="true" className="h-3 w-3" />
              rows/s
            </div>
            <div className="mt-1 font-mono text-[13px] text-text">
              {formatRate(snapshot.rowsPerSecond)}
            </div>
          </div>
          <div className="rounded-md border border-line bg-bg/30 px-2.5 py-2">
            <div className="flex items-center gap-1.5 font-mono text-micro text-muted/70">
              <Timer aria-hidden="true" className="h-3 w-3" />
              eta
            </div>
            <div className="mt-1 font-mono text-[13px] text-text">
              {formatEta(snapshot.etaSeconds)}
            </div>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between gap-2 font-mono text-micro text-muted/70">
            <span>progress</span>
            <span>{snapshot.progress}%</span>
          </div>
          <div
            aria-label="Прогресс симуляции"
            aria-valuemax={100}
            aria-valuemin={0}
            aria-valuenow={snapshot.progress}
            className="h-1.5 overflow-hidden rounded-full bg-surface-2"
            role="progressbar"
          >
            <div
              className="h-full rounded-full bg-[image:var(--gradient-migration)] transition-[width] duration-300"
              style={{ width: `${snapshot.progress}%` }}
            />
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 font-mono text-micro text-muted/70">
            table ticker
          </div>
          <TableTicker
            completedTables={snapshot.completedTables}
            currentTable={snapshot.currentTable}
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-line bg-bg/70">
          <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-1.5 font-mono text-micro text-muted/70">
            <span>stdout</span>
            <span>{snapshot.logs.length} строк</span>
          </div>
          <div
            aria-label="Консоль симуляции"
            className="scroll-area min-h-[150px] max-h-[230px] overflow-y-auto px-3 py-2 font-mono text-micro leading-relaxed"
            ref={consoleRef}
            role="log"
            tabIndex={0}
          >
            {snapshot.logs.length === 0 ? (
              <p className="text-muted/70">
                $ нажмите «Запустить симуляцию» — шаги пойдут по реальному
                пайплайну initial-load
              </p>
            ) : (
              snapshot.logs.map((log) => (
                <p className="flex gap-2" key={log.id}>
                  <span className="shrink-0 text-muted/70">
                    [{formatElapsed(log.atMs)}]
                  </span>{' '}
                  <span className={LOG_COLOR[log.level]}>
                    {log.message}
                  </span>
                </p>
              ))
            )}
          </div>
        </div>

        {completed && snapshot.validationPassed ? (
          <div className="mt-3 flex items-start gap-2.5 rounded-md border border-ok/30 bg-ok/5 px-3 py-2.5">
            <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-ok" />
            <div>
              <p className="font-mono text-caption text-ok">
                VALIDATION PASSED
              </p>
              <p className="mt-0.5 text-micro leading-relaxed text-muted/80">
                Counts, агрегаты, nulls, orphan-FK и sequences совпали. Target
                готов к cutover.
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            className="cta-primary inline-flex h-9 items-center gap-2 rounded-md px-3.5 text-xs font-semibold text-white transition hover:brightness-110"
            onClick={handlePrimary}
            type="button"
          >
            {running ? (
              <Pause aria-hidden="true" className="h-3.5 w-3.5" />
            ) : (
              <Play aria-hidden="true" className="h-3.5 w-3.5" />
            )}
            {primaryLabel}
          </button>
          <button
            aria-label="Сбросить симуляцию"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line bg-surface/60 text-muted transition-colors hover:border-electric/40 hover:text-text disabled:cursor-not-allowed disabled:opacity-40"
            disabled={snapshot.status === 'idle'}
            onClick={reset}
            title="Сбросить"
            type="button"
          >
            <RotateCcw aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
          <div
            aria-label="Скорость симуляции"
            className="ml-auto inline-flex items-center gap-1 rounded-md border border-line bg-surface/50 p-0.5"
            role="group"
          >
            {SPEEDS.map((speed) => (
              <button
                aria-pressed={snapshot.speed === speed}
                className={cn(
                  'rounded px-2 py-1 font-mono text-micro transition-colors',
                  snapshot.speed === speed
                    ? 'bg-surface-2 text-text'
                    : 'text-muted hover:text-text',
                )}
                key={speed}
                onClick={() => setSpeed(speed)}
                type="button"
              >
                {speed}x
              </button>
            ))}
          </div>
        </div>

        <p className="mt-3 font-mono text-micro leading-relaxed text-muted/70">
          демо-набор: {formatCount(snapshot.totalRows)} строк · реальный job с
          phase/table/ETA подключается в LIVE
        </p>
      </div>
    </div>
  );
}
